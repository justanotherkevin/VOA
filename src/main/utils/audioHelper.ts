import { ipcRenderer } from 'electron';
import { withTimeout } from './common';

export interface ChunkRecorderState {
  active: boolean;
  stream: MediaStream | null;
  chunks: Blob[];
  chunkStart: number;
  recorder: MediaRecorder | null;
}

function startAudioChunk(
  state: ChunkRecorderState,
  mimeType: string,
  intervalMs: number,
  onChunk: (audio: number[], start: number, end: number) => void,
): void {
  if (!state.active || !state.stream) return;
  state.chunks = [];
  state.chunkStart = Date.now();
  state.recorder = new MediaRecorder(state.stream, { mimeType } as MediaRecorderOptions);
  state.recorder.addEventListener('dataavailable', (e: BlobEvent) => {
    if (e.data && e.data.size > 0) state.chunks.push(e.data);
  });
  state.recorder.addEventListener('stop', () => {
    const blobs = [...state.chunks];
    const start = state.chunkStart;
    const end = Date.now();
    decodeAndSendChunk(blobs, mimeType, start, end, onChunk);
    if (state.active) startAudioChunk(state, mimeType, intervalMs, onChunk);
  });
  state.recorder.start();
  setTimeout(() => {
    if (state.recorder?.state === 'recording') state.recorder.stop();
  }, intervalMs);
}

const CHUNK_INTERVAL_MS = 3000;

/**
 * Starts chunk-based recording on the given stream. Returns a stop function
 * that halts recording and releases all resources.
 */
export function startChunkRecorder(
  stream: MediaStream,
  mimeType: string,
  onChunk: (audio: number[], startedAt: number, endedAt: number) => void,
): () => void {
  const state: ChunkRecorderState = {
    active: true,
    stream,
    chunks: [],
    chunkStart: Date.now(),
    recorder: null,
  };

  startAudioChunk(state, mimeType, CHUNK_INTERVAL_MS, onChunk);

  return () => {
    state.active = false;
    if (state.recorder?.state === 'recording') state.recorder.stop();
    state.stream?.getTracks().forEach((t) => t.stop());
    state.stream = null;
    state.recorder = null;
  };
}

export function mixStereoToMono(buffer: AudioBuffer): Float32Array {
  const SCALING_FACTOR = Math.sqrt(2);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    mono[i] = (SCALING_FACTOR * (left[i] + right[i])) / 2;
  }
  return mono;
}
export async function acquireSystemAudioStream(): Promise<MediaStream | null> {
  if (process.platform === 'darwin') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loopback = require('electron-audio-loopback');
    const { getLoopbackAudioMediaStream } = loopback;
    if (typeof getLoopbackAudioMediaStream !== 'function') return null;
    return withTimeout(5000, getLoopbackAudioMediaStream());
  }
  if (process.platform === 'win32') {
    const source = await ipcRenderer.invoke('system-audio:get-desktop-source');
    if (!source?.id) return null;
    const raw = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'desktop' } } as any,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
        },
      } as any,
    });
    raw.getVideoTracks().forEach((t) => t.stop());
    return new MediaStream(raw.getAudioTracks());
  }
  return null;
}
export async function decodeAndSendChunk(
  blobs: Blob[],
  mimeType: string,
  startedAt: number,
  endedAt: number,
  onChunk: (audio: number[], start: number, end: number) => void,
): Promise<void> {
  if (!blobs.length) return;
  try {
    const blob = new Blob(blobs, { type: mimeType });
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);

    const SAMPLE_RATE = 16000;
    let mono: Float32Array;
    if (decoded.sampleRate !== SAMPLE_RATE) {
      const offlineCtx = new OfflineAudioContext(
        decoded.numberOfChannels,
        Math.ceil(decoded.duration * SAMPLE_RATE),
        SAMPLE_RATE,
      );
      const src = offlineCtx.createBufferSource();
      src.buffer = decoded;
      src.connect(offlineCtx.destination);
      src.start(0);
      const resampled = await offlineCtx.startRendering();
      mono =
        resampled.numberOfChannels === 2
          ? mixStereoToMono(resampled)
          : resampled.getChannelData(0);
    } else {
      mono =
        decoded.numberOfChannels === 2
          ? mixStereoToMono(decoded)
          : decoded.getChannelData(0);
    }

    await audioCtx.close();
    onChunk(Array.from(mono), startedAt, endedAt);
  } catch (err) {
    console.error('[preload] system audio decode failed:', err);
  }
}
