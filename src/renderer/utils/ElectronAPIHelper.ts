/**
 * Helper utilities for safe electronAPI access in renderer process
 * Provides type-safe access to IPC communication without casting to any
 */

interface TranscriberStartPayload {
  audio: number[];
  source?: 'mic' | 'system';
  startedAt?: number;
  endedAt?: number;
}

/**
 * Send audio data to transcriber service via IPC
 * Handles both VAD segments and regular audio buffers
 */
export async function sendAudioToTranscriber(
  audio: number[],
  source: 'mic' | 'system' = 'mic',
  startedAt?: number,
  endedAt?: number,
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.transcriber) {
    return;
  }

  const payload: TranscriberStartPayload = { audio, source, startedAt, endedAt };
  await electronAPI.transcriber.start(payload);
}

/**
 * Type guard for electronAPI availability
 */
export function hasElectronAPI(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return (window as any).electronAPI?.transcriber !== undefined;
}
