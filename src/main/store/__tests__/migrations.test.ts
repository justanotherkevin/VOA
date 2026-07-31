import { describe, it, expect } from 'vitest';
import { runMigrations, formatParticipantsTitle } from '../migrations';

// Minimal in-memory stand-in for the `electron-store` instance `runMigrations`
// receives — the function only ever calls `.get`/`.set` on it.
function createFakeStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    get: (key: string) => data.get(key),
    set: (key: string, value: unknown) => data.set(key, value),
  };
}

describe('runMigrations — summarizerProvider migration', () => {
  it('leaves summarizerProvider untouched on a fresh store (falls through to the builtin default elsewhere)', () => {
    const store = createFakeStore({
      meetingsMigrated: true,
      recordingTypeMigrated: true,
    });

    runMigrations(store);

    expect(store.get('summarizerProvider')).toBeUndefined();
    expect(store.get('summarizerProviderMigrated')).toBe(true);
  });

  it('force-sets summarizerProvider to lmstudio when lmStudioPreferences has a non-default baseUrl', () => {
    const store = createFakeStore({
      meetingsMigrated: true,
      recordingTypeMigrated: true,
      lmStudioPreferences: { baseUrl: 'http://192.168.1.5:1234', model: '' },
    });

    runMigrations(store);

    expect(store.get('summarizerProvider')).toBe('lmstudio');
    expect(store.get('summarizerProviderMigrated')).toBe(true);
  });

  it('force-sets summarizerProvider to lmstudio when lmStudioPreferences has a non-empty model', () => {
    const store = createFakeStore({
      meetingsMigrated: true,
      recordingTypeMigrated: true,
      lmStudioPreferences: {
        baseUrl: 'http://localhost:1234',
        model: 'qwen2.5-1.5b-instruct',
      },
    });

    runMigrations(store);

    expect(store.get('summarizerProvider')).toBe('lmstudio');
  });

  it('leaves summarizerProvider untouched when lmStudioPreferences looks like the untouched default', () => {
    const store = createFakeStore({
      meetingsMigrated: true,
      recordingTypeMigrated: true,
      lmStudioPreferences: { baseUrl: 'http://localhost:1234', model: '' },
    });

    runMigrations(store);

    expect(store.get('summarizerProvider')).toBeUndefined();
  });

  it('does not touch summarizerProvider if it was already explicitly set', () => {
    const store = createFakeStore({
      meetingsMigrated: true,
      recordingTypeMigrated: true,
      summarizerProvider: 'ollama',
      lmStudioPreferences: { baseUrl: 'http://192.168.1.5:1234', model: '' },
    });

    runMigrations(store);

    expect(store.get('summarizerProvider')).toBe('ollama');
  });

  it('only runs once — a second call is a no-op even if lmStudioPreferences changes afterward', () => {
    const store = createFakeStore({
      meetingsMigrated: true,
      recordingTypeMigrated: true,
    });

    runMigrations(store);
    expect(store.get('summarizerProvider')).toBeUndefined();

    store.set('lmStudioPreferences', {
      baseUrl: 'http://192.168.1.5:1234',
      model: '',
    });
    runMigrations(store);

    expect(store.get('summarizerProvider')).toBeUndefined();
  });
});

describe('formatParticipantsTitle', () => {
  it('formats a single participant', () => {
    expect(formatParticipantsTitle(['Alice'])).toBe('Meeting with Alice');
  });

  it('formats two participants', () => {
    expect(formatParticipantsTitle(['Alice', 'Bob'])).toBe(
      'Meeting with Alice and Bob',
    );
  });

  it('formats three participants', () => {
    expect(formatParticipantsTitle(['Alice', 'Bob', 'Carol'])).toBe(
      'Meeting with Alice, Bob, and Carol',
    );
  });

  it('formats four or more participants with an "and N others" suffix', () => {
    expect(
      formatParticipantsTitle(['Alice', 'Bob', 'Carol', 'Dave']),
    ).toBe('Meeting with Alice, Bob, and 2 others');
  });
});
