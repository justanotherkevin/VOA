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

export interface CalendarParticipant {
  name: string | null;
  email: string | null;
}

export interface CalendarEventMatch {
  id: string;
  title: string;
  participants: CalendarParticipant[];
  overlapMs: number;
}

export interface CalendarProvider {
  // Finds all calendar events overlapping a buffer window around `atTime`
  // (epoch ms), sorted by overlap descending (best match first). [] if none
  // — never throws for a "no match" case, only for real failures
  // (unreachable feed, parse error) so callers can distinguish the two.
  findMatchingEvents(atTime: number): Promise<CalendarEventMatch[]>;
}
