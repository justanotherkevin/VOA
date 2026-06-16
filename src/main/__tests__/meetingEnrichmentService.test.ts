/// <reference types="vitest/globals" />
// Integration test: transcript text → StructuredSummaryResult via real Qwen inference
//
// Starting point: meeting.transcript (the joined Whisper output stored after a session ends)
// Mirrors the path triggered by EnrichmentService.triggerEnrichment():
//   1. getMeetingById(id) → meeting.transcript
//   2. structuredSummarizerService.initialize()
//   3. structuredSummarizerService.summarize(transcript)
//   4. parseStructuredOutput(rawQwenResponse) → StructuredSummaryResult
//
// Requires: npm run build  (child process runs from dist/main/structured-summarizer-process.js)
// Run via:  npm run test:meeting-enrichment

import {
  parseStructuredOutput,
} from '@/main/pipeline/structured-summarizer';
import type { StructuredSummaryResult } from '@/main/pipeline/structured-summarizer';

describe('parseStructuredOutput', () => {
  it('returns null for empty/missing summary', () => {
    expect(parseStructuredOutput('{}')).toBeNull();
  });

  it('parses minimal valid JSON', () => {
    const result = parseStructuredOutput(
      '{"summary":"test","decisions":[],"topics":[],"actionItems":[]}',
    );
    expect(result).not.toBeNull();
    expect(result?.summary).toBe('test');
  });

  it('strips markdown fences before parsing', () => {
    const result = parseStructuredOutput(
      '```json\n{"summary":"fenced","decisions":[],"topics":[],"actionItems":[]}\n```',
    );
    expect(result?.summary).toBe('fenced');
  });

  it('parses a realistic rolling response', () => {
    const raw = `{
      "summary": "The community board reviewed last month's minutes and discussed budget allocations. A subcommittee was proposed to review infrastructure needs.",
      "decisions": ["Approve last month minutes", "Form infrastructure subcommittee"],
      "topics": ["meeting minutes", "budget", "infrastructure"],
      "actionItems": [
        {"text": "Aaron to send subcommittee charter draft by Friday", "done": false},
        {"text": "Chair to confirm quorum for next session", "done": false}
      ]
    }`;

    const result: StructuredSummaryResult | null = parseStructuredOutput(raw);

    expect(result).not.toBeNull();
    expect(result!.summary).toContain('community board');
    expect(result!.decisions).toHaveLength(2);
    expect(result!.topics).toContain('infrastructure');
    expect(result!.actionItems).toHaveLength(2);
    expect(result!.actionItems[0].done).toBe(false);
  });
});
