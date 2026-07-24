import { describe, it, expect } from 'vitest';
import { cleanText, stripNonSpeechTags } from '../text-cleaner';

describe('stripNonSpeechTags', () => {
  it('removes a bracketed Whisper non-speech tag entirely', () => {
    expect(stripNonSpeechTags('[BLANK_AUDIO]')).toBe('');
  });

  it('removes a parenthesized non-speech tag', () => {
    expect(stripNonSpeechTags('(music)')).toBe('');
  });

  it('is case-insensitive and tolerates underscore/space variants', () => {
    expect(stripNonSpeechTags('[blank_audio]')).toBe('');
    expect(stripNonSpeechTags('[Blank Audio]')).toBe('');
  });

  it('strips a non-speech tag from the middle of real speech, keeping the rest', () => {
    expect(
      stripNonSpeechTags(
        'Let me check the numbers [BLANK_AUDIO] before we ship',
      ),
    ).toBe('Let me check the numbers before we ship');
  });

  it('strips multiple tags in one segment', () => {
    expect(stripNonSpeechTags('[MUSIC] [SILENCE] [NOISE]')).toBe('');
  });

  it('leaves ordinary speech untouched', () => {
    expect(stripNonSpeechTags('Hey, can you send me the report?')).toBe(
      'Hey, can you send me the report?',
    );
  });

  it('returns an empty string for empty/non-string input', () => {
    expect(stripNonSpeechTags('')).toBe('');
    expect(stripNonSpeechTags(undefined as unknown as string)).toBe('');
  });
});

describe('cleanText', () => {
  it('also strips non-speech tags in addition to single-word fillers', () => {
    expect(cleanText('[BLANK_AUDIO] um so yeah I think we should go')).toBe(
      'I think we should go',
    );
  });
});
