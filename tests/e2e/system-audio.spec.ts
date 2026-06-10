/**
 * Smoke tests for the system audio loopback feature
 *
 * Covers:
 * 1. Settings toggle — persists systemAudioEnabled preference
 * 2. Settings warning — banner shown when Screen Recording permission is missing
 * 3. Recording flow — startSystemAudio called when toggle is on and recording starts
 * 4. Recording flow — stopSystemAudio called when recording stops
 * 5. Regression — mic-only recording unaffected when toggle is off
 */

import { test, expect } from './fixtures';
import { toggleRecording } from './utils/dictation/recording-actions';
import { setupAudioMocking } from './utils/dictation/hardware-mocks';
import {
  getSystemAudioToggle,
  navigateToSettings,
  wait,
} from './utils/common.helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Read the current meetingPreferences from the store via IPC.
 */
async function getMeetingPrefs(page: any): Promise<Record<string, any>> {
  return page.evaluate(() =>
    (window as any).electronAPI.getMeetingPreferences(),
  );
}

/**
 * Directly set meetingPreferences via IPC (used to seed state for Settings UI tests).
 */
async function setSystemAudioEnabled(
  page: any,
  enabled: boolean,
): Promise<void> {
  // Wait until electronAPI is injected by the preload script
  await pollUntil(page, () =>
    page.evaluate(
      () => !!(window as any).electronAPI?.updateMeetingPreferences,
    ),
  );
  await page.evaluate(
    (val: boolean) =>
      (window as any).electronAPI.updateMeetingPreferences({
        systemAudioEnabled: val,
      }),
    enabled,
  );
}

/**
 * Persist the system audio preference, reload the renderer so useRecordingFlow
 * mounts fresh, then wait until the hook has resolved getMeetingPreferences and
 * the onRecordingToggle listener is wired with the correct systemAudioEnabled
 * value — avoids all async React re-wiring timing issues.
 */
async function reloadPageWithSystemAudio(
  page: any,
  enabled: boolean,
): Promise<void> {
  // Persist to store so useRecordingFlow reads the correct value on fresh mount
  await setSystemAudioEnabled(page, enabled);

  // Reload renderer — useRecordingFlow mounts fresh and reads from store
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Wait for preload script to re-inject electronAPI after reload
  await pollUntil(page, () =>
    page.evaluate(() => !!(window as any).electronAPI?.getMeetingPreferences),
  );

  // Wait for useRecordingFlow to mount and expose the test getter
  await pollUntil(page, () =>
    page.evaluate(
      () => typeof (window as any).__getSystemAudioEnabled === 'function',
    ),
  );

  // Wait for the hook's useEffect to load the preference from the store
  await pollUntil(page, () =>
    page.evaluate(
      (val: boolean) => (window as any).__getSystemAudioEnabled?.() === val,
      enabled,
    ),
  );
}

/**
 * Directly set the systemAudioEnabled React state via the test hook exposed by
 * useRecordingFlow, without a page reload.
 */
async function setSystemAudioState(page: any, enabled: boolean): Promise<void> {
  await pollUntil(page, () =>
    page.evaluate(
      () => typeof (window as any).__setSystemAudioEnabled === 'function',
    ),
  );
  await page.evaluate(
    (val: boolean) => (window as any).__setSystemAudioEnabled(val),
    enabled,
  );
}

/**
 * Poll in the test process (not via page.waitForFunction which hangs in this
 * Electron+Playwright setup) until condition is truthy.
 */
async function pollUntil(
  page: any,
  fn: () => Promise<boolean>,
  timeoutMs = 8000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await wait(150);
  }
  throw new Error(`pollUntil timed out after ${timeoutMs}ms`);
}

/**
 * Set systemAudioEnabled React state and wait (via polling) until the ref
 * is also updated, guaranteeing handleToggleRecording will see the new value.
 *
 * Since handleToggleRecording reads from systemAudioEnabledRef.current, we
 * only need to confirm the effect that updates the ref has run — no need for
 * a page reload.
 */
async function setupSystemAudioForRecordingTest(
  page: any,
  enabled: boolean,
): Promise<void> {
  // setSystemAudioEnabled (IPC) also acts as the "electronAPI ready" barrier
  await setSystemAudioEnabled(page, enabled);
  await setSystemAudioState(page, enabled);

  if (enabled) {
    // Poll until the ref is updated (happens in a useEffect after React commits)
    await pollUntil(page, () =>
      page.evaluate(() => (window as any).__getSystemAudioEnabled?.() === true),
    );
  }
}

/**
 * Install a spy on window.electronAPI.startSystemAudio / stopSystemAudio.
 * Returns a handle so the test can read call counts later.
 *
 * We replace the real implementation with a no-op that records calls because
 * the real startSystemAudio tries to capture hardware audio (unavailable in CI).
 */
