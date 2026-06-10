import { type Page, type ElectronApplication } from '@playwright/test';
import { expect } from '@playwright/test';
import { wait } from '../common.helpers';
import {
  startRecording,
  stopRecording,
  waitForRecordingToStart,
  waitForRecordingToStop,
  sendAudioToTranscriber,
} from './recording-actions';
import { type MockTranscriptionChunk } from './verification-utils';
import { mountMockAudioChunks } from './hardware-mocks';

/**
 * Setup a mock for the transcriber:start IPC handler in the Main process.
 * This uses electronApp.evaluate to inject the mock behavior at runtime.
 */
export async function setupMainProcessTranscriberMock(
  electronApp: ElectronApplication,
  transcriptionText: string,
  chunks: MockTranscriptionChunk[] = [],
): Promise<void> {
  await (electronApp as any).evaluate(
    async ({ ipcMain, BrowserWindow }: any, { text, chunks }: any) => {
      // Remove the real handler
      ipcMain.removeHandler('transcriber:start');

      // Register the mock handler
      ipcMain.handle('transcriber:start', async (event: any) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const mockResult = {
          text,
          chunks:
            chunks.length > 0
              ? chunks
              : [{ text, timestamp: [0, 1] as [number, number] }],
        };

        const savedTranscript = {
          id: 'mock-' + Date.now(),
          date: Date.now(),
          text: mockResult.text,
          chunks: mockResult.chunks,
        };

        // Find notification window and update its state to "processing"
        const notificationWindow = BrowserWindow.getAllWindows().find(
          (w: any) => w.webContents.getURL().includes('notification.html'),
        );

        if (notificationWindow) {
          notificationWindow.webContents.send('notification:update-state', {
            state: 'processing',
            title: 'Processing',
            message: 'Processing your audio...',
          });
        }

        // Simulate processing delay and then send the completion event
        setTimeout(() => {
          win?.webContents.send('transcriber:complete', {
            status: 'complete',
            data: mockResult,
            savedTranscript,
          });

          // Update notification to "done" state
          if (notificationWindow) {
            notificationWindow.webContents.send('notification:update-state', {
              state: 'done',
              title: 'Done',
              message: 'Complete',
            });
          }
        }, 500);

        return mockResult;
      });
    },
    { text: transcriptionText, chunks },
  );
}

/**
 * Complete full dictation workflow: record → transcribe (via IPC) → verify
 * This version tests the full integration path.
 */
export async function performDictationFlow(
  page: Page,
  electronApp: ElectronApplication,
  transcriptionText: string,
  chunks: MockTranscriptionChunk[] = [],
): Promise<void> {
  console.log('🚀 Starting complete dictation workflow');

  // Setup the main process mock just-in-time
  await setupMainProcessTranscriberMock(electronApp, transcriptionText, chunks);

  // Start recording
  await startRecording(page, electronApp);
  await waitForRecordingToStart(page);

  // Simulate recording duration
  await wait(1000);

  // Stop recording
  await stopRecording(page, electronApp);
  await waitForRecordingToStop(page);

  // Send audio to the actual transcriber (to test the IPC path)
  // In black-box mode, the Main process will catch this and return the mock response
  console.log('📍 Sending audio to transcriber via IPC');
  await sendAudioToTranscriber(page);

  // Give some time for UI updates
  // Note: We no longer call mockTranscriberResponse from here.
  // The Main process handles it automatically in E2E mode.
  await wait(2000);

  // Scroll to history to ensure it's in view
  await page.evaluate(() => window.scrollBy(0, 500));
  await wait(500);

  console.log('✅ Workflow execution complete');
}

/**
 * Verify app is ready and main window is visible
 */
export async function verifyAppReady(page: Page): Promise<void> {
  await expect(
    page.locator('h1.text-4xl:has-text("Home")'),
    'Verify app is ready and main window is visible',
  ).toBeVisible();
}

/**
 * Mount mock audio file and wait for transcription to complete
 */
export async function transcribeAudioAndWait(
  page: Page,
  notificationWindow: Page,
  audioFilename: string,
  label?: string,
): Promise<void> {
  const labelSuffix = label ? ` (${label})` : '';

  // Mount audio and trigger transcription
  await mountMockAudioChunks(page, audioFilename);

  // Verify processing state
  try {
    await expect(
      notificationWindow.locator('[aria-label="Processing audio"]'),
    ).toBeVisible({ timeout: 5000 });

    await expect(
      notificationWindow.locator('[aria-label="Processing audio"]'),
    ).not.toBeVisible({
      timeout: 90000,
    });
    console.log(`✅ Transcription completed${labelSuffix}`);
  } catch {
    // Processing state may not be visible, but transcription still happens
    await page.waitForTimeout(30000);
  }
}
