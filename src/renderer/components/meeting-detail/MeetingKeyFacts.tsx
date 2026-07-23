import type { Meeting } from '@/renderer/hooks/useMeetings';
import { formatDateTime, formatDuration } from '@/renderer/utils/formatters';

const AUDIO_SOURCE_LABEL: Record<Meeting['audioSource'], string> = {
  mic: 'Mic',
  system: 'System Audio',
  both: 'Mic + System',
};

const SUMMARY_STATUS_LABEL: Record<Meeting['summaryStatus'], string> = {
  ready: 'Summary Ready',
  pending: 'Generating…',
  failed: 'Summary Failed',
  'not-started': 'Not Started',
};

export function MeetingKeyFacts({ meeting }: { meeting: Meeting }) {
  const openItems = meeting.actionItems.filter((a) => !a.done).length;

  const facts: Array<{ label: string; value: string }> = [
    { label: 'Recorded', value: formatDateTime(meeting.startedAt) },
    { label: 'Duration', value: formatDuration(meeting.durationMs) },
    { label: 'Source', value: AUDIO_SOURCE_LABEL[meeting.audioSource] },
    {
      label: 'Participants',
      value:
        meeting.participants.length > 0
          ? String(meeting.participants.length)
          : '—',
    },
    {
      label: 'Open Items',
      value: meeting.actionItems.length > 0 ? String(openItems) : '—',
    },
    { label: 'Status', value: SUMMARY_STATUS_LABEL[meeting.summaryStatus] },
  ];

  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-3 rounded-xl border border-[#1f2f45] bg-[#12203380] px-5 py-4">
      {facts.map((f) => (
        <div key={f.label}>
          <div className="text-[10px] uppercase tracking-wide text-[#6f93c2] mb-1">
            {f.label}
          </div>
          <div className="text-sm font-medium text-gray-100">{f.value}</div>
        </div>
      ))}
    </div>
  );
}
