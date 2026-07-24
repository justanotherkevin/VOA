import { ipcMain } from 'electron';
import {
  updateNotificationState,
  getCurrentNotificationState,
  NotificationStatePayload,
} from '../notification-window';
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
      // Apply immediately — don't block delivery on the activeWindow lookup
      // below. It's a real OS query (see active-window.ts) with unpredictable
      // latency, and awaiting it here used to delay this call's own delivery
      // long enough that a *later* update (e.g. TranscriberService's
      // calendar-match push) could reach the renderer first and then get
      // silently clobbered when this stale 'recording' payload landed after.
      updateNotificationState(payload);

      // If activeWindow is missing, try to detect it and send a non-blocking
      // follow-up — but only if the state hasn't moved on since, so this
      // enrichment can't overwrite a newer state with stale 'recording' data.
      if (!payload.activeWindow && payload.state === 'recording') {
        const activeWin = await getActiveWindow();
        if (activeWin && getCurrentNotificationState() === 'recording') {
          updateNotificationState({ ...payload, activeWindow: activeWin });
        }
      }
      return { success: true };
    },
  );
}
