/**
 * src/testing/electronMocks.ts
 *
 * Shared helper to install a controlled electronAPI mock on the global window
 * for tests. Exposes trigger/reset helpers so tests can simulate IPC events.
 *
 * Usage in setupTests.ts:
 *   import { attachGlobalElectronMock } from '@/testing/electronMocks';
 *   attachGlobalElectronMock();
 *
 * Tests can import triggerUpdate/triggerComplete to fire messages.
 */
import { RECORDING_SHORTCUT, DICTATION_SHORTCUT } from '@/lib/shortcuts';
import { vi } from 'vitest';

let updateCallback: ((msg: any) => void) | null = null;
let completeCallback: ((msg: any) => void) | null = null;
let recordingToggleCallback: (() => void) | null = null;
let dictationToggleCallback: (() => void) | null = null;
let notificationStateUpdateCallback: ((data: any) => void) | null = null;
let meetingSavedCallback: ((meeting: any) => void) | null = null;
let meetingClearedCallback: (() => void) | null = null;
let meetingDetectedCallback: ((event: any) => void) | null = null;
let meetingEndedCallback: ((event: any) => void) | null = null;

export function attachGlobalElectronMock() {
  // Ensure global.window exists
  (global as any).window = (global as any).window ?? {};

  (global as any).window.electronAPI = {
    // ── Transcriber ──────────────────────────────────────────────────────────
    transcriber: {
      start: vi.fn(async () => {}),
      startSession: vi.fn(async () => {}),
      endSession: vi.fn(async () => {}),
      initiate: vi.fn(),
      on: {
        update: vi.fn((cb: (m: any) => void) => {
          updateCallback = cb;
          return () => {
            updateCallback = null;
          };
        }),
        progress: vi.fn(() => () => {}),
        processing: vi.fn(() => () => {}),
        initiate: vi.fn(() => () => {}),
        ready: vi.fn(() => () => {}),
        done: vi.fn(() => () => {}),
        error: vi.fn(() => () => {}),
        complete: vi.fn((cb: (m: any) => void) => {
          completeCallback = cb;
          return () => {
            completeCallback = null;
          };
        }),
      },
    },

    // ── Meetings ─────────────────────────────────────────────────────────────
    meetings: {
      getAll: vi.fn(async () => []),
      getById: vi.fn(async () => null),
      update: vi.fn(async () => null),
      delete: vi.fn(async () => true),
      clear: vi.fn(async () => ({ success: true })),
      dismiss: vi.fn(async () => ({ success: true })),
      enrich: vi.fn(async () => ({ success: true })),
      on: {
        saved: vi.fn((cb: (m: any) => void) => {
          meetingSavedCallback = cb;
          return () => {
            meetingSavedCallback = null;
          };
        }),
        cleared: vi.fn((cb: () => void) => {
          meetingClearedCallback = cb;
          return () => {
            meetingClearedCallback = null;
          };
        }),
        detected: vi.fn((cb: (e: any) => void) => {
          meetingDetectedCallback = cb;
          return () => {
            meetingDetectedCallback = null;
          };
        }),
        ended: vi.fn((cb: (e: any) => void) => {
          meetingEndedCallback = cb;
          return () => {
            meetingEndedCallback = null;
          };
        }),
      },
    },

    // ── Settings ──────────────────────────────────────────────────────────────
    settings: {
      shortcuts: {
        get: vi.fn(async () => ({
          recordingToggle: RECORDING_SHORTCUT,
          dictationToggle: DICTATION_SHORTCUT,
        })),
        updateRecordingToggle: vi.fn(async () => ({ success: true })),
        updateDictationToggle: vi.fn(async () => ({ success: true })),
        on: {
          triggered: vi.fn(() => () => {}),
          recordingToggle: vi.fn((cb: () => void) => {
            recordingToggleCallback = cb;
            return () => {
              recordingToggleCallback = null;
            };
          }),
          dictationToggle: vi.fn((cb: () => void) => {
            dictationToggleCallback = cb;
            return () => {
              dictationToggleCallback = null;
            };
          }),
        },
      },
      model: {
        get: vi.fn(async () => ({
          selectedModel: 'Xenova/whisper-tiny',
          multilingual: false,
          quantized: false,
          language: 'english',
        })),
        update: vi.fn(async () => ({ success: true })),
        getAsrType: vi.fn(async () => 'whisper'),
        setAsrType: vi.fn(async () => ({ success: true })),
        cache: {
          list: vi.fn(async () => ({ success: true, models: [] })),
          delete: vi.fn(async () => ({ success: true })),
          clearAll: vi.fn(async () => ({ success: true, deletedCount: 0 })),
          getPaths: vi.fn(async () => ({ success: true, paths: [] })),
        },
      },
      recording: {
        get: vi.fn(async () => ({
          systemAudioEnabled: false,
          autoRecordMode: 'manual',
        })),
        update: vi.fn(async () => ({ success: true })),
      },
      app: {
        get: vi.fn(async () => ({
          launchAtLogin: false,
          showMenuBar: true,
          showDockIcon: true,
        })),
        update: vi.fn(async () => ({ success: true })),
      },
      audio: {
        get: vi.fn(async () => ({
          micGain: 62,
          noiseSuppression: true,
          labelSpeakers: true,
        })),
        update: vi.fn(async () => ({ success: true })),
      },
      ui: {
        get: vi.fn(async () => ({
          theme: 'dark',
          accentLight: '#2f6bed',
          accentDark: '#4f8cff',
          density: 'comfortable',
        })),
        update: vi.fn(async () => ({ success: true })),
      },
    },

    // ── Shell ─────────────────────────────────────────────────────────────────
    shell: {
      openPath: vi.fn(async () => {}),
    },

    // ── LM Studio ─────────────────────────────────────────────────────────────
    lmStudio: {
      getPreferences: vi.fn(async () => ({
        baseUrl: 'http://localhost:1234',
        model: '',
      })),
      savePreferences: vi.fn(async () => {}),
      testConnection: vi.fn(async () => ({ ok: true, models: [] })),
    },

    // ── Summarizer ────────────────────────────────────────────────────────────
    summarizer: {
      prefetch: vi.fn(async () => {}),
      on: {
        progress: vi.fn(() => () => {}),
        ready: vi.fn(() => () => {}),
        error: vi.fn(() => () => {}),
      },
    },

    // ── Permissions ──────────────────────────────────────────────────────────
    permissions: {
      check: vi.fn(async () => ({
        microphone: 'granted',
        accessibility: true,
      })),
      refresh: vi.fn(async () => ({ granted: true })),
      openSettings: vi.fn(async () => {}),
    },

    // ── Recordings ────────────────────────────────────────────────────────────
    recordings: {
      toggle: vi.fn(() => {}),
    },

    // ── Calendar ──────────────────────────────────────────────────────────────
    calendar: {
      getPreferences: vi.fn(async () => ({ feedUrl: '' })),
      savePreferences: vi.fn(async () => ({ success: true })),
      testConnection: vi.fn(async () => ({ success: true, eventCount: 0 })),
      declineMatch: vi.fn(async () => ({ success: true })),
      selectMatch: vi.fn(async () => ({ success: true })),
    },

    // ── Notifications ─────────────────────────────────────────────────────────
    notifications: {
      getActiveWindow: vi.fn(async () => null),
      // The real main process echoes UPDATE_STATE calls back down as a
      // 'notification:update-state' push (see notification-window.ts) —
      // this is how e.g. InMeetingPill/CalendarMatchPill self-close.
      // Simulate that round trip so tests can exercise it.
      updateState: vi.fn(async (payload: any) => {
        notificationStateUpdateCallback?.(payload);
      }),
      on: {
        updateState: vi.fn((cb: (data: any) => void) => {
          notificationStateUpdateCallback = cb;
          return () => {
            notificationStateUpdateCallback = null;
          };
        }),
      },
    },

    // ── Audio ─────────────────────────────────────────────────────────────────
    audio: {
      startSystemAudio: vi.fn(async () => false),
      stopSystemAudio: vi.fn(),
    },

    // ── Transcript History ────────────────────────────────────────────────────
    transcriptHistory: {
      get: vi.fn(async () => []),
      clear: vi.fn(async () => {}),
    },

    // ── Platform ──────────────────────────────────────────────────────────────
    platform: 'darwin',
  };
}

