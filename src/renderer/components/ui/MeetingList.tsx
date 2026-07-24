import React, { useState, useMemo } from 'react';
import { Search, Mic } from 'lucide-react';
import type { Recording } from '@/renderer/hooks/useMeetings';
import {
  formatMeetingDate,
  formatMeetingShortDate,
  formatDurationShort,
} from '@/renderer/utils/formatters';
import { cn } from '@/renderer/utils/utils';
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemHeader,
  ItemFooter,
  ItemTitle,
} from '@/renderer/components/item';

interface MeetingListProps {
  meetings: Recording[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewRecording: () => void;
}

// Group a list of recordings into date-labeled buckets (Today/Yesterday/etc).
function groupByDate(items: Recording[]): Map<string, Recording[]> {
  const map = new Map<string, Recording[]>();
  for (const m of items) {
    const label = formatMeetingDate(m.startedAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(m);
  }
  return map;
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

  const meetingItems = useMemo(
    () => filtered.filter((m) => m.type === 'meeting'),
    [filtered],
  );
  const dictationItems = useMemo(
    () => filtered.filter((m) => m.type === 'dictation'),
    [filtered],
  );
  const meetingGroups = useMemo(
    () => groupByDate(meetingItems),
    [meetingItems],
  );
  const dictationGroups = useMemo(
    () => groupByDate(dictationItems),
    [dictationItems],
  );

  return (
    <div className="flex flex-col">
      {/* Search */}
      <div className="px-1 pb-2">
        <div className="flex items-center gap-2 bg-sidebar-accent rounded-lg px-3 py-2">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-sidebar-foreground placeholder:text-muted-foreground outline-none w-full"
          />
        </div>
      </div>

      {/* List */}
      <div>
        <RecordingTypeSection
          heading="Meetings"
          groups={meetingGroups}
          emptyLabel={
            search ? 'No meetings match your search' : 'No meetings yet'
          }
          selectedId={selectedId}
          onSelect={onSelect}
        />
        <RecordingTypeSection
          heading="Dictations"
          groups={dictationGroups}
          emptyLabel={
            search ? 'No dictations match your search' : 'No dictations yet'
          }
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>

      {/* New Recording button */}
      <div className="px-1 pt-3 mt-2 border-t border-sidebar-border">
        <button
          onClick={onNewRecording}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 px-3 rounded-lg transition-colors"
        >
          <Mic size={14} />
          New Recording
        </button>
      </div>
    </div>
  );
}

function RecordingTypeSection({
  heading,
  groups,
  emptyLabel,
  selectedId,
  onSelect,
}: {
  heading: string;
  groups: Map<string, Recording[]>;
  emptyLabel: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="px-3 pt-2 pb-1">
        <span className="text-xs uppercase tracking-wide text-sidebar-foreground/40 font-semibold">
          {heading}
        </span>
      </div>
      {groups.size === 0 ? (
        <div className="px-4 py-3">
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <ItemGroup>
          {Array.from(groups.entries()).map(([label, items]) => (
            <div key={label}>
              {/* <div className="px-3 py-1.5">
                <span className="text-xs text-sidebar-foreground/60 font-medium">
                  {label}
                </span>
              </div> */}
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
          ))}
        </ItemGroup>
      )}
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
  meeting: Recording;
  isSelected: boolean;
  onSelect: () => void;
  shortDate: string;
  duration: string;
}) {
  return (
    <Item
      asChild
      size="sm"
      className={cn(
        'w-full cursor-pointer items-start rounded-none border-l-2 border-t-0 border-r-0 border-b-0',
        isSelected
          ? 'border-l-primary bg-sidebar-accent'
          : 'border-l-transparent hover:bg-sidebar-accent/50',
      )}
    >
      <button
        onClick={onSelect}
        data-meeting-id={meeting.id}
        className="w-full text-left"
      >
        <ItemContent className="min-w-0 gap-1">
          <ItemHeader>
            <ItemTitle className="min-w-0 flex-1 text-sidebar-foreground">
              <span className="block w-full truncate">{meeting.title}</span>
            </ItemTitle>
            <span className="text-xs text-muted-foreground shrink-0">
              {shortDate}
            </span>
          </ItemHeader>
          <ItemFooter className="basis-auto justify-start gap-2">
            <TagMarquee tags={meeting.topics} />
            {duration && (
              <span className="text-xs text-sidebar-foreground/60 shrink-0 tabular-nums">
                {duration}
              </span>
            )}
          </ItemFooter>
        </ItemContent>
      </button>
    </Item>
  );
}

function TagMarquee({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="flex-1 min-w-0" />;

  // Duplicate the tag list so the loop wraps seamlessly at the 50% mark;
  // duration scales with tag count so denser rows don't scroll too fast.
  const durationS = Math.max(26, tags.length * 2.2);

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      <div
        className="tag-marquee-track flex w-max gap-1.5"
        style={{ animationDuration: `${durationS}s` }}
      >
        {[...tags, ...tags].map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
