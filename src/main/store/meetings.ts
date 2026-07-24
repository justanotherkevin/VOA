import { getStore } from './instance';
import { normalizeRecording, generateTitle } from './migrations';
import { Recording } from './schema';

export function saveMeeting(data: Omit<Recording, 'id'>): Recording {
  const store = getStore();
  const meetings: Recording[] = store.get('meetings') ?? [];
  const newMeeting: Recording = {
    id: crypto.randomUUID(),
    ...data,
  };

  meetings.unshift(newMeeting);

  if (meetings.length > 100) {
    meetings.length = 100;
  }

  store.set('meetings', meetings);
  return newMeeting;
}

export function getMeetings(): Recording[] {
  const meetings: any[] = getStore().get('meetings') ?? [];
  return meetings.map(normalizeRecording);
}

export function getMeetingById(id: string): Recording | null {
  const meetings: any[] = getStore().get('meetings') ?? [];
  const found = meetings.find((m) => m.id === id);
  return found ? normalizeRecording(found) : null;
}

export function updateMeeting(
  id: string,
  patch: Partial<Recording>,
): Recording | null {
  const store = getStore();
  const meetings: Recording[] = store.get('meetings') ?? [];
  const idx = meetings.findIndex((m) => m.id === id);
  if (idx === -1) return null;

  meetings[idx] = { ...meetings[idx], ...patch };
  store.set('meetings', meetings);
  return meetings[idx];
}

export function deleteMeeting(id: string): boolean {
  const store = getStore();
  const meetings: Recording[] = store.get('meetings') ?? [];
  const filtered = meetings.filter((m) => m.id !== id);
  if (filtered.length === meetings.length) return false;
  store.set('meetings', filtered);
  return true;
}

export function clearMeetings(): void {
  getStore().set('meetings', []);
}
