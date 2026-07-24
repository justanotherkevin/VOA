import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CHANNELS } from '@/lib/ipc-channels';

const handlers: Record<string, Function> = {};
const mockIpcMain = {
  handle: (channel: string, handler: Function) => {
    handlers[channel] = handler;
  },
};

const mockGetCalendarPreferences = vi.fn();
const mockSaveCalendarPreferences = vi.fn();
const mockFromURL = vi.fn();
const mockDeclineCalendarMatch = vi.fn();
const mockSelectCalendarMatch = vi.fn();

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
}));

vi.mock('electron-log', () => ({
  log: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/main/store', () => ({
  getCalendarPreferences: (...args: any[]) =>
    mockGetCalendarPreferences(...args),
  saveCalendarPreferences: (...args: any[]) =>
    mockSaveCalendarPreferences(...args),
}));

vi.mock('node-ical', () => ({
  async: { fromURL: (...args: any[]) => mockFromURL(...args) },
}));

vi.mock('@/main/services/transcriber', () => ({
  default: {
    declineCalendarMatch: (...args: any[]) => mockDeclineCalendarMatch(...args),
    selectCalendarMatch: (...args: any[]) => mockSelectCalendarMatch(...args),
  },
}));

describe('Calendar IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(handlers)) delete handlers[key];
  });

  async function loadAndRegister() {
    const { registerCalendarHandlers } = await import('../calendar');
    registerCalendarHandlers();
    return handlers;
  }

  it('registers GET_PREFERENCES, SET_PREFERENCES, TEST_CONNECTION, DECLINE_MATCH, and SELECT_MATCH handlers', async () => {
    const h = await loadAndRegister();
    expect(h[CHANNELS.CALENDAR.GET_PREFERENCES]).toBeDefined();
    expect(h[CHANNELS.CALENDAR.SET_PREFERENCES]).toBeDefined();
    expect(h[CHANNELS.CALENDAR.TEST_CONNECTION]).toBeDefined();
    expect(h[CHANNELS.CALENDAR.DECLINE_MATCH]).toBeDefined();
    expect(h[CHANNELS.CALENDAR.SELECT_MATCH]).toBeDefined();
  });

  it('GET_PREFERENCES returns the stored preferences', async () => {
    mockGetCalendarPreferences.mockReturnValue({
      feedUrl: 'https://example.com/feed.ics',
    });
    const h = await loadAndRegister();

    const result = await h[CHANNELS.CALENDAR.GET_PREFERENCES]();

    expect(result).toEqual({ feedUrl: 'https://example.com/feed.ics' });
  });

  it('SET_PREFERENCES saves and returns success', async () => {
    const h = await loadAndRegister();

    const result = await h[CHANNELS.CALENDAR.SET_PREFERENCES](
      {},
      { feedUrl: 'https://example.com/feed.ics' },
    );

    expect(mockSaveCalendarPreferences).toHaveBeenCalledWith({
      feedUrl: 'https://example.com/feed.ics',
    });
    expect(result).toEqual({ success: true });
  });

  it('SET_PREFERENCES returns failure when saving throws', async () => {
    mockSaveCalendarPreferences.mockImplementation(() => {
      throw new Error('encryption unavailable');
    });
    const h = await loadAndRegister();

    const result = await h[CHANNELS.CALENDAR.SET_PREFERENCES](
      {},
      { feedUrl: 'bad' },
    );

    expect(result.success).toBe(false);
  });

  it('TEST_CONNECTION rejects non-http(s)/webcal URLs', async () => {
    const h = await loadAndRegister();

    const result = await h[CHANNELS.CALENDAR.TEST_CONNECTION](
      {},
      'ftp://example.com/feed.ics',
    );

    expect(result.success).toBe(false);
    expect(mockFromURL).not.toHaveBeenCalled();
  });

  it('TEST_CONNECTION returns success with the event count on a reachable feed', async () => {
    mockFromURL.mockResolvedValue({
      vcalendar: { 'WR-CALNAME': 'Test' },
      'event-1': { type: 'VEVENT' },
      'event-2': { type: 'VEVENT' },
    });
    const h = await loadAndRegister();

    const result = await h[CHANNELS.CALENDAR.TEST_CONNECTION](
      {},
      'https://example.com/feed.ics',
    );

    expect(result).toEqual({ success: true, eventCount: 2 });
  });

  it('TEST_CONNECTION returns failure when the fetch throws', async () => {
    mockFromURL.mockRejectedValue(new Error('unreachable'));
    const h = await loadAndRegister();

    const result = await h[CHANNELS.CALENDAR.TEST_CONNECTION](
      {},
      'https://example.com/feed.ics',
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('unreachable');
  });

  it('DECLINE_MATCH delegates to transcriberService and returns success', async () => {
    const h = await loadAndRegister();

    const result = await h[CHANNELS.CALENDAR.DECLINE_MATCH]();

    expect(mockDeclineCalendarMatch).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('SELECT_MATCH delegates the chosen id to transcriberService and returns success', async () => {
    const h = await loadAndRegister();

    const result = await h[CHANNELS.CALENDAR.SELECT_MATCH]({}, 'evt-1');

    expect(mockSelectCalendarMatch).toHaveBeenCalledWith('evt-1');
    expect(result).toEqual({ success: true });
  });
});
