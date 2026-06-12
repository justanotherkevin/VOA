import { useState, useEffect, useCallback } from 'react';

export interface MeetingActionItem {
  text: string;
  done: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  transcript: string;
  chunks: Array<{
    text: string;
    timestamp: [number, number | null];
  }>;
  isMeeting: boolean;
  summary: string;
  summaryStatus: 'pending' | 'ready' | 'failed' | 'not-started';
  decisions: string[];
  topics: string[];
  actionItems: MeetingActionItem[];
  audioSource: 'mic' | 'system' | 'both';
  participants: string[];
  tags: string[];
}

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    const data = await window.electronAPI.meetings.getAll();
    setMeetings(data ?? []);
  }, []);

  const deleteMeeting = useCallback(async (id: string) => {
    await window.electronAPI.meetings.delete(id);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const updateMeetingTitle = useCallback(async (id: string, title: string) => {
    await window.electronAPI.meetings.update(id, { title });
    setMeetings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, title } : m)),
    );
  }, []);

  const clearAll = useCallback(async () => {
    await window.electronAPI.meetings.clear();
    setMeetings([]);
    setSelectedId(null);
  }, []);

  useEffect(() => {
    fetchMeetings();

    const unsubSaved = window.electronAPI.meetings.on.saved((meeting: Meeting) => {
      setMeetings((prev) => {
        const isNew = !prev.some((m) => m.id === meeting.id);
        if (isNew) setSelectedId(meeting.id);
        return [meeting, ...prev.filter((m) => m.id !== meeting.id)];
      });
    });

    const unsubCleared = window.electronAPI.meetings.on.cleared(() => {
      setMeetings([]);
      setSelectedId(null);
    });

    return () => {
      unsubSaved();
      unsubCleared();
    };
  }, []);

  const selectedMeeting = meetings.find((m) => m.id === selectedId) ?? null;

  return {
    meetings,
    selectedId,
    selectedMeeting,
    setSelectedId,
    deleteMeeting,
    updateMeetingTitle,
    clearAll,
    refreshMeetings: fetchMeetings,
  };
}
