/**
 * Utility for setting up and managing transcriber IPC event listeners
 * Consolidates subscription logic to reduce code duplication and improve maintainability
 */

import type { TranscriberData } from '@/renderer/hooks/useTranscriber';

interface TranscriberCallbacks {
  onProgress?: (message: any) => void;
  onUpdate?: (data: TranscriberData) => void;
  onComplete?: (data: TranscriberData) => void;
  onInitiate?: (message: any) => void;
  onReady?: () => void;
  onError?: (message: any) => void;
  onDone?: (message: any) => void;
}

/**
 * Set up all transcriber IPC listeners
 * Returns an array of unsubscribe functions for cleanup
 */
export function setupTranscriberListeners(
  callbacks: TranscriberCallbacks,
): Array<() => void> {
  const unsubscribers: Array<() => void> = [];

  // Progress listener - model download/load
  if (callbacks.onProgress) {
    unsubscribers.push(
      window.electronAPI.transcriber.on.progress(callbacks.onProgress),
    );
  }

  // Update listener - partial ASR results
  if (callbacks.onUpdate) {
    unsubscribers.push(
      window.electronAPI.transcriber.on.update(async (message: any) => {
        const updateMessage = message as any;
        callbacks.onUpdate?.({
          isBusy: true,
          text: updateMessage.data[0],
          chunks: updateMessage.data[1].chunks,
        });
      }),
    );
  }

  // Complete listener - final transcript
  if (callbacks.onComplete) {
    unsubscribers.push(
      window.electronAPI.transcriber.on.complete(async (message: any) => {
        const completeMessage = message as any;
        callbacks.onComplete?.({
          isBusy: false,
          text: completeMessage.data.text,
          chunks: completeMessage.data.chunks,
        });
      }),
    );
  }

  // Initiate listener - model load start
  if (callbacks.onInitiate) {
    unsubscribers.push(
      window.electronAPI.transcriber.on.initiate(callbacks.onInitiate),
    );
  }

  // Ready listener - model ready
  if (callbacks.onReady) {
    unsubscribers.push(window.electronAPI.transcriber.on.ready(callbacks.onReady));
  }

  // Error listener
  if (callbacks.onError) {
    unsubscribers.push(window.electronAPI.transcriber.on.error(callbacks.onError));
  }

  // Done listener - file loaded
  if (callbacks.onDone) {
    unsubscribers.push(window.electronAPI.transcriber.on.done(callbacks.onDone));
  }

  return unsubscribers;
}

/**
 * Clean up all transcriber listeners
 */
export function cleanupTranscriberListeners(
  unsubscribers: Array<() => void>,
): void {
  unsubscribers.forEach((unsub) => {
    try {
      unsub();
    } catch (e) {
      // Ignore cleanup errors
    }
  });
}
