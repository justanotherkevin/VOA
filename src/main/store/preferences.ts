import { safeStorage } from 'electron';
import log from 'electron-log';
import { getStore } from './instance';
import {
  ShortcutPreferences,
  ModelPreferences,
  MeetingPreferences,
  AppPreferences,
  AudioPreferences,
  UIPreferences,
  LMStudioPreferences,
  CalendarPreferences,
  PastePreferences,
  SummarizerProviderType,
  DEFAULT_SHORTCUTS,
  DEFAULT_MODEL_PREFERENCES,
  DEFAULT_MEETING_PREFERENCES,
  DEFAULT_APP_PREFERENCES,
  DEFAULT_AUDIO_PREFERENCES,
  DEFAULT_UI_PREFERENCES,
  DEFAULT_LM_STUDIO_PREFERENCES,
  DEFAULT_CALENDAR_PREFERENCES,
  DEFAULT_STORED_CALENDAR_PREFERENCES,
  DEFAULT_PASTE_PREFERENCES,
  DEFAULT_SUMMARIZER_PROVIDER,
} from './schema';

// ─── Shortcuts ────────────────────────────────────────────────────────────────

export function getShortcuts(): ShortcutPreferences {
  // Merge with defaults so installs upgraded from a version that only
  // persisted `recordingToggle` still get a `dictationToggle` fallback.
  return { ...DEFAULT_SHORTCUTS, ...getStore()?.get('shortcuts') };
}

export function saveShortcuts(shortcuts: ShortcutPreferences): void {
  getStore()?.set('shortcuts', shortcuts);
}

export function updateRecordingToggleShortcut(shortcut: string): void {
  const shortcuts = getShortcuts();
  shortcuts.recordingToggle = shortcut;
  getStore()?.set('shortcuts', shortcuts);
}

export function updateDictationToggleShortcut(shortcut: string): void {
  const shortcuts = getShortcuts();
  shortcuts.dictationToggle = shortcut;
  getStore()?.set('shortcuts', shortcuts);
}

// ─── Model Preferences ────────────────────────────────────────────────────────

