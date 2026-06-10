import { ipcMain } from 'electron';
import { CHANNELS } from '@/lib/ipc-channels';
import { meetingDetector } from '@/main/services/meeting-detector';

export function registerMeetingDetectorHandlers(): void {
  ipcMain.handle(CHANNELS.MEETING_DETECTOR.DISMISS, async (_event, meetingKey: string) => {
    await meetingDetector.handleDismiss(meetingKey);
    return { success: true };
  });
}
