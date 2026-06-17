#!/usr/bin/env node
/**
 * Watch the LM Studio summarization pipeline process a full transcript.
 *
 * Usage:
 *   node scripts/watch-summarize.mjs [transcript.json] [--url http://localhost:1234] [--model <model-id>]
 *
 * Defaults:
 *   transcript: tests/e2e/mocks/city-meeting-transcript-2.json
 *   url:        http://localhost:1234
 *   model:      (empty = use whatever is loaded in LM Studio)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const urlFlag = args.indexOf('--url');
const modelFlag = args.indexOf('--model');
const BASE_URL = urlFlag !== -1 ? args[urlFlag + 1] : 'http://localhost:1234';
const MODEL = modelFlag !== -1 ? args[modelFlag + 1] : '';
const transcriptArg = args.find(a => !a.startsWith('--') && args.indexOf(a) !== urlFlag + 1 && args.indexOf(a) !== modelFlag + 1);
const TRANSCRIPT_PATH = transcriptArg
  ? resolve(process.cwd(), transcriptArg)
  : resolve(ROOT, 'tests/e2e/mocks/city-meeting-transcript-2.json');

// ── Config (mirrors structured-summarizer.ts constants) ─────────────────────
const MAX_DELTA_CHARS = 2000;

const PROMPT_TEMPLATE = `You are a meeting transcript analyzer. Extract structured information and return ONLY valid JSON matching this schema:
{
  "summary": "2-3 sentence overview of what was discussed and decided",
  "decisions": ["explicit decision made during the meeting"],
  "topics": ["main subject discussed"],
  "actionItems": [{"text": "what needs to be done", "done": false}]
}

Guidelines:
- Extract only explicitly stated decisions and action items, not implied ones
- If a field has no content, return an empty array []
- For short transcripts, extract whatever information is available
- If the audio is non-English, respond in English
- Output ONLY the JSON object — no explanation, no markdown fences`;

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

// ── ANSI colours ─────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
};
const b  = s => `${C.bold}${s}${C.reset}`;
const c  = (color, s) => `${color}${s}${C.reset}`;
const hr = (char = '─', len = 70) => c(C.dim, char.repeat(len));

// ── Helpers ───────────────────────────────────────────────────────────────────
function splitIntoChunks(text, maxSize) {
  if (text.length <= maxSize) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxSize) {
    const segment = remaining.slice(0, maxSize);
    const newlineIdx = segment.lastIndexOf('\n');
    const periodIdx  = segment.lastIndexOf('. ');
    const spaceIdx   = segment.lastIndexOf(' ');
    let splitAt;
    if (newlineIdx > 0)      splitAt = newlineIdx + 1;
    else if (periodIdx > 0)  splitAt = periodIdx + 2;
    else if (spaceIdx > 0)   splitAt = spaceIdx + 1;
    else                     splitAt = maxSize;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

function parseResult(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const p = JSON.parse(match[0]);
    if (!p.summary || typeof p.summary !== 'string') return null;
    return {
      summary:     p.summary.trim(),
      decisions:   Array.isArray(p.decisions)   ? p.decisions.filter(d => typeof d === 'string')   : [],
      topics:      Array.isArray(p.topics)       ? p.topics.filter(t => typeof t === 'string')       : [],
      actionItems: Array.isArray(p.actionItems)  ? p.actionItems.filter(a => a && typeof a.text === 'string').map(a => ({ text: a.text, done: Boolean(a.done) })) : [],
    };
  } catch {
    return null;
  }
}

async function callLMStudio(messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0 }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } finally {
    clearTimeout(timeout);
  }
}

function formatResult(result) {
  if (!result) return c(C.red, '  (null — parse failed)');
  const lines = [
    `  ${b('Summary:')}    ${result.summary}`,
    `  ${b('Decisions:')}  ${result.decisions.length === 0 ? c(C.dim, '(none)') : result.decisions.map(d => `• ${d}`).join('\n               ')}`,
    `  ${b('Topics:')}     ${result.topics.length === 0    ? c(C.dim, '(none)') : result.topics.join(', ')}`,
    `  ${b('Actions:')}    ${result.actionItems.length === 0 ? c(C.dim, '(none)') : result.actionItems.map(a => `• ${a.text}`).join('\n               ')}`,
  ];
  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  // 1. Load transcript
  let raw;
  try {
    raw = JSON.parse(readFileSync(TRANSCRIPT_PATH, 'utf-8'));
  } catch (e) {
    console.error(c(C.red, `Cannot read transcript: ${TRANSCRIPT_PATH}\n${e.message}`));
    process.exit(1);
  }

  const transcript = raw.segments
    .map(s => s.text.trim())
    .filter(t => t && !t.startsWith('['))   // drop [BLANK_AUDIO], [CROSSTALK] etc.
    .join(' ');

  const chunks = splitIntoChunks(transcript, MAX_DELTA_CHARS);

  // 2. Header
  console.log('\n' + hr('═'));
  console.log(b(c(C.cyan, '  LM Studio Summarization Watch')));
  console.log(hr('═'));
  console.log(`  ${b('Transcript:')}  ${TRANSCRIPT_PATH}`);
  console.log(`  ${b('Source:')}      ${raw.source ?? 'unknown'} (${raw.duration_s ?? '?'}s, ${raw.segment_count ?? raw.segments.length} segments)`);
  console.log(`  ${b('Characters:')}  ${transcript.length.toLocaleString()}`);
  console.log(`  ${b('Chunks:')}      ${chunks.length} × ≤${MAX_DELTA_CHARS} chars`);
  console.log(`  ${b('LM Studio:')}   ${BASE_URL}${MODEL ? `  model=${MODEL}` : ''}`);
  console.log(hr('─'));

  // 3. Connectivity check
  process.stdout.write(`\n  Checking connectivity… `);
  try {
    const ping = await fetch(`${BASE_URL.replace(/\/$/, '')}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
    const models = (await ping.json())?.data?.map(m => m.id) ?? [];
    console.log(c(C.green, '✓ reachable') + c(C.dim, models.length ? `  (loaded: ${models.join(', ')})` : '  (no models listed)'));
  } catch (e) {
    console.log(c(C.red, `✗ unreachable — ${e.message}`));
    console.log(c(C.yellow, `  Start LM Studio and load a model, then re-run.\n`));
    process.exit(1);
  }

  // 4. Process chunks
  let currentSummary = null;
  const timings = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isFirst = i === 0;
    const chunkNum = `[${i + 1}/${chunks.length}]`;

    console.log('\n' + hr('─'));
    console.log(b(c(C.blue, `  Chunk ${chunkNum}`)) + c(C.dim, `  ${chunk.length} chars`));
    console.log(c(C.dim, `  "${chunk.slice(0, 120).replace(/\n/g, ' ')}${chunk.length > 120 ? '…' : ''}"`));

    const messages = isFirst
      ? [
          { role: 'system', content: PROMPT_TEMPLATE },
          { role: 'user', content: `Extract structured information from this transcript:\n\n${chunk}` },
        ]
      : [
          { role: 'system', content: ROLLING_PROMPT_TEMPLATE },
          { role: 'user', content: `Previous summary:\n${JSON.stringify(currentSummary)}\n\nNew transcript segment:\n${chunk}` },
        ];

    process.stdout.write(`  Sending to LM Studio… `);
    const t0 = Date.now();

    let raw_response;
    try {
      raw_response = await callLMStudio(messages);
    } catch (e) {
      console.log(c(C.red, `✗ error — ${e.message}`));
      console.log(c(C.red, `  Aborting — rolling summary is no longer valid.\n`));
      process.exit(1);
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    timings.push(+elapsed);
    console.log(c(C.green, `✓`) + c(C.dim, ` ${elapsed}s`));

    const result = parseResult(raw_response ?? '');
    if (!result) {
      console.log(c(C.red, `  Parse failed — raw response:`));
      console.log(c(C.dim, `  ${(raw_response ?? '(empty)').slice(0, 300)}`));
      console.log(c(C.red, `  Aborting — schema validation failed.\n`));
      process.exit(1);
    }

    currentSummary = result;
    console.log(c(C.dim, '\n  Rolling result after this chunk:'));
    console.log(formatResult(currentSummary));
  }

  // 5. Final result
  const totalTime = timings.reduce((a, b) => a + b, 0).toFixed(1);
  const avgTime   = (timings.reduce((a, b) => a + b, 0) / timings.length).toFixed(1);

  console.log('\n' + hr('═'));
  console.log(b(c(C.green, '  ✓ Final Summary')));
  console.log(hr('─'));
  console.log(formatResult(currentSummary));
  console.log(hr('─'));
  console.log(c(C.dim, `  ${chunks.length} chunks · total ${totalTime}s · avg ${avgTime}s/chunk`));
  console.log(hr('═') + '\n');
})();
