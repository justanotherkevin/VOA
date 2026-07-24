#!/usr/bin/env node
/**
 * Fetches real events from an ICS feed for a given local date and prints a
 * JSON object describing them, for exploring what calendar data is actually
 * available before deciding what to build on top of it.
 *
 * The `matches` field mirrors what IcsFeedCalendarProvider.findMatchingEvents()
 * (src/main/pipeline/ics-feed-calendar-provider.ts) actually hands to the app
 * today. `raw` includes everything else node-ical parses off each VEVENT
 * (description, location, organizer, status, categories, attendee PARTSTAT/
 * ROLE, recurrence) that the provider currently discards — useful for
 * brainstorming what else could be surfaced.
 *
 * The feed URL is stored encrypted in the app (electron-store + safeStorage,
 * see src/main/store.ts) and can't be decrypted outside a running Electron
 * app, so it must be passed explicitly here — same requirement as
 * scripts/check-calendar-feed.mjs.
 *
 * Usage:
 *   node scripts/generate-calendar-fixture.mjs <feedUrl> --date 2026-07-22 [--out <path>]
 *
 * Defaults:
 *   --out: tests/e2e/mocks/calendar-fixture-<date>.json
 */

import * as ical from 'node-ical';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Must match MATCH_BUFFER_MS in ics-feed-calendar-provider.ts.
const MATCH_BUFFER_MS = 10 * 60 * 1000;

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};
const c = (color, s) => `${color}${s}${C.reset}`;

const args = process.argv.slice(2);
const feedUrl = args.find((a) => !a.startsWith('--'));
const dateFlag = args.indexOf('--date');
const outFlag = args.indexOf('--out');

if (!feedUrl || dateFlag === -1) {
  console.error(
    c(
      C.red,
      'Usage: node scripts/generate-calendar-fixture.mjs <feedUrl> --date YYYY-MM-DD [--out <path>]',
    ),
  );
  process.exit(1);
}

const dateStr = args[dateFlag + 1];
const outPath =
  outFlag !== -1
    ? resolve(args[outFlag + 1])
    : resolve(`tests/e2e/mocks/calendar-fixture-${dateStr}.json`);

function isSameLocalDate(date, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return (
    date.getFullYear() === y &&
    date.getMonth() + 1 === m &&
    date.getDate() === d
  );
}

function overlapMs(eventStart, eventEnd, atTime) {
  const start = Math.max(eventStart, atTime - MATCH_BUFFER_MS);
  const end = Math.min(eventEnd, atTime + MATCH_BUFFER_MS);
  return end - start;
}

function stripMailtoPrefix(value) {
  return value.replace(/^mailto:/i, '');
}

// Mirrors toCalendarParticipant() in ics-feed-calendar-provider.ts.
function toCalendarParticipant(attendee) {
  if (typeof attendee === 'string') {
    return { name: null, email: stripMailtoPrefix(attendee) };
  }
  return {
    name: attendee.params?.CN ?? null,
    email: attendee.val ? stripMailtoPrefix(attendee.val) : null,
  };
}

function normalizeAttendees(attendee) {
  if (!attendee) return [];
  return Array.isArray(attendee) ? attendee : [attendee];
}

const TIME_LABEL_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

function formatMatchTitle(event) {
  const summary =
    typeof event.summary === 'string' ? event.summary : 'Untitled event';
  return `${summary} — ${TIME_LABEL_FORMAT.format(event.start)}`;
}

// Everything node-ical parses off a VEVENT beyond what the provider
// currently uses — kept separate so it's obvious what's "available but
// unused" vs. what the app already consumes.
function toRawEvent(event) {
  return {
    uid: event.uid ?? null,
    summary: event.summary ?? null,
    description: event.description ?? null,
    location: event.location ?? null,
    status: event.status ?? null,
    categories: event.categories ?? null,
    organizer: event.organizer
      ? {
          name: event.organizer.params?.CN ?? null,
          email: stripMailtoPrefix(
            String(event.organizer.val ?? event.organizer),
          ),
        }
      : null,
    attendees: normalizeAttendees(event.attendee).map((a) => ({
      ...toCalendarParticipant(a),
      role: typeof a === 'object' ? (a.params?.ROLE ?? null) : null,
      partstat: typeof a === 'object' ? (a.params?.PARTSTAT ?? null) : null,
    })),
    isRecurring: Boolean(event.rrule),
    start: event.start.toISOString(),
    end: (event.end ?? event.start).toISOString(),
  };
}

(async () => {
  console.log(c(C.dim, `Fetching ${feedUrl} ...`));
  let data;
  try {
    data = await ical.async.fromURL(feedUrl);
  } catch (error) {
    console.log(c(C.red, `✗ Fetch failed: ${error.message}`));
    process.exit(1);
  }

  const events = Object.values(data).filter(
    (v) => v?.type === 'VEVENT' && v.start && isSameLocalDate(v.start, dateStr),
  );

  if (events.length === 0) {
    console.log(c(C.yellow, `No events found on ${dateStr}.`));
    process.exit(0);
  }

  console.log(c(C.green, `✓ Found ${events.length} event(s) on ${dateStr}:`));
  events.forEach((e) =>
    console.log(
      c(
        C.cyan,
        `  - ${e.summary ?? 'Untitled event'} (${e.start.toLocaleTimeString()}–${(e.end ?? e.start).toLocaleTimeString()})`,
      ),
    ),
  );

  // atTime used for the `matches` overlap calc: midpoint of each event's own
  // start, so every fetched event on the date comes back "matched" — this is
  // exploratory output, not a strict findMatchingEvents() reproduction against
  // a single recording start time.
  const output = {
    date: dateStr,
    fetchedAt: new Date().toISOString(),
    matches: events.map((e) => {
      const eventStart = e.start.getTime();
      const eventEnd = (e.end ?? e.start).getTime();
      return {
        id: e.uid,
        title: formatMatchTitle(e),
        participants: normalizeAttendees(e.attendee).map(toCalendarParticipant),
        overlapMs: overlapMs(eventStart, eventEnd, eventStart),
      };
    }),
    raw: events.map(toRawEvent),
  };

  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(c(C.bold + C.green, `\nWrote fixture to ${outPath}`));
})();
