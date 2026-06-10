import {
  acquireSystemAudioStream,
  startChunkRecorder,
} from '../utils/audioHelper';

/*
  System Audio Capture
  MediaStream cannot cross contextBridge — all recording logic stays in preload,
  decoded audio chunks (number[]) are passed back to the renderer via onChunk callback.
  The architecture is a necessary compromise, not a mistake.
  Why it can't move to the main process via IPC:

  The recording pipeline requires browser APIs (MediaRecorder, AudioContext, OfflineAudioContext) that simply don't exist in Node.js. The main process can't run new
  MediaRecorder(...) or new AudioContext().

  Why it can't move to the renderer either:

  On macOS, electron-audio-loopback is a native Node.js module — it needs require(). The renderer runs in a sandboxed browser context with no access to require. The MediaStream
   it returns also can't cross contextBridge (non-serializable).

  So preload is the only execution context that has both:
  - require() / Node.js access → for electron-audio-loopback
  - Browser APIs → for MediaRecorder and AudioContext
*/

let systemAudioStopHandle: (() => void) | null = null;

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
      return true;
    } catch (err) {
      console.error('[preload] startSystemAudio failed:', err);
      return false;
    }
  },

  stopSystemAudio: (): void => {
    systemAudioStopHandle?.();
    systemAudioStopHandle = null;
  },
};
