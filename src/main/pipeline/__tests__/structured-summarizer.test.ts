/// <reference types="vitest/globals" />
import {
  parseStructuredOutput,
  extractFieldsWithRegex,
  splitIntoChunks,
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

// ── splitIntoChunks ──────────────────────────────────────────────────────────

describe('splitIntoChunks', () => {
  it('returns the full text as a single chunk when under limit', () => {
    const text = 'Short text.';
    expect(splitIntoChunks(text, 2000)).toEqual([text]);
  });

  it('splits text into multiple chunks when over limit', () => {
    const text = 'word '.repeat(500); // 2500 chars
    const chunks = splitIntoChunks(text, 2000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ').replace(/\s+/g, ' ').trim()).toBe(text.trim());
  });

  it('each chunk is at or under the max size', () => {
    const text = 'word '.repeat(1000); // 5000 chars
    const chunks = splitIntoChunks(text, 2000);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });

  it('prefers splitting at newlines', () => {
    const line = 'x'.repeat(1000);
    const text = `${line}\n${line}\n${line}`;
    const chunks = splitIntoChunks(text, 2000);
    for (const chunk of chunks) {
      expect(chunk).not.toContain('\n');
    }
  });
});

// ── StructuredSummarizerService (fetch-based) ────────────────────────────────

const makeOkResponse = (content: string) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  } as Response);

const makeErrorResponse = (status: number) =>
  Promise.resolve({
    ok: false,
    status,
    statusText: 'Bad Request',
    json: () => Promise.resolve({}),
  } as Response);

describe('StructuredSummarizerService.summarize()', () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());

    const mod = await import('../structured-summarizer');
    service = mod.default;
    service.currentSummary = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null and skips fetch for text shorter than 200 chars', async () => {
    const result = await service.summarize('Short text.');
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns StructuredSummaryResult on happy path', async () => {
    const validJson = JSON.stringify({
      summary: 'Team aligned on Q3 roadmap.',
      decisions: ['Launch in August'],
      topics: ['roadmap'],
      actionItems: [{ text: 'Update spec', done: false }],
    });
    (fetch as any).mockReturnValueOnce(makeOkResponse(validJson));

    const result = await service.summarize('word '.repeat(50));
    expect(result?.summary).toBe('Team aligned on Q3 roadmap.');
    expect(result?.decisions).toEqual(['Launch in August']);
    expect(result?.actionItems).toEqual([{ text: 'Update spec', done: false }]);
  });

  it('returns null when LM Studio returns an error status', async () => {
    (fetch as any).mockReturnValueOnce(makeErrorResponse(500));

    const result = await service.summarize('word '.repeat(50));
    expect(result).toBeNull();
  });

  it('returns null when fetch rejects (LM Studio not running)', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await service.summarize('word '.repeat(50));
    expect(result).toBeNull();
  });

  it('sends system prompt and transcript in messages array', async () => {
    const validJson = JSON.stringify({
      summary: 'ok',
      decisions: [],
      topics: [],
      actionItems: [],
    });
    (fetch as any).mockReturnValueOnce(makeOkResponse(validJson));

    await service.summarize('word '.repeat(50));

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('Extract structured information');
    expect(body.temperature).toBe(0);
  });
});

// ── submitChunk / resetSession / getCurrentSummary / summarizeChunked ─────────

