# Whisper Base/Small/Medium: onnxruntime-node Crash

## Status (current)

Tiny is the only reliable Whisper model. Base/Small/Medium are disabled in
Settings. Two in-app mitigations were tried and both failed to make them
usable — see "Tried" sections below. **Decision: stop trying to work around
this from application code and move Whisper off `onnxruntime-node` entirely
(`whisper.cpp` is the leading candidate)** — see "Decision" at the bottom.

This investigation and its fix (`whisper-process.ts` isolation + FIFO queue,
Base/Small/Medium disabled in `src/lib/Constants.ts`/`AIModel.tsx`, the
`distil-whisper`-style migration guard in `src/main/store.ts`) originated on
an unmerged branch and was brought onto `main` alongside three related,
independent additions: eager model lifecycle (pre-load the selected model at
app startup, swap-on-save in Settings instead of lazily on first
`transcribe()` call — see `TranscriberService.preloadCurrentModel()` /
`applyModelPreferences()`), toast notifications for model load/error/queue
state (`sonner`, wired in `useTranscriber.ts` and `AIModel.tsx`), and
permanent timing/queue-depth diagnostic logs in `whisper-process.ts` and
`whisper-transcriber.ts`. None of those three change the conclusion below —
they apply to whichever model is actually enabled (currently Tiny only).

## Problem

Only `Xenova/whisper-tiny` works reliably. Selecting Base, Small, or Medium
either froze the app indefinitely or crashed it outright — inconsistently,
depending on what else was going on in the process at the time.

## Investigation

### The freeze

`WhisperTranscriber.initialize()`/`.transcribe()` (`src/main/pipeline/whisper-transcriber.ts`)
ran `@xenova/transformers`'s `pipeline()` call directly and synchronously in
the Electron **main** process — no `worker_thread` or child process, unlike
the Qwen summarizer pipeline that existed at the time (since replaced by LM
Studio, see `docs/lm-studio-migration.md`), which was isolated in a child
process specifically to survive native crashes.

Timing a plain-Node harness against the exact production code path
(unquantized, `.en` suffix, the existing `no_attentions` revision workaround
for medium) showed load+inference scaling with model size but completing
fine: tiny 1.7s, small 8.2s, medium 19.9s. No hang, correct output.

Reproducing the same call inside the real Electron app (Playwright driving
the actual `TranscriberService.transcribe()` IPC path, with a second loop
pinging a cheap IPC channel to measure main-process responsiveness) showed
`small` hanging for 6+ minutes with no completion and no error — and the
app's own `main.log` had a real user session showing the identical pattern:
`small` logged "Initializing ASR pipeline" and then nothing, for 18+
minutes, until the next unrelated session.

Sampling the Electron main thread mid-hang (`sample <pid> 3`) showed **100%
of samples** on the main thread, inside:

```
InferenceSessionWrap::LoadModel → OrtApis::CreateSessionFromArray
→ InferenceSession::Initialize → SessionState::FinalizeSessionState
→ PrepackConstantInitializedTensors → MatMul<float>::PrePack
→ GemmPackBFp32 → BFCArena::Alloc → posix_memalign → ...
```

— stuck allocating memory during ONNX weight prepacking, with `read`/`write`
syscalls under the allocator in the tail of the stack, consistent with
memory-pressure/swap thrashing rather than a clean allocation.

### The crash

Moving Whisper into a `worker_thread` (own thread, same process) fixed the
freeze — main process stayed responsive throughout (ping latency avg 5ms,
max ~150-400ms vs. previously blocking for the full transcription duration).
But under real usage it then **crashed the whole app**: `SIGTRAP`, exit code
5, captured in a macOS crash report
(`~/Library/Logs/DiagnosticReports/Electron-*.ips`) at the exact same
allocator code path:

```
onnxruntime::BFCArena::Extend → CPUAllocator::Alloc → posix_memalign
```

A `worker_thread` shares the parent's OS process and address space, so a
native crash inside it takes the whole app down — confirmed against
Electron's own docs (see Research below).

Switching to `utilityProcess.fork()` (a real separate OS process, matching
the pattern the old Qwen summarizer child process used) contained the crash:
the crash report moved from `Electron` (main) to `Electron Helper` (the
child), the main app kept running, and `TranscriberService` surfaced a clean
error instead of hanging or dying.

**This does not make Small/Medium usable.** The underlying `BFCArena`
allocator bug still fires — confirmed with and without quantization, during
both model load and inference (quantization just moves _where_ in the
pipeline it crashes, from load to the first inference call). Reproduction
rate across every variant tried (main-thread, `worker_thread`,
`utilityProcess`, quantized, unquantized): 100%.

## Research

Electron's own docs are explicit that native addons (like `onnxruntime-node`,
a compiled N-API module) are unsafe inside `worker_threads` — "most existing
native modules have been written assuming single-threaded environment, using
them in Web Workers will lead to crashes and memory corruptions," because
`process.dlopen` isn't thread-safe. This matches what we saw exactly.

