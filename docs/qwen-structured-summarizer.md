# Qwen2.5 Structured Summarizer — Implementation Notes

## Overview

`onnx-community/Qwen2.5-1.5B-Instruct` runs as an Electron `utilityProcess` child to extract structured meeting data (summary, decisions, topics, action items) from transcripts without blocking the main thread.

---

## Model

| Property     | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Model ID     | `onnx-community/Qwen2.5-1.5B-Instruct`                           |
| Library      | `@huggingface/transformers` v3 (Node.js build)                   |
| Task         | `text-generation`                                                |
| Quantization | `q8` → `model_quantized.onnx` (~900 MB)                          |
| Format       | ChatML (`<                                                       | im_start | >user … < | im_start | >assistant`) |
| Cache path   | `~/.cache/huggingface/hub/onnx-community/Qwen2.5-1.5B-Instruct/` |

`q4` (`model_q4.onnx`, 1.7 GB) was tried first but caused `SIGTRAP` in the utility process. `q8` is the stable choice.

---

## Architecture

```
Main process (structured-summarizer.ts)
  └── utilityProcess.fork('structured-summarizer-process.js')
        ├── receives: { type: 'config', modelName, cacheDir, ... }
        ├── receives: { type: 'initialize' }  → loads pipeline, emits 'initialized'
        ├── receives: { type: 'summarize', id, text }  → emits 'summarize-result'
        └── sends progress events during download
```

`utilityProcess.fork()` is Electron's purpose-built API for background Node.js tasks. It uses `process.parentPort` for IPC instead of `process.send()` (which belongs to `child_process.fork()`). Mixing these APIs causes silent failures.

---

## Files Changed

### `src/main/pipeline/structured-summarizer-process.ts`

Child process entry point. Runs inside `utilityProcess.fork()`.

- Listens on `process.parentPort` for `config`, `initialize`, and `summarize` messages
- On `initialize`: imports `@huggingface/transformers`, sets `env.cacheDir`, calls `pipeline('text-generation', ...)`
- Formats prompts using ChatML and extracts the assistant reply by slicing from the last `<|im_start|>assistant\n` marker

### `src/main/pipeline/structured-summarizer.ts`

Parent service (singleton). Spawns and manages the child process.

- `_processFactory` defaults to `utilityProcess.fork(scriptPath)`; overridable in tests via a fake object
- Sends `cacheDir = path.join(app.getPath('home'), '.cache', 'huggingface', 'hub')` as part of the first `config` message so the child redirects its cache to the HF hub path
- Handles child exit with a non-zero code as an unexpected crash (`_handleChildDeath`)

### `src/main/model-cache.ts`

Detects whether the model is already downloaded so Settings can show "Delete" vs "Download".

**Critical fix:** the `@huggingface/transformers` JS library writes to:

```
{cacheDir}/{org}/{model}/          ← JS library format
```

Not the Python hub format:

```
{cacheDir}/models--{org}--{model}/  ← Python hub format (wrong)
```

`QWEN_CACHE_PATH` was updated to use the JS format:

```ts
const QWEN_CACHE_PATH = path.join(
  HF_CACHE_BASE,
  'onnx-community',
  'Qwen2.5-1.5B-Instruct',
);
```

### `package.json`

Added npm `overrides` to force `@huggingface/transformers` to use `onnxruntime-node@1.14.0`:

```json
"overrides": {
  "@huggingface/transformers": {
    "onnxruntime-node": "1.14.0"
  }
}
```

**Why:** `@huggingface/transformers` v3.8.1 pins `onnxruntime-node@1.21.0`. That version crashes with exit code 5 (`SIGTRAP`) when loading Qwen inside Electron's utility process. `onnxruntime-node@1.14.0` (the same version `@xenova/transformers` uses for Whisper) is stable in the same environment.

---

## Resolved Issues

### Issue 1: SIGTRAP on model load (exit code 5)

**Symptom:** Download reached 100%, then process exited with `code=5` or `signal=SIGTRAP`.

**Root cause:** `onnxruntime-node@1.21.0` (pinned by `@huggingface/transformers` v3.8.1) crashes in Electron's utility process. The same code runs fine in plain Node.js (e.g., Vitest).

**Fix:** npm `overrides` → force `onnxruntime-node@1.14.0` inside `@huggingface/transformers`. After `npm install`, confirm with:

```
npm ls onnxruntime-node
# should show @huggingface/transformers → onnxruntime-node@1.14.0 overridden
```

### Issue 2: "Download" button reappears after successful download

**Symptom:** Model files existed on disk but Settings always showed "Download".

**Root cause:** `model-cache.ts` was checking the Python hub directory format (`models--onnx-community--Qwen2.5-1.5B-Instruct`) but the JS library writes to `onnx-community/Qwen2.5-1.5B-Instruct`.

**Fix:** Updated `QWEN_CACHE_PATH` to use the JS library path format.

### Issue 3: Files not saved to disk (WASM web build)

**Investigated but not shipped.** The `transformers.web.js` build bundles `fs` as an empty webpack stub at compile time. Even in Electron (where real `fs` is available at runtime), the bundled stub is used — `IS_FS_AVAILABLE = false` — so no files are ever written to disk. Setting `env.useFSCache = true` throws at runtime.

**Fix:** Stayed on the Node.js build (`import('@huggingface/transformers')`), which has `IS_FS_AVAILABLE = true` and writes files normally. The WASM approach would require a custom `env.useCustomCache` implementation with real `fs` calls to persist files.

---

## Where Data Is Stored

**Model files:**

```
~/.cache/huggingface/hub/onnx-community/Qwen2.5-1.5B-Instruct/
  onnx/model_quantized.onnx   (~900 MB)
  tokenizer.json
  config.json
  …
```

**Meeting data (electron-store):**

```
~/Library/Application Support/voa/audio-to-text.json
```

Each meeting object contains:

```json
{
  "summaryStatus": "ready",
  "summary": "…",
  "decisions": ["…"],
  "topics": ["…"],
  "actionItems": [{ "text": "…", "done": false }]
}
```

To inspect directly:

```bash
cat ~/Library/Application\ Support/voa/audio-to-text.json | python3 -m json.tool | less
```

---

## Enrichment Gate

Structured summarization only runs for recordings where `type === 'meeting'`. This is set by `MeetingDetector` based on recording length and audio source. Short test recordings or dictations (`type === 'dictation'`) are skipped.

The transcript must also be at least 200 characters — shorter texts are skipped with a warning in the console.
