import React from 'react';
import { AlignLeft, Loader2, Sparkles } from 'lucide-react';
import type { Recording } from '@/renderer/hooks/useMeetings';
import {
  HAS_TAGS_RE,
  TranscriptTagRenderer,
  type TranscriptTagStyle,
} from '../ui/TranscriptTagRenderer';
import { Section } from './Section';

interface MeetingOverviewProps {
  meeting: Recording;
  summaryReady: boolean;
  summaryPending: boolean;
  summaryNotStarted: boolean;
  onEnrich: () => void;
  tagStyle: TranscriptTagStyle;
}

export function MeetingOverview({
  meeting,
  summaryReady,
  summaryPending,
  summaryNotStarted,
  onEnrich,
  tagStyle,
}: MeetingOverviewProps) {
  return (
    <Section icon={<AlignLeft size={15} />} title="Overview">
      {summaryPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={13} className="animate-spin" />
          <span>Generating summary…</span>
        </div>
      )}
      {meeting.summaryStatus === 'failed' && (
        <p className="text-sm text-muted-foreground italic">
          Summary unavailable.
        </p>
      )}
      {meeting.type === 'meeting' && summaryNotStarted && (
        <button
          onClick={onEnrich}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: 'rgba(124,111,247,0.12)',
            color: '#a59ef5',
            border: '1px solid rgba(124,111,247,0.2)',
          }}
        >
          <Sparkles size={14} />
          Meeting details
        </button>
      )}
      {summaryReady && meeting.summary && (
        <div className="text-foreground/80 text-sm leading-relaxed">
          {HAS_TAGS_RE.test(meeting.summary) ? (
            <TranscriptTagRenderer text={meeting.summary} style={tagStyle} />
          ) : (
            meeting.summary
          )}
        </div>
      )}
      {summaryReady && !meeting.summary && (
        <p className="text-sm text-muted-foreground italic">
          No summary available.
        </p>
      )}
    </Section>
  );
}
