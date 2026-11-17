/// <reference types="vitest/globals" />
import { pipeline } from '@xenova/transformers';
import { AudioContext } from 'node-web-audio-api';
import {
  readFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { VAD_CONFIG } from '@/renderer/utils/VadConfig';
import whisperCpp from '@/main/pipeline/whisper-cpp-transcriber';

// whisper-server.ts only needs app.getPath('userData') (model dir) and app.on
// (cleanup hook); point userData at the real app dir so cached ggml models are reused.
vi.mock('electron', () => ({
  app: {
    getPath: () => `${process.env.HOME}/Library/Application Support/voa`,
    on: () => undefined,
    quit: () => undefined,
  },
}));

// Add model IDs here to compare accuracy side-by-side.
// Any HuggingFace model compatible with @xenova/transformers works.
// Examples:
//   'Xenova/whisper-tiny'
//   'Xenova/whisper-base'
//   'onnx-community/moonshine-base-ONNX'
const ONNX_MODELS = ['Xenova/whisper-tiny', 'Xenova/whisper-base'];
const CPP_MODELS = ['tiny.en', 'base.en', 'small.en'];
// whisper.cpp ggml models live in the app's userData dir (see vi.mock above).
const GGML_DIR = join(homedir(), 'Library/Application Support/voa/models');
const GGML_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
const RESULTS_JSON = resolve(process.cwd(), '.logs/asr-benchmark.json');

interface Engine {
  id: string; // e.g. "onnxruntime/Xenova/whisper-tiny"
  engine: 'onnxruntime' | 'whisper.cpp';
  model: string;
  load: () => Promise<void>;
  transcribe: (audio: Float32Array) => Promise<string>;
  dispose: () => Promise<void>;
}

function onnxEngine(model: string): Engine {
  let t: any;
  return {
    id: `onnxruntime/${model}`,
    engine: 'onnxruntime',
    model,
    load: async () => {
      let lastFile = '';
      t = await pipeline('automatic-speech-recognition', model, {
        quantized: true,
        progress_callback: (p: any) => {
          if (p.status === 'downloading' && p.file !== lastFile) {
            lastFile = p.file;
            console.log(`  downloading ${p.file}`);
          }
        },
      });
    },
    transcribe: async (audio) => {
      // chunk_length_s: without it transformers.js only decodes the first 30s of a long clip.
      const result = await t(audio, {
        task: 'transcribe',
        language: 'en',
        return_timestamps: true,
        chunk_length_s: 30,
      });
      const chunks: Array<{ text: string }> = result.chunks ?? [];
      return chunks.length > 0
        ? chunks.map((c) => c.text).join(' ')
        : (result.text ?? '');
    },
    // @ts-ignore — dispose not in all transformer types
    dispose: async () => t?.dispose?.(),
  };
}

// Pre-download so cold load measures only server spawn → ready, as the spec requires.
async function ensureGgml(file: string): Promise<void> {
  const dest = join(GGML_DIR, file);
  if (existsSync(dest)) return;
  mkdirSync(GGML_DIR, { recursive: true });
  console.log(`  downloading ${file}…`);
  const res = await fetch(`${GGML_URL}/${file}`);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  writeFileSync(`${dest}.part`, Buffer.from(await res.arrayBuffer()));
  renameSync(`${dest}.part`, dest);
}

function cppEngine(model: string): Engine {
  const appModelId = `Xenova/whisper-${model}`; // mapped to ggml-<model>.bin by GGML_FILES
  return {
    id: `whisper.cpp/${model}`,
    engine: 'whisper.cpp',
    model,
    load: async () => {
      await ensureGgml(`ggml-${model}.bin`);
      const t0 = performance.now();
      await whisperCpp.initialize(appModelId, true);
      coldLoadOverrideMs = performance.now() - t0;
    },
    transcribe: async (audio) => {
      const r = await whisperCpp.transcribe(audio, 'transcribe');
      return r.chunks.map((c) => c.text).join(' ');
    },
    dispose: async () => whisperCpp.dispose(),
  };
}

// Set by engines whose load() includes a step (download) that must not be timed.
let coldLoadOverrideMs: number | null = null;

// Smoke-run filters, comma-separated substrings: ASR_BENCH_ENGINES=whisper.cpp/tiny.en,onnxruntime/Xenova/whisper-tiny ASR_BENCH_FIXTURES=Monologue
const envList = (k: string) => process.env[k]?.split(',').filter(Boolean);
const ENGINE_FILTER = envList('ASR_BENCH_ENGINES');
const FIXTURE_FILTER = envList('ASR_BENCH_FIXTURES');

const ENGINES: Engine[] = [
  ...ONNX_MODELS.map(onnxEngine),
  ...CPP_MODELS.map(cppEngine),
].filter((e) => !ENGINE_FILTER || ENGINE_FILTER.some((f) => e.id.includes(f)));

interface Row {
  fixture: string;
  mode: string;
  engine: string;
  model: string;
  durationS: number;
  coldLoadMs: number;
  ttfcMs: number | null;
  completeMs: number;
  rtf: number;
  wer: number | null; // null: fixture has no reference transcript
  repetitive: boolean;
  hyp: string;
}
const rows: Row[] = [];
const coldLoads = new Map<string, number>();

// Detects Whisper's classic decoding-loop hallucination (e.g. a phrase repeating
// verbatim dozens of times) using the same compression-ratio heuristic OpenAI's
// own Whisper CLI uses to flag failed segments (compression_ratio_threshold,
// default 2.4): degenerate/repetitive text gzips down far more than normal
// speech does, since gzip already exploits repeated substrings.
const COMPRESSION_RATIO_THRESHOLD = 2.4;

function compressionRatio(text: string): number {
  if (text.length === 0) return 0;
  const raw = Buffer.byteLength(text, 'utf8');
  const compressed = gzipSync(text).length;
  return raw / compressed;
}

function isRepetitive(text: string): boolean {
  return compressionRatio(text) > COMPRESSION_RATIO_THRESHOLD;
}

const FIXTURES_DIR = resolve(process.cwd(), 'tests/e2e/mocks');
const TARGET_SAMPLE_RATE = 16000;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Word Error Rate: Levenshtein distance on word arrays / reference word count
function wer(reference: string, hypothesis: string): number {
  const ref = reference.split(' ');
  const hyp = hypothesis.split(' ');
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;

  const d = Array.from({ length: ref.length + 1 }, (_, i) =>
    Array.from({ length: hyp.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );

  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      d[i][j] =
        ref[i - 1] === hyp[j - 1]
          ? d[i - 1][j - 1]
          : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
    }
  }

  return d[ref.length][hyp.length] / ref.length;
}

// Decode any audio file (mp3/ogg/wav) to Float32Array at 16kHz mono
async function loadAudio(filePath: string): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE }) as any;
  const fileBuffer = readFileSync(filePath);
  // Node.js Buffer.buffer is a shared memory pool — slice to get a standalone ArrayBuffer
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  );
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i] / audioBuffer.numberOfChannels;
    }
  }

  await ctx.close();
  return mono;
}

