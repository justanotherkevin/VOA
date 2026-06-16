/*
  The preload file is responsible for 3 things:

  1. Define the contract (Channels type)
  All valid IPC channel names are derived from the CHANNELS constants object — single source of truth.
  TypeScript will catch invalid channel names at compile time.

  2. Bridge main ↔ renderer (contextBridge)
  contextBridge.exposeInMainWorld('electronAPI', { ... })
  This injects window.electronAPI into the renderer safely. Without contextBridge, the renderer would have no access to Node.js/Electron
  APIs at all.

  3. Wrap IPC into friendly methods
  Raw IPC is clunky (ipcRenderer.invoke('meetings:get-all')). Preload wraps these into named functions
  organized by domain namespace (e.g., electronAPI.meetings.getAll()).
*/
// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { audioAPI } from './preload/audioCapture';
import { CHANNELS } from '@/lib/ipc-channels';

type ChannelLeaves<T> = T extends string
  ? T
  : T extends Record<string, unknown>
  ? { [K in keyof T]: ChannelLeaves<T[K]> }[keyof T]
  : never;

export type Channels = ChannelLeaves<typeof CHANNELS>;

function subscribe(channel: Channels, listener: (...args: unknown[]) => void) {
  const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
    listener(...args);
  ipcRenderer.on(channel, subscription);

  return () => {
    ipcRenderer.removeListener(channel, subscription);
  };
}

