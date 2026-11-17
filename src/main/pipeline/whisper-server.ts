import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { log, error } from 'electron-log';

export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

const MODEL_BASE_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
const READY_TIMEOUT_MS = 60_000;

// shortcut: dev only, expects Homebrew whisper-server; bundle for packaged builds
const SERVER_BIN = fs.existsSync('/opt/homebrew/bin/whisper-server')
  ? '/opt/homebrew/bin/whisper-server'
  : 'whisper-server';

let proc: ChildProcess | null = null;
let port = 0;
let currentModel: string | null = null;
let starting: Promise<void> | null = null;
let startingModel: string | null = null;
let cleanupRegistered = false;
let queue: Promise<unknown> = Promise.resolve();

export function encodeWav(audio: Float32Array, sampleRate = 16000): Buffer {
  const buf = Buffer.alloc(44 + audio.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + audio.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(audio.length * 2, 40);
  for (let i = 0; i < audio.length; i++) {
    const s = Math.max(-1, Math.min(1, audio[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return buf;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port: p } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(p));
    });
  });
}

async function ensureModel(
  modelFile: string,
  onProgress?: (data: any) => void,
): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'models');
  const file = path.join(dir, modelFile);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(dir, { recursive: true });
  const url = `${MODEL_BASE_URL}/${modelFile}`;
  log(`[whisper-server] Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body)
    throw new Error(`Model download failed: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  let loaded = 0;
  const body = Readable.fromWeb(res.body as any);
  body.on('data', (chunk: Buffer) => {
    loaded += chunk.length;
    if (total) {
      onProgress?.({
        status: 'progress',
        file: modelFile,
        loaded,
        total,
        progress: (loaded / total) * 100,
      });
    }
  });
  // Download to a .part file so an interrupted download is never mistaken for a model.
  const part = `${file}.part`;
  await pipeline(body, fs.createWriteStream(part));
  fs.renameSync(part, file);
  return file;
}

async function waitReady(child: ChildProcess, p: number): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error('whisper-server exited during startup');
    try {
      await fetch(`http://127.0.0.1:${p}/`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error('whisper-server did not become ready in time');
}

async function launch(
  modelFile: string,
  onProgress?: (data: any) => void,
): Promise<void> {
  const model = await ensureModel(modelFile, onProgress);
  const p = await freePort();
  // --max-context 0: segments are independent, so don't condition on previous
  // text (the main source of repetition loops / hallucination carry-over).
  const child = spawn(
    SERVER_BIN,
    [
      '-m',
      model,
      '--host',
      '127.0.0.1',
      '--port',
      String(p),
      '-l',
      'en',
      '--max-context',
      '0',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let stderrTail = '';
  child.stderr?.on('data', (d) => {
    stderrTail = (stderrTail + d).slice(-2000);
  });
  child.on('exit', (code, signal) => {
    if (proc === child) proc = null;
    log(`[whisper-server] exited code=${code} signal=${signal}`);
  });
  child.on('error', (e) => error('[whisper-server] spawn error', e));
  proc = child;
  port = p;
  currentModel = modelFile;
  try {
    await waitReady(child, p);
  } catch (e) {
    child.kill();
    if (proc === child) proc = null;
    throw new Error(`${(e as Error).message}\n${stderrTail}`);
  }
  log(`[whisper-server] ready on port ${p}`);
}

function registerCleanupOnce(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  app.on('will-quit', stopWhisperServer);
  process.on('exit', stopWhisperServer);
  // Under vitest electron is mocked and app.quit is a no-op, which would swallow Ctrl+C.
  if (process.versions.electron) {
    process.on('SIGINT', () => app.quit());
    process.on('SIGTERM', () => app.quit());
  }
}

export async function startWhisperServer(
  modelFile: string,
  onProgress?: (data: any) => void,
): Promise<void> {
  registerCleanupOnce();
  if (starting && startingModel === modelFile) return starting;
  // A different model is running or loading: let any start finish, then swap.
  if (starting) await starting.catch(() => undefined);
  if (proc && proc.exitCode === null) {
    if (currentModel === modelFile) return;
    stopWhisperServer();
  }
  startingModel = modelFile;
  starting = launch(modelFile, onProgress).finally(() => {
    starting = null;
    startingModel = null;
  });
  return starting;
}

async function post(audio: Float32Array): Promise<WhisperSegment[]> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(encodeWav(audio))], { type: 'audio/wav' }),
    'segment.wav',
  );
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0');
  const res = await fetch(`http://127.0.0.1:${port}/inference`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`whisper-server HTTP ${res.status}`);
  const json = (await res.json()) as {
    segments?: { start: number; end: number; text: string }[];
    error?: string;
  };
  if (json.error) throw new Error(json.error);
  return (json.segments ?? []).map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }));
}

// Mic and system segments can arrive together; the server handles one at a time.
export function transcribePcm(audio: Float32Array): Promise<WhisperSegment[]> {
  const job = queue.then(async () => {
    const model = currentModel;
    if (!model) throw new Error('whisper-server not started');
    await startWhisperServer(model);
    try {
      return await post(audio);
    } catch (e) {
      if (proc && proc.exitCode === null) throw e;
      await startWhisperServer(model); // died mid-request: restart once and retry
      return post(audio);
    }
  });
  queue = job.catch(() => undefined);
  return job;
}

export function stopWhisperServer(): void {
  proc?.kill();
  proc = null;
  currentModel = null;
}
