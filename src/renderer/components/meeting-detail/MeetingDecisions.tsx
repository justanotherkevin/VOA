import { Lightbulb } from 'lucide-react';
import type { Meeting } from '@/renderer/hooks/useMeetings';
import { Section } from './Section';

interface MeetingDecisionsProps {
  meeting: Meeting;
  summaryReady: boolean;
}

export function MeetingDecisions({
  meeting,
  summaryReady,
}: MeetingDecisionsProps) {
  if (!summaryReady || meeting.decisions.length === 0) return null;

  return (
    <Section icon={<Lightbulb size={15} />} title="Key Decisions">
      <ul className="space-y-2.5">
        {meeting.decisions.map((d, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-sm text-gray-300 leading-relaxed"
          >
            <span
              className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: 'rgba(124,111,247,0.7)' }}
            />
            {d}
          </li>
        ))}
      </ul>
    </Section>
  );
}
