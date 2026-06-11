/**
 * Test Data Factories for E2E Tests
 *
 * Provides factory functions for creating Meeting objects in tests.
 * Use these factories with seed.helpers.ts to populate the store
 * when a test needs specific data to be present at startup.
 *
 * Usage:
 *   import { meetingFactory } from '../fixtures-data';
 *   import { seedMeeting, clearMeetings } from './utils/seed.helpers';
 *
 *   // In your test beforeEach:
 *   await clearMeetings(page);
 *   await seedMeeting(page, meetingFactory({ title: 'Budget Review' }));
 */

import { Meeting } from '@/main/store';

export function meetingFactory(overrides: Partial<Omit<Meeting, 'id'>> = {}): Omit<Meeting, 'id'> {
  const now = Date.now();
  return {
    title: 'Test Meeting',
    startedAt: now - 30 * 60 * 1000,
    endedAt: now,
    durationMs: 30 * 60 * 1000,
    transcript: 'This is a sample meeting transcript for testing purposes.',
    chunks: [
      { text: 'This is a sample meeting transcript', timestamp: [0, 2.0] },
      { text: 'for testing purposes', timestamp: [2.0, 3.5] },
    ],
    summary: '',
    summaryStatus: 'pending',
    decisions: [],
    topics: [],
    actionItems: [],
    audioSource: 'mic',
    participants: [],
    tags: [],
    ...overrides,
  };
}

/**
 * Create a Meeting that already has enrichment data (summaryStatus: 'ready').
 */
export function enrichedMeetingFactory(overrides: Partial<Omit<Meeting, 'id'>> = {}): Omit<Meeting, 'id'> {
  return meetingFactory({
    summary: 'The team reviewed quarterly targets and agreed on next steps.',
    summaryStatus: 'ready',
    decisions: ['Approved Q3 roadmap', 'Assigned ownership of migration task'],
    topics: ['Quarterly targets', 'Roadmap planning'],
    actionItems: [
      { text: 'Write migration plan by Friday', done: false },
      { text: 'Update project tracker', done: false },
    ],
    ...overrides,
  });
}
