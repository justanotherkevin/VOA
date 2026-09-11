# Audience: engineers and makers

This file, together with its sibling `.claude/audience-meeting-heavy-professionals.md`,
is the source of truth for `README.md` and `docs/index.html` respectively. It is not
user-facing copy. It is the brief a writer reads before touching the README. Every
claim in here traces to code, a file path, or a command that can be re-run to verify
it. If a claim cannot be traced, it does not belong in this document, and it does not
belong in the README either.

## Who this is for

Engineers, indie hackers, and privacy-minded developers deciding whether to run VOA,
read its code, or contribute to it. They are technically literate enough to check our
claims themselves: they will clone the repo, grep the source, and read the diff before
they trust a paragraph of prose. They evaluate open source projects the way they
evaluate a pull request, not the way they evaluate a product page.

## What they already believe walking in

They have seen "privacy-first, local AI" claimed by products that quietly phone home
anyway, so the phrase itself carries no weight with them anymore. They assume a 1.5B
parameter model is a toy, too small to produce a summary worth reading, because most of
what they have seen at that size is a demo, not a tool. They assume an Electron app
will be sluggish and memory-hungry, because that reputation is earned across the
ecosystem, fairly or not. They assume a solo side project with no releases and no CI is
already abandoned, because that is the statistically correct prior for most repos that
look like this one.

We earn trust against each of these not by asserting the opposite, but by giving them
something to check. Against "privacy-first is a lie," we give them a grep command, not
a promise. Against "1.5B is too small," we point at the specific model, quantization,
and the rolling-summarization code that compensates for a small context window. Against
"Electron is slow," we do not claim it is fast, we simply do not bring it up unprompted
and let the architecture speak for itself. Against "this is abandoned," we are honest
about what is unfinished rather than papering over it, because a maintained project with
disclosed bugs reads as more alive than a polished one with none.

## What they actually care about, ranked

1. **Can I verify the privacy claim myself?** They want a command to run, not a
   sentence to believe.
2. **What are the hard technical problems, and how were they solved?** This is where
   respect is earned. Skipping this section for polish is the single biggest mistake we
   could make for this audience.
3. **What is broken right now?** A clear, current list of known issues is worth more to
   this reader than a features list.
4. **Can I run it in under ten minutes?** Setup friction is evaluated before anything
   else about the app itself.
5. **Is it worth contributing to?** Last, and only after the above four hold up.

## Proof points we can honestly make

| Claim                                                                                         | Evidence                                                                                                                                                                                                             | Where it lives                                                                                                                                                           |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Audio is never written to disk                                                                | Grep for `writeFile`, `createWriteStream`, `.wav`, `.webm`, and `audioPath` across `src/main` and `src/renderer` returns nothing; audio only ever exists as in-memory `Float32Array` buffers                         | `src/main/`, `src/renderer/` (absence is the evidence; reproduce with `grep -rE "writeFile \| createWriteStream \| \.wav \| \.webm \| audioPath" src/main src/renderer`) |
| Only a label is persisted about audio, never audio data                                       | Saved records store `audioSource` as `'mic' \| 'system' \| 'both'`, a string tag, not a buffer                                                                                                                       | recording/meeting persistence types                                                                                                                                      |
| The only outbound network host in the main process is for model downloads                     | `huggingface.co` is the only host string in `src/main`; the only other `https` strings are `github.com` and `electronjs.org` in doc comments, plus `example.com` in tests; no telemetry or analytics endpoint exists | `grep -r "https://" src/main`                                                                                                                                            |
| Speech-to-text runs on-device via Whisper                                                     | `@xenova/transformers` on ONNX Runtime, in a dedicated Electron `utilityProcess`                                                                                                                                     | `src/main/pipeline` (transcription pipeline)                                                                                                                             |
| Summarization runs on-device by default                                                       | Qwen2.5-1.5B-Instruct GGUF, Q4_K_M quantization, 1065.6 MB, via `node-llama-cpp`, in its own `utilityProcess`, model pulled from `huggingface.co`                                                                    | `src/main/pipeline/structured-summarizer.ts`                                                                                                                             |
| Long meetings are handled without a huge context window, not just truncated                   | Rolling summarization is implemented, not aspirational: `ROLLING_PROMPT_TEMPLATE`, `splitIntoChunks`, `submitChunk`, `summarizeChunked`                                                                              | `src/main/pipeline/structured-summarizer.ts`                                                                                                                             |
| Speech segmentation uses a real VAD model, not a volume threshold                             | `@ricky0123/vad-web` (Silero), streamed to main as `Float32Array` segments over IPC                                                                                                                                  | recorder/VAD integration                                                                                                                                                 |
| LM Studio and Ollama are supported as swappable backends, not a hard dependency on one vendor | Optional alternatives via an OpenAI-compatible `/v1/chat/completions` call                                                                                                                                           | `src/main/pipeline/structured-summarizer.ts`                                                                                                                             |
| Known-broken behavior is disclosed, not hidden                                                | Two Whisper models are hard-disabled with `disabled: true` after a confirmed native crash; auto-paste is implemented but gated off by a function that returns `false`                                                | `src/lib/Constants.ts`; `shouldPasteText()` in `src/main/util.ts`                                                                                                        |
| No unverified retention claims remain in shipped docs                                         | The changelog's "3 days" retention claim was traced to no code and removed; see "What we must never claim"                                                                                                           | `CHANGELOG.md` 1.0.0 entry, this document                                                                                                                                |

## The stories worth telling

