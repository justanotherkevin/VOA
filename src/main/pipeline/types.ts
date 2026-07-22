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

  // Number of jobs currently queued or in flight, if this transcriber
  // implementation serializes work through a queue. Optional since not
  // every AsrTranscriber implementation (e.g. a future Parakeet backend)
  // needs to support it.
  getQueueDepth?(): number;
}
