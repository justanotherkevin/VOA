# LM Studio Migration: Why We Moved Off On-Device ONNX

## Background

The structured summarizer pipeline extracts a `StructuredSummaryResult` from meeting transcripts:

```ts
{
  summary: string;
  decisions: string[];
  topics: string[];
  actionItems: Array<{ text: string; done: boolean }>;
}
```

The original implementation used `@huggingface/transformers` to run a quantized ONNX model in an Electron child process (`structured-summarizer-process.ts`). The child process received a raw transcript, ran it through the model in chunks, and returned a JSON string that the parent parsed into `StructuredSummaryResult`.

---

## Models Tried

| Model | Size | Result |
|---|---|---|
| `onnx-community/Qwen2.5-1.5B-Instruct` | ~900 MB | Inconsistent keys, frequent hallucination |
| `onnx-community/Qwen2.5-Coder-1.5B-Instruct` | ~900 MB | Marginally better JSON shape, still unreliable |
| `onnx-community/Qwen2.5-Coder-3B-Instruct` | ~1.8 GB | Improved content quality, key naming still inconsistent |

---

## The Core Problem: Small Models Can't Follow JSON Schemas Reliably

Every model tried produced output with varied key names across inference runs and chunks:

```
"summarize"   instead of  "summary"
"decision"    instead of  "decisions"
"topic"       instead of  "topics"
"actions"     instead of  "actionItems"
"action_items"             "actionItems"
"actions_items"            "actionItems"
{ "output": { ... } }     (nested wrapper, no top-level keys)
```

The prompt included a one-shot example with the exact 4-key schema and explicit instructions ("Output ONLY the JSON object"). The rolling prompt for multi-chunk inference included a full worked example with `CONTEXT` / `NEW AUDIO` labels. Neither fixed the issue consistently.

### Why Small Models Fail at This

Instruction-following quality scales with parameter count. Models under ~3B:
- Understand the *intent* of a prompt but don't rigidly honor key name contracts
- Drift toward paraphrasing keys rather than copying them verbatim
- Inconsistently apply formatting rules across temperature/sampling variations
- Worsen on longer contexts (chunked inference compounds the problem)

This is a known limitation — not a prompt engineering gap. Published benchmarks consistently show structured JSON adherence improving sharply at 7B+ parameters.

---

## Why Patching the Parser Is Not a Solution

The `parseStructuredOutput` function already handles some key aliases (`action_items` → `actionItems`, `Summary` → `summary`). Adding more mappings for every variant the model emits is:

1. **Unbounded** — each model version or prompt change produces new variants
2. **Fragile** — nested wrappers like `{ "output": { ... } }` can't be reliably unwrapped without knowing the structure in advance
3. **Silent failures** — a mapping that partially matches corrupts the result rather than returning `null`
4. **Not portable** — every new model we test requires another round of key-mapping discovery

---

## Why We Can't Go Bigger On-Device

Models that reliably follow JSON schemas are 7B+ parameters. Quantized sizes:

| Model | q4 size | q8 size |
|---|---|---|
| Llama-3.2-3B | ~3.4 GB | ~6.4 GB |
| Llama-3.1-7B | ~4.1 GB | ~8.2 GB |
| Qwen2.5-7B | ~4.4 GB | ~8.8 GB |

These exceed the 2 GB download budget for a desktop app feature that is opt-in and secondary to transcription. Shipping a 4+ GB model as part of an Electron app is not practical.

Additionally, ONNX inference for 7B+ models on CPU is extremely slow (30–120s per inference on typical MacBook hardware), making it unsuitable for a feature triggered after every meeting.

---

## Decision: Move to LM Studio

LM Studio runs an OpenAI-compatible local inference server (`http://localhost:1234/v1/chat/completions`). Users manage their own models — download, selection, and hardware acceleration are handled entirely by LM Studio.

### Why This Is Better

| Concern | On-Device ONNX | LM Studio |
|---|---|---|
| Model quality | 1.5B–3B, unreliable JSON | 7B+ models, reliable JSON |
| Maintenance | We manage downloads, versions, cache | User manages in LM Studio |
| Size impact on app | 900 MB–1.8 GB bundled | 0 MB (LM Studio separate) |
| Inference speed | Slow CPU ONNX | GPU-accelerated by LM Studio |
| User flexibility | Locked to our chosen model | User picks any model they prefer |
| API compatibility | Custom IPC/child process | Standard OpenAI `/v1/chat/completions` |

### Bonus: Ollama Compatibility

Ollama uses the same OpenAI-compatible API format at `http://localhost:11434`. Supporting both requires only a configurable `baseUrl` in Settings — no additional code paths.

---

## What Changes

- `structured-summarizer-process.ts` — **deleted** (child process no longer needed)
- `structured-summarizer.ts` — rewritten to use `fetch()` instead of `fork()`; chunking and rolling accumulation move here directly
- `store.ts` — adds `lmStudio: { baseUrl, model }` preference
- Settings UI — adds LM Studio section with URL, model name, and connection test
- All callers (`EnrichmentService`, IPC handlers) — **unchanged**
- `parseStructuredOutput`, prompts, `StructuredSummaryResult` type — **unchanged**
