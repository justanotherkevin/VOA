import type { ElectronApplication } from '@playwright/test';
import { expect, test } from '@e2e/fixtures';
import { getVisibleWindows } from '@e2e/utils/common.helpers';
import {
  startDictation,
  stopDictation,
  startRecording,
  stopRecording,
} from '@e2e/utils/dictation/recording-actions';
import {
  NOTIFICATION_HEIGHT,
  NOTIFICATION_DICTATION_WINDOW_HEIGHT,
} from '@/lib/notification-dimensions';

async function getNotificationWindowHeight(
  electronApp: ElectronApplication,
): Promise<number | undefined> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('notification.html'),
    );
    return win?.getBounds().height;
  });
}

// The window only grows for a Dictation, so its transparent extra space
// can't block clicks on apps underneath during other (clickable) states.
test.describe('Notification window height', () => {
  test('grows while a Dictation records and shrinks back after', async ({
    electronApp,
  }) => {
    test.setTimeout(45_000);
    const { main } = await getVisibleWindows(electronApp);

    await startDictation(main, electronApp);
    await expect
      .poll(() => getNotificationWindowHeight(electronApp))
      .toBe(NOTIFICATION_DICTATION_WINDOW_HEIGHT);

    await stopDictation(main, electronApp);
    await expect
      .poll(() => getNotificationWindowHeight(electronApp))
      .toBe(NOTIFICATION_HEIGHT);
  });

  test('stays pill height while a Meeting records', async ({ electronApp }) => {
    test.setTimeout(45_000);
    const { main } = await getVisibleWindows(electronApp);

    await startRecording(main, electronApp);
    await expect
      .poll(() => getNotificationWindowHeight(electronApp))
      .toBe(NOTIFICATION_HEIGHT);

    await stopRecording(main, electronApp);
  });
});
