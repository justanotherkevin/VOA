# Whisper Base/Small/Medium: onnxruntime-node Crash

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

## Suggestions going forward

1. **Retest after an `onnxruntime-node` version bump.** Currently pinned to `1.14.0` (via `package.json` `overrides`) specifically to dodge a _different_ SIGSEGV in `1.21` that affected the old Qwen pipeline (now moot — Qwen no longer runs on-device). Since that constraint may no longer apply, a newer `onnxruntime-node` is worth trying against this exact bug — no fix is confirmed, but none is ruled out either.
2. **Migrate Whisper to `whisper.cpp`** (GGML models, Metal acceleration) instead of ONNX/`onnxruntime-node`. This sidesteps the bug entirely rather than working around it, and multiple sources point to it as the standard choice for Whisper specifically on Apple Silicon. Now the most promising path — the arena mitigation above shows the ONNX allocator itself is the problem, not something app-code can fully paper over.
3. Whichever path is taken, keep the `utilityProcess` isolation and queue — even once Base/Small/Medium work again, a single wedged native call should never be able to take the whole app down or block the main thread. That property is independent of which backend ends up running inference.
