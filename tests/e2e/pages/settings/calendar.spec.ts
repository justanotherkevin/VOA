/**
 * E2E tests for Settings > Calendar > "Test Connection".
 *
 * Regression coverage for a reported bug: clicking "Test Connection" appeared
 * to do nothing. Runs against a real local HTTP server serving a fixture
 * .ics feed (rather than a live account) so the test is self-contained and
 * still exercises the full round trip: renderer click → IPC →
 * node-ical fetch/parse → result rendered back in the Settings UI.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@e2e/fixtures';
import { navigateToSettings } from '@e2e/utils/common.helpers';

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildFixtureIcs(): string {
  const now = new Date();
  const start = new Date(now.getTime() - 5 * 60 * 1000);
  const end = new Date(now.getTime() + 25 * 60 * 1000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VOA E2E//EN',
    'BEGIN:VEVENT',
    'UID:e2e-test-event-1',
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    'SUMMARY:E2E Test Meeting',
    'ATTENDEE;CN=Alice Smith:mailto:alice@example.com',
    'ATTENDEE;CN=Bob Jones:mailto:bob@example.com',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

test.describe('Settings — Calendar (Test Connection)', () => {
  let server: http.Server;
  let feedUrl: string;

  test.beforeAll(async () => {
    const icsBody = buildFixtureIcs();
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/calendar' });
      res.end(icsBody);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = server.address() as AddressInfo;
    feedUrl = `http://127.0.0.1:${port}/feed.ics`;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('button is disabled (and visibly so) until a feed URL is entered — reproduces "nothing happens"', async ({
    page,
  }) => {
    await navigateToSettings(page, 'Calendar');

    const input = page.locator('[data-testid="calendar-feed-url-input"]');
    const button = page.locator(
      '[data-testid="calendar-test-connection-button"]',
    );

    await input.fill('');
    await expect(button).toBeDisabled();
    // A disabled button that's visually identical to an enabled one is what
    // produced the "I clicked it and nothing happened" report — assert the
    // dimmed :disabled style is actually applied, not just the DOM attribute.
    await expect(button).toHaveCSS('opacity', '0.5');
  });

  test('Test Connection reports success and the real event count for a reachable feed', async ({
    page,
  }) => {
    await navigateToSettings(page, 'Calendar');

    const input = page.locator('[data-testid="calendar-feed-url-input"]');
    const button = page.locator(
      '[data-testid="calendar-test-connection-button"]',
    );
    const result = page.locator('[data-testid="calendar-test-result"]');

    await input.fill(feedUrl);
    await expect(button).toBeEnabled();

    await button.click();

    await expect(result.locator('.s-pill-good')).toBeVisible({
      timeout: 10_000,
    });
    await expect(result).toContainText('Connected — 1 event found');
  });

  test('Test Connection reports failure (not silence) for an unreachable feed', async ({
    page,
  }) => {
    await navigateToSettings(page, 'Calendar');

    const input = page.locator('[data-testid="calendar-feed-url-input"]');
    const button = page.locator(
      '[data-testid="calendar-test-connection-button"]',
    );
    const result = page.locator('[data-testid="calendar-test-result"]');

    await input.fill('http://127.0.0.1:1/unreachable.ics');
    await button.click();

    await expect(result.locator('.s-pill-danger')).toBeVisible({
      timeout: 10_000,
    });
  });
});
