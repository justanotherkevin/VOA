/**
 * Text cleaning utilities to remove filler words, disfluencies, and false starts
 * from transcribed speech for more polished output
 */

// Common filler words and verbal disfluencies
const FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'erm', 'ah', 'umm', 'uhhh',
  'like', 'you know', 'basically', 'literally', 'honestly', 'actually',
  'i mean', 'you see', 'sort of', 'kind of', 'i think', 'i believe',
  'well', 'anyway', 'anyhow', 'so', 'you know what',
  'mmhmm', 'uh huh', 'yeah', 'yep', 'nope',
]);

// Repeated interjections pattern: "um um um" or "like like like"
const REPEATED_FILLER_PATTERN = /\b(\w{1,4})\s+(?:\1\s*)+/gi;

// False starts pattern: "I th- I think" or "that's- that is"
const FALSE_START_PATTERN = /\b\w+-\s+(?:that's|he's|she's|it's|i'm|we're|you're|they're|i've|we've|they've|i'll|we'll|you'll|they'll)\b/gi;

// Multiple spaces
const MULTIPLE_SPACES_PATTERN = /\s{2,}/g;

export function cleanText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // Remove false starts (e.g., "I th- I think" -> "I think")
  cleaned = cleaned.replace(FALSE_START_PATTERN, (match) => {
    // Keep only the second part (the corrected version)
    const parts = match.split(/\s+/);
    return parts.slice(1).join(' ');
  });

  // Remove repeated filler words (e.g., "um um um" -> "um")
  cleaned = cleaned.replace(REPEATED_FILLER_PATTERN, '$1');

  // Remove filler words
  cleaned = cleaned
    .split(/\s+/)
    .filter((word) => {
      const lowerWord = word.toLowerCase();
      // Keep the word if it's not in the filler list
      return !FILLER_WORDS.has(lowerWord);
    })
    .join(' ');

  // Clean up multiple spaces
  cleaned = cleaned.replace(MULTIPLE_SPACES_PATTERN, ' ');

  // Trim and normalize
  cleaned = cleaned.trim();

  return cleaned;
}

export default { cleanText };
