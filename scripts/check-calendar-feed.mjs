#!/usr/bin/env node
/**
 * Standalone check against a real calendar ICS feed — prints exactly what
 * IcsFeedCalendarProvider.findMatchingEvents() would compute (same ±10min
 * buffer, same attendee parsing), without needing to run the app or start a
 * recording. Useful for confirming the feed URL actually returns attendee
 * data before testing the full in-app flow.
 *
 * Usage:
 *   node scripts/check-calendar-feed.mjs <feedUrl> [--at <ISO time>]
 *
 * Defaults:
 *   --at: now
 *
 * Example:
 *   node scripts/check-calendar-feed.mjs "https://calendar.google.com/calendar/ical/.../private-.../basic.ics"
 *   node scripts/check-calendar-feed.mjs "$FEED_URL" --at 2026-07-24T14:00:00
 */

import * as ical from 'node-ical';

const MATCH_BUFFER_MS = 10 * 60 * 1000; // must match ics-feed-calendar-provider.ts

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
const atFlag = args.indexOf('--at');
const atTime =
  atFlag !== -1 ? new Date(args[atFlag + 1]).getTime() : Date.now();

if (!feedUrl) {
  console.error(
    c(
      C.red,
      'Usage: node scripts/check-calendar-feed.mjs <feedUrl> [--at <ISO time>]',
    ),
  );
  process.exit(1);
}

function overlapMs(eventStart, eventEnd, atTime) {
  const start = Math.max(eventStart, atTime - MATCH_BUFFER_MS);
  const end = Math.min(eventEnd, atTime + MATCH_BUFFER_MS);
  return end - start;
}

function formatAttendee(attendee) {
  if (typeof attendee === 'string') {
    return { name: null, email: attendee.replace(/^mailto:/i, '') };
  }
  return {
    name: attendee.params?.CN ?? null,
    email: attendee.val ? attendee.val.replace(/^mailto:/i, '') : null,
  };
}

(async () => {
  console.log(c(C.dim, `Fetching ${feedUrl} ...`));
  const t0 = Date.now();

  let data;
  try {
    data = await ical.async.fromURL(feedUrl);
  } catch (error) {
    console.log(
      c(
        C.red,
        `✗ Fetch failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${error.message}`,
      ),
    );
    process.exit(1);
  }

  const allEvents = Object.values(data).filter(
    (v) => v?.type === 'VEVENT' && v.start,
  );
  console.log(
    c(
      C.green,
      `✓ Fetched in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${allEvents.length} event(s) total in feed`,
    ),
  );
  console.log(
    c(
      C.dim,
      `Checking for events within ±${MATCH_BUFFER_MS / 60000}min of ${new Date(atTime).toLocaleString()}\n`,
    ),
  );

  const matches = allEvents
    .map((event) => {
      const eventStart = event.start.getTime();
      const eventEnd = (event.end ?? event.start).getTime();
      const overlap = overlapMs(eventStart, eventEnd, atTime);
      return { event, overlap };
    })
    .filter((m) => m.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap);

  if (matches.length === 0) {
    console.log(c(C.yellow, 'No matching events found in the buffer window.'));
    console.log(
      c(
        C.dim,
        'Try --at with a time that overlaps a real event on your calendar.',
      ),
    );
    process.exit(0);
  }

  matches.forEach(({ event, overlap }, i) => {
    const attendees = (
      Array.isArray(event.attendee)
        ? event.attendee
        : event.attendee
          ? [event.attendee]
          : []
    ).map(formatAttendee);
    console.log(
      c(C.bold + C.cyan, `${i + 1}. ${event.summary ?? 'Untitled event'}`),
    );
    console.log(c(C.dim, `   uid: ${event.uid}`));
    console.log(
      c(
        C.dim,
        `   start: ${event.start.toLocaleString()}  end: ${(event.end ?? event.start).toLocaleString()}`,
      ),
    );
    console.log(c(C.dim, `   overlap: ${Math.round(overlap / 60000)}min`));
    if (attendees.length === 0) {
      console.log(c(C.yellow, '   attendees: (none found on this event)'));
    } else {
      console.log('   attendees:');
      attendees.forEach((a) =>
        console.log(
          `     - ${a.name ?? '(no name)'} <${a.email ?? 'no email'}>`,
        ),
      );
    }
    console.log('');
  });

  console.log(
    c(
      C.dim,
      `This is exactly what the app would use to populate a recording's participants field.`,
    ),
  );
})();
