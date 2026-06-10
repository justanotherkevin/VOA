import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import transcriberService from '../services/transcriber';
import { meetingDetector } from '../services/meeting-detector';
import { error, log } from 'electron-log';
import { CHANNELS } from '@/lib/ipc-channels';
import type { TranscriberCallbacks } from '../services/transcriber';
import { startTrayAnimation, stopTrayAnimation } from '../models/tray';

function makeCallbacks(
  event: IpcMainInvokeEvent,
  context: string,
): TranscriberCallbacks {
  const win = BrowserWindow.fromWebContents(event.sender as any);
  const send = (channel: string, payload: unknown) => {
    try {
      win?.webContents.send(channel, payload);
    } catch (e) {
      error(`[transcriber:${context}] Error sending IPC`, e);
    }
  };
  // prettier-ignore
  return {
    onUpdate:      (data)    => send(CHANNELS.TRANSCRIBER.UPDATE, data),
    onProgress:    (data)    => send(CHANNELS.TRANSCRIBER.PROGRESS, data),
    onComplete:    (result)  => send(CHANNELS.TRANSCRIBER.COMPLETE, result),
    onError:       (msg)     => send(CHANNELS.TRANSCRIBER.ERROR, msg),
    onMeetingSaved:(meeting) => send(CHANNELS.MEETINGS.SAVED, meeting),
  };
}

export function registerTranscriberHandlers() {
  ipcMain.handle(CHANNELS.TRANSCRIBER.SESSION_START, async (_event, args) => {
    const { startedAt } = args || {};
    const isMeeting = await meetingDetector.checkCurrentWindow();
    log('[transcriber:session-start] isMeeting:', isMeeting);
    transcriberService.beginSession(startedAt ?? Date.now(), isMeeting);
    startTrayAnimation();
  });

  ipcMain.handle(CHANNELS.TRANSCRIBER.SESSION_END, async (event, args) => {
    const { endedAt } = args || {};
    const callbacks = makeCallbacks(event, 'session-end');
    await transcriberService.endSession(endedAt ?? Date.now(), callbacks);
    stopTrayAnimation();
  });

  ipcMain.handle(CHANNELS.TRANSCRIBER.START, async (event, args) => {
    const sampleCount = args?.audio?.length ?? 0;
    log(
      `[transcriber:start] Received VAD segment from renderer: ${sampleCount} samples (${(sampleCount / 16000).toFixed(1)}s)`,
    );
    const callbacks = makeCallbacks(event, 'start');
    return transcriberService.transcribe(args ?? {}, callbacks);
  });
}
