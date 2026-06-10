/**
 * Voice Activity Detection (VAD) configuration constants
 * Used by useAudioRecorder hook for MicVAD initialization and audio processing
 */

export const VAD_CONFIG = {
  // Audio sample rate (Hz) - standard for MicVAD
  SAMPLE_RATE: 16000,

  // Pause timeout (ms) - time to wait after speech end before flushing segment
  PAUSE_TIMEOUT_MS: 500,

  // CDN paths for WASM modules
  BASE_ASSET_PATH: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/',
  ONNX_WASM_BASE_PATH: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',

  // IPC channel name for transcription
  TRANSCRIBER_CHANNEL: 'transcriber:start',
} as const;