**The ONNX-to-GGUF summarizer migration.** VOA's summarization backend did not start
as `node-llama-cpp`; the project moved off an on-device ONNX path (see
`docs/lm-studio-migration.md`) toward calling out to LM Studio or Ollama over HTTP, and
separately toward `node-llama-cpp` with a bundled GGUF model as the default. This is
interesting to an engineer because it is a concrete example of choosing a workable
architecture over a purer one: keeping "on-device" true while accepting an HTTP call
to a local server process, and shipping a quantized model that fits a real machine's
RAM instead of chasing a bigger model that would not. It also means the old
`structured-summarizer-process.ts` utilityProcess referenced in older comments no
longer exists, which is the kind of drift a reader will notice if we do not explain it
first.

**The Whisper native crash and process isolation.** Small and Medium Whisper models
are disabled because of a confirmed `onnxruntime-node` native crash, documented in
`docs/whisper-onnxruntime-crash.md`. What makes this worth telling is the negative
result: running the model in an isolated `utilityProcess` did not fix it, and a version
bump made it worse, not better. Base survived repeated manual switching in the real app
and Tiny is the schema default, so those are what ship. This is a story about
disclosing a bug that isolation could not solve, rather than quietly shrinking the
feature set and hoping nobody asks. It is also a preview of the honest next step: the
fix is scoped to a future `whisper.cpp` migration, not to retrying the same isolation
approach with more patience.

**The VAD segmentation fix, and the bug still open next to it.** VAD-based recording
correctly avoids emitting transcriptions for silence, but there is a diagnosed
race: if a recording starts before VAD finishes loading, `useAudioRecorder.ts`'s
`handleDataAvailable` closure captures `vadInitialized` at `startRecording()` time
instead of reading a live ref, so a stale `false` persists for that `MediaRecorder`
instance's whole lifetime and can produce a duplicate, full-audio transcription. This
is worth telling for two reasons: it demonstrates that segmentation is handled by a
real model rather than a naive threshold, and it is a good example of a closure-capture
bug that is easy to explain and easy to verify by reading the one line responsible for
it, which is exactly the kind of detail this audience trusts more than a claim of "it
just works."

## What we must never claim

- **Never state a data retention period, deletion schedule, or storage duration for
  audio or transcripts unless it is enforced by code we can point to.** This is not a
  hypothetical risk: `CHANGELOG.md`'s 1.0.0 entry documents a "raw audio kept 3 days
  post-recording for diarization" policy that no code implements. That sentence was
  taken on trust from the changelog and briefly published on the public marketing page
  as a concrete privacy promise before it was caught and removed. It is the reason this
  document exists. Treat `CHANGELOG.md` as a record of intent, not a record of shipped
  behavior, and never lift a claim from it without checking the source first.
- **Never claim a signed, notarized, or downloadable release exists.** There are zero
  GitHub releases. The only install path is clone, `npm install`, `npm start`.
- **Never claim cross-platform support.** The app is macOS only. macOS 13 Ventura is
  the baseline and covers dictation; macOS 14 Sonoma or later is required for
  system-audio capture and therefore for meeting recording, enforced by a `major >= 14`
  check in `systemAudioCapability.ts`.
- **Never claim automated testing or review gates a pull request.** There is no CI.
  `.github/` contains three issue templates and no workflows.
- **Never claim a pinned or guaranteed Node version.** `package.json` has no `engines`
  field and there is no `.nvmrc`.
- **Never claim Small or Medium Whisper models are available, or imply the disabling is
  a config toggle a user can flip.** It is a deliberate, tested response to a native
  crash, not a preference.
- **Never round the summarizer model size down to "about a gigabyte" in a way that
  implies a smaller download than it is.** State 1065.6 MB (1.04 GB) when precision
  matters, or "just over a gigabyte" when it does not; do not say "small download."

## Tone and register

Write like documentation for a tool you'd trust, not like a landing page. Prefer a
specific file path or command over an adjective. Say what a component does before
saying that it is good. Disclose limitations in the same voice as capabilities, not in
a smaller font or a buried footnote; this audience reads a disclosed bug as evidence of
an active maintainer, not as a mark against the project. Avoid superlatives entirely.
If a sentence would work equally well in a pitch deck, rewrite it until it only works
here.

## How this maps to README.md

- The privacy section of the README should lead with the grep commands from "Proof
  points," not with a paragraph asserting privacy. Let the reader run the command
  before they finish reading the section.
- The architecture or "how it works" section should carry the two or three sentences
  of "The stories worth telling" that are most load-bearing (ONNX-to-GGUF and the
  Whisper crash are the strongest candidates), not the full narrative from this
  document. Link to `docs/lm-studio-migration.md` and
  `docs/whisper-onnxruntime-crash.md` for readers who want the rest.
- A "known issues" or "status" section should carry the VAD duplicate-transcription
  bug, the auto-paste gate, the disabled Whisper models, and the lack of a signed
  release, stated plainly and without hedging.
- Setup instructions should stay honest about there being no `engines` field and no
  pinned Node version, rather than implying a version is required and enforced.
- If the README grows too long, cut narrative detail from "The stories worth telling"
  first and keep the proof points table and the known-issues list; those two carry
  more trust per line than prose does for this audience.

## Open questions

- Whether the README should include the exact grep commands inline (maximizes
  verifiability) or link out to this document (keeps the README shorter). No decision
  has been made.
- Whether "no CI" should be framed as a limitation to fix or simply stated as current
  status; this document takes no position on roadmap, only on what is true today.
- Whether a future signed release changes how strongly we can phrase the "clone and
  run" setup story, since today's honest framing assumes no packaged binary exists.
