import { type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Setup audio mocking in the renderer process
 * Mocks MediaRecorder, getUserMedia, and MediaStream to prevent actual hardware access
 */
export async function setupAudioMocking(page: Page): Promise<void> {
  const setupFn = () => {
    // --- Mock AudioContext ---
    const mockAudioBuffer = {
      sampleRate: 16000,
      length: 16000,
      duration: 1.0,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(16000),
    };

    class MockAudioContext {
      decodeAudioData() {
        return Promise.resolve(mockAudioBuffer);
      }
      close() {
        return Promise.resolve();
      }
      createBufferSource() {
        return {
          buffer: null,
          connect: () => {},
          start: () => {},
        };
      }
    }
    (window as any).AudioContext = MockAudioContext;
    (window as any).OfflineAudioContext = MockAudioContext;

    // --- Mock MediaRecorder ---
    class MockMediaRecorder {
      stream: MediaStream;
      mimeType: string = 'audio/webm;codecs=opus';
      state: 'inactive' | 'recording' | 'paused' = 'inactive';
      private _eventListeners: Map<string, Function[]> = new Map();

      static isTypeSupported(type: string): boolean {
        return true;
      }

      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        this.stream = stream;
        if (options?.mimeType) {
          this.mimeType = options.mimeType;
        }
      }

      start(): void {
        this.state = 'recording';
        this._dispatchEvent('start', new Event('start'));
      }

      stop(): void {
        this.state = 'inactive';
        const mockBlob = new Blob(['mock audio data'], { type: this.mimeType });
        const event = new Event('dataavailable') as any;
        event.data = mockBlob;
        this._dispatchEvent('dataavailable', event);
        this._dispatchEvent('stop', new Event('stop'));
      }

      pause(): void {
        this.state = 'paused';
      }

      resume(): void {
        this.state = 'recording';
      }

      addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ): void {
        if (!this._eventListeners.has(type)) {
          this._eventListeners.set(type, []);
        }
        if (typeof listener === 'function') {
          this._eventListeners.get(type)!.push(listener);
        }
      }

      removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
      ): void {
        if (!this._eventListeners.has(type)) return;
        const listeners = this._eventListeners.get(type);
        if (listeners && typeof listener === 'function') {
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      }

      dispatchEvent(event: Event): boolean {
        return true;
      }

      private _dispatchEvent(type: string, event: any): void {
        const listeners = this._eventListeners.get(type) || [];
        listeners.forEach((listener) => {
          if (typeof listener === 'function') {
            listener(event);
          }
        });
      }

      ondataavailable: ((this: MediaRecorder, ev: BlobEvent) => any) | null =
        null;
      onerror: ((this: MediaRecorder, ev: ErrorEvent) => any) | null = null;
      onpause: ((this: MediaRecorder, ev: any) => any) | null = null;
      onresume: ((this: MediaRecorder, ev: any) => any) | null = null;
      onstart: ((this: MediaRecorder, ev: any) => any) | null = null;
      onstop: ((this: MediaRecorder, ev: any) => any) | null = null;
    }

    (window as any).MediaRecorder = MockMediaRecorder;

    // --- Mock getUserMedia ---
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
        configurable: true,
      });
    }

    navigator.mediaDevices.getUserMedia = async (): Promise<MediaStream> => {
      return new (window as any).MediaStream() as MediaStream;
    };

    // --- Mock MediaStream ---
    if (!(window as any).MediaStream) {
      (window as any).MediaStream = class MockMediaStream {
        id = 'mock-stream-' + Math.random();
        active = true;
        getTracks() {
          return [];
        }
        getAudioTracks() {
          return [];
        }
        getVideoTracks() {
          return [];
        }
        addEventListener() {}
        removeEventListener() {}
      };
    }
  };

  // Run immediately on current page
  await page.evaluate(setupFn);

  // Also register for any reloads
  await page.addInitScript(setupFn);
}

/**
 * Mount mock audio chunks to trigger transcription workflow
 */
export async function mountMockAudioChunks(
  electronPage: Page,
  audioFilename: string = 'fairy-tails-story.mp3',
): Promise<void> {
  const audioFilePath = path.join(__dirname, '../../mocks', audioFilename);
  const audioFileBuffer = await fs.promises.readFile(audioFilePath);

  const setRecordingHook = await electronPage.evaluate(
    async (audioData: { bytes: number[] }) => {
      const uint8Array = new Uint8Array(audioData.bytes);
      const mockBlob = new Blob([uint8Array], { type: 'audio/mpeg' });

      // Access the recording complete handler from useRecordingFlow
      const hooks = (window as any).__recordingFlowHooks__;
      if (hooks && hooks.triggerRecordingComplete) {
        await hooks.triggerRecordingComplete(
          [mockBlob], // chunks array
          'audio/mpeg', // mimeType
          Date.now() - 500, // startTime (simulated 2.5s recording)
        );
        console.log('[Test] Mock audio processing triggered');
        return { success: true };
      } else {
        console.error('[Test] Recording flow hooks not found on window');
        return { success: false, error: 'Hooks not available' };
      }
    },
    { bytes: Array.from(audioFileBuffer) },
  );
  if (!setRecordingHook.success) {
    throw new Error(
      `Failed to trigger mock audio processing: ${setRecordingHook.error}`,
    );
  }
}
