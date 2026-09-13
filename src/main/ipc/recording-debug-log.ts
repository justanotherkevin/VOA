import { ipcMain } from 'electron';
import { CHANNELS } from '@/lib/ipc-channels';
import {
  recordDebugEvent,
  type RecordingDebugEvent,
} from '../utils/recording-debug-log';

export function registerRecordingDebugLogHandlers(): void {
  ipcMain.handle(
    CHANNELS.RECORDING_DEBUG_LOG.RECORD_EVENT,
    async (event, payload: RecordingDebugEvent) => {
      recordDebugEvent(payload);
    },
  );
}
