/// <reference types="vitest/globals" />
import {
  parseStructuredOutput,
  extractFieldsWithRegex,
} from '../structured-summarizer';

// ── parseStructuredOutput ────────────────────────────────────────────────────

describe('parseStructuredOutput', () => {
  it('returns all four fields from valid JSON', () => {
    const sampleStructuredOutput = {
      summary: 'We discussed quarterly goals.',
      decisions: ['Ship v2 by July'],
      topics: ['roadmap', 'hiring'],
      actionItems: [{ text: 'Write spec', done: false }],
    };

    const raw = JSON.stringify(sampleStructuredOutput);
    const result = parseStructuredOutput(raw);
    expect(result).toEqual(sampleStructuredOutput);
  });

  it('returns empty arrays when decisions and topics are absent', () => {
    const raw = JSON.stringify({
      summary: 'Quick standup.',
      decisions: [],
      topics: [],
      actionItems: [],
    });
    const result = parseStructuredOutput(raw);
    expect(result?.decisions).toEqual([]);
    expect(result?.topics).toEqual([]);
    expect(result?.actionItems).toEqual([]);
  });

  it('returns null when summary field is missing', () => {
    const raw = JSON.stringify({
      decisions: ['Do something'],
      topics: ['work'],
      actionItems: [],
    });
    expect(parseStructuredOutput(raw)).toBeNull();
  });

  it('maps actionItems done field correctly for mixed values', () => {
    const raw = JSON.stringify({
      summary: 'Follow-up session.',
      decisions: [],
      topics: [],
      actionItems: [
        { text: 'Task A', done: true },
        { text: 'Task B', done: false },
      ],
    });
    const result = parseStructuredOutput(raw);
    expect(result?.actionItems).toEqual([
      { text: 'Task A', done: true },
      { text: 'Task B', done: false },
    ]);
  });

  it('falls back to regex extraction when JSON is malformed but fields present', () => {
    const raw = `{ "summary": "Discussed roadmap.", "decisions": ["Hire engineer"], "topics": ["hiring"] "actionItems": [] }`;
    const result = parseStructuredOutput(raw);
    expect(result?.summary).toBe('Discussed roadmap.');
    expect(result?.decisions).toContain('Hire engineer');
  });

  it('returns null for completely unstructured output', () => {
    expect(
      parseStructuredOutput('Sure! Here is a summary of the meeting.'),
    ).toBeNull();
  });

  it('filters out non-string entries from decisions and topics arrays', () => {
    const raw = JSON.stringify({
      summary: 'Planning session.',
      decisions: ['Valid decision', 42, null],
      topics: ['engineering', false],
      actionItems: [],
    });
    const result = parseStructuredOutput(raw);
    expect(result?.decisions).toEqual(['Valid decision']);
    expect(result?.topics).toEqual(['engineering']);
  });
});

// ── extractFieldsWithRegex ───────────────────────────────────────────────────

describe('extractFieldsWithRegex', () => {
  it('extracts all fields when present in raw string', () => {
    const raw = `
      "summary": "Brief overview of the call.",
      "decisions": ["Approve budget"],
      "topics": ["finance"],
      "actionItems": [{"text": "Send report", "done": false}]
    `;
    const result = extractFieldsWithRegex(raw);
    expect(result?.summary).toBe('Brief overview of the call.');
    expect(result?.decisions).toContain('Approve budget');
    expect(result?.topics).toContain('finance');
    expect(result?.actionItems?.[0]).toEqual({
      text: 'Send report',
      done: false,
    });
  });

  it('returns null when summary field is absent', () => {
    const raw = `"decisions": ["Do something"], "topics": ["work"]`;
    expect(extractFieldsWithRegex(raw)).toBeNull();
  });

  it('returns empty arrays for missing optional fields', () => {
    const raw = `"summary": "Short meeting."`;
    const result = extractFieldsWithRegex(raw);
    expect(result?.decisions).toEqual([]);
    expect(result?.topics).toEqual([]);
    expect(result?.actionItems).toEqual([]);
  });
});

// ── summarize() ──────────────────────────────────────────────────────────────

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(),
}));

