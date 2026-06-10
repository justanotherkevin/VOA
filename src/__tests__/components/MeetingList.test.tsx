import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MeetingList } from '@/renderer/components/ui/MeetingList';
import type { Meeting } from '@/renderer/hooks/useMeetings';

const makeMeeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  id: 'meeting-1',
  title: 'Team Standup',
  startedAt: Date.now(),
  endedAt: Date.now() + 60000,
  durationMs: 60000,
  transcript: 'We discussed the sprint goals.',
  chunks: [],
  summary: '',
  summaryStatus: 'pending',
  decisions: [],
  topics: [],
  actionItems: [],
  audioSource: 'mic',
  participants: [],
  tags: [],
  ...overrides,
});

describe('MeetingList — summary status indicator', () => {
  it('shows yellow indicator when summary is null (processing)', () => {
    const meeting = makeMeeting({ summaryStatus: 'pending' });
    render(
      <MeetingList
        meetings={[meeting]}
        selectedId={null}
        onSelect={vi.fn()}
        onNewRecording={vi.fn()}
      />
    );

    const dot = screen.getByTitle('Generating summary…');
    expect(dot).toBeTruthy();
  });

  it('shows green indicator when summary is present (done)', () => {
    const meeting = makeMeeting({ summaryStatus: 'ready', summary: 'A concise summary of the meeting.' });
    render(
      <MeetingList
        meetings={[meeting]}
        selectedId={null}
        onSelect={vi.fn()}
        onNewRecording={vi.fn()}
      />
    );

    const dot = screen.getByTitle('Summary ready');
    expect(dot).toBeTruthy();
  });

  it('updates indicator when meeting data changes from null to summary', () => {
    const meeting = makeMeeting({ summaryStatus: 'pending' });
    const { rerender } = render(
      <MeetingList
        meetings={[meeting]}
        selectedId={null}
        onSelect={vi.fn()}
        onNewRecording={vi.fn()}
      />
    );

    expect(screen.getByTitle('Generating summary…')).toBeTruthy();

    const enriched = { ...meeting, summaryStatus: 'ready' as const, summary: 'Summary text.' };
    rerender(
      <MeetingList
        meetings={[enriched]}
        selectedId={null}
        onSelect={vi.fn()}
        onNewRecording={vi.fn()}
      />
    );

    expect(screen.getByTitle('Summary ready')).toBeTruthy();
    expect(screen.queryByTitle('Generating summary…')).toBeNull();
  });
});
