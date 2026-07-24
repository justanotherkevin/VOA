import * as ical from 'node-ical';
import type { Attendee, VEvent } from 'node-ical';
import type {
  CalendarEventMatch,
  CalendarParticipant,
  CalendarProvider,
} from './types';

// Buffer around the recording's start time within which a calendar event
// counts as "happening now" — wide enough to tolerate starting a recording a
// few minutes early/late relative to the scheduled time.
const MATCH_BUFFER_MS = 10 * 60 * 1000;

export interface IcsFeedProviderConfig {
  type: 'ics-feed';
  feedUrl: string;
}

function isVEvent(value: unknown): value is VEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'VEVENT'
  );
}

function overlapMs(
  eventStart: number,
  eventEnd: number,
  atTime: number,
): number {
  const start = Math.max(eventStart, atTime - MATCH_BUFFER_MS);
  const end = Math.min(eventEnd, atTime + MATCH_BUFFER_MS);
  return end - start;
}

function normalizeAttendees(
  attendee: Attendee[] | Attendee | undefined,
): Attendee[] {
  if (!attendee) return [];
  return Array.isArray(attendee) ? attendee : [attendee];
}

function stripMailtoPrefix(value: string): string {
  return value.replace(/^mailto:/i, '');
}

// Attendee is `string | { val: string; params: {...} }` — node-ical returns a
// bare string when the ATTENDEE property has no parameters (e.g. no CN).
function toCalendarParticipant(attendee: Attendee): CalendarParticipant {
  if (typeof attendee === 'string') {
    return { name: null, email: stripMailtoPrefix(attendee) };
  }
  return {
    name: attendee.params?.CN ?? null,
    email: attendee.val ? stripMailtoPrefix(attendee.val) : null,
  };
}

const TIME_LABEL_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

// Includes a short start-time label so near-duplicate event titles (e.g. a
// recurring "1:1" at two different times) are still distinguishable in the
// notification's Select when multiple events match.
function formatMatchTitle(event: VEvent): string {
  const summary =
    typeof event.summary === 'string' ? event.summary : 'Untitled event';
  return `${summary} — ${TIME_LABEL_FORMAT.format(event.start)}`;
}

export class IcsFeedCalendarProvider implements CalendarProvider {
  constructor(private readonly config: IcsFeedProviderConfig) {}

  async findMatchingEvents(atTime: number): Promise<CalendarEventMatch[]> {
    const data = await ical.async.fromURL(this.config.feedUrl);

    const matches: CalendarEventMatch[] = [];

    for (const value of Object.values(data)) {
      if (!isVEvent(value) || !value.start) continue;
      const eventStart = value.start.getTime();
      const eventEnd = (value.end ?? value.start).getTime();
      const overlap = overlapMs(eventStart, eventEnd, atTime);
      if (overlap <= 0) continue;

      matches.push({
        id: value.uid,
        title: formatMatchTitle(value),
        participants: normalizeAttendees(value.attendee).map(
          toCalendarParticipant,
        ),
        overlapMs: overlap,
      });
    }

    return matches.sort((a, b) => b.overlapMs - a.overlapMs);
  }
}
