import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CalendarResponse, VEvent } from 'node-ical';

const mockFromURL = vi.fn();

vi.mock('node-ical', () => ({
  async: { fromURL: (...args: any[]) => mockFromURL(...args) },
}));

import { IcsFeedCalendarProvider } from '../ics-feed-calendar-provider';

function makeVEvent(overrides: Partial<VEvent> = {}): VEvent {
  return {
    type: 'VEVENT',
    uid: 'event-1',
    summary: 'Team Sync',
    start: new Date('2026-07-23T10:00:00Z') as any,
    end: new Date('2026-07-23T10:30:00Z') as any,
    ...overrides,
  } as VEvent;
}

describe('IcsFeedCalendarProvider', () => {
  beforeEach(() => {
    mockFromURL.mockReset();
  });

  const provider = new IcsFeedCalendarProvider({
    type: 'ics-feed',
    feedUrl: 'https://example.com/feed.ics',
  });

  const atTime = new Date('2026-07-23T10:00:00Z').getTime();
  const TEN_MIN_MS = 10 * 60 * 1000;

  it('returns attendees for the event overlapping atTime', async () => {
    const data: CalendarResponse = {
      'event-1': makeVEvent({
        attendee: [
          { val: 'mailto:alice@example.com', params: { CN: 'Alice' } },
          { val: 'mailto:bob@example.com', params: {} },
        ] as any,
      }),
    };
    mockFromURL.mockResolvedValue(data);

    const result = await provider.findMatchingEvents(atTime);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('event-1');
    expect(result[0].title).toContain('Team Sync');
    expect(result[0].participants).toEqual([
      { name: 'Alice', email: 'alice@example.com' },
      { name: null, email: 'bob@example.com' },
    ]);
    expect(result[0].overlapMs).toBeGreaterThan(0);
  });

  it('returns [] when no event is within the buffer window', async () => {
    const data: CalendarResponse = {
      'event-1': makeVEvent({
        start: new Date('2026-07-24T10:00:00Z') as any,
        end: new Date('2026-07-24T10:30:00Z') as any,
        attendee: [
          { val: 'mailto:alice@example.com', params: { CN: 'Alice' } },
        ] as any,
      }),
    };
    mockFromURL.mockResolvedValue(data);

    const result = await provider.findMatchingEvents(atTime);

    expect(result).toEqual([]);
  });

  it('returns all overlapping events sorted by overlap descending', async () => {
    const data: CalendarResponse = {
      short: makeVEvent({
        uid: 'short',
        summary: 'Short Overlap',
        start: new Date('2026-07-23T09:55:00Z') as any,
        end: new Date('2026-07-23T10:02:00Z') as any,
        attendee: [{ val: 'mailto:short@example.com', params: {} }] as any,
      }),
      long: makeVEvent({
        uid: 'long',
        summary: 'Long Overlap',
        start: new Date('2026-07-23T10:00:00Z') as any,
        end: new Date('2026-07-23T10:30:00Z') as any,
        attendee: [{ val: 'mailto:long@example.com', params: {} }] as any,
      }),
    };
    mockFromURL.mockResolvedValue(data);

    const result = await provider.findMatchingEvents(atTime);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('long');
    expect(result[1].id).toBe('short');
    expect(result[0].overlapMs).toBeGreaterThan(result[1].overlapMs);
  });

  it('includes an event that starts just inside the 10-minute buffer', async () => {
    const data: CalendarResponse = {
      'event-1': makeVEvent({
        start: new Date(atTime + TEN_MIN_MS - 60_000) as any, // 9 min after atTime
        end: new Date(atTime + TEN_MIN_MS + 30 * 60_000) as any,
      }),
    };
    mockFromURL.mockResolvedValue(data);

    const result = await provider.findMatchingEvents(atTime);

    expect(result).toHaveLength(1);
  });

  it('excludes an event that starts just outside the 10-minute buffer', async () => {
    const data: CalendarResponse = {
      'event-1': makeVEvent({
        start: new Date(atTime + TEN_MIN_MS + 60_000) as any, // 11 min after atTime
        end: new Date(atTime + TEN_MIN_MS + 30 * 60_000) as any,
      }),
    };
    mockFromURL.mockResolvedValue(data);

    const result = await provider.findMatchingEvents(atTime);

    expect(result).toEqual([]);
  });

  it('handles a bare-string attendee (no parameters)', async () => {
    const data: CalendarResponse = {
      'event-1': makeVEvent({ attendee: 'mailto:carol@example.com' as any }),
    };
    mockFromURL.mockResolvedValue(data);

    const result = await provider.findMatchingEvents(atTime);

    expect(result[0].participants).toEqual([
      { name: null, email: 'carol@example.com' },
    ]);
  });

  it('returns an empty participants list when the matched event has no attendees', async () => {
    const data: CalendarResponse = {
      'event-1': makeVEvent(),
    };
    mockFromURL.mockResolvedValue(data);

    const result = await provider.findMatchingEvents(atTime);

    expect(result).toHaveLength(1);
    expect(result[0].participants).toEqual([]);
  });

  it('ignores non-VEVENT entries in the calendar response', async () => {
    const data: CalendarResponse = {
      vcalendar: { 'WR-CALNAME': 'Test' } as any,
      'event-1': makeVEvent({
        attendee: [
          { val: 'mailto:alice@example.com', params: { CN: 'Alice' } },
        ] as any,
      }),
    };
    mockFromURL.mockResolvedValue(data);

    const result = await provider.findMatchingEvents(atTime);

    expect(result).toHaveLength(1);
    expect(result[0].participants).toEqual([
      { name: 'Alice', email: 'alice@example.com' },
    ]);
  });
});
