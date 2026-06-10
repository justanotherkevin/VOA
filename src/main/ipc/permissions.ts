import { ipcMain, shell } from 'electron';
import type { PermissionsService } from '../services/permissions';
import { CHANNELS } from '@/lib/ipc-channels';

export function registerPermissionsHandlers(permissionsService: PermissionsService): void {
  ipcMain.handle(CHANNELS.PERMISSIONS.CHECK, async () => {
    return permissionsService.refresh();
  });

  ipcMain.handle(CHANNELS.PERMISSIONS.CHECK_KEYBOARD, async () => {
    return true;
  });

  ipcMain.handle(CHANNELS.PERMISSIONS.REFRESH, async (event, type: string) => {
    const state = permissionsService.refresh();
    if (type === 'microphone') return { granted: state.microphone === 'granted' };
    if (type === 'accessibility') return { granted: state.accessibility };
    if (type === 'screenRecording') return { granted: state.screenRecording === 'granted' };
    if (type === 'keyboardShortcut') return { granted: true };
    return { granted: false };
  });

  ipcMain.handle(
    CHANNELS.PERMISSIONS.OPEN_SETTINGS,
    async (event, type: 'microphone' | 'accessibility' | 'screenRecording') => {
      if (process.platform !== 'darwin') return;

      const urls = {
        microphone:
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
        accessibility:
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
        screenRecording:
          'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
      };

      const url = urls[type];
      if (url) {
        await shell.openExternal(url);
      }
    },
  );
}
