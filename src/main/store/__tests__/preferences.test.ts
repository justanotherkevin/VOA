import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getPastePreferences, savePastePreferences } from '../preferences';

const data = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../instance', () => ({
  getStore: () => ({
    get: (key: string) => data.get(key),
    set: (key: string, value: unknown) => data.set(key, value),
  }),
}));
vi.mock('electron-log', () => ({ default: { info: vi.fn() } }));

describe('paste preferences saved before copyToClipboard existed', () => {
  beforeEach(() => {
    data.clear();
    data.set('pastePreferences', { enabled: false, allowedApps: ['Slack'] });
  });

  it('reads copyToClipboard as its default (true)', () => {
    expect(getPastePreferences()).toEqual({
      enabled: false,
      allowedApps: ['Slack'],
      copyToClipboard: true,
    });
  });

  it('keeps the default when an unrelated field is saved', () => {
    savePastePreferences({ enabled: true });
    expect(data.get('pastePreferences')).toEqual({
      enabled: true,
      allowedApps: ['Slack'],
      copyToClipboard: true,
    });
  });
});
