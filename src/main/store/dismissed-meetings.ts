import { getStore } from './instance';

const MAX_DISMISSED_KEYS = 30;

export function getDismissedMeetingKeys(): string[] {
  return getStore()?.get('dismissedMeetingKeys') ?? [];
}

export function addDismissedMeetingKey(key: string): void {
  const keys = getDismissedMeetingKeys();
  if (keys.includes(key)) return;
  keys.push(key);
  if (keys.length > MAX_DISMISSED_KEYS) {
    keys.splice(0, keys.length - MAX_DISMISSED_KEYS);
  }
  getStore()?.set('dismissedMeetingKeys', keys);
}