export function detachGlobalElectronMock() {
  try {
    if ((global as any).window) {
      delete (global as any).window.electronAPI;
    }
  } finally {
    updateCallback = null;
    completeCallback = null;
    recordingToggleCallback = null;
    dictationToggleCallback = null;
    notificationStateUpdateCallback = null;
    meetingSavedCallback = null;
    meetingClearedCallback = null;
    meetingDetectedCallback = null;
    meetingEndedCallback = null;
  }
}

/**
 * Test helpers to programmatically fire transcriber events from tests.
 */
export function triggerTranscriberUpdate(payload: any) {
  updateCallback?.(payload);
}

export function triggerTranscriberComplete(payload: any) {
  completeCallback?.(payload);
}

export function resetElectronMockCallbacks() {
  updateCallback = null;
  completeCallback = null;
  recordingToggleCallback = null;
  dictationToggleCallback = null;
  notificationStateUpdateCallback = null;
  meetingSavedCallback = null;
  meetingClearedCallback = null;
  meetingDetectedCallback = null;
  meetingEndedCallback = null;
}

export function triggerRecordingToggle() {
  recordingToggleCallback?.();
}

export function triggerDictationToggle() {
  dictationToggleCallback?.();
}

export function triggerNotificationShow(data: {
  title: string;
  message: string;
  activeWindow?: any;
}) {
  notificationStateUpdateCallback?.({
    state: 'recording',
    title: data.title,
    message: data.message,
    activeWindow: data.activeWindow || {
      title: data.title,
      owner: { name: 'Test App' },
    },
  });
}

export function triggerNotificationHide() {
  notificationStateUpdateCallback?.({
    state: 'done',
    title: '',
    message: '',
  });
}

export function triggerCalendarMatch(
  calendarMatches: Array<{ id: string; title: string }>,
) {
  notificationStateUpdateCallback?.({
    state: 'calendar-match',
    title: '',
    message: '',
    calendarMatches,
  });
}

export function triggerMeetingSaved(meeting: any) {
  meetingSavedCallback?.(meeting);
}
