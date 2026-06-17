/// <reference types="vitest/globals" />
// Integration test: LM Studio response shape validation.
//
// Requires a running LM Studio instance at http://localhost:1234 with a model loaded.
// Run via: npm run test:lmstudio
//
// What this tests:
//   1. checkConnection() returns true when LM Studio is reachable
//   2. summarize() returns a StructuredSummaryResult with all required keys
//   3. Each key has the correct type (string / array shapes)

import structuredSummarizerService, {
  checkConnection,
} from '@/main/pipeline/structured-summarizer';
import type { StructuredSummaryResult } from '@/main/pipeline/structured-summarizer';

const LM_STUDIO_URL = 'http://localhost:1234';

const SAMPLE_TRANSCRIPT = `
Alice: Good morning everyone. Let's start with the budget review for Q3.
Bob: Sure. We're currently at 80% of the allocated budget with two months remaining.
Alice: That's concerning. We need to cut the marketing spend by 20%.
Bob: Agreed. I'll prepare a revised budget proposal by Friday.
Alice: Also, the new dashboard feature needs to launch before the conference on the 15th.
Carol: I can have the frontend done by Wednesday if design approves the mockups today.
Alice: Let's make that happen. Carol, loop in the design team right after this call.
`;

describe('LM Studio integration — StructuredSummaryResult shape', () => {
  it('LM Studio is reachable at the default port', async () => {
    const reachable = await checkConnection(LM_STUDIO_URL);
    expect(reachable).toBe(true);
  });

  it('summarize() returns a result with all required keys', async () => {
    const result: StructuredSummaryResult | null =
      await structuredSummarizerService.summarize(SAMPLE_TRANSCRIPT);

    expect(result).not.toBeNull();

    // summary: non-empty string
    expect(typeof result!.summary).toBe('string');
    expect(result!.summary.length).toBeGreaterThan(0);

    // decisions: array of strings
    expect(Array.isArray(result!.decisions)).toBe(true);
    for (const d of result!.decisions) {
      expect(typeof d).toBe('string');
    }

    // topics: array of strings
    expect(Array.isArray(result!.topics)).toBe(true);
    for (const t of result!.topics) {
      expect(typeof t).toBe('string');
    }

    // actionItems: array of { text: string, done: boolean }
    expect(Array.isArray(result!.actionItems)).toBe(true);
    for (const item of result!.actionItems) {
      expect(typeof item.text).toBe('string');
      expect(typeof item.done).toBe('boolean');
    }
  });

  it('summarizeChunked() returns a valid result for a full transcript', async () => {
    const result = await structuredSummarizerService.summarizeChunked(SAMPLE_TRANSCRIPT);

    expect(result).not.toBeNull();
    expect(typeof result!.summary).toBe('string');
    expect(result!.summary.length).toBeGreaterThan(0);
    expect(Array.isArray(result!.decisions)).toBe(true);
    expect(Array.isArray(result!.topics)).toBe(true);
    expect(Array.isArray(result!.actionItems)).toBe(true);
  });
});