describe('StructuredSummarizerService.summarize()', () => {
  let service: any;
  let mockPipelineFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { pipeline } = await import('@huggingface/transformers');
    mockPipelineFn = vi.fn();
    (pipeline as ReturnType<typeof vi.fn>).mockResolvedValue(mockPipelineFn);

    const mod = await import('../structured-summarizer');
    service = mod.default;

    // Reset singleton so each test re-initializes
    service.isInitialized = false;
    service.initializationPromise = null;
    service.pipe = null;
  });

  it('returns null and skips pipeline for text shorter than 200 chars', async () => {
    const result = await service.summarize('Short text.');
    expect(result).toBeNull();
    expect(mockPipelineFn).not.toHaveBeenCalled();
  });

  it('returns StructuredSummaryResult on happy path', async () => {
    const validJson = JSON.stringify({
      summary: 'Team aligned on Q3 roadmap.',
      decisions: ['Launch in August'],
      topics: ['roadmap'],
      actionItems: [{ text: 'Update spec', done: false }],
    });
    mockPipelineFn.mockResolvedValueOnce([
      { generated_text: [{ role: 'assistant', content: validJson }] },
    ]);

    const longText = 'word '.repeat(50); // 250 chars
    const result = await service.summarize(longText);

    expect(result).not.toBeNull();
    expect(result?.summary).toBe('Team aligned on Q3 roadmap.');
    expect(result?.decisions).toEqual(['Launch in August']);
    expect(result?.actionItems).toEqual([{ text: 'Update spec', done: false }]);
  });

  it('returns null when pipeline throws, without propagating the error', async () => {
    mockPipelineFn.mockRejectedValueOnce(new Error('CUDA out of memory'));
    const longText = 'word '.repeat(50);
    await expect(service.summarize(longText)).resolves.toBeNull();
  });

  it('handles non-array generated_text (plain string) gracefully', async () => {
    const validJson = JSON.stringify({
      summary: 'Plain string path.',
      decisions: [],
      topics: [],
      actionItems: [],
    });
    mockPipelineFn.mockResolvedValueOnce([{ generated_text: validJson }]);

    const longText = 'word '.repeat(50);
    const result = await service.summarize(longText);
    expect(result?.summary).toBe('Plain string path.');
  });

  it('parses structured output from a realistic monologue about payment schedules', async () => {
    const monologue = `Glad to see things are going well and business is starting to pick up. Andrea told me about your outstanding numbers on Tuesday. Keep up the good work. Now to other business, I am going to suggest a payment schedule for the outstanding monies that is due. One, can you pay the balance of the license agreement as soon as possible? Two, I suggest we setup or you suggest, what you can pay on the back royalties, would you feel comfortable with paying every two weeks? Every month, I will like to catch up and maintain current royalties. So, if we can start the current royalties and maintain them every two weeks as all stores are required to do, I would appreciate it. Let me know if this works for you.`;

    // Simulate what Qwen2.5 would realistically return for this content
    const realisticLlmResponse = JSON.stringify({
      summary:
        'A business update call covering strong recent performance and a proposed payment schedule for outstanding license fees and back royalties, suggesting bi-weekly payments going forward.',
      decisions: [
        'Establish bi-weekly royalty payment schedule',
        'Maintain current royalties on the same bi-weekly cadence required of all stores',
      ],
      topics: ['payment schedule', 'license agreement', 'back royalties', 'business performance'],
      actionItems: [
        { text: 'Pay balance of the license agreement as soon as possible', done: false },
        { text: 'Propose a payment amount for back royalties', done: false },
        { text: 'Confirm bi-weekly payment schedule works', done: false },
      ],
    });

    mockPipelineFn.mockResolvedValueOnce([
      { generated_text: [{ role: 'assistant', content: realisticLlmResponse }] },
    ]);

    const result = await service.summarize(monologue);
    console.log('\n── Monologue structured output ──');
    console.log(JSON.stringify(result, null, 2));

    expect(result).not.toBeNull();
    expect(result?.summary).toContain('payment');
    expect(result?.decisions.length).toBeGreaterThan(0);
    expect(result?.topics).toContain('payment schedule');
    expect(result?.actionItems.length).toBeGreaterThan(0);
    expect(result?.actionItems[0].done).toBe(false);
  });
});
