import { RECORDING_SHORTCUT } from '@/lib/shortcuts';
import log from 'electron-log';

let store: any;

// ─── Meeting Data Model ───────────────────────────────────────────────────────

export interface MeetingActionItem {
  text: string;
  done: boolean;
}

export interface Meeting {
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
  isMeeting: boolean;
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

interface StoreSchema {
  meetings: Meeting[];
  meetingsMigrated: boolean;
  shortcuts?: ShortcutPreferences;
  modelPreferences?: ModelPreferences;
  meetingPreferences?: MeetingPreferences;
  appPreferences?: AppPreferences;
  audioPreferences?: AudioPreferences;
  uiPreferences?: UIPreferences;
  lmStudioPreferences?: LMStudioPreferences;
  transcriptHistory?: StoredTranscript[];
  dismissedMeetingKeys?: string[];
}

export const DEFAULT_SHORTCUTS: ShortcutPreferences = {
  recordingToggle: RECORDING_SHORTCUT,
};

const DEFAULT_MODEL_PREFERENCES: ModelPreferences = {
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

// ─── Store Init ───────────────────────────────────────────────────────────────

export async function initializeStore() {
  const { default: Store } = await import('electron-store');
  // E2E_STORE_NAME is a runtime env var (not replaced at build time like VITE_*).
  // Passing it via electronApp.launch env lets tests use an isolated store file.
  // eg. ~/Library/Application Support/voa/audio-to-text.json
  const storeName = process.env.E2E_STORE_NAME || 'audio-to-text';
  store = new Store<StoreSchema>({
    name: storeName,
    defaults: {
      meetings: [],
      meetingsMigrated: false,
      shortcuts: DEFAULT_SHORTCUTS,
      modelPreferences: DEFAULT_MODEL_PREFERENCES,
      meetingPreferences: DEFAULT_MEETING_PREFERENCES,
      appPreferences: DEFAULT_APP_PREFERENCES,
      audioPreferences: DEFAULT_AUDIO_PREFERENCES,
      uiPreferences: DEFAULT_UI_PREFERENCES,
      lmStudioPreferences: DEFAULT_LM_STUDIO_PREFERENCES,
      dismissedMeetingKeys: [],
    },
  });

  runMigrations();

  if (process.env.E2E_TEST === 'true') {
    (global as any).__e2eStore = store;
  }
}

// ─── Migration ────────────────────────────────────────────────────────────────

function migrateOldMeeting(m: any): Meeting {
  const summary = m.summary ?? '';
  const summaryStatus = m.summaryStatus ?? 'ready';
  return {
    ...m,
    isMeeting: m.isMeeting ?? false,
    summary,
    summaryStatus,
    decisions: m.decisions ?? [],
    topics: m.topics ?? [],
  };
}

function runMigrations() {
  if (store.get('meetingsMigrated')) return;

  const oldHistory: StoredTranscript[] = store.get('transcriptHistory') ?? [];
  if (oldHistory.length > 0) {
    const meetings: Meeting[] = oldHistory.map((t) => ({
      id: t.id,
      title: generateTitle(t.text),
      startedAt: t.date,
      endedAt: t.date,
      durationMs: 0,
      transcript: t.text,
      chunks: t.chunks,
      summary: '',
      summaryStatus: 'ready' as const,
      decisions: [],
      topics: [],
      actionItems: [],
      audioSource: 'mic' as const,
      participants: [],
      tags: [],
    }));
    store.set('meetings', meetings);
    log.info(`[Store] Migrated ${meetings.length} transcripts → meetings`);
  }

  store.set('meetingsMigrated', true);
}

// ─── Meeting CRUD ─────────────────────────────────────────────────────────────

export function saveMeeting(data: Omit<Meeting, 'id'>): Meeting {
  const meetings: Meeting[] = store.get('meetings') ?? [];
  const newMeeting: Meeting = {
    id: crypto.randomUUID(),
    ...data,
  };

  meetings.unshift(newMeeting);

  if (meetings.length > 100) {
    meetings.length = 100;
  }

  store.set('meetings', meetings);
  return newMeeting;
}

export function getMeetings(): Meeting[] {
  const meetings: any[] = store.get('meetings') ?? [];
  return meetings.map(migrateOldMeeting);
}

export function getMeetingById(id: string): Meeting | null {
  const meetings: any[] = store.get('meetings') ?? [];
  const found = meetings.find((m) => m.id === id);
  return found ? migrateOldMeeting(found) : null;
}

export function updateMeeting(
  id: string,
  patch: Partial<Meeting>,
): Meeting | null {
  const meetings: Meeting[] = store.get('meetings') ?? [];
  const idx = meetings.findIndex((m) => m.id === id);
  if (idx === -1) return null;

  meetings[idx] = { ...meetings[idx], ...patch };
  store.set('meetings', meetings);
  return meetings[idx];
}

export function deleteMeeting(id: string): boolean {
  const meetings: Meeting[] = store.get('meetings') ?? [];
  const filtered = meetings.filter((m) => m.id !== id);
  if (filtered.length === meetings.length) return false;
  store.set('meetings', filtered);
  return true;
}

export function clearMeetings(): void {
  store.set('meetings', []);
}

export function generateTitle(transcript: string): string {
  if (!transcript || transcript.trim() === '') return 'Untitled Meeting';
  const words = transcript.trim().split(/\s+/);
  return words.slice(0, 8).join(' ') + (words.length > 8 ? '...' : '');
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export function getShortcuts(): ShortcutPreferences {
  return store?.get('shortcuts') ?? DEFAULT_SHORTCUTS;
}

export function saveShortcuts(shortcuts: ShortcutPreferences): void {
  store?.set('shortcuts', shortcuts);
}

export function updateRecordingToggleShortcut(shortcut: string): void {
  const shortcuts = store?.get('shortcuts') ?? DEFAULT_SHORTCUTS;
  shortcuts.recordingToggle = shortcut;
  store?.set('shortcuts', shortcuts);
}

export function getModelPreferences(): ModelPreferences {
  if (!store) return DEFAULT_MODEL_PREFERENCES;

  const preferences =
    store.get('modelPreferences') ?? DEFAULT_MODEL_PREFERENCES;

  if (preferences.selectedModel?.startsWith('distil-whisper/')) {
    preferences.selectedModel = DEFAULT_MODEL_PREFERENCES.selectedModel;
    store.set('modelPreferences', preferences);
  }

  if (!preferences.asrType) {
    preferences.asrType = 'whisper';
    store.set('modelPreferences', preferences);
  }

  return preferences;
}

export function saveModelPreferences(preferences: ModelPreferences): void {
  store?.set('modelPreferences', preferences);
}

export function updateModelPreferences(
  preferences: Partial<ModelPreferences>,
): void {
  const current = store?.get('modelPreferences') ?? DEFAULT_MODEL_PREFERENCES;
  store?.set('modelPreferences', { ...current, ...preferences });
}

export function getMeetingPreferences(): MeetingPreferences {
  return store?.get('meetingPreferences') ?? DEFAULT_MEETING_PREFERENCES;
}

export function saveMeetingPreferences(
  prefs: Partial<MeetingPreferences>,
): void {
  const current =
    store?.get('meetingPreferences') ?? DEFAULT_MEETING_PREFERENCES;
  store?.set('meetingPreferences', { ...current, ...prefs });
}

export function getLMStudioPreferences(): LMStudioPreferences {
  return store?.get('lmStudioPreferences') ?? DEFAULT_LM_STUDIO_PREFERENCES;
}

export function saveLMStudioPreferences(
  prefs: Partial<LMStudioPreferences>,
): void {
  const current =
    store?.get('lmStudioPreferences') ?? DEFAULT_LM_STUDIO_PREFERENCES;
  store?.set('lmStudioPreferences', { ...current, ...prefs });
}

// ─── Dismissed Meeting Keys ───────────────────────────────────────────────────

const MAX_DISMISSED_KEYS = 30;

export function getDismissedMeetingKeys(): string[] {
  return store?.get('dismissedMeetingKeys') ?? [];
}

export function addDismissedMeetingKey(key: string): void {
  const keys = getDismissedMeetingKeys();
  if (keys.includes(key)) return;
  keys.push(key);
  if (keys.length > MAX_DISMISSED_KEYS) {
    keys.splice(0, keys.length - MAX_DISMISSED_KEYS);
  }
  store?.set('dismissedMeetingKeys', keys);
}

// ─── Legacy compat (used by old tests) ───────────────────────────────────────

export function saveTranscript(data: {
  text: string;
  chunks: Array<{ text: string; timestamp: [number, number | null] }>;
}): StoredTranscript | null {
  if (!store || !data.text || data.text.trim() === '') return null;

  const meeting = saveMeeting({
    title: generateTitle(data.text),
    startedAt: Date.now(),
    endedAt: Date.now(),
    durationMs: 0,
    transcript: data.text,
    chunks: data.chunks,
    summary: '',
    summaryStatus: 'pending',
    decisions: [],
    topics: [],
    actionItems: [],
    audioSource: 'mic',
    participants: [],
    tags: [],
  });

  return {
    id: meeting.id,
    date: meeting.startedAt,
    text: meeting.transcript,
    chunks: meeting.chunks,
  };
}

export function getTranscriptHistory(): StoredTranscript[] {
  return getMeetings().map((m) => ({
    id: m.id,
    date: m.startedAt,
    text: m.transcript,
    chunks: m.chunks,
  }));
}

export function clearTranscriptHistory(): void {
  clearMeetings();
}

// ─── App Preferences ─────────────────────────────────────────────────────────

export function getAppPreferences(): AppPreferences {
  return store?.get('appPreferences') ?? DEFAULT_APP_PREFERENCES;
}

export function saveAppPreferences(prefs: Partial<AppPreferences>): void {
  const current = store?.get('appPreferences') ?? DEFAULT_APP_PREFERENCES;
  store?.set('appPreferences', { ...current, ...prefs });
}

// ─── Audio Preferences ────────────────────────────────────────────────────────

export function getAudioPreferences(): AudioPreferences {
  return store?.get('audioPreferences') ?? DEFAULT_AUDIO_PREFERENCES;
}

export function saveAudioPreferences(prefs: Partial<AudioPreferences>): void {
  const current = store?.get('audioPreferences') ?? DEFAULT_AUDIO_PREFERENCES;
  store?.set('audioPreferences', { ...current, ...prefs });
}

// ─── UI Preferences ───────────────────────────────────────────────────────────

export function getUIPreferences(): UIPreferences {
  return store?.get('uiPreferences') ?? DEFAULT_UI_PREFERENCES;
}

export function saveUIPreferences(prefs: Partial<UIPreferences>): void {
  const current = store?.get('uiPreferences') ?? DEFAULT_UI_PREFERENCES;
  store?.set('uiPreferences', { ...current, ...prefs });
}
