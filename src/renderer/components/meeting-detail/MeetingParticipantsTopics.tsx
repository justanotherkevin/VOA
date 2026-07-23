import { Users } from 'lucide-react';
import type { Meeting } from '@/renderer/hooks/useMeetings';
import { Section } from './Section';

interface MeetingParticipantsTopicsProps {
  meeting: Meeting;
  summaryReady: boolean;
}

export function MeetingParticipantsTopics({
  meeting,
  summaryReady,
}: MeetingParticipantsTopicsProps) {
  const showParticipants = meeting.participants.length > 0;
  const showTopics = summaryReady && meeting.topics.length > 0;

  if (!showParticipants && !showTopics) return null;

  return (
    <Section icon={<Users size={15} />} title="Participants & Topics">
      <div className="space-y-4">
        {showParticipants && (
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Participants
            </div>
            <div className="flex flex-wrap gap-1.5">
              {meeting.participants.map((p, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full border border-[#2a2a2a] text-gray-300"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
        {showTopics && (
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Topics
            </div>
            <div className="flex flex-wrap gap-1.5">
              {meeting.topics.map((t, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full border"
                  style={{
                    background: 'rgba(124,111,247,0.1)',
                    borderColor: 'rgba(124,111,247,0.25)',
                    color: '#a59ef5',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