// Splits audio into speech segments by detecting silence gaps.
//
// In the app, @ricky0123/vad-web (MicVAD) does this in real-time using a neural
// model (Silero VAD) running in the browser/renderer. It fires onSpeechEnd with a
// Float32Array for each detected utterance, which is then sent via IPC to
// WhisperTranscriber one segment at a time. TranscriberService accumulates these
// segments as text and joins them when the session ends.
//
// Here we can't use MicVAD because it's browser/WASM-only and requires MediaStream.
// Instead we use an energy threshold (RMS per 10ms frame) to approximate the same
// segmentation. minSilenceMs defaults to VAD_CONFIG.PAUSE_TIMEOUT_MS so this
// stays in sync with the real app's pause-before-flush timeout instead of
// silently drifting from it.
//
// Limitation: RMS threshold is tunable but not adaptive. Quiet recordings may need
// a lower silenceThreshold (0.005); loud/noisy ones may need a higher value (0.02).
function segmentBySilence(
  audio: Float32Array,
  sampleRate = 16000,
  {
    frameSizeMs = 10,
    silenceThreshold = 0.01,
    minSilenceMs = VAD_CONFIG.PAUSE_TIMEOUT_MS,
    maxSegmentS = 28,
    minSegmentS = 0.5,
  } = {},
): Float32Array[] {
  const frameSize = Math.round((sampleRate * frameSizeMs) / 1000);
  const minSilenceFrames = Math.round(minSilenceMs / frameSizeMs);
  const maxSegmentSamples = maxSegmentS * sampleRate;
  const minSegmentSamples = minSegmentS * sampleRate;

  const numFrames = Math.floor(audio.length / frameSize);
  const isSpeech: boolean[] = new Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    const start = i * frameSize;
    for (let j = 0; j < frameSize; j++) sum += audio[start + j] ** 2;
    isSpeech[i] = Math.sqrt(sum / frameSize) > silenceThreshold;
  }

  const segments: Float32Array[] = [];
  let segStart = -1;
  let silenceCount = 0;

  for (let i = 0; i <= numFrames; i++) {
    const speech = i < numFrames && isSpeech[i];

    if (speech) {
      if (segStart < 0) segStart = i * frameSize;
      silenceCount = 0;
    } else if (segStart >= 0) {
      silenceCount++;
      const segLen = i * frameSize - segStart;
      const shouldFlush =
        silenceCount >= minSilenceFrames ||
        segLen >= maxSegmentSamples ||
        i === numFrames;

      if (shouldFlush) {
        const end = (i - silenceCount) * frameSize;
        const seg = audio.slice(segStart, end);
        if (seg.length >= minSegmentSamples) segments.push(seg);
        segStart = -1;
        silenceCount = 0;
      }
    }
  }

  return segments.length > 0 ? segments : [audio];
}

