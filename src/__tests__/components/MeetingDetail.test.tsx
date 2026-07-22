/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
import { MeetingDetail } from '@/renderer/components/ui/MeetingDetail';
import type { Meeting } from '@/renderer/hooks/useMeetings';

vi.mock('@/renderer/components/ui/TranscriptTagRenderer', () => ({
  TranscriptTagRenderer: ({ text }: { text: string }) => <span>{text}</span>,
  loadTagStyle: () => 'pill',
  saveTagStyle: vi.fn(),
  HAS_TAGS_RE: /\[(Meeting|Mic)\]/i,
}));

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_MEETING: Meeting = {
  id: 'test-1',
  title: 'Payment Schedule Discussion',
  startedAt: Date.now(),
  endedAt: Date.now() + 120_000,
  durationMs: 120_000,
  transcript:
    'Glad to see things are going well and business is starting to pick up. Andrea told me about your outstanding numbers on Tuesday.',
  chunks: [],
  summary:
    'A business update call covering strong recent performance and a proposed payment schedule for outstanding license fees and back royalties, suggesting bi-weekly payments going forward.',
  summaryStatus: 'ready',
  decisions: [
    'Establish bi-weekly royalty payment schedule',
    'Maintain current royalties on the same bi-weekly cadence required of all stores',
  ],
  topics: [
    'payment schedule',
    'license agreement',
    'back royalties',
    'business performance',
  ],
  actionItems: [
    {
      text: 'Pay balance of the license agreement as soon as possible',
      done: false,
    },
    { text: 'Propose a payment amount for back royalties', done: false },
    { text: 'Confirm bi-weekly payment schedule works', done: true },
  ],
  audioSource: 'both',
  participants: [],
  tags: [],
};

function emptyStructured(overrides?: Partial<Meeting>): Meeting {
  return {
    ...BASE_MEETING,
    decisions: [],
    topics: [],
    actionItems: [],
    ...overrides,
  };
}

// ── Sidebar visibility ────────────────────────────────────────────────────────

describe('sidebar column visibility', () => {
  it('renders sidebar when decisions, topics, and action items are populated', () => {
    render(<MeetingDetail meeting={BASE_MEETING} />);

    expect(screen.getByText('Key Decisions')).toBeInTheDocument();
    expect(screen.getByText('Topics')).toBeInTheDocument();
    expect(screen.getByText('Action Items')).toBeInTheDocument();
  });

  it('hides sidebar entirely when all structured fields are empty and summary is ready', () => {
    render(<MeetingDetail meeting={emptyStructured()} />);

    expect(screen.queryByText('Key Decisions')).not.toBeInTheDocument();
    expect(screen.queryByText('Topics')).not.toBeInTheDocument();
    expect(screen.queryByText('Action Items')).not.toBeInTheDocument();
  });

  it('shows sidebar with spinner when summaryStatus is pending', () => {
    render(
      <MeetingDetail meeting={emptyStructured({ summaryStatus: 'pending' })} />,
    );

    expect(screen.getByText('Generating…')).toBeInTheDocument();
  });

  it('shows sidebar only for action items when decisions and topics are empty but actions exist', () => {
    const meeting = emptyStructured({
      actionItems: [{ text: 'Follow up with client', done: false }],
    });
    render(<MeetingDetail meeting={meeting} />);

    expect(screen.getByText('Action Items')).toBeInTheDocument();
    expect(screen.queryByText('Key Decisions')).not.toBeInTheDocument();
    expect(screen.queryByText('Topics')).not.toBeInTheDocument();
  });
});

// ── Key Decisions section ─────────────────────────────────────────────────────

describe('Key Decisions section', () => {
  it('renders each decision from the monologue fixture', () => {
    render(<MeetingDetail meeting={BASE_MEETING} />);

    expect(
      screen.getByText('Establish bi-weekly royalty payment schedule'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Maintain current royalties on the same bi-weekly cadence required of all stores',
      ),
    ).toBeInTheDocument();
  });

  it('hides Key Decisions when decisions array is empty', () => {
    render(<MeetingDetail meeting={{ ...BASE_MEETING, decisions: [] }} />);

    expect(screen.queryByText('Key Decisions')).not.toBeInTheDocument();
  });

  it('hides Key Decisions when summaryStatus is not ready', () => {
    render(
      <MeetingDetail meeting={{ ...BASE_MEETING, summaryStatus: 'pending' }} />,
    );

    // The pending spinner placeholder shows "Key Decisions" heading — but the
    // actual decision text must not appear
    expect(
      screen.queryByText('Establish bi-weekly royalty payment schedule'),
    ).not.toBeInTheDocument();
  });
});

// ── Topics section ────────────────────────────────────────────────────────────

describe('Topics section', () => {
  it('renders each topic chip from the monologue fixture', () => {
    render(<MeetingDetail meeting={BASE_MEETING} />);

    expect(screen.getByText('payment schedule')).toBeInTheDocument();
    expect(screen.getByText('license agreement')).toBeInTheDocument();
    expect(screen.getByText('back royalties')).toBeInTheDocument();
    expect(screen.getByText('business performance')).toBeInTheDocument();
  });

  it('hides Topics when topics array is empty', () => {
    render(<MeetingDetail meeting={{ ...BASE_MEETING, topics: [] }} />);

    expect(screen.queryByText('Topics')).not.toBeInTheDocument();
  });
});

// ── Action Items section ──────────────────────────────────────────────────────

describe('Action Items section', () => {
  it('renders each action item text', () => {
    render(<MeetingDetail meeting={BASE_MEETING} />);

    expect(
      screen.getByText(
        'Pay balance of the license agreement as soon as possible',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Propose a payment amount for back royalties'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Confirm bi-weekly payment schedule works'),
    ).toBeInTheDocument();
  });

  it('applies line-through styling to completed action items', () => {
    render(<MeetingDetail meeting={BASE_MEETING} />);

    const doneItem = screen.getByText(
      'Confirm bi-weekly payment schedule works',
    );
    expect(doneItem).toHaveClass('line-through');
  });

  it('does not apply line-through to incomplete action items', () => {
    render(<MeetingDetail meeting={BASE_MEETING} />);

    const pendingItem = screen.getByText(
      'Pay balance of the license agreement as soon as possible',
    );
    expect(pendingItem).not.toHaveClass('line-through');
  });
});

// ── Overview / summary states ─────────────────────────────────────────────────

describe('Overview section', () => {
  it('renders summary text when ready', () => {
    render(<MeetingDetail meeting={BASE_MEETING} />);

    expect(
      screen.getByText(
        /business update call covering strong recent performance/,
      ),
    ).toBeInTheDocument();
  });

  it('shows spinner text when pending', () => {
    render(
      <MeetingDetail meeting={{ ...BASE_MEETING, summaryStatus: 'pending' }} />,
    );

    expect(screen.getByText('Generating summary…')).toBeInTheDocument();
  });

  it('shows fallback text when failed', () => {
    render(
      <MeetingDetail meeting={{ ...BASE_MEETING, summaryStatus: 'failed' }} />,
    );

    expect(screen.getByText('Summary unavailable.')).toBeInTheDocument();
  });
});

// ── Empty meeting placeholder ─────────────────────────────────────────────────

describe('null meeting', () => {
  it('renders the empty-state placeholder', () => {
    render(<MeetingDetail meeting={null} />);

    expect(
      screen.getByText('Select a meeting to view details'),
    ).toBeInTheDocument();
  });
});
