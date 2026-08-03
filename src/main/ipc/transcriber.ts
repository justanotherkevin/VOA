import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import transcriberService from '../services/transcriber';
import { error, log } from 'electron-log';
import { CHANNELS } from '@/lib/ipc-channels';
import type { TranscriberCallbacks } from '../services/transcriber';
import { startTrayAnimation, stopTrayAnimation } from '../models/tray';

export function makeCallbacks(
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
    onQueued:      (data)    => send(CHANNELS.TRANSCRIBER.PROCESSING, data),
  };
}

// Consumed once by SESSION_START when set via the e2e test helper channel.
let _e2eNextSessionForceMeeting = false;

export function setE2eForceMeeting(value: boolean) {
  _e2eNextSessionForceMeeting = value;
}

export function registerTranscriberHandlers() {
  ipcMain.handle(CHANNELS.TRANSCRIBER.SESSION_START, async (_event, args) => {
    const { startedAt, forceType, pasteOnComplete } = args || {};
    // The recording shortcut and the dictation shortcut are two distinct,
    // explicit user choices — no need to guess intent from the active
    // window. That auto-detection predates the dedicated dictation shortcut
    // (when a single shortcut had to infer meeting-vs-dictation), and left
    // unforced sessions started via the recording shortcut misclassified as
    // 'dictation' whenever the focused app wasn't on the meeting-app list.
    let type: 'meeting' | 'dictation' =
      forceType === 'dictation' ? 'dictation' : 'meeting';
    if (_e2eNextSessionForceMeeting) {
      type = 'meeting';
      _e2eNextSessionForceMeeting = false;
    }
    log('[transcriber:session-start] type:', type);
    transcriberService.beginSession(startedAt ?? Date.now(), type, {
      pasteOnComplete: !!pasteOnComplete,
    });
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

  ipcMain.handle(CHANNELS.TRANSCRIBER.MODEL_STATUS, async () => {
    return transcriberService.getModelStatus();
  });
}
