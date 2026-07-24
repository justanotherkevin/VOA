export const CHANNELS = {
  TRANSCRIBER: {
    START: 'transcriber:start',
    START_DIARIZED: 'transcriber:start-diarized',
    SESSION_START: 'transcriber:session-start',
    SESSION_END: 'transcriber:session-end',
    INITIATE: 'transcriber:initiate',
    UPDATE: 'transcriber:update',
    PROGRESS: 'transcriber:progress',
    PROCESSING: 'transcriber:processing',
    READY: 'transcriber:ready',
    DONE: 'transcriber:done',
    ERROR: 'transcriber:error',
    COMPLETE: 'transcriber:complete',
  },
  MEETINGS: {
    GET_ALL: 'meetings:get-all',
    GET_BY_ID: 'meetings:get-by-id',
    UPDATE: 'meetings:update',
    DELETE: 'meetings:delete',
    CLEAR: 'meetings:clear',
    SAVED: 'meetings:saved',
    CLEARED: 'meetings:cleared',
    ENRICH: 'meetings:enrich',
  },
  MEETING_DETECTOR: {
    DETECTED: 'meeting-detector:detected',
    ENDED: 'meeting-detector:ended',
    DISMISS: 'meeting-detector:dismiss',
  },
  MEETING_PREFERENCES: {
    GET: 'meetingPreferences:get',
    UPDATE: 'meetingPreferences:update',
  },
  SHORTCUTS: {
    GET: 'shortcuts:get',
    UPDATE_RECORDING_TOGGLE: 'shortcuts:updateRecordingToggle',
    UPDATE_DICTATION_TOGGLE: 'shortcuts:updateDictationToggle',
    TRIGGERED: 'shortcut:triggered',
  },
  RECORDING: {
    TOGGLE: 'recording:toggle',
  },
  DICTATION: {
    TOGGLE: 'dictation:toggle',
  },
  MODEL: {
    PREFERENCES_GET: 'modelPreferences:get',
    PREFERENCES_UPDATE: 'modelPreferences:update',
    CACHE_LIST: 'modelCache:list',
    CACHE_DELETE: 'modelCache:delete',
    CACHE_CLEAR_ALL: 'modelCache:clearAll',
    CACHE_PATHS: 'modelCache:paths',
    GET_ASR_TYPE: 'settings:get-asr-type',
    SET_ASR_TYPE: 'settings:set-asr-type',
  },
  SHELL: {
    OPEN_PATH: 'shell:openPath',
    OPEN_EXTERNAL: 'shell:openExternal',
  },
  PERMISSIONS: {
    CHECK: 'permissions:check',
    CHECK_KEYBOARD: 'permissions:check-keyboard-shortcut',
    REFRESH: 'permissions:refresh',
    OPEN_SETTINGS: 'permissions:open-settings',
  },
  NOTIFICATIONS: {
    SHOW: 'notification:show',
    HIDE: 'notification:hide',
    UPDATE_STATE: 'notification:update-state',
    GET_ACTIVE_WINDOW: 'notification:get-active-window',
  },
  TRANSCRIPT_HISTORY: {
    GET: 'transcriptHistory:get',
    CLEAR: 'transcriptHistory:clear',
  },
  SYSTEM_AUDIO: {
    GET_DESKTOP_SOURCE: 'system-audio:get-desktop-source',
  },
  APP_PREFERENCES: {
    GET: 'appPreferences:get',
    UPDATE: 'appPreferences:update',
  },
  AUDIO_PREFERENCES: {
    GET: 'audioPreferences:get',
    UPDATE: 'audioPreferences:update',
  },
  UI_PREFERENCES: {
    GET: 'uiPreferences:get',
    UPDATE: 'uiPreferences:update',
  },
  LM_STUDIO: {
    GET: 'lmStudio:get',
    SET: 'lmStudio:set',
    TEST: 'lmStudio:test',
  },
  CALENDAR: {
    GET_PREFERENCES: 'calendar:get-preferences',
    SET_PREFERENCES: 'calendar:set-preferences',
    TEST_CONNECTION: 'calendar:test-connection',
    DECLINE_MATCH: 'calendar:decline-match',
    SELECT_MATCH: 'calendar:select-match',
  },
} as const;