This is also a known, still-open upstream bug, not something specific to
this app:

- [microsoft/onnxruntime#20084](https://github.com/microsoft/onnxruntime/issues/20084) — "Unpredictable onnxruntime-node crash when using Electron," reproduced with `worker_threads` specifically, unresolved.
- [microsoft/onnxruntime#13086](https://github.com/microsoft/onnxruntime/issues/13086) — worker-thread crashes traced to `InferenceSession` not being cleaned up on termination; no close API exists.
- [microsoft/onnxruntime#17867](https://github.com/microsoft/onnxruntime/issues/17867) — a segfault in the same `MlasSgemmCopyPackB`/`GemmPackBFp32`/`MatMul::PrePack` code path we hit, on a different platform/config.
- [microsoft/onnxruntime#15087](https://github.com/microsoft/onnxruntime/issues/15087) — a related `BFCArena` crash, with a documented (partial) mitigation: `enable_cpu_mem_arena=false`, `enable_mem_pattern=false`, `execution_mode=SEQUENTIAL`, `intra_op_num_threads=1`, `inter_op_num_threads=1`. **Not reachable from our code** — `@xenova/transformers@2.17.2`'s `constructSession()` hardcodes `InferenceSession.create(buffer, { executionProviders })` with no session-options passthrough (there's even a `// TODO add option for user to force specify their desired execution provider` left in the library source).
- No changelog or release notes found (searched 1.14 through 1.21+) documenting a fix for this specific `BFCArena` crash.

No project found that runs `onnxruntime-node` safely inside a
`worker_thread`. Every real Electron+onnxruntime project that surfaced in
research uses process isolation, not thread isolation, when it needs to
survive this class of crash — the same shape as this codebase's old Qwen
child-process pattern.

## Solution implemented

- `src/main/pipeline/whisper-process.ts` — new `utilityProcess.fork()` child. Model load and inference happen here, isolated from main/renderer/GPU processes both in crash blast radius and in memory address space (a separate OS process gets a clean, uncontended heap instead of competing with Electron's other processes for the same one — plausibly part of why the hang doesn't reproduce standalone).
- `src/main/pipeline/whisper-transcriber.ts` — rewritten as a thin proxy: spawns the child lazily, and runs every `initialize()`/`transcribe()` call through an explicit FIFO queue so only one job is ever in flight — no job is posted to the child until the previous one has resolved. `dispose()` force-kills the child rather than asking it to shut down cooperatively, since a wedged child can't be trusted to respond to a graceful shutdown message either.
- `src/lib/Constants.ts` / Settings UI — Base/Small/Medium marked `disabled` in `MODEL_META_DATA` with a `disabledReason`; the Settings model list dims them, blocks selection, and shows the reason as a tooltip (native `title`) and an "Unavailable" pill instead of the download button.
- `src/main/store.ts` — `getModelPreferences()` resets `selectedModel` back to the default (tiny) if it's already set to base/small/medium, mirroring the existing `distil-whisper/` migration guard, so a model picked before this fix doesn't keep silently failing on every launch.

Net effect: Tiny works as before. Base/Small/Medium can no longer be
selected from Settings, and if somehow still selected (stale preference,
IPC call bypassing the UI) they now fail with a clean error instead of
freezing or crashing the app.

## Tried: disabling the CPU memory arena (onnxruntime#15087's mitigation)

Patched `InferenceSession.create` on the exact `onnxruntime-node` instance
`@xenova/transformers` resolves (`whisper-process.ts`, before any session is
created) to force `enableCpuMemArena: false`, `enableMemPattern: false`,
`executionMode: 'sequential'`, `intraOpNumThreads: 1`, `interOpNumThreads: 1`
— the mitigation from onnxruntime#15087, otherwise unreachable through
`@xenova/transformers`'s API (see above).

**Isolated single runs (fresh Electron process, one model load, then done):**
100% pass rate across 6 runs — small, small-quantized, medium,
medium-quantized, each producing a correct transcript with no crash.

**Sequential runs in one long-lived app session (tiny, then small, then
small-quantized, then medium, then medium-quantized, back to back — closer
to how the app actually gets used across a session where the user might try
a few models):** crashes again, at the second distinct model loaded, even
with a fresh `utilityProcess` child forced for every model change (so it
isn't simply "the same process reused" either — each crash was in a
genuinely fresh OS process). System `vm_stat` at the time showed roughly
2.7 GB free out of 18 GB total, well below what the isolated runs had
available.

**Conclusion: this is a real, measurable mitigation, not a fix.** It raises
the bar for how much memory pressure the same crash needs to trigger under —
enough to pass every isolated test, not enough to survive realistic repeated
use on a memory-constrained machine. Re-enabling Base/Small/Medium on the
strength of the isolated results alone would have shipped a bug that's
merely harder to hit, not gone. Kept in `whisper-process.ts` as a real
improvement (worth having regardless), but Base/Small/Medium stay disabled
in Settings until something eliminates the crash rather than narrowing its
window.

The `utilityProcess`-per-model-change behavior (kill and respawn the child
on every distinct model load, added while investigating this) is kept in
`whisper-transcriber.ts` too — it didn't fix this crash, but it's a
correctness improvement independent of it: it guarantees every model load
starts in a process untouched by a previous model's session state.

## Tried: forcing a full app relaunch on model change

Reasoning: every isolated single-model test (6/6) passed — a model's
_first_ load in a genuinely fresh process was the one condition that looked
reliable, even though the _same_ model loaded a second time in an
already-used process reliably crashed. So: make every model change force a
full app relaunch (`app.relaunch()` + `app.exit()`), confirmed with the
user first, so every load is that "first load in a fresh process" case.

Implemented (IPC relaunch path, Settings confirm dialog, Base/Small/Medium
re-enabled) and re-verified directly against that exact condition — a fresh
Electron process, `Xenova/whisper-small.en`, first and only model load in
that process. **It crashed anyway** (`SIGTRAP`, exit code 5, identical
`BFCArena` stack). `vm_stat` at the time showed ~3GB free, comparable to or
higher than during the isolated runs that had passed. Reverted the
re-enablement again.

This is the more important data point of the two experiments: it means the
crash isn't cleanly gated by "fresh process" or "memory pressure" the way
the first round of testing suggested — those earlier passes were
consistent with a flaky/non-deterministic bug (a race or heap-corruption
class of issue) getting lucky across a small number of trials, not with a
threshold being crossed. Neither the arena-disable mitigation nor forcing a
fresh process per model load are things application code can rely on to
prevent this. Base/Small/Medium stay disabled with no in-app mitigation
currently believed to close the gap — see the Decision below.

## Why not just retest with a newer `onnxruntime-node`?

`onnxruntime-node` is currently pinned to `1.14.0` (via `package.json`
`overrides`) specifically to dodge a _different_ SIGSEGV in `1.21` that hit
the old Qwen summarizer pipeline. That constraint is now moot — Qwen no
longer runs on-device (see `docs/lm-studio-migration.md`) — so a version
bump is technically unblocked and would be a legitimate one-line experiment.

Not pursuing it as the primary path: two independent mitigations
(arena-disable, fresh-process-per-load) both looked like fixes in small
samples and both failed under closer testing, in a way consistent with a
non-deterministic native bug rather than a config problem. A version bump
is the same category of bet — "maybe this environment variable changes the
odds" — with no confirmed report that any later version fixes this specific
`BFCArena` crash (searched changelogs 1.14 through 1.21+, nothing found).
Worth a quick try if someone has spare cycles, but not worth blocking the
migration decision on.

## Decision: moving off `onnxruntime-node`

Two in-app mitigations were tried and both failed against the same
`BFCArena` crash. That's enough signal that this isn't a configuration
problem reachable from application code — it's a bug inside the native
allocator itself, on this platform/library-version combination, and no
amount of session-options tuning or process lifecycle management from our
side reliably avoids it. **Migrate Whisper off ONNX/`onnxruntime-node` to
`whisper.cpp`** (GGML models, Metal acceleration on Apple Silicon) — this
sidesteps the bug entirely rather than working around it, and it's the
ecosystem's de facto standard for Whisper on Apple Silicon specifically
(multiple independent sources point to it over ONNX Runtime for this exact
platform/model combination).

**Not yet researched — needed before implementation starts:**

- Node.js binding for `whisper.cpp` (native addon vs. spawning the `main`/
  `whisper-cli` binary as a subprocess) — which is more viable inside an
  Electron `utilityProcess`, and what the packaging/distribution story looks
  like (prebuilt binaries per platform vs. building from source at install
  time).
- GGML model file availability/licensing for the sizes currently in
  `MODEL_META_DATA` (tiny/base/small/medium, English-only `.en` variants)
  and where they'd be hosted/downloaded from (mirroring today's
  `model-cache.ts` download-and-cache flow).
- How much of `whisper-transcriber.ts`'s public interface (`AsrTranscriber`
  in `src/main/pipeline/types.ts`) survives unchanged — `initialize()`/
  `transcribe()` signatures, `chunk_length_s`/`stride_length_s`-style
  windowing behavior, timestamp/chunk output shape `TranscriberService`
  already depends on.
- Whether accuracy/output is comparable to the current ONNX Whisper exports
  for the same model size (whisper.cpp uses the original OpenAI weights
  converted to GGML, not the `Xenova/whisper-*` ONNX exports currently used
  — same underlying model, different conversion pipeline).
- Performance expectations on Apple Silicon (Metal acceleration) vs. the
  current CPU-only ONNX path — likely a net win, not yet measured here.

**Keep regardless of backend:** the `utilityProcess` isolation and FIFO
queue in `whisper-transcriber.ts`/`whisper-process.ts`. Even once
`whisper.cpp` is in place, a single wedged native call should never be able
to take the whole app down or block the main thread — that property is
independent of which backend ends up running inference, and this migration
should preserve rather than remove it.
