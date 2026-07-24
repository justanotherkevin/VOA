import { RECORDING_SHORTCUT, DICTATION_SHORTCUT } from '@/lib/shortcuts';

// ─── Meeting Data Model ───────────────────────────────────────────────────────

export interface MeetingActionItem {
  text: string;
  done: boolean;
}

export interface Recording {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  transcript: string;
  chunks: Array<{
    text: string;
    timestamp: [number, number | null];
  }>;
  type: 'meeting' | 'dictation';
  summary: string;
  summaryStatus: 'pending' | 'ready' | 'failed' | 'not-started';
  decisions: string[];
  topics: string[];
  actionItems: MeetingActionItem[];
  audioSource: 'mic' | 'system' | 'both';
  participants: string[];
  tags: string[];
}

// ─── Legacy (kept for migration only) ────────────────────────────────────────

export interface StoredTranscript {
  id: string;
  date: number;
  text: string;
  chunks: Array<{
    text: string;
    timestamp: [number, number | null];
  }>;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export interface ShortcutPreferences {
  recordingToggle: string;
  dictationToggle: string;
}

export interface ModelPreferences {
  selectedModel: string;
  multilingual: boolean;
  quantized: boolean;
  language: string;
  asrType?: 'whisper' | 'parakeet';
}

export interface MeetingPreferences {
  systemAudioEnabled: boolean;
  autoRecordMode: 'manual' | 'ask' | 'auto' | 'auto-stop';
}

export interface AppPreferences {
  launchAtLogin: boolean;
  showMenuBar: boolean;
  showDockIcon: boolean;
}

export interface AudioPreferences {
  micGain: number;
  noiseSuppression: boolean;
  labelSpeakers: boolean;
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'auto';
  accentLight: string;
  accentDark: string;
  density: 'comfortable' | 'compact';
}

export interface LMStudioPreferences {
  baseUrl: string;
  model: string;
}

export interface CalendarPreferences {
  feedUrl: string;
}

// The store persists only the encrypted form (see get/saveCalendarPreferences
// below) — feedUrl is a bearer-token-like secret (the URL alone grants read
// access to the full calendar), unlike other preferences in this schema.
export interface StoredCalendarPreferences {
  encryptedFeedUrl: string;
}

export interface StoreSchema {
  meetings: Recording[];
  meetingsMigrated: boolean;
  recordingTypeMigrated: boolean;
  shortcuts?: ShortcutPreferences;
  modelPreferences?: ModelPreferences;
  meetingPreferences?: MeetingPreferences;
  appPreferences?: AppPreferences;
  audioPreferences?: AudioPreferences;
  uiPreferences?: UIPreferences;
  lmStudioPreferences?: LMStudioPreferences;
  calendarPreferences?: StoredCalendarPreferences;
  transcriptHistory?: StoredTranscript[];
  dismissedMeetingKeys?: string[];
}

export const DEFAULT_SHORTCUTS: ShortcutPreferences = {
  recordingToggle: RECORDING_SHORTCUT,
  dictationToggle: DICTATION_SHORTCUT,
};

export const DEFAULT_MODEL_PREFERENCES: ModelPreferences = {
  selectedModel: 'Xenova/whisper-tiny',
  multilingual: false,
  quantized: false,
  language: 'english',
  asrType: 'whisper',
};

export const DEFAULT_MEETING_PREFERENCES: MeetingPreferences = {
  systemAudioEnabled: false,
  autoRecordMode: 'manual',
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  launchAtLogin: false,
  showMenuBar: true,
  showDockIcon: true,
};

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  micGain: 62,
  noiseSuppression: true,
  labelSpeakers: true,
};

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  theme: 'dark',
  accentLight: '#2f6bed',
  accentDark: '#4f8cff',
  density: 'comfortable',
};

export const DEFAULT_LM_STUDIO_PREFERENCES: LMStudioPreferences = {
  baseUrl: 'http://localhost:1234',
  model: '',
};

export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
  feedUrl: '',
};

export const DEFAULT_STORED_CALENDAR_PREFERENCES: StoredCalendarPreferences = {
  encryptedFeedUrl: '',
};
