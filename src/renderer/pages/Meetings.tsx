import React from 'react';
import { useMeetings } from '@/renderer/hooks/useMeetings';
import { MeetingList } from '@/renderer/components/ui/MeetingList';
import { MeetingDetail } from '@/renderer/components/ui/MeetingDetail';

interface MeetingsProps {
  onNewRecording: () => void;
}

export default function Meetings({ onNewRecording }: MeetingsProps) {
  const {
    meetings,
    selectedId,
    selectedMeeting,
    setSelectedId,
    deleteMeeting,
    updateMeetingTitle,
  } = useMeetings();

  return (
    <div className="flex h-full overflow-hidden">
      {/* Meeting list panel */}
      <div className="w-72 shrink-0">
        <MeetingList
          meetings={meetings}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNewRecording={onNewRecording}
        />
      </div>

      {/* Meeting detail panel */}
      <MeetingDetail
        meeting={selectedMeeting}
        onDelete={deleteMeeting}
        onTitleChange={updateMeetingTitle}
      />
    </div>
  );
}
