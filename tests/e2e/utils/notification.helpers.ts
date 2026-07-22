import { ElectronApplication, Page } from '@playwright/test';
import { wait } from '@e2e/utils/common.helpers';

// Callers must await page.waitForLoadState('domcontentloaded') first, or
// this fires before useRecordingFlow's listener registers and gets dropped.
export async function triggerRecordingToggle(
  electronApp: ElectronApplication,
): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows();
    const mainWin = wins.find(
      (w) => !w.webContents.getURL().includes('notification.html'),
    );
    if (mainWin) {
      mainWin.webContents.send('recording:toggle');
    }
  });
}

export async function waitForNotificationWindow(
  electronApp: ElectronApplication,
  timeoutMs = 10_000,
): Promise<Page | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const windows = electronApp.windows();
    const notificationWindow = windows.find((w) =>
      w.url().includes('notification.html'),
    );
    if (notificationWindow) {
      await notificationWindow.waitForLoadState('networkidle');
      return notificationWindow;
    }
    await wait(500);
  }
  return null;
}

// Polls via locator waiting rather than a fixed delay — activeWindow
// resolves asynchronously (see getActiveWindow() in src/main/active-window.ts).
export async function waitForNotificationText(
  notificationWindow: Page,
  text: string,
  timeoutMs = 5_000,
): Promise<void> {
  const locator = notificationWindow.locator(
    `[data-testid="notification-window"] >> text=${text}`,
  );
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
}
