import React from 'react';
import { Check, CheckSquare, Lightbulb, Loader2, Tag } from 'lucide-react';
import type { Meeting } from '@/renderer/hooks/useMeetings';
import { SideSection } from './SideSection';

interface MeetingSidebarProps {
  meeting: Meeting;
  summaryReady: boolean;
  summaryPending: boolean;
}

export function MeetingSidebar({
  meeting,
  summaryReady,
  summaryPending,
}: MeetingSidebarProps) {
  const shouldShow =
    (summaryReady && meeting.decisions.length > 0) ||
    (summaryReady && meeting.topics.length > 0) ||
    meeting.actionItems.length > 0 ||
    summaryPending;

  if (!shouldShow) return null;

  return (
    <div className="border-l border-[#1e1e1e] bg-[#0f0f0f] overflow-y-auto px-4 py-6 space-y-6">
      {summaryReady && meeting.decisions.length > 0 && (
        <SideSection icon={<Lightbulb size={13} />} title="Key Decisions">
          <ul className="space-y-2">
            {meeting.decisions.map((d, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed"
              >
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'rgba(124,111,247,0.7)' }}
                />
                {d}
              </li>
            ))}
          </ul>
        </SideSection>
      )}

      {summaryReady && meeting.topics.length > 0 && (
        <SideSection icon={<Tag size={13} />} title="Topics">
          <div className="flex flex-wrap gap-1.5">
            {meeting.topics.map((t, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full border"
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
        </SideSection>
      )}

      {meeting.actionItems.length > 0 && (
        <SideSection icon={<CheckSquare size={13} />} title="Action Items">
          <ul className="space-y-2">
            {meeting.actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={`mt-0.5 w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${
                    item.done
                      ? 'bg-green-600 border-green-600'
                      : 'border-[#3a3a3a]'
                  }`}
                >
                  {item.done && <Check size={8} className="text-white" />}
                </span>
                <span
                  className={
                    item.done ? 'text-gray-600 line-through' : 'text-gray-300'
                  }
                >
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </SideSection>
      )}

      {/* Pending state in sidebar — no section titles so tests wait for real data */}
      {summaryPending && meeting.decisions.length === 0 && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Loader2 size={11} className="animate-spin" />
          <span>Generating…</span>
        </div>
      )}
    </div>
  );
}
