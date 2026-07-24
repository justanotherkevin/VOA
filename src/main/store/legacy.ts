import { getStore } from './instance';
import { saveMeeting, getMeetings, clearMeetings } from './meetings';
import { generateTitle } from './migrations';
import { StoredTranscript } from './schema';

export function saveTranscript(data: {
  text: string;
  chunks: Array<{ text: string; timestamp: [number, number | null] }>;
}): StoredTranscript | null {
  if (!getStore() || !data.text || data.text.trim() === '') return null;

  const meeting = saveMeeting({
    title: generateTitle(data.text),
    startedAt: Date.now(),
    endedAt: Date.now(),
    durationMs: 0,
    transcript: data.text,
    chunks: data.chunks,
    type: 'dictation',
    summary: '',
    summaryStatus: 'pending',
    decisions: [],
    topics: [],
    actionItems: [],
    audioSource: 'mic',
    participants: [],
    tags: [],
  });

  return {
    id: meeting.id,
    date: meeting.startedAt,
    text: meeting.transcript,
    chunks: meeting.chunks,
  };
}

export function getTranscriptHistory(): StoredTranscript[] {
  return getMeetings().map((m) => ({
    id: m.id,
    date: m.startedAt,
    text: m.transcript,
    chunks: m.chunks,
  }));
}

export function clearTranscriptHistory(): void {
  clearMeetings();
}
