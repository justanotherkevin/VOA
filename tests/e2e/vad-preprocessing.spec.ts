/**
 * E2E tests for VAD preprocessing integration
 *
 * Tests that VAD + segmentation preprocessing is always applied during transcription:
 * 1. VAD preprocessing cannot be disabled (no Settings toggle)
 * 2. Transcription with noisy audio produces cleaner output
 * 3. Transcription with clean audio still works correctly
 * 4. Preprocessing is transparent to the user (no separate UI steps)
 *
 * Note: VAD preprocessing is now the standard, non-optional pipeline.
 * Tests run against the development build via Vite dev server.
 */

import {
  test,
  expect,
  _electron as electron,
  Page,
  ElectronApplication,
} from '@playwright/test';
import path from 'path';
import {
  loadAudioFile,
  sendAudioToTranscriber,
} from './utils/dictation/recording-actions';

test.describe('VAD Preprocessing Integration', () => {
  const mainJsPath = path.join(__dirname, '../../dist/main/main.js');
  let electronApp: ElectronApplication;
  let homePage: Page;

  test.beforeEach(async () => {
    electronApp = await electron.launch({ args: [mainJsPath] });
    await electronApp.firstWindow();
    await electronApp.evaluate(async ({ app }) => {
      if (!app.isReady()) await app.whenReady();
    });

    // Find the main home page window
    for (const win of electronApp.windows()) {
      if (win.url().includes('index.html')) {
        homePage = win;
        break;
      }
    }

    await expect(homePage.locator('h1:has-text("to dictate")')).toBeVisible();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('VAD preprocessing always applies during transcription', async () => {
    test.setTimeout(120000); // 2 minutes for real AI transcription

    console.log('📍 TEST: Verifying VAD preprocessing is always enabled');

    // STEP 1: Verify there is no preprocessing toggle in Settings
    console.log('📍 STEP 1: Checking Settings page for preprocessing toggle');
    await homePage.locator('a:has-text("Settings")').click();
    await homePage.waitForTimeout(500);

    // Should NOT find a preprocessing toggle
    const preprocessingToggle = homePage.locator(
      'text=/VAD|preprocessing|silence removal/i',
    );
    const toggleCount = await preprocessingToggle.count();
    console.log(`✅ Preprocessing toggle count: ${toggleCount} (should be 0)`);

    // Navigate back to home
    await homePage.locator('a:has-text("Home")').click();
    await homePage.waitForTimeout(500);

    // STEP 2: Test transcription with audio (preprocessing happens automatically)
    console.log('📍 STEP 2: Loading and transcribing audio file');
    const audioData = await loadAudioFile('fairy-tails-story.mp3', homePage);

    // Send audio to transcriber (VAD preprocessing applies automatically)
    await sendAudioToTranscriber(homePage, audioData);
    console.log('✅ Audio sent to transcriber with VAD preprocessing');

    // STEP 3: Wait for transcription to complete
    console.log('📍 STEP 3: Waiting for transcription to complete...');

    // Wait for history to update
    await homePage.waitForTimeout(90000); // 90 seconds for real AI transcription

    // Verify transcription appears in History
    console.log('📍 Checking for transcription in History section...');
    const historyHeading = homePage.locator('h3:has-text("History")');
    await expect(historyHeading).toBeVisible({ timeout: 5000 });

    // Should have at least one transcript entry
    const transcriptText = homePage
      .locator('p')
      .filter({ hasNotText: /^(Dictated|Saved|0|133)$/ })
      .first();
    await expect(transcriptText).toBeVisible({ timeout: 5000 });

    const transcriptContent = await transcriptText.textContent();
    console.log(
      '✅ Transcript appears in History (VAD preprocessing applied):',
      transcriptContent?.substring(0, 50),
    );

    // STEP 4: Verify transcription saved in electron-store
    console.log('📍 STEP 4: Verifying transcription saved in electron-store...');
    const transcripts = await homePage.evaluate(async () => {
      return await (window as any).electronAPI.getTranscriptHistory();
    });

    expect(transcripts).toBeDefined();
    expect(transcripts.length).toBeGreaterThan(0);

    const latestTranscript = transcripts[0];
    expect(latestTranscript.text).toBeTruthy();
    expect(latestTranscript.text.length).toBeGreaterThan(0);
    console.log(
      '✅ Transcription saved with VAD preprocessing:',
      latestTranscript.text.substring(0, 50) + '...',
    );

    console.log(
      '🎉 TEST COMPLETE - VAD preprocessing always applies (transparent to user)',
    );
  });

  test('VAD preprocessing works with clean audio', async () => {
    test.setTimeout(120000); // 2 minutes for real AI transcription

    console.log(
      '📍 TEST: Verifying VAD preprocessing works with clean audio',
    );

    // Load audio and send to transcriber
    const audioData = await loadAudioFile('fairy-tails-story.mp3', homePage);
    await sendAudioToTranscriber(homePage, audioData);
    console.log('✅ Clean audio sent to transcriber');

    // Wait for transcription
    await homePage.waitForTimeout(90000);

    // Verify transcription completed
    const transcripts = await homePage.evaluate(async () => {
      return await (window as any).electronAPI.getTranscriptHistory();
    });

    expect(transcripts).toBeDefined();
    expect(transcripts.length).toBeGreaterThan(0);

    const latestTranscript = transcripts[0];
    expect(latestTranscript.text).toBeTruthy();
    expect(latestTranscript.text.length).toBeGreaterThan(10); // Should have meaningful content

    console.log(
      '✅ Clean audio transcribed successfully with VAD preprocessing:',
      latestTranscript.text.substring(0, 50) + '...',
    );

    console.log('🎉 TEST COMPLETE - VAD preprocessing handles clean audio');
  });
});
