import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { log } from 'electron-log';

// Dev-only breadcrumb trail for the recording start/stop flow — NOT the
// transcript/meeting store. Written as JSON Lines to a gitignored folder at
// the repo root so it survives across runs and is easy to grep/tail while
// chasing a bug in useRecordingFlow.ts (e.g. "why did the notification show
// mic-only for a meeting session?"). Never runs in a packaged build — there
// is no repo root to write into, and this is a local dev aid only.
const LOG_DIR = path.join(app.getAppPath(), '.recording-logs');
const LOG_FILE = path.join(LOG_DIR, 'sessions.jsonl');

export type RecordingDebugEvent =
  | {
      type: 'session_start';
      timestamp: number;
      sessionType: 'meeting' | 'dictation';
      initialState: {
        systemAudioSupported: boolean;
        modelStatus: string;
      };
      uiState: {
        isMeeting: boolean;
        systemAudioEnabled: boolean;
      };
    }
  | {
      type: 'session_stop';
      timestamp: number;
      sessionType: 'meeting' | 'dictation';
    }
  | {
      type: 'session_error';
      timestamp: number;
      stage: string;
      message: string;
    };

export function recordDebugEvent(event: RecordingDebugEvent): void {
  if (app.isPackaged) return;

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(event)}\n`);
  } catch (error) {
    log('[recording-debug-log] Failed to write event:', error);
  }
}
