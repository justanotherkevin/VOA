import React, { useState, useMemo } from 'react';
import { Search, Mic, Circle, Users } from 'lucide-react';
import type { Meeting } from '@/renderer/hooks/useMeetings';
import {
  formatMeetingDate,
  formatMeetingShortDate,
  formatDurationShort,
} from '@/renderer/utils/formatters';

interface MeetingListProps {
  meetings: Meeting[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewRecording: () => void;
}

export function MeetingList({
  meetings,
  selectedId,
  onSelect,
  onNewRecording,
}: MeetingListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.transcript.toLowerCase().includes(q) ||
        (m.summary ?? '').toLowerCase().includes(q),
    );
  }, [meetings, search]);

  // Group by date label
  const grouped = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of filtered) {
      const label = formatMeetingDate(m.startedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(m);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] border-r border-[#2a2a2a]">
      {/* Search */}
      <div className="px-3 pt-4 pb-2">
        <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-500 shrink-0" />
          <input
            type="text"
            placeholder="Search meetings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-gray-300 placeholder-gray-500 outline-none w-full"
          />
        </div>
      </div>

      {/* Meeting count */}
      <div className="px-3 py-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Meetings
        </span>
        <span className="text-xs text-gray-600">{meetings.length}</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">
              {search ? 'No meetings match your search' : 'No meetings yet'}
            </p>
            {!search && (
              <p className="text-xs text-gray-600 mt-1">
                Press the shortcut to start recording
              </p>
            )}
          </div>
        ) : (
          Array.from(grouped.entries()).map(([label, items]) => (
            <div key={label}>
              <div className="px-3 py-1.5">
                <span className="text-xs text-gray-600 font-medium">
                  {label}
                </span>
              </div>
              {items.map((meeting) => (
                <MeetingRow
                  key={meeting.id}
                  meeting={meeting}
                  isSelected={meeting.id === selectedId}
                  onSelect={() => onSelect(meeting.id)}
                  shortDate={formatMeetingShortDate(meeting.startedAt)}
                  duration={formatDurationShort(meeting.durationMs)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* New Recording button */}
      <div className="p-3 border-t border-[#2a2a2a]">
        <button
          onClick={onNewRecording}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
        >
          <Mic size={14} />
          New Recording
        </button>
      </div>
    </div>
  );
}

function MeetingRow({
  meeting,
  isSelected,
  onSelect,
  shortDate,
  duration,
}: {
  meeting: Meeting;
  isSelected: boolean;
  onSelect: () => void;
  shortDate: string;
  duration: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors group ${
        isSelected
          ? 'bg-[#2a2a2a] border-l-2 border-blue-500'
          : 'border-l-2 border-transparent hover:bg-[#222]'
      }`}
    >
      <span
        className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
          isSelected ? 'bg-blue-500' : 'bg-gray-600'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm text-gray-200 truncate font-medium">
              {meeting.title}
            </span>
            <Circle
              size={8}
              className={`shrink-0 fill-current ${
                meeting.summaryStatus === 'pending' ||
                meeting.summaryStatus === 'not-started'
                  ? 'text-yellow-400'
                  : 'text-green-500'
              }`}
              title={
                meeting.summaryStatus === 'pending'
                  ? 'Generating summary…'
                  : meeting.summaryStatus === 'not-started'
                    ? 'Meeting insights available'
                    : 'Summary ready'
              }
            />
          </div>
          <span className="text-xs text-gray-500 shrink-0">{shortDate}</span>
        </div>
        <div className="flex items-center gap-2">
          {duration && (
            <span className="text-xs text-gray-600">{duration}</span>
          )}
          {(meeting.isMeeting ?? meeting.audioSource !== 'mic') && (
            <span
              data-testid="meeting-type-badge"
              className="flex items-center gap-0.5 text-[10px] text-indigo-400/70 font-medium"
            >
              <Users size={9} />
              Meeting
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
