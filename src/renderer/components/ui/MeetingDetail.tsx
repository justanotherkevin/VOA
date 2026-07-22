import { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';
import type { Meeting } from '@/renderer/hooks/useMeetings';
import { useCopyText } from '@/renderer/hooks/useCopyText';
import {
  HAS_TAGS_RE,
  loadTagStyle,
  saveTagStyle,
  type TranscriptTagStyle,
} from './TranscriptTagRenderer';
import { MeetingDetailHeader } from '../meeting-detail/MeetingDetailHeader';
import { MeetingOverview } from '../meeting-detail/MeetingOverview';
import { MeetingTranscript } from '../meeting-detail/MeetingTranscript';
import { MeetingSidebar } from '../meeting-detail/MeetingSidebar';

interface MeetingDetailProps {
  meeting: Meeting | null;
  onDelete?: (id: string) => void;
  onTitleChange?: (id: string, title: string) => void;
}

export function MeetingDetail({
  meeting,
  onDelete,
  onTitleChange,
}: MeetingDetailProps) {
  const { copied, copy } = useCopyText();
  const [enriching, setEnriching] = useState(false);
  const [tagStyle, setTagStyle] = useState<TranscriptTagStyle>(loadTagStyle);

  useEffect(() => {
    if (enriching && meeting?.summaryStatus === 'ready') setEnriching(false);
  }, [enriching, meeting?.summaryStatus]);

  const handleEnrich = async () => {
    if (!meeting || enriching) return;
    setEnriching(true);
    await window.electronAPI.meetings.enrich(meeting.id);
  };

  const handleTagStyleChange = (style: TranscriptTagStyle) => {
    setTagStyle(style);
    saveTagStyle(style);
  };

  const hasTags = meeting
    ? HAS_TAGS_RE.test(meeting.transcript) ||
      HAS_TAGS_RE.test(meeting.summary ?? '')
    : false;

  if (!meeting) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#111] text-gray-600">
        <div className="text-center">
          <Mic size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a meeting to view details</p>
          <p className="text-xs mt-1 opacity-60">or start a new recording</p>
        </div>
      </div>
    );
  }

  const fullText = [
    meeting.title,
    meeting.summary ? `\nOverview:\n${meeting.summary}` : '',
    meeting.decisions.length > 0
      ? `\nKey Decisions:\n${meeting.decisions.map((d) => `• ${d}`).join('\n')}`
      : '',
    meeting.topics.length > 0 ? `\nTopics: ${meeting.topics.join(', ')}` : '',
    meeting.actionItems.length > 0
      ? `\nAction Items:\n${meeting.actionItems.map((a) => `[${a.done ? 'x' : ' '}] ${a.text}`).join('\n')}`
      : '',
    `\nTranscript:\n${meeting.transcript}`,
  ]
    .filter(Boolean)
    .join('');

  const summaryReady = meeting.summaryStatus === 'ready';
  const summaryPending = meeting.summaryStatus === 'pending' || enriching;
  const summaryNotStarted =
    meeting.summaryStatus === 'not-started' && !enriching;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#111]">
      <MeetingDetailHeader
        meeting={meeting}
        copied={copied}
        onCopy={() => copy(fullText)}
        onDelete={onDelete}
        onTitleChange={onTitleChange}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          <MeetingOverview
            meeting={meeting}
            summaryReady={summaryReady}
            summaryPending={summaryPending}
            summaryNotStarted={summaryNotStarted}
            onEnrich={handleEnrich}
            tagStyle={tagStyle}
          />

          <MeetingTranscript
            transcript={meeting.transcript}
            hasTags={hasTags}
            tagStyle={tagStyle}
            onTagStyleChange={handleTagStyleChange}
          />
        </div>

        <div className="max-w-56 shrink-0">
          <MeetingSidebar
            meeting={meeting}
            summaryReady={summaryReady}
            summaryPending={summaryPending}
          />
        </div>
      </div>
    </div>
  );
}
