/**
 * E2E tests for the proactive calendar-match notification: when a recording
 * starts and is classified as a meeting, TranscriberService looks up nearby
 * calendar events and — if any are found — shows a confirmation pill in the
 * notification window. This exercises the full loop against a real local ICS
 * server (not mocks): recording start → calendar lookup → notification →
 * user decision (or timeout default) → saved recording's `participants`.
 *
 * Fixture event shapes mirror a real Google Calendar export captured in
 * tests/e2e/mocks/calendar-fixture-2026-07-22.json (multi-attendee events,
 * one zero-attendee event) — but with dates computed relative to "now" at
 * test-run time, since hardcoded historical dates can't overlap a live test.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import {
  startRecording,
  stopRecording,
} from '../../utils/dictation/recording-actions';
import { mountMockAudioChunks } from '../../utils/dictation/hardware-mocks';
import { getVisibleWindows, pollUntil } from '../../utils/common.helpers';
import { getMeetings } from '../../utils/seed.helpers';
import type { Recording } from '@/main/store';

// stopRecording() only waits a fixed 500ms after toggling — real Whisper
// inference on the mocked audio (city-meeting-short.mp3) can take several
// seconds, more under system load, so the meeting isn't persisted yet by
// the time a fixed wait elapses. Poll until it actually shows up instead of
// racing TranscriberService.persistMeeting.
async function waitForSavedMeeting(page: Page): Promise<Recording> {
  let saved: Recording | undefined;
  await pollUntil(async () => {
    const meetings = await getMeetings(page);
    saved = meetings[0];
    return meetings.length > 0;
  }, 20_000);
  return saved as Recording;
}

interface FixtureAttendee {
  name: string;
  email: string;
}

interface FixtureEvent {
  uid: string;
  title: string;
  attendees: FixtureAttendee[];
  // Minutes from "now" this event starts/ends — defaults put "now" mid-event.
  startOffsetMin?: number;
  endOffsetMin?: number;
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildFixtureIcs(events: FixtureEvent[]): string {
  const now = Date.now();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VOA E2E//EN'];

  for (const event of events) {
    const start = new Date(now + (event.startOffsetMin ?? -5) * 60_000);
    const end = new Date(now + (event.endOffsetMin ?? 25) * 60_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${formatIcsDate(new Date(now))}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${event.title}`,
      ...event.attendees.map((a) => `ATTENDEE;CN=${a.name}:mailto:${a.email}`),
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}

async function startFixtureServer(
  events: FixtureEvent[],
): Promise<{ server: http.Server; feedUrl: string }> {
  const icsBody = buildFixtureIcs(events);
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/calendar' });
    res.end(icsBody);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, feedUrl: `http://127.0.0.1:${port}/feed.ics` };
}

async function configureFeed(page: Page, feedUrl: string): Promise<void> {
  await page.evaluate(
    (url) =>
      (window as any).electronAPI.calendar.savePreferences({ feedUrl: url }),
    feedUrl,
  );
}

const WEEKLY_SYNC: FixtureEvent = {
  uid: 'e2e-weekly-sync',
  title: 'Weekly Sync',
  attendees: [
    { name: 'Alice Smith', email: 'alice@example.com' },
    { name: 'Bob Jones', email: 'bob@example.com' },
  ],
};

const ONE_ON_ONE: FixtureEvent = {
  uid: 'e2e-one-on-one',
  title: '1:1 with Sam',
  attendees: [{ name: 'Sam Lee', email: 'sam@example.com' }],
  // Shorter overlap than WEEKLY_SYNC's default — not the best-overlap match,
  // so choosing it in the Select is distinguishable from the auto-default.
  startOffsetMin: -2,
  endOffsetMin: 20,
};

test.describe('Notification — calendar match', () => {
  let mainPage: Page;
  let notificationPage: Page;

  test.beforeEach(async ({ electronApp }) => {
    const { main, notification } = await getVisibleWindows(electronApp);
    mainPage = main;
    notificationPage = notification;
  });

  test('single match: notification shows the event title and its attendees are saved', async ({
    electronApp,
  }) => {
    test.setTimeout(60_000);
    const { server, feedUrl } = await startFixtureServer([WEEKLY_SYNC]);

    try {
      await configureFeed(mainPage, feedUrl);
      await startRecording(mainPage, electronApp, { isMeeting: true });

      // The calendar-match notification can supersede the initial "recording
      // started" pill within milliseconds against a fast local feed, so wait
      // directly for the final state rather than an intermediate one. A
      // single match pre-selects itself in the Select (Notification.tsx).
      await expect(
        notificationPage.getByRole('combobox'),
        'notification should show the matched event pre-selected in the Select',
      ).toHaveText(/Weekly Sync/, { timeout: 10_000 });

      await mountMockAudioChunks(mainPage, 'city-meeting-short.mp3');
      await stopRecording(mainPage, electronApp);

      const saved = await waitForSavedMeeting(mainPage);
      expect(saved.participants).toEqual(['Alice Smith', 'Bob Jones']);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('multiple matches: choosing a non-default option in the Select persists that match', async ({
    electronApp,
  }) => {
    test.setTimeout(60_000);
    const { server, feedUrl } = await startFixtureServer([
      WEEKLY_SYNC,
      ONE_ON_ONE,
    ]);

    try {
      await configureFeed(mainPage, feedUrl);
      await startRecording(mainPage, electronApp, { isMeeting: true });

      const trigger = notificationPage.getByRole('combobox');
      await expect(
        trigger,
        'notification should show a Select when multiple events match',
      ).toBeVisible({ timeout: 10_000 });

      // WEEKLY_SYNC has the larger overlap (the default if left unchosen) —
      // deliberately pick ONE_ON_ONE to prove a real selection took effect,
      // not just the auto-default.

      await trigger.click();
      await notificationPage
        .getByRole('option', { name: '1:1 with Sam' })
        .click();

      await mountMockAudioChunks(mainPage, 'city-meeting-short.mp3');
      await stopRecording(mainPage, electronApp);

      const saved = await waitForSavedMeeting(mainPage);
      expect(saved.participants).toEqual(['Sam Lee']);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // There is no explicit "No"/decline button in the redesigned calendar-match
  // pill (see Notification.tsx) — declining now only happens by leaving the
  // Select untouched, which is covered by the "no interaction" case below.
  // calendar.declineMatch remains reachable via IPC for any future affordance
  // that wants it, but nothing in the current UI calls it.

  test('no interaction: stopping immediately after the match is found still attaches participants', async ({
    electronApp,
  }) => {
    test.setTimeout(60_000);
    const { server, feedUrl } = await startFixtureServer([WEEKLY_SYNC]);

    try {
      await configureFeed(mainPage, feedUrl);
      await startRecording(mainPage, electronApp, { isMeeting: true });

      // Only wait for the match to be found — never interact with the pill.
      // The decision is resolved lazily from session state at persist time,
      // not from the cosmetic 10s countdown, so no long wait is needed here.
      await expect(notificationPage.getByRole('combobox')).toHaveText(
        /Weekly Sync/,
        { timeout: 10_000 },
      );

      await mountMockAudioChunks(mainPage, 'city-meeting-short.mp3');
      await stopRecording(mainPage, electronApp);

      const saved = await waitForSavedMeeting(mainPage);
      expect(saved.participants).toEqual(['Alice Smith', 'Bob Jones']);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
