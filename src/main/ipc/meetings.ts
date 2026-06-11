import { ipcMain } from 'electron';
import {
  getMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  clearMeetings,
  saveMeeting,
  getMeetingPreferences,
  saveMeetingPreferences,
  Meeting,
} from '../store';
import { CHANNELS } from '@/lib/ipc-channels';
import { getMainWindow } from '../state/volatile';

export function registerMeetingsHandlers() {
  ipcMain.handle(CHANNELS.MEETINGS.GET_ALL, async () => {
    return getMeetings();
  });

  ipcMain.handle(CHANNELS.MEETINGS.GET_BY_ID, async (_event, id: string) => {
    return getMeetingById(id);
  });

  ipcMain.handle(CHANNELS.MEETINGS.UPDATE, async (_event, id: string, patch: Record<string, unknown>) => {
    return updateMeeting(id, patch as any);
  });

  ipcMain.handle(CHANNELS.MEETINGS.DELETE, async (_event, id: string) => {
    return deleteMeeting(id);
  });

  ipcMain.handle(CHANNELS.MEETINGS.CLEAR, async () => {
    clearMeetings();
    getMainWindow()?.webContents.send(CHANNELS.MEETINGS.CLEARED);
    return { success: true };
  });

  ipcMain.handle(CHANNELS.MEETING_PREFERENCES.GET, async () => {
    return getMeetingPreferences();
  });

  ipcMain.handle(CHANNELS.MEETING_PREFERENCES.UPDATE, async (_event, prefs: Record<string, unknown>) => {
    saveMeetingPreferences(prefs as any);
    return { success: true };
  });

  if (process.env.E2E_TEST === 'true') {
    ipcMain.handle('meetings:e2e-seed', async (_event, data: Omit<Meeting, 'id'>) => {
      return saveMeeting(data);
    });
  }
}
