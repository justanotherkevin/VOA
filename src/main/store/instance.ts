import {
  DEFAULT_SHORTCUTS,
  DEFAULT_MODEL_PREFERENCES,
  DEFAULT_MEETING_PREFERENCES,
  DEFAULT_APP_PREFERENCES,
  DEFAULT_AUDIO_PREFERENCES,
  DEFAULT_UI_PREFERENCES,
  DEFAULT_LM_STUDIO_PREFERENCES,
  DEFAULT_STORED_CALENDAR_PREFERENCES,
  StoreSchema,
} from './schema';
import { runMigrations } from './migrations';

let store: any;

export function getStore(): any {
  return store;
}

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
      recordingTypeMigrated: false,
      shortcuts: DEFAULT_SHORTCUTS,
      modelPreferences: DEFAULT_MODEL_PREFERENCES,
      meetingPreferences: DEFAULT_MEETING_PREFERENCES,
      appPreferences: DEFAULT_APP_PREFERENCES,
      audioPreferences: DEFAULT_AUDIO_PREFERENCES,
      uiPreferences: DEFAULT_UI_PREFERENCES,
      lmStudioPreferences: DEFAULT_LM_STUDIO_PREFERENCES,
      calendarPreferences: DEFAULT_STORED_CALENDAR_PREFERENCES,
      dismissedMeetingKeys: [],
    },
  });

  runMigrations(store);

  if (process.env.E2E_TEST === 'true') {
    (global as any).__e2eStore = store;
  }
}
