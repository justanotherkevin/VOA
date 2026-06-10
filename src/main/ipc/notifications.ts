import { ipcMain } from 'electron';
import { updateNotificationState, NotificationStatePayload } from '../notification-window';
import { getActiveWindow } from '../active-window';
import { CHANNELS } from '@/lib/ipc-channels';
import { executeCommand } from '@/main/commands/registry';

export function registerNotificationHandlers() {
  // Relay recording:toggle from any renderer window to the main window.
  // This is needed because recordings.toggle() sends renderer→main, but
  // the shortcut manager only goes main→renderer. Without this relay,
  // any UI button calling recordings.toggle() is silently ignored.
  ipcMain.on(CHANNELS.RECORDING.TOGGLE, () => {
    executeCommand('recording.toggle');
  });

  /**
   * Get the currently active window information
   * Allows renderer to retrieve active window for notification display
   */
  ipcMain.handle(CHANNELS.NOTIFICATIONS.GET_ACTIVE_WINDOW, async () => {
    const activeWin = await getActiveWindow();
    return activeWin || null;
  });

  /**
   * Allow the renderer to update the notification window state.
   * This ensures consistency when recording is triggered by the UI or hooks.
   */
  ipcMain.handle(
    CHANNELS.NOTIFICATIONS.UPDATE_STATE,
    async (event, payload: NotificationStatePayload) => {
      // If activeWindow is missing, try to detect it
      if (!payload.activeWindow && payload.state === 'recording') {
        const activeWin = await getActiveWindow();
        if (activeWin) {
          payload.activeWindow = activeWin;
        }
      }
      updateNotificationState(payload);
      return { success: true };
    },
  );
}
