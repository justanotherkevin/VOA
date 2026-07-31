// Fixed palette so the same participant string always renders the same
// color (simple string hash mod palette length, no persistence needed).
const AVATAR_COLOR_CLASSES = [
  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
  'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  'bg-teal-500/15 text-teal-600 dark:text-teal-400',
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// A participant is either a display name ("Alice Smith") or a bare email
// ("alice@example.com") — extracts the first letter of whichever is present.
export function getParticipantInitial(participant: string): string {
  const trimmed = participant.trim();
  if (!trimmed) return '?';
  return trimmed[0].toUpperCase();
}

export function getParticipantColorClass(participant: string): string {
  const index = hashString(participant) % AVATAR_COLOR_CLASSES.length;
  return AVATAR_COLOR_CLASSES[index];
}
