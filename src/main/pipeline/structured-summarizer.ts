/* eslint-disable camelcase */
import { DEFAULT_MODELS } from '@/lib/Constants';

export interface StructuredSummaryResult {
  summary: string;
  decisions: string[];
  topics: string[];
  actionItems: Array<{ text: string; done: boolean }>;
}

const MAX_TRANSCRIPT_CHARS = 8000;
const PROMPT_TEMPLATE = `You are a meeting note assistant. Extract structured information from this meeting transcript.
Return only valid JSON matching this schema:
{
  "summary": "2-3 sentence overview",
  "decisions": ["decision 1", "decision 2"],
  "topics": ["topic 1", "topic 2"],
  "actionItems": [{"text": "task description", "done": false}]
}
Transcript:
`;

export function parseStructuredOutput(
  raw: string,
): StructuredSummaryResult | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return extractFieldsWithRegex(raw);

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const summary =
      typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    if (!summary) return null;

    return {
      summary,
      decisions: Array.isArray(parsed.decisions)
        ? parsed.decisions.filter((d: unknown) => typeof d === 'string')
        : [],
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter((t: unknown) => typeof t === 'string')
        : [],
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems
            .filter((a: unknown) => a && typeof (a as any).text === 'string')
            .map((a: any) => ({ text: a.text, done: Boolean(a.done) }))
        : [],
    };
  } catch {
    return extractFieldsWithRegex(raw);
  }
}

export function extractFieldsWithRegex(
  raw: string,
): StructuredSummaryResult | null {
  const summaryMatch = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const summary = summaryMatch?.[1]?.trim() ?? '';
  if (!summary) return null;

  const decisionsMatch = raw.match(/"decisions"\s*:\s*\[([\s\S]*?)\]/);
  const decisions = decisionsMatch
    ? [...decisionsMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
    : [];

  const topicsMatch = raw.match(/"topics"\s*:\s*\[([\s\S]*?)\]/);
  const topics = topicsMatch
    ? [...topicsMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
    : [];

  const actionItems: Array<{ text: string; done: boolean }> = [];
  const actionItemsMatch = raw.match(/"actionItems"\s*:\s*\[([\s\S]*?)\]/);
  if (actionItemsMatch) {
    const itemMatches = actionItemsMatch[1].matchAll(
      /\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"done"\s*:\s*(true|false)\s*\}/g,
    );
    for (const m of itemMatches) {
      actionItems.push({ text: m[1], done: m[2] === 'true' });
    }
  }

  return { summary, decisions, topics, actionItems };
}

class StructuredSummarizerService {
  private pipe: any = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initializationPromise) return this.initializationPromise;
    if (this.isInitialized) return Promise.resolve();

    this.initializationPromise = (async () => {
      try {
        console.log(
          '[StructuredSummarizer] Initializing text-generation pipeline...',
        );
        // @huggingface/transformers is ESM-only; must be imported dynamically
        const { pipeline } = await import('@huggingface/transformers');
        this.pipe = await pipeline(
          'text-generation',
          DEFAULT_MODELS.text2structuredSummary,
          { dtype: 'q4' },
        );
        this.isInitialized = true;
        console.log('[StructuredSummarizer] Pipeline initialized successfully');
      } catch (error) {
        console.error(
          '[StructuredSummarizer] Failed to initialize pipeline:',
          error,
        );
        this.initializationPromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  async summarize(text: string): Promise<StructuredSummaryResult | null> {
    if (text.length < 200) {
      console.warn('[StructuredSummarizer] Text too short, skipping');
      return null;
    }

    await this.initialize();

    if (!this.pipe)
      throw new Error('StructuredSummarizer pipeline not initialized');

    const transcript = text.slice(0, MAX_TRANSCRIPT_CHARS);
    const messages = [
      { role: 'user' as const, content: PROMPT_TEMPLATE + transcript },
    ];

    try {
      const output = await this.pipe(messages, {
        max_new_tokens: 512,
        do_sample: false,
      });

      const generated = output[0]?.generated_text;
      const responseText: string = Array.isArray(generated)
        ? (generated.at(-1)?.content ?? '')
        : (generated ?? '');

      const result = parseStructuredOutput(responseText);
      console.log(
        '[StructuredSummarizer] Parsed result:',
        JSON.stringify(result),
      );
      return result;
    } catch (error) {
      console.error('[StructuredSummarizer] Inference error:', error);
      return null;
    }
  }

  dispose(): void {
    this.pipe = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

export default new StructuredSummarizerService();
