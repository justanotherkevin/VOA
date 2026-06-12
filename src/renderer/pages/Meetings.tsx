import React, { useState, useEffect } from 'react';
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

  const [summarizerReady, setSummarizerReady] = useState(false);

  useEffect(() => {
    window.electronAPI.settings.model.cache.list().then((res: any) => {
      if (res?.models?.some((m: any) => m.source === 'hf' && m.name?.includes('Qwen'))) {
        setSummarizerReady(true);
      }
    });

    const unsub = window.electronAPI.summarizer.on.ready(() => setSummarizerReady(true));
    return unsub;
  }, []);

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
        summarizerReady={summarizerReady}
        onDelete={deleteMeeting}
        onTitleChange={updateMeetingTitle}
      />
    </div>
  );
}
