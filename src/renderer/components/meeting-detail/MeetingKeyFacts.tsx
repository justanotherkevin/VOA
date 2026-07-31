import type { Recording } from '@/renderer/hooks/useMeetings';
import { formatDateTime, formatDuration } from '@/renderer/utils/formatters';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from '@/renderer/components/avatar';
import {
  getParticipantInitial,
  getParticipantColorClass,
} from '@/renderer/utils/AvatarUtils';

const AUDIO_SOURCE_LABEL: Record<Recording['audioSource'], string> = {
  mic: 'Mic',
  system: 'System Audio',
  both: 'Mic + System',
};

const SUMMARY_STATUS_LABEL: Record<Recording['summaryStatus'], string> = {
  ready: 'Summary Ready',
  pending: 'Generating…',
  failed: 'Summary Failed',
  'not-started': 'Not Started',
};

export function MeetingKeyFacts({ meeting }: { meeting: Recording }) {
  const openItems = meeting.actionItems.filter((a) => !a.done).length;

  const facts: Array<{ label: string; value: string; testId?: string }> = [
    { label: 'Recorded', value: formatDateTime(meeting.startedAt) },
    { label: 'Duration', value: formatDuration(meeting.durationMs) },
    { label: 'Source', value: AUDIO_SOURCE_LABEL[meeting.audioSource] },
    {
      label: 'Open Items',
      value: meeting.actionItems.length > 0 ? String(openItems) : '—',
    },
    {
      label: 'Status',
      value: SUMMARY_STATUS_LABEL[meeting.summaryStatus],
      testId: `key-fact-status-${meeting.summaryStatus}`,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-3 rounded-xl border border-border bg-muted/50 px-5 py-4">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
          Participants
        </div>
        {meeting.participants.length > 0 ? (
          <AvatarGroup data-testid="key-fact-participants-avatars">
            {meeting.participants.slice(0, 4).map((p, i) => (
              <Avatar key={i} size="sm" title={p}>
                <AvatarFallback className={getParticipantColorClass(p)}>
                  {getParticipantInitial(p)}
                </AvatarFallback>
              </Avatar>
            ))}
            {meeting.participants.length > 4 && (
              <AvatarGroupCount>
                +{meeting.participants.length - 4}
              </AvatarGroupCount>
            )}
          </AvatarGroup>
        ) : (
          <div className="text-sm font-medium text-foreground">—</div>
        )}
      </div>
      {facts.map((f) => (
        <div key={f.label}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            {f.label}
          </div>
          <div
            className="text-sm font-medium text-foreground"
            data-testid={f.testId}
          >
            {f.value}
          </div>
        </div>
      ))}
    </div>
  );
}
