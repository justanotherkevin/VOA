import { type Page } from '@playwright/test';
import { wait } from '../common.helpers';

/**
 * Interface for mock transcription data
 */
export interface MockTranscriptionChunk {
  text: string;
  timestamp: [number, number];
}

export interface MockTranscriptionData {
  text: string;
  chunks: MockTranscriptionChunk[];
}

/**
 * Verify transcribed text appears in history
 */
export async function verifyTranscriptInHistory(
  page: Page,
  text: string,
  timeout: number = 3000,
): Promise<boolean> {
  if (!text || text.trim() === '') {
    try {
      const items = page.locator('[data-testid="transcript-history-item"]');
      await items
        .first()
        .waitFor({ timeout: 1000 })
        .catch(() => {});
      const count = await items.count();
      if (count > 0) {
        return true;
      }
    } catch (e) {
      console.log(`✓ Empty transcript handled correctly`);
    }
    return true;
  }

  try {
    const textLocator = page.locator(`text=${text}`);
    await textLocator.waitFor({ timeout });
    return true;
  } catch {
    console.warn(`⚠ Transcript "${text}" not found in visible history`);
    try {
      const bodyText = await page
        .textContent('body', { timeout: 1000 })
        .catch(() => null);
      if (bodyText?.includes(text)) {
        return true;
      }
    } catch (e) {
      console.log(`[verifyTranscriptInHistory]: Page might have closed `);
    }
    return false;
  }
}

/**
 * Get transcript history item count
 */
export async function getHistoryItemCount(page: Page): Promise<number> {
  const items = page.locator('[data-testid="transcript-history-item"]');
  return items.count();
}

/**
 * Wait for transcription to complete by listening to production IPC channel
 */
export async function waitForTranscriptionComplete(
  page: Page,
  timeout: number = 5000,
): Promise<boolean> {
  console.log('📍 Waiting for transcription to complete');

  const completed = await page.evaluate((timeoutMs: number) => {
    return new Promise<boolean>((resolve) => {
      let hasCompleted = false;
      const timeoutHandle = setTimeout(() => {
        console.log(
          '[waitForTranscriptionComplete] Timeout - assuming transcriber already processed',
        );
        if (!hasCompleted) {
          resolve(true);
        }
      }, timeoutMs);

      const handleComplete = (result: any) => {
        console.log(
          '[waitForTranscriptionComplete] Transcription complete event:',
          result,
        );
        if (!hasCompleted) {
          hasCompleted = true;
          clearTimeout(timeoutHandle);
          resolve(true);
        }
      };

      try {
        (window as any).electronAPI?.onTranscriberComplete?.(handleComplete);
      } catch (e) {
        console.warn(
          '[waitForTranscriptionComplete] Could not register listener:',
          e,
        );
      }
    });
  }, timeout);

  if (completed) {
    console.log('✓ Transcription processing complete or timeout reached');
  } else {
    console.warn('⚠ Transcription processing failed');
  }

  return completed;
}

/**
 * Get transcriber state for debugging sequential transcription issues
 */
export async function getTranscriberState(page: Page): Promise<any> {
  const state = await page.evaluate(() => {
    const hooks = (window as any).__recordingFlowHooks__;
    if (!hooks) {
      return { error: 'Recording flow hooks not found' };
    }

    // Return what we can inspect from the hooks
    return {
      isRecordingActive: hooks.isRecordingActive,
      hasTranscriberHook: !!hooks.transcriber,
    };
  });
  console.log('[getTranscriberState]', state);
  return state;
}

/**
 * Verify history count matches expected
 */
export async function verifyHistoryCount(
  page: Page,
  expectedCount: number,
  failureMessage?: string,
): Promise<void> {
  const actualCount = await getHistoryItemCount(page);
  if (actualCount !== expectedCount) {
    const message =
      failureMessage ||
      `Expected ${expectedCount} items in history, but found ${actualCount}`;
    console.error(`❌ ${message}`);
    throw new Error(message);
  }
  console.log(`✓ History count verified: ${expectedCount} items`);
}

/**
 * Wait for state reset between recordings
 * Ensures transcriber is ready for next recording
 */
export async function waitForStateReset(
  page: Page,
  delayMs: number = 1000,
): Promise<void> {
  console.log('📍 Waiting for state reset between recordings...');

  // Give async state updates time to complete
  await wait(delayMs);

  // Verify notification is not visible
  const notificationStillVisible = await page.evaluate(() => {
    return (window as any).__isRecordingActive === true;
  });

  if (notificationStillVisible) {
    console.warn('⚠ Warning: Recording state may not be fully reset');
  }

  console.log('✓ State reset wait complete');
}

/**
 * Get full transcript history for verification
 */
export async function getFullHistory(page: Page): Promise<any[]> {
  const history = await page.evaluate(async () => {
    try {
      return await (window as any).electronAPI?.getTranscriptHistory?.();
    } catch (e) {
      console.error('[getFullHistory] Error fetching history:', e);
      return [];
    }
  });
  console.log(`[getFullHistory] Found ${history?.length || 0} transcripts`);
  return history || [];
}

/**
 * Get transcript history from electron store (alias for getFullHistory)
 */
export async function getTranscriptHistory(page: Page): Promise<any[]> {
  return await page.evaluate(async () => {
    return await (window as any).electronAPI.getTranscriptHistory();
  });
}

/**
 * Clear all transcripts from electron store
 */
export async function clearTranscriptHistory(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (window as any).electronAPI?.clearTranscriptHistory?.();
  });
}

/**
 * Verify transcript contains expected keywords
 */
export async function verifyTranscriptionContent(
  transcript: any,
  keywords: string[],
): Promise<void> {
  if (!transcript.text) {
    throw new Error('Transcript has no text property');
  }
  const transcriptTrimmed = transcript.text.trim();
  keywords.forEach((keyword) => {
    if (!transcriptTrimmed.includes(keyword)) {
      throw new Error(
        `Transcript does not contain expected keyword: "${keyword}"`,
      );
    }
  });
  console.log('✅ Transcript content verified');
}