const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav'];

function getFixtures(): Array<{ name: string; audioFile: string }> {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((f) => AUDIO_EXTENSIONS.some((ext) => f.endsWith(ext)))
    .map((f) => {
      const ext = AUDIO_EXTENSIONS.find((e) => f.endsWith(e))!;
      return { name: basename(f, ext), audioFile: f };
    })
    .filter(
      (f) => !FIXTURE_FILTER || FIXTURE_FILTER.some((x) => f.name.includes(x)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readRef(name: string): string | null {
  const f = join(FIXTURES_DIR, `${name}.txt`);
  if (!existsSync(f)) return null;
  const text = readFileSync(f, 'utf8');
  // sample-audio.txt is an unfilled placeholder, not a transcript
  return text.startsWith('replace this') ? null : normalize(text);
}

// Decode and segment once per fixture so every engine gets identical input.
const audioCache = new Map<string, Float32Array>();
const segmentCache = new Map<string, Float32Array[]>();
async function getAudio(audioFile: string): Promise<Float32Array> {
  if (!audioCache.has(audioFile))
    audioCache.set(audioFile, await loadAudio(join(FIXTURES_DIR, audioFile)));
  return audioCache.get(audioFile)!;
}
function getSegments(audioFile: string, audio: Float32Array): Float32Array[] {
  if (!segmentCache.has(audioFile))
    segmentCache.set(audioFile, segmentBySilence(audio));
  return segmentCache.get(audioFile)!;
}

async function runMode(
  engine: Engine,
  fixture: string,
  mode: string,
  audio: Float32Array,
  segments: Float32Array[],
) {
  const ref = readRef(fixture);
  const texts: string[] = [];
  let ttfcMs: number | null = null;
  const t0 = performance.now();
  for (const seg of segments) {
    const text = (await engine.transcribe(seg)).trim();
    if (text) {
      texts.push(text);
      if (ttfcMs === null) ttfcMs = performance.now() - t0;
    }
  }
  const completeMs = performance.now() - t0;
  const durationS = audio.length / TARGET_SAMPLE_RATE;
  const hyp = normalize(texts.join(' '));
  const score = ref === null ? null : wer(ref, hyp);
  const repetitive = isRepetitive(hyp);
  rows.push({
    fixture,
    mode,
    engine: engine.engine,
    model: engine.model,
    durationS,
    coldLoadMs: coldLoads.get(engine.id)!,
    ttfcMs,
    completeMs,
    rtf: completeMs / 1000 / durationS,
    wer: score,
    repetitive,
    hyp,
  });
  console.log(
    `  ${engine.id} ${mode} ${fixture}: ${completeMs.toFixed(0)}ms, WER ${score === null ? 'n/a' : (score * 100).toFixed(1) + '%'}${repetitive ? ' ⚠ HALLUCINATION LOOP' : ''}`,
  );
}

// ######################################################################################

const FIXTURES = getFixtures();
const FIXTURE_ENTRIES = FIXTURES.map(
  ({ name, audioFile }) => [name, audioFile] as const,
);

describe.each(ENGINES)('ASR accuracy — $id', (engine) => {
  beforeAll(async () => {
    console.log(`\n[${engine.id}] Loading model…`);
    coldLoadOverrideMs = null;
    const t0 = performance.now();
    await engine.load();
    coldLoads.set(engine.id, coldLoadOverrideMs ?? performance.now() - t0);
    console.log(
      `[${engine.id}] Model ready in ${coldLoads.get(engine.id)!.toFixed(0)}ms\n`,
    );
    // Warm-up so per-fixture timings exclude first-inference lazy init.
    await engine.transcribe(new Float32Array(TARGET_SAMPLE_RATE * 2));
  });

  afterAll(async () => {
    await engine.dispose();
  });

  if (FIXTURE_ENTRIES.length === 0) {
    it('no fixtures — add an audio file (.mp3/.ogg/.wav) + matching .txt to tests/e2e/mocks/', () => {
      console.warn(
        'No fixtures found. Drop your audio file and matching .txt into tests/e2e/mocks/ to run accuracy tests.',
      );
    });
    return;
  }

  // Passes the entire audio file to Whisper as a single clip.
  // Does NOT reflect how the app works — the app never sends a full recording to
  // Whisper at once. Use this as a baseline or for fixtures that are short (< 28s).
  // For clips longer than ~28s this mode risks hallucination loops on tiny/base models.
  describe('single clip', () => {
    test.each(FIXTURE_ENTRIES)('%s', async (name, audioFile) => {
      const audio = await getAudio(audioFile);
      await runMode(engine, name, 'single clip', audio, [audio]);
    });
  });

  // Splits the audio file into short segments using silence detection, then
  // transcribes each segment independently — mirroring the real app pipeline:
  //   MicVAD (renderer) → onSpeechEnd Float32Array → IPC → WhisperTranscriber
  //   → TranscriberService.sessionSegments[] → joined text on session end
  //
  // Key differences vs. the real app:
  //   - Segmentation: RMS energy threshold vs. Silero neural VAD model
  //   - Segment boundaries may differ; WER can be higher if silenceThreshold
  //     doesn't match the recording's noise floor
  //   - No IPC round-trip; segments are transcribed sequentially in the same process
  //   - No style transfer, text cleaning, or summarization applied
  describe('VAD-segmented', () => {
    test.each(FIXTURE_ENTRIES)('%s', async (name, audioFile) => {
      const audio = await getAudio(audioFile);
      const segments = getSegments(audioFile, audio);
      console.log(`  segments: ${segments.length}`);
      await runMode(engine, name, 'VAD-segmented', audio, segments);
    });
  });
});

function sh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

afterAll(async () => {
  await whisperCpp.dispose(); // backstop: no whisper-server left running even if a suite failed
  if (rows.length === 0) return;
  const ramGb = (Number(sh('sysctl -n hw.memsize')) / 1024 ** 3).toFixed(0);
  const machine = `${sh('sysctl -n machdep.cpu.brand_string')}, macOS ${sh('sw_vers -productVersion')}, ${ramGb} GB RAM`;
  const fx = FIXTURES.map((f) => f.name);
  const withRef = fx.filter((n) => readRef(n) !== null);
  const pad = (v: string | number, n: number) => String(v).padStart(n);
  const f1 = (v: number | null, d = 0) => (v === null ? 'n/a' : v.toFixed(d));
  const pct = (v: number | null) =>
    v === null ? 'n/a' : (v * 100).toFixed(1) + '%';
  const line = '═'.repeat(110);

  console.log('\n' + line);
  console.log('  ASR BENCHMARK SUMMARY');
  console.log(line);
  console.log(`Machine: ${machine}`);
  console.log('Fairness notes:');
  console.log(
    '  - whisper.cpp runs on the Metal GPU; onnxruntime runs on the CPU in Node.',
  );
  console.log(
    '  - whisper.cpp timings include local HTTP and WAV encoding overhead, as in the app.',
  );
  console.log(
    '  - onnxruntime small is excluded: it crashes (docs/whisper-onnxruntime-crash.md).',
  );
  console.log(
    '  - TTFC in "single clip" mode equals time to complete (no streaming).',
  );
  console.log(
    '  - Cold load: whisper.cpp = server spawn to ready (download excluded); onnxruntime = pipeline() creation (includes download if uncached).',
  );
  console.log(`Fixtures: ${fx.join(', ')}`);
  console.log(
    `Fixtures with reference transcript (WER): ${withRef.join(', ') || 'none'}`,
  );

  for (const fixture of fx) {
    for (const mode of ['single clip', 'VAD-segmented']) {
      const rs = rows.filter((r) => r.fixture === fixture && r.mode === mode);
      if (rs.length === 0) continue;
      console.log(`\nFixture: ${fixture}  [${mode}]`);
      console.log(
        `  ${'engine/model'.padEnd(34)}${pad('dur(s)', 8)}${pad('cold(ms)', 10)}${pad(mode === 'single clip' ? 'TTFC*(ms)' : 'TTFC(ms)', 11)}${pad('done(ms)', 10)}${pad('RTF', 8)}${pad('WER', 9)}  halluc`,
      );
      for (const r of rs) {
        console.log(
          `  ${(r.engine + '/' + r.model).padEnd(34)}${pad(f1(r.durationS, 1), 8)}${pad(f1(r.coldLoadMs), 10)}${pad(f1(r.ttfcMs), 11)}${pad(f1(r.completeMs), 10)}${pad(r.rtf.toFixed(3), 8)}${pad(pct(r.wer), 9)}  ${r.repetitive ? 'YES' : 'no'}`,
        );
      }
    }
  }

  for (const mode of ['single clip', 'VAD-segmented']) {
    console.log(
      `\nOVERALL (mean across fixtures) [${mode}]  (WER mean over fixtures with a reference only)`,
    );
    console.log(
      `  ${'engine/model'.padEnd(34)}${pad('mean WER', 10)}${pad('mean RTF', 10)}${pad('mean TTFC(ms)', 15)}${pad('halluc', 8)}`,
    );
    for (const e of ENGINES) {
      const rs = rows.filter(
        (r) => r.mode === mode && r.engine === e.engine && r.model === e.model,
      );
      if (rs.length === 0) continue;
      const mean = (xs: number[]) =>
        xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
      const werM = mean(rs.filter((r) => r.wer !== null).map((r) => r.wer!));
      const ttfcM = mean(
        rs.filter((r) => r.ttfcMs !== null).map((r) => r.ttfcMs!),
      );
      console.log(
        `  ${e.id.padEnd(34)}${pad(pct(werM), 10)}${pad(f1(mean(rs.map((r) => r.rtf)), 3), 10)}${pad(f1(ttfcM), 15)}${pad(rs.filter((r) => r.repetitive).length + '/' + rs.length, 8)}`,
      );
    }
  }
  console.log('\n' + line + '\n');

  mkdirSync(dirname(RESULTS_JSON), { recursive: true });
  writeFileSync(
    RESULTS_JSON,
    JSON.stringify(
      { machine, fixtures: fx, fixturesWithReference: withRef, rows },
      null,
      2,
    ),
  );
  console.log(`Raw results (${rows.length} rows): ${RESULTS_JSON}`);
});
