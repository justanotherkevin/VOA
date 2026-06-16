import { getLMStudioPreferences } from '@/main/store';

export interface StructuredSummaryResult {
  summary: string;
  decisions: string[];
  topics: string[];
  actionItems: Array<{ text: string; done: boolean }>;
}

const MAX_TRANSCRIPT_CHARS = 8000;
const MAX_DELTA_CHARS = 2000;

const ROLLING_PROMPT_TEMPLATE = `You are a meeting transcript analyzer. You will receive a previous structured summary and a new transcript segment. Update the summary to integrate the new information and return ONLY valid JSON matching this schema:
{
  "summary": "2-3 sentence overview of everything discussed so far",
  "decisions": ["all explicit decisions made throughout the meeting"],
  "topics": ["all main subjects discussed"],
  "actionItems": [{"text": "what needs to be done", "done": false}]
}

Guidelines:
- Merge previous decisions, topics, and action items with new ones — do not overwrite
- Update the summary to reflect the cumulative discussion up to this point
- Remove exact duplicates but preserve all unique items
- Extract only explicitly stated decisions and action items, not implied ones
- If the audio is non-English, respond in English
- Output ONLY the JSON object — no explanation, no markdown fences`;

const PROMPT_TEMPLATE = `You are a meeting transcript analyzer. Extract structured information and return ONLY valid JSON matching this schema:
{
  "summary": "2-3 sentence overview of what was discussed and decided",
  "decisions": ["explicit decision made during the meeting"],
  "topics": ["main subject discussed"],
  "actionItems": [{"text": "what needs to be done", "done": false}]
}

Example:
Transcript: "Let's move the launch to March 15th. Mike, can you update the landing page copy by end of week? We also need to finalize pricing — Sarah will send a proposal to the team. Main topics were launch timeline and pricing strategy."

Output:
{
  "summary": "Team agreed to move the product launch to March 15th. Pricing finalization and landing page updates were identified as key blockers.",
  "decisions": ["Move launch date to March 15th"],
  "topics": ["Launch timeline", "Pricing strategy", "Landing page"],
  "actionItems": [
    {"text": "Mike: Update landing page copy by end of week", "done": false},
    {"text": "Sarah: Send pricing proposal to team", "done": false}
  ]
}

Guidelines:
- Extract only explicitly stated decisions and action items, not implied ones
- If a field has no content, return an empty array []
- For short transcripts, extract whatever information is available
- If the audio is non-English, respond in English
- If speakers overlap or content is unclear, capture the best interpretation in topics
- Output ONLY the JSON object — no explanation, no markdown fences`;

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

async function callLMStudio(
  messages: { role: string; content: string }[],
): Promise<string | null> {
  const { baseUrl, model } = getLMStudioPreferences();
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0 }),
  });
  if (!response.ok) {
    throw new Error(`LM Studio returned ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  return (data.choices?.[0]?.message?.content as string) ?? null;
}

export function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  if (text.length <= maxChunkSize) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxChunkSize) {
    const segment = remaining.slice(0, maxChunkSize);
    const newlineIdx = segment.lastIndexOf('\n');
    const periodIdx = segment.lastIndexOf('. ');
    const spaceIdx = segment.lastIndexOf(' ');

    let splitAt: number;
    if (newlineIdx > 0) splitAt = newlineIdx + 1;
    else if (periodIdx > 0) splitAt = periodIdx + 2;
    else if (spaceIdx > 0) splitAt = spaceIdx + 1;
    else splitAt = maxChunkSize;

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

class StructuredSummarizerService {
  private currentSummary: StructuredSummaryResult | null = null;

  async initialize(): Promise<void> {
    // No-op: LM Studio manages model lifecycle externally
  }

  async summarize(text: string): Promise<StructuredSummaryResult | null> {
    if (text.length < 200) {
      console.warn('[StructuredSummarizer] Text too short, skipping');
      return null;
    }
    try {
      const responseText = await callLMStudio([
        { role: 'system', content: PROMPT_TEMPLATE },
        {
          role: 'user',
          content: `Extract structured information from this transcript:\n\n${text.slice(0, MAX_TRANSCRIPT_CHARS)}`,
        },
      ]);
      return responseText ? parseStructuredOutput(responseText) : null;
    } catch (err) {
      console.error('[StructuredSummarizer] Inference error:', err);
      return null;
    }
  }

  async submitChunk(
    deltaTranscript: string,
  ): Promise<StructuredSummaryResult | null> {
    if (deltaTranscript.length < 100) {
      console.warn('[StructuredSummarizer] Delta transcript too short, skipping chunk');
      return this.currentSummary;
    }

    const previousSummary = this.currentSummary;
    try {
      const messages = previousSummary
        ? [
            { role: 'system', content: ROLLING_PROMPT_TEMPLATE },
            {
              role: 'user',
              content: `Previous summary:\n${JSON.stringify(previousSummary)}\n\nNew transcript segment:\n${deltaTranscript.slice(0, MAX_DELTA_CHARS)}`,
            },
          ]
        : [
            { role: 'system', content: PROMPT_TEMPLATE },
            {
              role: 'user',
              content: `Extract structured information from this transcript:\n\n${deltaTranscript.slice(0, MAX_DELTA_CHARS)}`,
            },
          ];

      const responseText = await callLMStudio(messages);
      const result = responseText ? parseStructuredOutput(responseText) : null;
      if (result) this.currentSummary = result;
      return result;
    } catch (err) {
      console.error('[StructuredSummarizer] Chunk inference error:', err);
      return null;
    }
  }

  async summarizeChunked(
    text: string,
  ): Promise<StructuredSummaryResult | null> {
    this.resetSession();
    const chunks = splitIntoChunks(text, MAX_DELTA_CHARS);
    for (const chunk of chunks) {
      await this.submitChunk(chunk);
    }
    return this.getCurrentSummary();
  }

  getCurrentSummary(): StructuredSummaryResult | null {
    return this.currentSummary;
  }

  resetSession(): void {
    this.currentSummary = null;
  }

  dispose(): void {
    this.currentSummary = null;
  }
}

export default new StructuredSummarizerService();
