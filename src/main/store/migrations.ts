import log from 'electron-log';
import { Recording, StoredTranscript } from './schema';

export function generateTitle(transcript: string): string {
  if (!transcript || transcript.trim() === '') return 'Untitled Meeting';
  const words = transcript.trim().split(/\s+/);
  return words.slice(0, 8).join(' ') + (words.length > 8 ? '...' : '');
}

export function normalizeRecording(m: any): Recording {
  const summary = m.summary ?? '';
  const summaryStatus = m.summaryStatus ?? 'ready';
  return {
    ...m,
    type: m.type ?? (m.isMeeting ? 'meeting' : 'dictation'),
    summary,
    summaryStatus,
    decisions: m.decisions ?? [],
    topics: m.topics ?? [],
  };
}

export function runMigrations(store: any) {
  if (!store.get('meetingsMigrated')) {
    const oldHistory: StoredTranscript[] = store.get('transcriptHistory') ?? [];
    if (oldHistory.length > 0) {
      const meetings: Recording[] = oldHistory.map((t) => ({
        id: t.id,
        title: generateTitle(t.text),
        startedAt: t.date,
        endedAt: t.date,
        durationMs: 0,
        transcript: t.text,
        chunks: t.chunks,
        type: 'dictation' as const,
        summary: '',
        summaryStatus: 'ready' as const,
        decisions: [],
        topics: [],
        actionItems: [],
        audioSource: 'mic' as const,
        participants: [],
        tags: [],
      }));
      store.set('meetings', meetings);
      log.info(`[Store] Migrated ${meetings.length} transcripts → meetings`);
    }

    store.set('meetingsMigrated', true);
  }

  if (!store.get('recordingTypeMigrated')) {
    const meetings: any[] = store.get('meetings') ?? [];
    if (meetings.length > 0) {
      const migrated = meetings.map(normalizeRecording);
      store.set('meetings', migrated);
      log.info(
        `[Store] Migrated ${migrated.length} recordings: isMeeting → type`,
      );
    }
    store.set('recordingTypeMigrated', true);
  }
}
