/* eslint-disable camelcase */
import { webmFixDuration } from './BlobFix';
import Constants from '../../lib/Constants';
import type { Transcriber } from '../hooks/useTranscriber';

export function getSupportedMimeType(): string | undefined {
  const types = [
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
    'audio/aac',
  ];

  // @ts-ignore
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }

  for (let i = 0; i < types.length; i += 1) {
    if (MediaRecorder.isTypeSupported(types[i])) {
      return types[i];
    }
  }
  return undefined;
}

export async function combineChunksToBlob(
  chunks: Blob[],
  mimeType: string | undefined,
  recordTimeMs: number,
): Promise<Blob> {
  let blob = new Blob(chunks, { type: mimeType });
  if (mimeType === 'audio/webm') {
    try {
      blob = await webmFixDuration(blob, recordTimeMs, blob.type);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('webmFixDuration failed', err);
    }
  }
  return blob;
}

export async function decodeAudioBlob(
  blob: Blob,
  sampleRate = Constants.SAMPLING_RATE,
): Promise<AudioBuffer> {
  // Decode at native sample rate first
  const audioCtx = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  // Resample to target sample rate if needed
  if (decoded.sampleRate !== sampleRate) {
    const offlineCtx = new OfflineAudioContext(
      decoded.numberOfChannels,
      Math.ceil(decoded.duration * sampleRate),
      sampleRate,
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0);
    const resampled = await offlineCtx.startRendering();

    await audioCtx.close();
    return resampled;
  }

  await audioCtx.close();
  return decoded;
}

export async function finalizeRecordingAndTranscribe(options: {
  chunks: Blob[];
  mimeType: string | undefined;
  startTime: number | null;
  setRecordedBlob: (b: Blob | null) => void;
  setAudioUrl: (u: string | null) => void;
  transcriber: Transcriber;
  onProcessing?: () => void;
}) {
  const {
    chunks,
    mimeType,
    startTime,
    setRecordedBlob,
    setAudioUrl,
    transcriber,
    onProcessing,
  } = options;

  const endedAt = Date.now();
  const recordTime = startTime ? endedAt - startTime : 0;
  const blob = await combineChunksToBlob(chunks, mimeType, recordTime);
  const url = URL.createObjectURL(blob);

  setRecordedBlob(blob);
  setAudioUrl(url);

  const decoded = await decodeAudioBlob(blob);

  onProcessing?.();

  await transcriber.start(decoded, startTime ?? undefined, endedAt);
}

export function stopMediaStream(stream: MediaStream | null) {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
}
