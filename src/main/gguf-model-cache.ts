import fs from 'fs';
import path from 'path';
import { error as logError, info } from 'electron-log';
import { BUILTIN_MODEL_PATH } from './pipeline/llama-summarizer';

const MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf';

// Confirmed via a real HEAD request against MODEL_URL during Phase 2
// verification — used as the completeness check when a redirected response
// doesn't echo Content-Length itself.
const EXPECTED_SIZE_BYTES = 1_117_320_736;
const SIZE_TOLERANCE_BYTES = 10 * 1024 * 1024;

const MODEL_DIR = path.dirname(BUILTIN_MODEL_PATH);
const PART_PATH = `${BUILTIN_MODEL_PATH}.part`;

let activeAbortController: AbortController | null = null;
let activeDownload: Promise<void> | null = null;

export function isModelDownloaded(): boolean {
  return fs.existsSync(BUILTIN_MODEL_PATH);
}

export function getModelPath(): string {
  return BUILTIN_MODEL_PATH;
}

export function downloadModel(
  onProgress?: (downloadedBytes: number, totalBytes: number) => void,
): Promise<void> {
  // A second concurrent call joins the download already in flight instead of
  // starting its own (which would truncate the shared .part file). Its
  // onProgress callback won't fire, since it isn't the caller driving the
  // download — an accepted limitation, not a bug.
  if (activeDownload) {
    return activeDownload;
  }

  const download = runDownload(onProgress).finally(() => {
    activeDownload = null;
  });
  activeDownload = download;
  return download;
}

async function runDownload(
  onProgress?: (downloadedBytes: number, totalBytes: number) => void,
): Promise<void> {
  fs.mkdirSync(MODEL_DIR, { recursive: true });

  const controller = new AbortController();
  activeAbortController = controller;

  try {
    const response = await fetch(MODEL_URL, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const contentLengthHeader = response.headers.get('content-length');
    const totalBytes = contentLengthHeader
      ? parseInt(contentLengthHeader, 10)
      : EXPECTED_SIZE_BYTES;

    // A .part file left over from a prior interrupted download is
    // overwritten outright — no resume logic, per spec.
    const fileStream = fs.createWriteStream(PART_PATH, { flags: 'w' });
    let downloadedBytes = 0;

    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        downloadedBytes += value.byteLength;
        await new Promise<void>((resolve, reject) => {
          fileStream.write(Buffer.from(value), (err) =>
            err ? reject(err) : resolve(),
          );
        });
        onProgress?.(downloadedBytes, totalBytes);
      }
    } finally {
      await new Promise<void>((resolve) => fileStream.end(resolve));
    }

    // Prefer the Content-Length this specific response reported (handles
    // upstream file revisions); fall back to the known expected size only
    // when the header is missing.
    const expectedBytes = contentLengthHeader
      ? totalBytes
      : EXPECTED_SIZE_BYTES;
    if (Math.abs(downloadedBytes - expectedBytes) > SIZE_TOLERANCE_BYTES) {
      fs.rmSync(PART_PATH, { force: true });
      throw new Error(
        `Downloaded file size mismatch: got ${downloadedBytes} bytes, expected ~${expectedBytes} bytes`,
      );
    }

    fs.renameSync(PART_PATH, BUILTIN_MODEL_PATH);
    info(
      `[gguf-model-cache] Downloaded model to ${BUILTIN_MODEL_PATH} (${downloadedBytes} bytes)`,
    );
  } catch (error) {
    fs.rmSync(PART_PATH, { force: true });
    if ((error as { name?: string })?.name === 'AbortError') {
      info('[gguf-model-cache] Download cancelled');
    } else {
      logError('[gguf-model-cache] Download failed:', error);
    }
    throw error;
  } finally {
    activeAbortController = null;
  }
}

export function cancelDownload(): void {
  activeAbortController?.abort();
}

export async function deleteModel(): Promise<boolean> {
  try {
    const resolvedPath = path.resolve(BUILTIN_MODEL_PATH);
    const resolvedDir = path.resolve(MODEL_DIR);

    if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
      logError(
        `[gguf-model-cache] Refusing to delete outside model dir: ${resolvedPath}`,
      );
      return false;
    }

    if (!fs.existsSync(resolvedPath)) {
      return false;
    }

    fs.rmSync(resolvedPath, { force: true });
    return true;
  } catch (error) {
    logError('[gguf-model-cache] Error deleting model:', error);
    return false;
  }
}
