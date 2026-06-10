export interface TranscriptionChunk {
  timestamp: [number, number];
  text: string;
}

export interface TranscriptionResult {
  chunks: TranscriptionChunk[];
  duration_in_seconds: number;
}

export interface TranscriberOptions {
  vadThreshold?: number;
}

export interface AsrTranscriber {
  initialize(
    model: string,
    quantized: boolean,
    progressCallback?: (data: any) => void,
  ): Promise<void>;

  transcribe(
    audioBuffer: Float32Array,
    subtask: string,
  ): Promise<TranscriptionResult>;

  dispose(): Promise<void>;

  getModelInfo(): {
    model: string | null;
    quantized: boolean | null;
    isInitialized: boolean;
  };
}
