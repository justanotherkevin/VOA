import { ipcRenderer } from 'electron';
import {
  acquireSystemAudioStream,
  startChunkRecorder,
} from '../utils/audioHelper';
import { CHANNELS } from '@/lib/ipc-channels';

/*
  System Audio Capture
  MediaStream cannot cross contextBridge — all recording logic stays in preload,
  decoded audio chunks (number[]) are passed back to the renderer via onChunk callback.
  The architecture is a necessary compromise, not a mistake.
  Why it can't move to the main process via IPC:

  The recording pipeline requires browser APIs (MediaRecorder, AudioContext, OfflineAudioContext) that simply don't exist in Node.js. The main process can't run new
  MediaRecorder(...) or new AudioContext().

  Why it can't move to the renderer either:

  On macOS, system audio comes from getDisplayMedia plus IPC calls to the main process (the electron-audio-loopback handlers). The MediaStream it returns can't cross
  contextBridge (non-serializable), so it has to be consumed where it is created.

  So preload is the only execution context that has both:
  - ipcRenderer → to enable and disable loopback audio in the main process
  - Browser APIs → for getDisplayMedia, MediaRecorder and AudioContext

  Windows are sandboxed, so preload can't require() the electron-audio-loopback package. Its small renderer logic is inlined in utils/audioHelper.ts instead.
*/

let systemAudioStopHandle: (() => void) | null = null;

// Levels for the notification window's "System" waveform are metered off
// this same stream/AnalyserNode (not a second acquireSystemAudioStream()
// call) and forwarded over IPC — see ipc/notifications.ts's relay. A second
// concurrent loopback capture used to be tried here, but on macOS
// electron-audio-loopback taps a single OS-level audio source, so a second
// tap starved this real capture of audio (meetings transcribing to a bare
// "[ Pause ]" token instead of real speech).
let meterContext: AudioContext | null = null;
let meterAnalyser: AnalyserNode | null = null;
let meterRafId: number | null = null;

export const audioAPI = {
  startSystemAudio: async (
    onChunk: (audio: number[], startedAt: number, endedAt: number) => void,
  ): Promise<boolean> => {
    try {
      const stream = await acquireSystemAudioStream();
      if (!stream) return false;

      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!mimeType) return false;

      systemAudioStopHandle = startChunkRecorder(stream, mimeType, onChunk);

      meterContext = new AudioContext();
      meterAnalyser = meterContext.createAnalyser();
      meterAnalyser.fftSize = 256;
      meterAnalyser.smoothingTimeConstant = 0.8;
      meterContext.createMediaStreamSource(stream).connect(meterAnalyser);

      const tick = () => {
        if (!meterAnalyser) return;
        const data = new Uint8Array(meterAnalyser.frequencyBinCount);
        meterAnalyser.getByteFrequencyData(data);
        ipcRenderer.send(CHANNELS.SYSTEM_AUDIO.LEVELS, Array.from(data));
        meterRafId = requestAnimationFrame(tick);
      };
      tick();

      return true;
    } catch (err) {
      console.error('[preload] startSystemAudio failed:', err);
      return false;
    }
  },

  stopSystemAudio: (): void => {
    systemAudioStopHandle?.();
    systemAudioStopHandle = null;
    if (meterRafId !== null) cancelAnimationFrame(meterRafId);
    meterRafId = null;
    meterAnalyser = null;
    if (meterContext && meterContext.state !== 'closed') {
      meterContext.close();
    }
    meterContext = null;
  },
};