export function getModelPreferences(): ModelPreferences {
  const store = getStore();
  if (!store) return DEFAULT_MODEL_PREFERENCES;

  const preferences =
    store.get('modelPreferences') ?? DEFAULT_MODEL_PREFERENCES;

  if (preferences.selectedModel?.startsWith('distil-whisper/')) {
    log.info(
      `[Store] getModelPreferences: resetting distil-whisper selectedModel=${preferences.selectedModel} to default`,
    );
    preferences.selectedModel = DEFAULT_MODEL_PREFERENCES.selectedModel;
    store.set('modelPreferences', preferences);
  }

  if (
    preferences.selectedModel &&
    /\/whisper-(small|medium)(\.en)?$/.test(preferences.selectedModel)
  ) {
    log.info(
      `[Store] getModelPreferences: resetting disabled selectedModel=${preferences.selectedModel} to default`,
    );
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
  getStore()?.set('modelPreferences', preferences);
}

export function updateModelPreferences(
  preferences: Partial<ModelPreferences>,
): void {
  const store = getStore();
  const current = store?.get('modelPreferences') ?? DEFAULT_MODEL_PREFERENCES;
  log.info(
    `[Store] updateModelPreferences: ${JSON.stringify(preferences)} (previous selectedModel=${current.selectedModel})`,
  );
  store?.set('modelPreferences', { ...current, ...preferences });
}

// ─── Meeting Preferences ──────────────────────────────────────────────────────

export function getMeetingPreferences(): MeetingPreferences {
  return getStore()?.get('meetingPreferences') ?? DEFAULT_MEETING_PREFERENCES;
}

export function saveMeetingPreferences(
  prefs: Partial<MeetingPreferences>,
): void {
  const store = getStore();
  const current =
    store?.get('meetingPreferences') ?? DEFAULT_MEETING_PREFERENCES;
  store?.set('meetingPreferences', { ...current, ...prefs });
}

// ─── LM Studio Preferences ────────────────────────────────────────────────────

export function getLMStudioPreferences(): LMStudioPreferences {
  return (
    getStore()?.get('lmStudioPreferences') ?? DEFAULT_LM_STUDIO_PREFERENCES
  );
}

export function saveLMStudioPreferences(
  prefs: Partial<LMStudioPreferences>,
): void {
  const store = getStore();
  const current =
    store?.get('lmStudioPreferences') ?? DEFAULT_LM_STUDIO_PREFERENCES;
  store?.set('lmStudioPreferences', { ...current, ...prefs });
}

// ─── Summarizer Provider ──────────────────────────────────────────────────────

export function getSummarizerProvider(): SummarizerProviderType {
  return getStore()?.get('summarizerProvider') ?? DEFAULT_SUMMARIZER_PROVIDER;
}

export function saveSummarizerProvider(provider: SummarizerProviderType): void {
  getStore()?.set('summarizerProvider', provider);
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export function getOnboardingCompleted(): boolean {
  return getStore()?.get('onboardingCompleted') ?? false;
}

export function saveOnboardingCompleted(completed: boolean): void {
  getStore()?.set('onboardingCompleted', completed);
}

// ─── Calendar Preferences ─────────────────────────────────────────────────────

export function getCalendarPreferences(): CalendarPreferences {
  const stored =
    getStore()?.get('calendarPreferences') ??
    DEFAULT_STORED_CALENDAR_PREFERENCES;
  if (!stored.encryptedFeedUrl) return DEFAULT_CALENDAR_PREFERENCES;

  try {
    const feedUrl = safeStorage.decryptString(
      Buffer.from(stored.encryptedFeedUrl, 'base64'),
    );
    return { feedUrl };
  } catch (error) {
    log.info(
      '[Store] Failed to decrypt calendar feed URL, treating as not configured:',
      error,
    );
    return DEFAULT_CALENDAR_PREFERENCES;
  }
}

export function saveCalendarPreferences(
  prefs: Partial<CalendarPreferences>,
): void {
  if (prefs.feedUrl === undefined) return;

  const encryptedFeedUrl = prefs.feedUrl
    ? safeStorage.encryptString(prefs.feedUrl).toString('base64')
    : '';
  getStore()?.set('calendarPreferences', { encryptedFeedUrl });
}

// ─── App Preferences ──────────────────────────────────────────────────────────

export function getAppPreferences(): AppPreferences {
  return getStore()?.get('appPreferences') ?? DEFAULT_APP_PREFERENCES;
}

export function saveAppPreferences(prefs: Partial<AppPreferences>): void {
  const store = getStore();
  const current = store?.get('appPreferences') ?? DEFAULT_APP_PREFERENCES;
  store?.set('appPreferences', { ...current, ...prefs });
}

// ─── Audio Preferences ────────────────────────────────────────────────────────

export function getAudioPreferences(): AudioPreferences {
  return getStore()?.get('audioPreferences') ?? DEFAULT_AUDIO_PREFERENCES;
}

export function saveAudioPreferences(prefs: Partial<AudioPreferences>): void {
  const store = getStore();
  const current = store?.get('audioPreferences') ?? DEFAULT_AUDIO_PREFERENCES;
  store?.set('audioPreferences', { ...current, ...prefs });
}

// ─── UI Preferences ───────────────────────────────────────────────────────────

export function getUIPreferences(): UIPreferences {
  return getStore()?.get('uiPreferences') ?? DEFAULT_UI_PREFERENCES;
}

export function saveUIPreferences(prefs: Partial<UIPreferences>): void {
  const store = getStore();
  const current = store?.get('uiPreferences') ?? DEFAULT_UI_PREFERENCES;
  store?.set('uiPreferences', { ...current, ...prefs });
}

// ─── Paste Preferences ────────────────────────────────────────────────────────

const MAX_ALLOWED_APPS = 50;

export function getPastePreferences(): PastePreferences {
  return getStore()?.get('pastePreferences') ?? DEFAULT_PASTE_PREFERENCES;
}

export function savePastePreferences(prefs: Partial<PastePreferences>): void {
  const store = getStore();
  const current = store?.get('pastePreferences') ?? DEFAULT_PASTE_PREFERENCES;
  const merged = { ...current, ...prefs };

  // Validate the merged result rather than trusting the renderer's payload —
  // a buggy or compromised renderer could otherwise persist `enabled: 1` or
  // `allowedApps: "Term"` (which would make `.includes()` do substring
  // matching). Non-boolean enabled coerces to false (paste stays off); a
  // non-array allowedApps is replaced with []; duplicates are removed and
  // the list is capped.
  const sanitized: PastePreferences = {
    enabled: merged.enabled,
    allowedApps: [],
  };

  if (typeof merged.enabled !== 'boolean') {
    log.info(
      `[Store] savePastePreferences: coerced non-boolean enabled=${JSON.stringify(merged.enabled)} to false`,
    );
    sanitized.enabled = false;
  }

  if (!Array.isArray(merged.allowedApps)) {
    log.info(
      `[Store] savePastePreferences: replaced invalid allowedApps=${JSON.stringify(merged.allowedApps)} with []`,
    );
  } else {
    const uniqueApps = Array.from(
      new Set(
        merged.allowedApps.filter(
          (app) => typeof app === 'string' && app.trim().length > 0,
        ),
      ),
    );
    if (uniqueApps.length > MAX_ALLOWED_APPS) {
      log.info(
        `[Store] savePastePreferences: truncated allowedApps from ${uniqueApps.length} to ${MAX_ALLOWED_APPS} entries`,
      );
      uniqueApps.length = MAX_ALLOWED_APPS;
    }
    if (uniqueApps.length !== merged.allowedApps.length) {
      log.info(
        `[Store] savePastePreferences: cleaned allowedApps (${merged.allowedApps.length} -> ${uniqueApps.length} entries)`,
      );
    }
    sanitized.allowedApps = uniqueApps;
  }

  store?.set('pastePreferences', sanitized);
}