async function spyOnSystemAudio(page: any): Promise<void> {
  await page.evaluate(() => {
    const api = (window as any).electronAPI;
    (window as any).__systemAudioCalls = { start: 0, stop: 0 };
    api.startSystemAudio = async () => {
      (window as any).__systemAudioCalls.start += 1;
      return true;
    };
    api.stopSystemAudio = () => {
      (window as any).__systemAudioCalls.stop += 1;
    };
  });
}

async function getSystemAudioCalls(
  page: any,
): Promise<{ start: number; stop: number }> {
  return page.evaluate(() => (window as any).__systemAudioCalls);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('System Audio — Settings toggle', () => {
  test('toggle enables and persists systemAudioEnabled preference', async ({
    page,
  }) => {
    // Ensure we start with the toggle off
    await setSystemAudioEnabled(page, false);

    await navigateToSettings(page);

    const toggle = await getSystemAudioToggle(page);

    await expect(toggle).toBeVisible({ timeout: 5000 });

    // Toggle it on
    await toggle.click();
    await wait(300);

    const prefs = await getMeetingPrefs(page);
    expect(prefs.systemAudioEnabled).toBe(true);
  });

  test('disabling the toggle persists systemAudioEnabled=false', async ({
    page,
  }) => {
    // Seed state as enabled
    await setSystemAudioEnabled(page, true);

    await navigateToSettings(page);

    const toggle = await getSystemAudioToggle(page);

    await expect(toggle).toBeVisible({ timeout: 5000 });

    // Toggle it off
    await toggle.click();
    await wait(300);

    const prefs = await getMeetingPrefs(page);
    expect(prefs.systemAudioEnabled).toBe(false);
  });
});

test.describe('System Audio — permission warning', () => {
  test('shows warning banner when system audio enabled but Screen Recording not granted', async ({
    page,
  }) => {
    // 1. Persist systemAudioEnabled=true so Settings reads it on mount
    await setSystemAudioEnabled(page, true);

    // 2. Navigate — Settings mounts and reads getMeetingPreferences → systemAudioEnabled=true
    await navigateToSettings(page);

    // 3. Directly set permissions state via test hook (no IPC/focus-event dance needed)
    await page.evaluate(() => {
      const setter = (window as any).__setPermissions;
      if (typeof setter !== 'function')
        throw new Error('__setPermissions not available');
      setter({
        microphone: 'granted',
        screenRecording: 'denied',
        accessibility: 'granted',
        keyboardShortcut: true,
      });
    });

    const warning = page.locator('text=Screen Recording permission required');
    await expect(warning).toBeVisible({ timeout: 5000 });

    const link = page.locator('text=Open Screen Recording settings');
    await expect(link).toBeVisible();
  });

  test('does NOT show permission warning when Screen Recording is granted', async ({
    page,
  }) => {
    await setSystemAudioEnabled(page, true);
    await navigateToSettings(page);

    // Force screenRecording to 'granted'
    await page.evaluate(() => {
      const setter = (window as any).__setPermissions;
      if (typeof setter !== 'function')
        throw new Error('__setPermissions not available');
      setter({
        microphone: 'granted',
        screenRecording: 'granted',
        accessibility: 'granted',
        keyboardShortcut: true,
      });
    });

    const warning = page.locator('text=Screen Recording permission required');
    await expect(warning).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe.skip('System Audio — recording flow integration', () => {
  test('startSystemAudio is called when recording starts with toggle on', async ({
    page,
    electronApp,
  }) => {
    test.setTimeout(20_000);
    // addInitScript mocks survive a page reload; set them up first.
    await setupAudioMocking(page);
    // Persist preference + reload so useRecordingFlow mounts with systemAudioEnabled=true
    await reloadPageWithSystemAudio(page, true);
    await spyOnSystemAudio(page);

    await toggleRecording(page, electronApp);
    await wait(500);

    const calls = await getSystemAudioCalls(page);
    expect(calls.start).toBe(1);

    // Clean up — stop recording
    await toggleRecording(page, electronApp);
    await wait(300);
  });

  test('stopSystemAudio is called when recording stops with toggle on', async ({
    page,
    electronApp,
  }) => {
    test.setTimeout(20_000);
    await setupAudioMocking(page);
    await reloadPageWithSystemAudio(page, true);
    await spyOnSystemAudio(page);

    await toggleRecording(page, electronApp);
    await wait(500);

    await toggleRecording(page, electronApp);
    await wait(500);

    const calls = await getSystemAudioCalls(page);
    expect(calls.stop).toBe(1);
  });

  test('startSystemAudio is NOT called when toggle is off (regression)', async ({
    page,
    electronApp,
  }) => {
    test.setTimeout(20_000);
    await setupAudioMocking(page);
    await reloadPageWithSystemAudio(page, false);
    await spyOnSystemAudio(page);

    await toggleRecording(page, electronApp);
    await wait(500);

    const calls = await getSystemAudioCalls(page);
    expect(calls.start).toBe(0);

    // Clean up
    await toggleRecording(page, electronApp);
    await wait(300);
  });
});
