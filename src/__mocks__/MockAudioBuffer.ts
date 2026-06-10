/**
 * Lightweight mock for AudioBuffer used in tests.
 * Exported as a factory to avoid class-methods-use-this lint rule.
 */
export default function createMockAudioBuffer() {
  return {
    numberOfChannels: 1,
    length: 1,
    sampleRate: 44100,
    getChannelData: () => new Float32Array([0]),
  } as unknown as AudioBuffer;
}
