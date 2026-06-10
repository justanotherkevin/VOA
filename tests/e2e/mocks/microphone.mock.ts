/**
 * Microphone Mock for E2E Tests
 *
 * Prevents accidental microphone access in tests that don't explicitly need it.
 * This ensures tests don't fail due to microphone permission issues or hardware conflicts.
 *
 * Usage in tests:
 *   import { setupMicrophoneMock } from './mocks/microphone.mock';
 *
 *   test.beforeEach(() => {
 *     setupMicrophoneMock();
 *   });
 */

/**
 * Mock implementation of MediaRecorder
 */
class MockMediaRecorder implements Partial<MediaRecorder> {
  public state: MediaRecorderState = 'inactive';
  public stream: MediaStream;
  public mimeType: string = 'audio/webm';

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
  }

  start(): void {
    this.state = 'recording';
  }

  pause(): void {
    this.state = 'paused';
  }

  resume(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.dispatchEvent(new Event('stop'));
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    // Mock event listener registration
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    // Mock event listener removal
  }

  dispatchEvent(event: Event): boolean {
    return true;
  }

  ondataavailable: ((this: MediaRecorder, ev: BlobEvent) => any) | null = null;
  onerror: ((this: MediaRecorder, ev: ErrorEvent) => any) | null = null;
  onpause: ((this: MediaRecorder, ev: Event) => any) | null = null;
  onresume: ((this: MediaRecorder, ev: Event) => any) | null = null;
  onstart: ((this: MediaRecorder, ev: Event) => any) | null = null;
  onstop: ((this: MediaRecorder, ev: Event) => any) | null = null;
}

/**
 * Mock implementation of MediaStream
 */
class MockMediaStream implements Partial<MediaStream> {
  public id: string = 'mock-stream-' + Math.random().toString(36).substr(2, 9);
  public active: boolean = true;
  public onaddtrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => any) | null = null;
  public onremovetrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => any) | null = null;

  getTracks(): MediaStreamTrack[] {
    return [];
  }

  getAudioTracks(): MediaStreamAudioTrack[] {
    return [];
  }

  getVideoTracks(): MediaStreamVideoTrack[] {
    return [];
  }

  addTrack(track: MediaStreamTrack): void {}

  removeTrack(track: MediaStreamTrack): void {}

  clone(): MediaStream {
    return new MockMediaStream() as any;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {}

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {}

  dispatchEvent(event: Event): boolean {
    return true;
  }
}

/**
 * Setup microphone mocking for E2E tests
 * Call this in your test's beforeEach hook
 */
export function setupMicrophoneMock(): void {
  // Mock getUserMedia to return a fake stream
  if (navigator && !navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {},
      writable: true,
      configurable: true,
    });
  }

  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async (
      constraints?: MediaStreamConstraints
    ): Promise<MediaStream> => {
      return new MockMediaStream() as any;
    };
  }

  // Mock window.MediaRecorder
  if (typeof window !== 'undefined') {
    (window as any).MediaRecorder = MockMediaRecorder;
  }

  // Mock AudioContext
  if (typeof window !== 'undefined' && !window.AudioContext) {
    (window as any).AudioContext = class MockAudioContext {
      createMediaStreamSource(stream: MediaStream) {
        return {};
      }
    };
  }
}

/**
 * Cleanup microphone mocks
 * Call this in your test's afterEach hook if needed
 */
export function cleanupMicrophoneMock(): void {
  // Optional: restore original implementations if needed
  // For now, mocks persist for test duration which is fine
}