describe('StructuredSummarizerService rolling session methods', () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());

    const mod = await import('../structured-summarizer');
    service = mod.default;
    service.currentSummary = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getCurrentSummary() returns null before any chunk is submitted', () => {
    expect(service.getCurrentSummary()).toBeNull();
  });

  it('resetSession() clears currentSummary to null', () => {
    service.currentSummary = {
      summary: 'Some prior summary',
      decisions: ['Decision A'],
      topics: ['Topic 1'],
      actionItems: [],
    };
    service.resetSession();
    expect(service.getCurrentSummary()).toBeNull();
  });

  it('resetSession() is idempotent when already null', () => {
    service.resetSession();
    expect(service.getCurrentSummary()).toBeNull();
  });

  it('submitChunk() returns currentSummary unchanged when delta is too short', async () => {
    const existing = {
      summary: 'Previous summary',
      decisions: [],
      topics: [],
      actionItems: [],
    };
    service.currentSummary = existing;

    const result = await service.submitChunk('Short.');
    expect(result).toEqual(existing);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('submitChunk() uses PROMPT_TEMPLATE on first chunk (no previousSummary)', async () => {
    const responseJson = JSON.stringify({
      summary: 'First chunk summary',
      decisions: [],
      topics: [],
      actionItems: [],
    });
    (fetch as any).mockReturnValueOnce(makeOkResponse(responseJson));

    await service.submitChunk('word '.repeat(25));

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toContain('Extract structured information');
    expect(body.messages[1].content).not.toContain('Previous summary');
  });

  it('submitChunk() updates currentSummary on success', async () => {
    const expected = {
      summary: 'Chunk summary',
      decisions: ['Use TypeScript'],
      topics: ['architecture'],
      actionItems: [{ text: 'Write ADR', done: false }],
    };
    (fetch as any).mockReturnValueOnce(makeOkResponse(JSON.stringify(expected)));

    const result = await service.submitChunk('word '.repeat(25));
    expect(result).toEqual(expected);
    expect(service.getCurrentSummary()).toEqual(expected);
  });

  it('submitChunk() passes previousSummary in rolling prompt on subsequent chunks', async () => {
    const firstResult = {
      summary: 'Chunk 1',
      decisions: ['Decision A'],
      topics: ['Topic 1'],
      actionItems: [],
    };
    const secondResult = {
      summary: 'Chunk 1 + 2',
      decisions: ['Decision A', 'Decision B'],
      topics: ['Topic 1', 'Topic 2'],
      actionItems: [],
    };

    (fetch as any)
      .mockReturnValueOnce(makeOkResponse(JSON.stringify(firstResult)))
      .mockReturnValueOnce(makeOkResponse(JSON.stringify(secondResult)));

    await service.submitChunk('word '.repeat(25));
    await service.submitChunk('word '.repeat(25));

    const secondCallBody = JSON.parse((fetch as any).mock.calls[1][1].body);
    expect(secondCallBody.messages[1].content).toContain('Previous summary');
    expect(secondCallBody.messages[1].content).toContain('Chunk 1');
    expect(service.getCurrentSummary()).toEqual(secondResult);
  });

  // intentionally causes error log
  it('submitChunk() returns null and leaves currentSummary unchanged on fetch error', async () => {
    const existing = {
      summary: 'Safe prior state',
      decisions: [],
      topics: [],
      actionItems: [],
    };
    service.currentSummary = existing;

    (fetch as any).mockRejectedValueOnce(new Error('network error'));

    const result = await service.submitChunk('word '.repeat(25));
    expect(result).toBeNull();
    expect(service.getCurrentSummary()).toEqual(existing);
  });

  it('summarizeChunked() resets session then processes each chunk sequentially', async () => {
    service.currentSummary = { summary: 'stale', decisions: [], topics: [], actionItems: [] };

    const chunkResult = {
      summary: 'Fresh summary',
      decisions: ['Decision X'],
      topics: ['Topic Y'],
      actionItems: [],
    };
    // Text long enough to produce 2 chunks at 2000 chars each
    const text = 'word '.repeat(500); // 2500 chars → 2 chunks
    (fetch as any)
      .mockReturnValueOnce(makeOkResponse(JSON.stringify(chunkResult)))
      .mockReturnValueOnce(makeOkResponse(JSON.stringify(chunkResult)));

    const result = await service.summarizeChunked(text);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual(chunkResult);
  });

  it('summarizeChunked() returns null when all chunks fail', async () => {
    (fetch as any).mockRejectedValue(new Error('offline'));

    const text = 'word '.repeat(50); // short, single chunk
    const result = await service.summarizeChunked(text);
    expect(result).toBeNull();
  });

  it('summarizeChunked() stops processing and resets session when a mid-chunk fetch fails', async () => {
    const firstChunkResult = {
      summary: 'First chunk summary',
      decisions: ['Decision A'],
      topics: ['Topic A'],
      actionItems: [],
    };
    // Text long enough for 2 chunks; first succeeds, second fails
    const text = 'word '.repeat(500); // ~2500 chars → 2 chunks
    (fetch as any)
      .mockReturnValueOnce(makeOkResponse(JSON.stringify(firstChunkResult)))
      .mockRejectedValueOnce(new Error('network error'));

    const result = await service.summarizeChunked(text);

    expect(result).toBeNull();
    expect(service.getCurrentSummary()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