const electronAPI = {
  // ── Transcriber ────────────────────────────────────────────────────────────
  transcriber: {
    start: (options?: unknown) => ipcRenderer.invoke(CHANNELS.TRANSCRIBER.START, options),
    startSession: (startedAt: number) =>
      ipcRenderer.invoke(CHANNELS.TRANSCRIBER.SESSION_START, { startedAt }),
    endSession: (endedAt: number) =>
      ipcRenderer.invoke(CHANNELS.TRANSCRIBER.SESSION_END, { endedAt }),
    initiate: (payload?: unknown) => ipcRenderer.send(CHANNELS.TRANSCRIBER.INITIATE, payload),
    on: {
      update: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.TRANSCRIBER.UPDATE, cb),
      progress: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.TRANSCRIBER.PROGRESS, cb),
      initiate: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.TRANSCRIBER.INITIATE, cb),
      ready: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.TRANSCRIBER.READY, cb),
      done: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.TRANSCRIBER.DONE, cb),
      error: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.TRANSCRIBER.ERROR, cb),
      complete: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.TRANSCRIBER.COMPLETE, cb),
    },
  },

  // ── Meetings ───────────────────────────────────────────────────────────────
  meetings: {
    getAll: () => ipcRenderer.invoke(CHANNELS.MEETINGS.GET_ALL),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.MEETINGS.GET_BY_ID, id),
    update: (id: string, patch: Record<string, unknown>) =>
      ipcRenderer.invoke(CHANNELS.MEETINGS.UPDATE, id, patch),
    delete: (id: string) => ipcRenderer.invoke(CHANNELS.MEETINGS.DELETE, id),
    clear: () => ipcRenderer.invoke(CHANNELS.MEETINGS.CLEAR),
    enrich: (meetingId: string) => ipcRenderer.invoke(CHANNELS.MEETINGS.ENRICH, meetingId),
    dismiss: (meetingKey: string) =>
      ipcRenderer.invoke(CHANNELS.MEETING_DETECTOR.DISMISS, meetingKey),
    on: {
      saved: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.MEETINGS.SAVED, cb),
      cleared: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.MEETINGS.CLEARED, cb),
      detected: (cb: (...args: unknown[]) => void) =>
        subscribe(CHANNELS.MEETING_DETECTOR.DETECTED, cb),
      ended: (cb: (...args: unknown[]) => void) =>
        subscribe(CHANNELS.MEETING_DETECTOR.ENDED, cb),
    },
  },

  // ── App Settings ───────────────────────────────────────────────────────────
  settings: {
    shortcuts: {
      get: () => ipcRenderer.invoke(CHANNELS.SHORTCUTS.GET),
      updateRecordingToggle: (shortcut: string) =>
        ipcRenderer.invoke(CHANNELS.SHORTCUTS.UPDATE_RECORDING_TOGGLE, shortcut),
      on: {
        triggered: (cb: (...args: unknown[]) => void) =>
          subscribe(CHANNELS.SHORTCUTS.TRIGGERED, cb),
        recordingToggle: (cb: (...args: unknown[]) => void) =>
          subscribe(CHANNELS.RECORDING.TOGGLE, cb),
      },
    },
    model: {
      get: () => ipcRenderer.invoke(CHANNELS.MODEL.PREFERENCES_GET),
      update: (preferences: Record<string, unknown>) =>
        ipcRenderer.invoke(CHANNELS.MODEL.PREFERENCES_UPDATE, preferences),
      getAsrType: () => ipcRenderer.invoke(CHANNELS.MODEL.GET_ASR_TYPE),
      setAsrType: (asrType: 'whisper' | 'parakeet') =>
        ipcRenderer.invoke(CHANNELS.MODEL.SET_ASR_TYPE, asrType),
      cache: {
        list: () => ipcRenderer.invoke(CHANNELS.MODEL.CACHE_LIST),
        delete: (modelName: string, source?: 'xenova' | 'hf') =>
          ipcRenderer.invoke(CHANNELS.MODEL.CACHE_DELETE, modelName, source ?? 'xenova'),
        clearAll: () => ipcRenderer.invoke(CHANNELS.MODEL.CACHE_CLEAR_ALL),
        getPaths: () => ipcRenderer.invoke(CHANNELS.MODEL.CACHE_PATHS),
      },
    },
    // Recording preferences (formerly "meetingPreferences" — unrelated to meeting objects)
    recording: {
      get: () => ipcRenderer.invoke(CHANNELS.MEETING_PREFERENCES.GET),
      update: (prefs: Record<string, unknown>) =>
        ipcRenderer.invoke(CHANNELS.MEETING_PREFERENCES.UPDATE, prefs),
    },
    app: {
      get: () => ipcRenderer.invoke(CHANNELS.APP_PREFERENCES.GET),
      update: (prefs: Record<string, unknown>) =>
        ipcRenderer.invoke(CHANNELS.APP_PREFERENCES.UPDATE, prefs),
    },
    audio: {
      get: () => ipcRenderer.invoke(CHANNELS.AUDIO_PREFERENCES.GET),
      update: (prefs: Record<string, unknown>) =>
        ipcRenderer.invoke(CHANNELS.AUDIO_PREFERENCES.UPDATE, prefs),
    },
    ui: {
      get: () => ipcRenderer.invoke(CHANNELS.UI_PREFERENCES.GET),
      update: (prefs: Record<string, unknown>) =>
        ipcRenderer.invoke(CHANNELS.UI_PREFERENCES.UPDATE, prefs),
    },
  },

  // ── LM Studio ────────────────────────────────────────────────────────────
  lmStudio: {
    getPreferences: () => ipcRenderer.invoke(CHANNELS.LM_STUDIO.GET),
    savePreferences: (prefs: Record<string, unknown>) => ipcRenderer.invoke(CHANNELS.LM_STUDIO.SET, prefs),
    testConnection: (baseUrl: string) => ipcRenderer.invoke(CHANNELS.LM_STUDIO.TEST, baseUrl),
  },

  // ── Shell ─────────────────────────────────────────────────────────────────
  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke(CHANNELS.SHELL.OPEN_PATH, filePath),
  },

  // ── Summarizer ────────────────────────────────────────────────────────────
  summarizer: {
    prefetch: () => ipcRenderer.invoke(CHANNELS.MODEL.SUMMARIZER_PREFETCH),
    submitChunk: (text: string) => ipcRenderer.invoke(CHANNELS.SUMMARIZER.SUBMIT_CHUNK, text),
    on: {
      progress: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.SUMMARIZER.PROGRESS, cb),
      ready: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.SUMMARIZER.READY, cb),
      error: (cb: (...args: unknown[]) => void) => subscribe(CHANNELS.SUMMARIZER.ERROR, cb),
    },
  },

  // ── Recordings ────────────────────────────────────────────────────────────
  recordings: {
    toggle: () => ipcRenderer.send(CHANNELS.RECORDING.TOGGLE),
  },

  // ── Permissions ────────────────────────────────────────────────────────────
  permissions: {
    check: () => ipcRenderer.invoke(CHANNELS.PERMISSIONS.CHECK),
    refresh: (type: string) => ipcRenderer.invoke(CHANNELS.PERMISSIONS.REFRESH, type),
    openSettings: (type: 'microphone' | 'accessibility' | 'screenRecording') =>
      ipcRenderer.invoke(CHANNELS.PERMISSIONS.OPEN_SETTINGS, type),
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: {
    getActiveWindow: () => ipcRenderer.invoke(CHANNELS.NOTIFICATIONS.GET_ACTIVE_WINDOW),
    updateState: (payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.NOTIFICATIONS.UPDATE_STATE, payload),
    on: {
      updateState: (cb: (...args: unknown[]) => void) =>
        subscribe(CHANNELS.NOTIFICATIONS.UPDATE_STATE, cb),
    },
  },

  // ── System Audio (preload-only, see audioCapture.ts) ──────────────────────
  audio: {
    ...audioAPI,
  },

  // ── Transcript History (legacy compat) ────────────────────────────────────
  transcriptHistory: {
    get: () => ipcRenderer.invoke(CHANNELS.TRANSCRIPT_HISTORY.GET),
    clear: () => ipcRenderer.invoke(CHANNELS.TRANSCRIPT_HISTORY.CLEAR),
  },

  // ── Platform info ─────────────────────────────────────────────────────────
  platform: process.platform,

};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

if (process.env.E2E_TEST === 'true') {
  contextBridge.exposeInMainWorld('__e2eTestAPI', {
    forceMeetingNextSession: () => ipcRenderer.invoke('transcriber:e2e-force-meeting'),
    transcribeFileForTest: (filePath: string) =>
      ipcRenderer.invoke('transcriber:e2e-transcribe-file', { filePath }),
    mockEnrichMeeting: () =>
      ipcRenderer.invoke('transcriber:e2e-mock-enrich-meeting'),
    seedMeeting: (data: unknown) =>
      ipcRenderer.invoke('meetings:e2e-seed', data),
  });
}

export type ElectronAPI = typeof electronAPI;
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
