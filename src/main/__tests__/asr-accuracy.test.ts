/// <reference types="vitest/globals" />
import { pipeline } from '@xenova/transformers';
import { AudioContext } from 'node-web-audio-api';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { VAD_CONFIG } from '@/renderer/utils/VadConfig';

// Add model IDs here to compare accuracy side-by-side.
// Any HuggingFace model compatible with @xenova/transformers works.
// Examples:
//   'Xenova/whisper-tiny'
//   'Xenova/whisper-base'
//   'onnx-community/moonshine-base-ONNX'
const MODELS = ['Xenova/whisper-tiny', 'Xenova/whisper-base'];

// fixture → mode → model → { wer, hyp, repetitive }
const results = new Map<
  string,
  Map<string, Map<string, { wer: number; hyp: string; repetitive: boolean }>>
>();

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
    .filter(({ name }) => existsSync(join(FIXTURES_DIR, `${name}.txt`)));
}

// ######################################################################################

const FIXTURES = getFixtures();
const FIXTURE_ENTRIES = FIXTURES.map(
  ({ name, audioFile }) => [name, audioFile] as const,
);

describe.each(MODELS)('ASR accuracy — %s', (model) => {
  let transcribe: ReturnType<typeof pipeline> extends Promise<infer T>
    ? T
    : never;

  beforeAll(async () => {
    console.log(`\n[${model}] Loading model…`);
    let lastFile = '';
    transcribe = await pipeline('automatic-speech-recognition', model, {
      quantized: true,
      progress_callback: (p: any) => {
        if (p.status === 'downloading' && p.file !== lastFile) {
          lastFile = p.file;
          console.log(`  downloading ${p.file}`);
        }
      },
    });
    console.log(`[${model}] Model ready\n`);
  });

  afterAll(async () => {
    // @ts-ignore — dispose not in all transformer types
    await transcribe?.dispose?.();
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
      console.log(`  transcribing ${audioFile}…`);
      const audio = await loadAudio(join(FIXTURES_DIR, audioFile));
      const ref = normalize(
        readFileSync(join(FIXTURES_DIR, `${name}.txt`), 'utf8'),
      );

      // @ts-ignore — transcribe is typed as Promise inside describe
      const result = await transcribe(audio, {
        task: 'transcribe',
        language: 'en',
        return_timestamps: true,
      });

      const chunks: Array<{ text: string }> = result.chunks ?? [];
      const hypothesis = normalize(
        chunks.length > 0
          ? chunks.map((c) => c.text).join(' ')
          : (result.text ?? ''),
      );

      const score = wer(ref, hypothesis);
      const repetitive = isRepetitive(hypothesis);
      console.log(
        `  WER: ${(score * 100).toFixed(1)}%${repetitive ? ' ⚠ HALLUCINATION LOOP' : ''}`,
      );
      console.log(`  ref: ${ref}`);
      console.log(`  hyp: ${hypothesis}`);

      if (!results.has(name)) results.set(name, new Map());
      const byMode = results.get(name)!;
      if (!byMode.has('single clip')) byMode.set('single clip', new Map());
      byMode
        .get('single clip')!
        .set(model, { wer: score, hyp: hypothesis, repetitive });

      // expect(score).toBeLessThan(0.25);
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
      console.log(`  transcribing ${audioFile} (VAD-segmented)…`);
      const audio = await loadAudio(join(FIXTURES_DIR, audioFile));
      const ref = normalize(
        readFileSync(join(FIXTURES_DIR, `${name}.txt`), 'utf8'),
      );

      const segments = segmentBySilence(audio);
      console.log(
        `  segments: ${segments.length} (${segments.map((s) => (s.length / TARGET_SAMPLE_RATE).toFixed(1) + 's').join(', ')})`,
      );

      const texts: string[] = [];
      for (const seg of segments) {
        // @ts-ignore — transcribe is typed as Promise inside describe
        const result = await transcribe(seg, {
          task: 'transcribe',
          language: 'en',
          return_timestamps: true,
        });
        const chunks: Array<{ text: string }> = result.chunks ?? [];
        const text =
          chunks.length > 0
            ? chunks.map((c) => c.text).join(' ')
            : (result.text ?? '');
        if (text.trim()) texts.push(text.trim());
      }

      const hypothesis = normalize(texts.join(' '));
      const score = wer(ref, hypothesis);
      const repetitive = isRepetitive(hypothesis);
      console.log(
        `  WER: ${(score * 100).toFixed(1)}%${repetitive ? ' ⚠ HALLUCINATION LOOP' : ''}`,
      );
      console.log(`  ref: ${ref}`);
      console.log(`  hyp: ${hypothesis}`);

      if (!results.has(name)) results.set(name, new Map());
      const byMode = results.get(name)!;
      if (!byMode.has('VAD-segmented')) byMode.set('VAD-segmented', new Map());
      byMode
        .get('VAD-segmented')!
        .set(model, { wer: score, hyp: hypothesis, repetitive });

      // expect(score).toBeLessThan(0.25);
    });
  });
});

afterAll(() => {
  if (results.size === 0) return;
  console.log('\n' + '═'.repeat(80));
  console.log('  MODEL COMPARISON SUMMARY');
  console.log('═'.repeat(80));
  for (const [fixture, byMode] of results) {
    for (const [mode, byModel] of byMode) {
      console.log(`\nFixture: ${fixture}  [${mode}]`);
      console.log(`  ${'Model'.padEnd(40)} ${'WER'.padStart(7)}  Output`);
      console.log(`  ${'-'.repeat(78)}`);
      for (const [mdl, { wer: score, hyp, repetitive }] of byModel) {
        const label = mdl.padEnd(40);
        const werStr = `${(score * 100).toFixed(1)}%`.padStart(7);
        const flag = repetitive ? ' ⚠ HALLUCINATION LOOP' : '';
        const preview = hyp;
        console.log(`  ${label} ${werStr}${flag}  ${preview}`);
      }
    }
  }
  console.log('\n' + '═'.repeat(80) + '\n');
});
