/*
 * src/__mocks__/RecordingUtils.js
 *
 * Vitest module mock for ../renderer/utils/RecordingUtils
 * Exposes a lightweight finalizeRecordingAndTranscribe implementation
 * used by integration tests to avoid heavy AudioContext/Blob decoding.
 */

import { vi } from 'vitest';

// Import actual module - Vitest will handle the mock override
const actual = await vi.importActual('../renderer/utils/RecordingUtils');

export const getSupportedMimeType = actual.getSupportedMimeType;
export const getSupportedFileExtension = actual.getSupportedFileExtension;

export const finalizeRecordingAndTranscribe = async (options) => {
  const { setRecordedBlob, setAudioUrl, transcriber } = options;
  const fakeBlob = new Blob(['fake-audio'], { type: 'audio/webm' });
  setRecordedBlob(fakeBlob);
  setAudioUrl('blob:fake/0');

  // Minimal fake AudioBuffer-like object for transcriber.start
  const fakeAudioBuffer = {
    numberOfChannels: 1,
    length: 1,
    sampleRate: 44100,
    getChannelData: () => new Float32Array([0]),
  };

  // Simulate calling transcriber.start so callers can await the flow
  await transcriber.start(fakeAudioBuffer);
};
