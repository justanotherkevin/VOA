# Embedded LLM: Why On-Device Summarization Works Now (and Didn't Before)

## Background

`docs/lm-studio-migration.md` documents why structured summarization moved off
on-device inference in the first place: every ONNX model tried at the time
(`onnx-community/Qwen2.5-{1.5B,Coder-1.5B,Coder-3B}-Instruct`, via
`@huggingface/transformers`) produced inconsistent JSON key names across
runs and chunks, and the fix — going to 7B+ parameters — was rejected as too
large (4+ GB, over the project's 2 GB budget for an opt-in feature) and too
slow on CPU ONNX (30–120s/inference).

[Meetily](https://github.com/Zackriya-Solutions/meetily) (`docs/meetily-comparison.md`)
takes a different path to the same "no external server" goal: an embedded
`llama.cpp` sidecar running a small GGUF model with Metal/CUDA acceleration,
rather than CPU ONNX. This raised the question of whether that's a real
difference or just a re-run of the same failed experiment with extra steps —
so before writing any pipeline code, a spike measured it directly.

---

## Phase 0 Spike: Does `llama.cpp` Actually Change the Outcome?

Ran `node-llama-cpp` (Node bindings for `llama.cpp`) against the exact same,
unmodified `PROMPT_TEMPLATE`/`ROLLING_PROMPT_TEMPLATE` this app already uses,
across 15 synthetic meeting transcripts plus a rolling-summary check, on an
Apple M3 Pro (18 GB RAM, macOS), Metal backend auto-selected.

| Model                          | Size on disk | License                                | JSON-parseable rate | Avg latency |
| ------------------------------ | ------------ | -------------------------------------- | ------------------- | ----------- |
| Qwen2.5-1.5B-Instruct (Q4_K_M) | 1.07 GB      | Apache-2.0                             | 15/15 (100%)        | 1.8s        |
| Qwen2.5-3B-Instruct (Q4_K_M)   | 2.10 GB      | Qwen Research License (non-commercial) | 15/15 (100%)        | 3.4s        |
| Qwen2.5-7B-Instruct (Q4_K_M)   | 4.62 GB      | Apache-2.0                             | 15/15 (100%)        | 6.6s        |

**Every model, including the same 1.5B parameter count that failed under ONNX,
hit 100% JSON-parseable output.** The 1.5B and 7B models matched exactly,
which is the strongest evidence this isn't just "bigger model, better
results" — the earlier ONNX failure was more likely an artifact of how
`@huggingface/transformers`' ONNX export handled the model's chat template
and tokenization than a fundamental limit of small models' instruction
following. (This wasn't isolated and confirmed as the exact root cause — it's
the most likely explanation given the data, not a proven one.)

**Decision: go.** Qwen2.5-1.5B-Instruct was selected as the bundled default —
smallest, fastest (1.8s/call, well under any reasonable per-meeting latency
budget), and unambiguously Apache-2.0 licensed (the 3B model's Qwen Research
License is non-commercial and was ruled out as a default for that reason
alone, independent of its otherwise-identical reliability).

---

## What Changed

Unlike the original LM Studio migration, this did **not** replace the HTTP
provider — it sits alongside it:

- `src/main/pipeline/llama-process.ts` (new) — `utilityProcess.fork()` child
  running `node-llama-cpp` inference, isolated from the main process exactly
  like `whisper-process.ts` isolates Whisper (see
  `docs/whisper-onnxruntime-crash.md` for why that isolation matters
  regardless of backend). Confirmed via a real (non-mocked)
  `utilityProcess.fork()` run, not assumed: model load ~1.4s, a summarize
  round-trip ~360ms, Metal backend auto-selected, no fallback to a bundled
  `llama-server` binary needed.
- `src/main/pipeline/llama-summarizer.ts` (new) — main-process proxy
  (`LlamaSummarizer`), mirroring `WhisperTranscriber`'s FIFO job queue and
  crash-recovery pattern. One difference from Whisper: there's exactly one
  bundled model for the app's lifetime, so `initialize()` is idempotent
  rather than reloading per call.
- `src/main/pipeline/summarizer-provider.ts` (new) — resolves the active
  summarization backend (`'lmstudio' | 'ollama' | 'builtin'`) from the store,
  mirroring `asr-factory.ts`'s provider-resolution pattern.
- `src/main/gguf-model-cache.ts` (new) — downloads and caches the bundled
  GGUF file (Qwen2.5-1.5B-Instruct-GGUF, Q4_K_M, ~1.1 GB) under
  `app.getPath('userData')`, verified end-to-end against a real HuggingFace
  download (1,117,320,736 bytes, checksum-matched) rather than assumed.
- `structured-summarizer.ts` — unchanged prompts, parsing, and chunking logic
  (`PROMPT_TEMPLATE`, `parseStructuredOutput`, `splitIntoChunks`, etc.); only
  the HTTP call is now conditionally routed to the embedded model based on
  the resolved provider.
- Settings — a "Built-in" option sits alongside LM Studio/Ollama in the AI
  Provider picker, with its own download/ready/delete status row.
- New installs default to `'builtin'`. Existing installs that already had LM
  Studio actively configured (non-default `baseUrl` or a `model` set) are
  migrated to explicitly keep `'lmstudio'`, so this change doesn't silently
  switch a working setup (see the `summarizerProviderMigrated` migration in
  `src/main/store/migrations.ts`).
- Onboarding no longer asks new users to install/connect LM Studio before
  finishing setup — the built-in model downloads in the background instead,
  non-blocking. Power users can still switch to LM Studio/Ollama in Settings.

### What Didn't Change

- LM Studio/Ollama HTTP support — kept, not removed. Users who prefer a
  larger self-hosted model (or already have a working setup) aren't affected.
- `parseStructuredOutput`, `extractFieldsWithRegex`, `splitIntoChunks`,
  `PROMPT_TEMPLATE`, `ROLLING_PROMPT_TEMPLATE` — identical for both providers,
  since Phase 0 explicitly validated the embedded path against these exact,
  unmodified prompts.

---

## Known Limitations / Follow-Ups

- The pre-existing "pipeline reads the store directly" pattern in
  `structured-summarizer.ts` (a documented deviation from
  `docs/PIPELINE-SERVICES-ARCHITECTURE.md`'s pipeline/services split) was
  deliberately not fixed as part of this change — the new
  `summarizer-provider.ts` follows the same existing pattern for consistency
  rather than partially refactoring call sites unrelated to this feature.
  Worth a dedicated cleanup pass separately.
- `src/lib/Constants.ts`'s `CACHED_MODEL_META` has a stale entry keyed
  `'Qwen2.5-1.5B-Instruct'` describing the old, deleted on-device ONNX
  summarizer attempt (~900 MB, a _different_ model artifact from the ~1.1 GB
  GGUF file this migration adds despite the similar name). Left alone
  in this migration since it's not currently reachable from the UI (nothing
  produces a cached model with that exact name today), but it's a confusing
  leftover worth removing in a follow-up.
- Only one model is offered for the built-in path (no user choice of size/
  quant) — matches Meetily's own default-one-model approach and keeps the
  download/cache logic simple; revisit if users want to trade size for
  quality.
