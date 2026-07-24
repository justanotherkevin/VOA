import { ipcMain } from 'electron';
import { validateShortcut } from '../shortcut-utils';
import { getShortcuts } from '../store';
import { error } from 'electron-log';
import { CHANNELS } from '@/lib/ipc-channels';
import { getMainWindow, getShortcutManager } from '../state/volatile';

export function registerShortcutHandlers() {
  ipcMain.handle(CHANNELS.SHORTCUTS.GET, async () => {
    return getShortcuts();
  });

  ipcMain.handle(
    CHANNELS.SHORTCUTS.UPDATE_RECORDING_TOGGLE,
    async (event, shortcut: string) => {
      try {
        // Validate the new shortcut
        const validation = validateShortcut(shortcut);
        if (!validation.valid) {
          return {
            success: false,
            message: validation.error || 'Invalid shortcut',
          };
        }

        if (!getMainWindow()) {
          error('[IPC] mainWindow is not available');
          return { success: false, message: 'Main window not available' };
        }

        // Delegate to the manager
        getShortcutManager().updateRecordingShortcut(shortcut);

        return { success: true, message: 'Shortcut updated successfully' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        error('[IPC] Error updating shortcut:', errorMessage);
        return {
          success: false,
          message: `Failed to update shortcut: ${errorMessage}`,
        };
      }
    },
  );

  ipcMain.handle(
    CHANNELS.SHORTCUTS.UPDATE_DICTATION_TOGGLE,
    async (event, shortcut: string) => {
      try {
        const validation = validateShortcut(shortcut);
        if (!validation.valid) {
          return {
            success: false,
            message: validation.error || 'Invalid shortcut',
          };
        }

        if (!getMainWindow()) {
          error('[IPC] mainWindow is not available');
          return { success: false, message: 'Main window not available' };
        }

        getShortcutManager().updateDictationShortcut(shortcut);

        return { success: true, message: 'Shortcut updated successfully' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        error('[IPC] Error updating shortcut:', errorMessage);
        return {
          success: false,
          message: `Failed to update shortcut: ${errorMessage}`,
        };
      }
    },
  );
}
