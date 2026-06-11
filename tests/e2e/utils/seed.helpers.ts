/**
 * E2E Test Seed Helpers
 *
 * IPC-based helpers for setting up and tearing down store data in tests.
 * Because the Electron app process is worker-scoped (shared across tests),
 * use these helpers instead of relying on the file-based store initialization
 * in fixtures-dev.ts (which only takes effect when the app first boots).
 *
 * Pattern:
 *   import { clearMeetings, seedMeeting } from './seed.helpers';
 *   import { meetingFactory } from '../fixtures-data';
 *
 *   test.beforeEach(async ({ page }) => {
 *     await clearMeetings(page);
 *     await seedMeeting(page, meetingFactory({ title: 'Budget Review' }));
 *   });
 */

import { Page } from '@playwright/test';
import { Meeting } from '@/main/store';

export async function getMeetings(page: Page): Promise<Meeting[]> {
  return page.evaluate(async () =>
    (window as any).electronAPI.meetings.getAll(),
  );
}

export async function forceMeetingNextSession(page: Page): Promise<void> {
  await page.evaluate(async () =>
    (window as any).__e2eTestAPI.forceMeetingNextSession(),
  );
}

export async function mockEnrichMeeting(page: Page): Promise<void> {
  await page.evaluate(async () =>
    (window as any).__e2eTestAPI.mockEnrichMeeting(),
  );
}

/**
 * Clear all meetings from the store via IPC.
 * The main process broadcasts a `meetings:cleared` event so `useMeetings` updates
 * its React state immediately — no navigation or remount needed.
 */
export async function clearMeetings(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (window as any).electronAPI.meetings.clear();
  });
}

/**
 * Seed a single meeting into the store via the E2E-only IPC endpoint.
 * Requires E2E_TEST=true (set automatically when using fixtures-dev.ts).
 *
 * Returns the saved meeting with its generated id.
 */
export async function seedMeeting(
  page: Page,
  data: Omit<Meeting, 'id'>,
): Promise<Meeting> {
  return page.evaluate(async (meetingData) => {
    return (window as any).__e2eTestAPI.seedMeeting(meetingData);
  }, data as any);
}

/**
 * Seed multiple meetings in sequence.
 * Meetings are inserted in order; the store keeps newest-first so the last
 * item in the array will appear first in the UI.
 */
export async function seedMeetings(
  page: Page,
  meetings: Omit<Meeting, 'id'>[],
): Promise<Meeting[]> {
  const saved: Meeting[] = [];
  for (const data of meetings) {
    saved.push(await seedMeeting(page, data));
  }
  return saved;
}
