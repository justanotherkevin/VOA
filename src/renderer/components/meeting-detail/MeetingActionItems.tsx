import { Check, CheckSquare } from 'lucide-react';
import type { Recording } from '@/renderer/hooks/useMeetings';
import { Section } from './Section';

export function MeetingActionItems({ meeting }: { meeting: Recording }) {
  if (meeting.actionItems.length === 0) return null;

  return (
    <Section icon={<CheckSquare size={15} />} title="Action Items">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {meeting.actionItems.map((item, i) => (
            <tr key={i} className="border-b border-border last:border-b-0">
              <td className="w-7 py-2 align-top">
                <span
                  className={`flex items-center justify-center w-4 h-4 rounded-full border ${
                    item.done
                      ? 'bg-green-600 border-green-600'
                      : 'border-muted-foreground/40'
                  }`}
                >
                  {item.done && <Check size={9} className="text-white" />}
                </span>
              </td>
              <td
                className={`py-2 pr-2 ${item.done ? 'text-muted-foreground line-through' : 'text-foreground/80'}`}
              >
                {item.text}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
