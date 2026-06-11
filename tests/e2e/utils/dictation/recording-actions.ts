import type { Page, ElectronApplication } from '@playwright/test';
import { expect } from '@playwright/test';
import { BrowserWindow } from 'electron';
import { wait } from '../common.helpers';
import { forceMeetingNextSession } from '../seed.helpers';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Toggle recording using direct IPC event from Main process (E2E only);
 */
export async function toggleRecording(
  page: Page,
  electronApp: ElectronApplication,
): Promise<void> {
  await (electronApp as ElectronApplication).evaluate(
    ({ BrowserWindow }: any) => {
      const wins = BrowserWindow.getAllWindows();
      const mainWin = wins.find((w: BrowserWindow) =>
        w.webContents.getURL().includes('index.html'),
      );
      if (mainWin) {
        mainWin.webContents.send('recording:toggle');
      }
    },
  );
}

/**
 * Start recording via Main process interaction.
 * Pass `{ isMeeting: true }` to classify the session as a meeting recording
 * (sets the E2E force-meeting flag before the toggle so SESSION_START picks it up).
 */
export async function startRecording(
  page: Page,
  electronApp: ElectronApplication,
  options?: { isMeeting?: boolean },
): Promise<void> {
  if (options?.isMeeting) {
    await forceMeetingNextSession(page);
  }
  await wait(100);
  await toggleRecording(page, electronApp);
  await wait(500);
}

/**
 * Stop recording via Main process interaction
 */
export async function stopRecording(
  page: Page,
  electronApp: ElectronApplication,
): Promise<void> {
  await toggleRecording(page, electronApp);
  await wait(500);
}

/**
 * Wait for recording to start (status shows "Recording..." in notification window)
 */
export async function waitForRecordingToStart(
  notificationWindow: Page,
  timeout: number = 3000,
): Promise<void> {
  try {
    await notificationWindow
      .locator('text=Recording')
      .first()
      .waitFor({ timeout });
  } catch {
    console.warn('⚠ Recording status not detected in notification window');
  }
}

/**
 * Wait for recording to stop (status shows "Ready to record" in notification window)
 */
export async function waitForRecordingToStop(
  notificationWindow: Page,
  timeout: number = 3000,
): Promise<void> {
  try {
    await notificationWindow
      .locator('text=Ready to record')
      .first()
      .waitFor({ timeout });
  } catch {
    console.warn('⚠ Ready state not visible in notification window');
  }
}

/**
 * Load audio file and return base64 data URL for browser decoding
 * @param filename - Name of the audio file (e.g., 'fairy-tails-story.mp3')
 * @returns Base64 data URL
 */
export async function loadAudioFileAsDataUrl(
  filename: string,
): Promise<string> {
  const filePath = path.join(__dirname, '../../mocks', filename);
  const buffer = await fs.promises.readFile(filePath);

  // Read file and create a data URL for the browser to decode
  const base64 = buffer.toString('base64');
  const mimeType = filename.endsWith('.mp3')
    ? 'audio/mpeg'
    : filename.endsWith('.wav')
      ? 'audio/wav'
      : filename.endsWith('.webm')
        ? 'audio/webm'
        : 'audio/mpeg';
  const dataUrl = `data:${mimeType};base64,${base64}`;

  console.log(
    `[loadAudioFile] Loaded ${filename}, size: ${buffer.length} bytes`,
  );

  return dataUrl;
}

/**
 * Decode audio file using Web Audio API (runs in browser context)
 * This matches the real recording flow: decodeAudioBlob() → AudioBuffer → Float32Array
 * @param page - Playwright page object
 * @param filename - Name of the audio file
 * @returns Decoded audio samples as number array
 */
export async function loadAudioFile(
  filename: string,
  page: Page,
): Promise<number[]> {
  // Load file buffer
  const filePath = path.join(__dirname, '../../mocks', filename);
  const buffer = await fs.promises.readFile(filePath);

  // Convert to array for serialization to browser context
  const fileArray = Array.from(buffer);

  // Decode in browser context using Web Audio API (same as real recording)
  const audioData = await page.evaluate(
    async (data: { bytes: number[]; mimeType: string }) => {
      console.log('[Browser] Decoding audio file with Web Audio API...');

      // Create ArrayBuffer from bytes
      const uint8Array = new Uint8Array(data.bytes);
      const arrayBuffer = uint8Array.buffer;

      // Decode with Web Audio API (same as RecordingUtils.ts)
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      console.log(
        `[Browser] Decoded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels} channels`,
      );

      // Convert to mono Float32Array (same as useTranscriber.ts)
      let audio: Float32Array;
      if (audioBuffer.numberOfChannels === 2) {
        const SCALING_FACTOR = Math.sqrt(2);
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);

        audio = new Float32Array(left.length);
        for (let i = 0; i < audioBuffer.length; ++i) {
          audio[i] = (SCALING_FACTOR * (left[i] + right[i])) / 2;
        }
      } else {
        audio = audioBuffer.getChannelData(0);
      }

      await audioContext.close();

      // Return as plain array (IPC serialization)
      return Array.from(audio);
    },
    {
      bytes: fileArray,
      mimeType: filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav',
    },
  );

  console.log(
    `[loadAudioFile] Decoded ${audioData.length} samples (${(audioData.length / 16000).toFixed(2)}s at 16kHz)`,
  );

  return audioData;
}

/**
 * Generate mock audio data (Float32Array) for testing
 */
function generateMockAudioData(durationSeconds: number = 1): number[] {
  const sampleRate = 16000;
  const totalSamples = sampleRate * durationSeconds;
  const audioData: number[] = [];

  const frequency = 440;
  for (let i = 0; i < totalSamples; i++) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    const noise = (Math.random() - 0.5) * 0.1;
    audioData.push((sample + noise) * 0.3);
  }

  return audioData;
}

/**
 * Send audio data to the transcriber via IPC
 * This triggers the actual transcriber service to process the audio.
 */
export async function sendAudioToTranscriber(
  page: Page,
  audioData?: number[],
): Promise<{ success: boolean; message?: string; result?: any }> {
  console.log('📍 Sending audio data to transcriber via IPC');

  const audio = audioData || generateMockAudioData(1);

  try {
    console.log(
      `[sendAudioToTranscriber] Sending ${audio.length} audio samples (${(audio.length / 16000).toFixed(2)}s)...`,
    );

    const result = await page.evaluate((audioArray) => {
      return (window as any).electronAPI.startTranscriber({
        audio: audioArray,
      });
    }, audio);

    console.log('[sendAudioToTranscriber] Transcriber response:', result);

    if (result && result.text !== undefined) {
      console.log(
        `[sendAudioToTranscriber] Got immediate result: "${result.text}"`,
      );
    }

    return { success: true, message: 'Audio sent to transcriber', result };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[sendAudioToTranscriber] Error:', errorMessage);
    return { success: false, message: errorMessage };
  }
}

/**
 * Toggle recording start and stop, with optional label for logging
 */
export async function recordAndWaitForCompletion(
  page: Page,
  electronApp: ElectronApplication,
  notificationWindow: Page,
  label?: string,
): Promise<void> {
  const labelSuffix = label ? ` (${label})` : '';

  // Start recording
  await toggleRecording(page, electronApp);
  await expect(notificationWindow.locator('text=recording')).toBeVisible();
  console.log(`✅ Recording started${labelSuffix}`);

  // Stop recording
  await toggleRecording(page, electronApp);
  await page.waitForTimeout(500);
  console.log(`✅ Recording stopped${labelSuffix}`);
}
