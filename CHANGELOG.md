# Changelog

All notable changes to VOA are documented here.

---

## [Unreleased]

### Added

- **Isolated Whisper/onnxruntime inference into a dedicated `utilityProcess`** (`src/main/pipeline/whisper-process.ts` + `whisper-transcriber.ts`) — model load and inference now run in a separate OS process behind a thin FIFO-queued proxy, so a native `onnxruntime-node` crash can no longer take down the whole app. A fresh child process is spawned per model switch to work around a BFCArena allocator crash reproduced when reusing one process across distinct models. See `docs/whisper-onnxruntime-crash.md` for the investigation.

### Fixed

- **Model-load toast getting stuck on "loading" forever** — the Settings-save IPC handler (`src/main/ipc/settings.ts`) only returned an error in its response but never broadcast `transcriber:error`, which is what actually resolves the renderer's toast. It now broadcasts `transcriber:error`/`transcriber:ready` on the outcome, matching the app-startup preload path.
- **Base/Small/Medium remained selectable in Settings despite being marked disabled** — the live Settings page (`src/renderer/pages/Settings.tsx`) has its own inline model list that never checked the `disabled` flag; a since-unused `AIModel.tsx` component had the correct logic but isn't rendered anywhere. `Settings.tsx`'s model list and `updateModelPref` now check `disabled` and revert optimistic UI state on a failed update instead of silently ignoring it.
- **`notification-visibility.spec.ts`'s recording-state test only checked that a static container div was attached**, not that the actual "recording" state text rendered — passed even when the toggle silently failed to reach the renderer. Now asserts the real text is visible.

### Changed

- **Re-enabled Base as a selectable Whisper model** — repeated manual switching between Tiny/Base in the real app didn't reproduce the native crash Small/Medium hit reliably. A version-bump experiment (`onnxruntime-node` 1.14.0 → 1.24.1) to fix the crash outright made things worse and was reverted; see `docs/whisper-onnxruntime-crash.md`.
- **Reorganized Settings-related e2e specs** under `tests/e2e/pages/settings/`, added an `@e2e/*` path alias (`tsconfig.json`) for absolute imports, deduplicated a `pollUntil` helper that had been copied into three separate spec files into `tests/e2e/utils/common.helpers.ts`, and removed dead code left over from removed system-audio test scenarios.

- **Paused auto-paste-on-transcription** — transcribed text is no longer automatically copied to the clipboard and pasted into the active window after each transcription (`shouldPasteText()` in `src/main/util.ts` now returns `false`). The mechanism is left in place, disabled at a single gate, for possible future opt-in use.

- **Refactored `MeetingDetail.tsx` into focused sub-components** — split the 459-line meeting detail view into `components/meeting-detail/` (`MeetingDetailHeader`, `MeetingOverview`, `MeetingTranscript`, `MeetingSidebar`, plus generic `Section`/`SideSection` primitives), extracted `useCopyText` into `hooks/`, and consolidated date/duration formatting (previously duplicated between `MeetingDetail.tsx` and `MeetingList.tsx`) into `utils/formatters.ts`. No behavior or visual changes.

---

## [1.0.0] — 2025

Initial public release.

### Added

- **On-device Whisper transcription** via `@xenova/transformers` + ONNX Runtime (Tiny, Base, Small, Medium models)
- **Voice Activity Detection** using `@ricky0123/vad-web` — automatically segments speech from silence
- **Smart meeting detection** — detects active calls in Zoom, Teams, Google Meet, and Slack via Accessibility API
- **AI-generated meeting summaries** and structured action items using Qwen2.5-1.5B-Instruct (local)
- **Meeting vs. monologue distinction** — classifies recordings based on whether another participant was detected
- **Global keyboard shortcut** — start/stop recording from any app (configurable, default F1)
- **Always-on-top recording pill** — floating notification showing waveform and in-meeting prompts
- **Structured meeting detail view** — sidebar-split layout with transcript and AI summary side by side
- **macOS-style settings UI** — System Settings-inspired interface with 7 panes:
  - General (theme, accent color, density, startup)
  - Recording (auto-record modes, meeting app detection)
  - Audio (mic source, gain, noise suppression)
  - Transcription (model selection, download/cache management)
  - Shortcuts (configurable hotkeys)
  - Privacy & Storage (data management)
  - Permissions (Microphone, Accessibility, Screen Recording)
- **Privacy-first architecture** — zero cloud dependency; no account, no telemetry, no data transmission
- **Local model caching** — models downloaded once and cached; configurable via settings
- **Audio retention policy** — raw audio kept 3 days post-recording for diarization; transcripts kept indefinitely
