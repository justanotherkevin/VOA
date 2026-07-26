// @ts-nocheck
import { expect, test } from '@e2e/fixtures';
import {
  triggerRecordingToggle,
  waitForNotificationWindow,
  waitForNotificationText,
} from '@e2e/utils/notification.helpers';
import { pollUntil } from '@e2e/utils/common.helpers';

async function isSessionActive(page: any): Promise<boolean> {
  return page.evaluate(() =>
    (window as any).__e2eTestAPI.isTranscriberSessionActive(),
  );
}

// electronApp is worker-scoped (playwright.config.ts sets workers: 1), so it
// persists across every spec file in the run, not just this one. Leaving a
// session started here breaks unrelated tests in other files (e.g. Settings
// model-swap tests get rejected with "stop recording first" instead of the
// error they expect) — always stop recording again before the test ends.
// Polls for the session to actually end rather than a fixed wait: the
// session-end IPC round-trip's duration isn't fixed, so a bare toggle (or
// even a short fixed delay after it) can return before the main process's
// session flag has actually flipped, letting the next spec file start while
// the session is still (briefly, but sometimes not briefly enough) active.
// Unlike specs that feed mock audio, this file's toggles exercise the real
// browser audio pipeline, so session-end depends on hasPendingVadSegment
// clearing (useRecordingFlow.ts) — a real (if silent) getUserMedia/VAD
// teardown that can occasionally take considerably longer than a couple of
// seconds under system load, hence the generous timeout.
test.describe('Notification Window Visibility', () => {
  test.afterEach(async ({ page, electronApp }) => {
    if (!(await isSessionActive(page))) return;
    await triggerRecordingToggle(electronApp);
    await pollUntil(async () => !(await isSessionActive(page)), 25_000);
  });

  test('should show notification window when recording starts', async ({
    page,
    electronApp,
  }) => {
    // afterEach's real-audio session-teardown poll can run long under load —
    // give the whole test (body + hooks) headroom beyond the 10s global default.
    test.setTimeout(30_000);
    await page.waitForLoadState('domcontentloaded');
    await triggerRecordingToggle(electronApp);

    const notificationWindow = await waitForNotificationWindow(electronApp);
    expect(notificationWindow).toBeDefined();
    if (!notificationWindow) return;

    const root = await notificationWindow.waitForSelector(
      '#notification-root',
      {
        state: 'attached',
        timeout: 5000,
      },
    );
    expect(root).not.toBeNull();

    const count = await notificationWindow
      .locator('#notification-root')
      .count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display recording state in notification window when recording shortcut is triggered', async ({
    page,
    electronApp,
  }) => {
    test.setTimeout(30_000);
    await page.waitForLoadState('domcontentloaded');
    await triggerRecordingToggle(electronApp);
    const notificationWindow = await waitForNotificationWindow(electronApp);
    expect(notificationWindow).toBeDefined();
    if (!notificationWindow) return;

    await waitForNotificationText(notificationWindow, 'recording');
  });
});
