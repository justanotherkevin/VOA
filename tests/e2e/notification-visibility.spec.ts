// @ts-nocheck
import { expect, test } from '@e2e/fixtures';
import {
  triggerRecordingToggle,
  waitForNotificationWindow,
  waitForNotificationText,
} from '@e2e/utils/notification.helpers';

test.describe('Notification Window Visibility', () => {
  test('should show notification window when recording starts', async ({
    page,
    electronApp,
  }) => {
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
    await page.waitForLoadState('domcontentloaded');
    await triggerRecordingToggle(electronApp);
    const notificationWindow = await waitForNotificationWindow(electronApp);
    expect(notificationWindow).toBeDefined();
    if (!notificationWindow) return;

    await waitForNotificationText(notificationWindow, 'recording');
  });
});
