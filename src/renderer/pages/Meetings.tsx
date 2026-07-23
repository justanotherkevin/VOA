import React from 'react';
import { useMeetingsContext } from '@/renderer/hooks/useMeetingsContext';
import { MeetingDetail } from '@/renderer/components/ui/MeetingDetail';

export default function Meetings() {
  const { selectedMeeting, deleteMeeting, updateMeetingTitle } =
    useMeetingsContext();

  return (
    <div className="flex h-full overflow-hidden">
      <MeetingDetail
        meeting={selectedMeeting}
        onDelete={deleteMeeting}
        onTitleChange={updateMeetingTitle}
      />
    </div>
  );
}
