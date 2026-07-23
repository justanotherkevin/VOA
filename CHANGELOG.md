# Changelog

All notable changes to VOA are documented here.

---

## [Unreleased]

### Added

- **Rebuilt the transcript's "Gutter" tag style on shadcn's Message component.** `TranscriptTagRenderer.tsx`'s `GutterView` now composes `Message`/`MessageAvatar`/`MessageContent` (`src/renderer/components/message.tsx`) with `Bubble`/`BubbleContent` (`bubble.tsx`) and `Avatar`/`AvatarFallback` (`avatar.tsx`), matching ui.shadcn.com/docs/components/base/message, instead of a hand-rolled flex/inline-style gutter column.
  - Each contiguous `[Meeting]`/`[Mic]` speaker turn gets its own avatar (`Volume2`/`Mic` icon tinted with the existing brand colors) and an accessible `aria-label` ("System audio" / "Mic audio").
  - Mic turns align to the end (right) and meeting/system-audio turns align to the start (left), so the transcript reads like a two-party conversation. The "Pill" tag style is unchanged.
  - Added `src/__tests__/components/TranscriptTagRenderer.test.tsx` covering message-row count, alignment, avatar labels, and pill-style rendering.
- **Redesigned the single Meeting view as a document-like "Ledger" layout with tabs.** `MeetingDetail.tsx` now opens with a thin accent bar and a navy key-facts block (recorded date, duration, audio source, participant count, open action items, summary status) above the title, then splits the rest into three shadcn `Tabs` (`src/renderer/components/tabs.tsx`, `line` variant): **Overview** (summary, key decisions, action items), **Transcript**, and **Participants** (participants + topics).
  - New `meeting-detail/` components: `MeetingKeyFacts`, `MeetingDecisions`, `MeetingActionItems` (checkmark/circle-indicator table instead of inline checkboxes), `MeetingParticipantsTopics`. `Section.tsx` is now a collapsible card shell (open by default, `aria-expanded`/`aria-controls`) shared by every section instead of a plain heading wrapper.
  - Removed the old two-column layout and its `MeetingSidebar`/`SideSection` components — decisions/topics/action items moved from a fixed right rail into the tabbed main column.
  - Added a rich mock meeting fixture (`src/renderer/__fixtures__/mockMeeting.json`) for iterating on the design against realistic data.
- **Adopted shadcn/ui and rebuilt the app around a single sidebar.** The previous hand-rolled icon-rail `Sidebar.tsx` and Settings' own standalone 232px nav panel are gone; there is now exactly one sidebar (`src/renderer/components/ui/Sidebar.tsx`), built on shadcn's Sidebar primitive, matching the structure documented at ui.shadcn.com/docs/components/sidebar:
  - `SidebarHeader` — app logo + status indicator.
  - `SidebarContent` — a collapsible **Meetings** `SidebarGroup` (search, grouped-by-date list, New Recording button — previously the Meetings page's own left panel).
  - `SidebarFooter` — a collapsible **Settings** menu (General/Transcription/Recording/Audio/Privacy & Storage/Permissions/Shortcuts — previously `Settings.tsx`'s own standalone nav panel).
  - The `SidebarTrigger` now lives in `MainLayout.tsx`, outside the sidebar, so it stays in a fixed screen position whether the sidebar is expanded or collapsed to its icon rail.
  - Added `MeetingsProvider`/`SettingsNavProvider` contexts (`src/renderer/contexts/`, mirroring the existing `PermissionsProvider` pattern) so the sidebar and the `Meetings`/`Settings` pages share meeting-selection and active-pane state without prop drilling.
  - `SettingSwitch`/`SegmentedControl` now wrap shadcn's `Switch`/`ToggleGroup` internally (same external API, no call-site changes) — every toggle and segmented control across all Settings panes is now a real shadcn component.
  - See `docs/APP-ARCHITECTURE.md`'s new "Sidebar Architecture" section for the two non-obvious constraints this design relies on (nav-click vs. collapse-toggle must stay separate; `SidebarContent` is the only scrolling region).
- **Isolated Whisper/onnxruntime inference into a dedicated `utilityProcess`** (`src/main/pipeline/whisper-process.ts` + `whisper-transcriber.ts`) — model load and inference now run in a separate OS process behind a thin FIFO-queued proxy, so a native `onnxruntime-node` crash can no longer take down the whole app. A fresh child process is spawned per model switch to work around a BFCArena allocator crash reproduced when reusing one process across distinct models. See `docs/whisper-onnxruntime-crash.md` for the investigation.
- **Sidebar now groups recordings into separate "Meetings" and "Dictations" sections** (`MeetingList.tsx`), each still date-bucketed (Today/Yesterday/etc) as before, with an empty-state line under whichever section has none yet.
  - The persisted entity's misleading `isMeeting: boolean` field is now `type: 'meeting' | 'dictation'` (`Meeting` interface renamed to `Recording` in `src/main/store.ts` and `src/renderer/hooks/useMeetings.ts`). Existing on-disk records are migrated once on store load (`runMigrations()` in `store.ts`).
  - Search placeholder/empty-state copy updated to be type-neutral now that the list holds two kinds of recording.
  - See `docs/APP-ARCHITECTURE.md`'s new "Recording type field" note for what the field drives. The `electronAPI.meetings` IPC namespace and `Meeting*` component/hook names are intentionally unchanged in this pass — a further "recording"→"capture" vocabulary rename (to free up "Recording" as an unambiguous entity name) is a separate, larger follow-up.

### Fixed

- **Sidebar became unusable with a large meeting history — the meeting list overflowed the whole sidebar and pushed Settings off-screen entirely**, since the list had no bounded scroll region of its own. Fixed by making `SidebarContent` the sidebar's one `flex-1 min-h-0 overflow-auto` region; `SidebarHeader`/`SidebarFooter` are fixed-height siblings, so Settings now always stays visible regardless of meeting count (verified with 35 seeded meetings).
- **Clicking "Settings" (or "Meetings") repeatedly could leave its list unexpectedly collapsed** — the row was originally a single button that both navigated and toggled the collapsible open/closed, so revisiting it an even number of times left it closed. This made e2e flows that navigate to Settings more than once per run (`shortcuts.spec.ts`, `system-audio.spec.ts`) flaky/timing out. Split into two controls: the row itself always navigates and forces the section open; a separate chevron button toggles collapse independently.
- **Dual-source (mic + system audio) recordings could save with the wrong `audioSource` and no `[Mic]`/`[Meeting]` tags** — the trailing VAD mic segment flushed on stop could arrive after `session-end` had already closed and saved the meeting, since `useRecordingFlow.ts`'s session-end effect only waited on `transcriber.isBusy` (never set in VAD mode). It now also waits on a new `hasPendingVadSegment` signal (`useVAD.ts`, `useAudioRecorder.ts`) before ending the session. As a safety net, `TranscriberService.recoverLateSegment` (`src/main/services/transcriber.ts`) now tags a late segment and upgrades `audioSource` to `'both'` if its source still slips in after the fact.
- **Model-load toast getting stuck on "loading" forever** — the Settings-save IPC handler (`src/main/ipc/settings.ts`) only returned an error in its response but never broadcast `transcriber:error`, which is what actually resolves the renderer's toast. It now broadcasts `transcriber:error`/`transcriber:ready` on the outcome, matching the app-startup preload path.
- **Base/Small/Medium remained selectable in Settings despite being marked disabled** — the live Settings page (`src/renderer/pages/Settings.tsx`) has its own inline model list that never checked the `disabled` flag; a since-unused `AIModel.tsx` component had the correct logic but isn't rendered anywhere. `Settings.tsx`'s model list and `updateModelPref` now check `disabled` and revert optimistic UI state on a failed update instead of silently ignoring it.
- **`notification-visibility.spec.ts`'s recording-state test only checked that a static container div was attached**, not that the actual "recording" state text rendered — passed even when the toggle silently failed to reach the renderer. Now asserts the real text is visible.

### Changed

- **Re-enabled Base as a selectable Whisper model** — repeated manual switching between Tiny/Base in the real app didn't reproduce the native crash Small/Medium hit reliably. A version-bump experiment (`onnxruntime-node` 1.14.0 → 1.24.1) to fix the crash outright made things worse and was reverted; see `docs/whisper-onnxruntime-crash.md`.
- **Reorganized Settings-related e2e specs** under `tests/e2e/pages/settings/`, added an `@e2e/*` path alias (`tsconfig.json`) for absolute imports, deduplicated a `pollUntil` helper that had been copied into three separate spec files into `tests/e2e/utils/common.helpers.ts`, and removed dead code left over from removed system-audio test scenarios.

- **Paused auto-paste-on-transcription** — transcribed text is no longer automatically copied to the clipboard and pasted into the active window after each transcription (`shouldPasteText()` in `src/main/util.ts` now returns `false`). The mechanism is left in place, disabled at a single gate, for possible future opt-in use.

- **Refactored `MeetingDetail.tsx` into focused sub-components** — split the 459-line meeting detail view into `components/meeting-detail/` (`MeetingDetailHeader`, `MeetingOverview`, `MeetingTranscript`, `MeetingSidebar`, plus generic `Section`/`SideSection` primitives), extracted `useCopyText` into `hooks/`, and consolidated date/duration formatting (previously duplicated between `MeetingDetail.tsx` and `MeetingList.tsx`) into `utils/formatters.ts`. No behavior or visual changes.
- **Extracted `src/main/ipc/transcriber.ts`'s E2E-only test handlers into `transcriber.e2e.ts`**, conditionally registered from `src/main/ipc/index.ts` under `E2E_TEST`, matching the convention already used by `meetings.ts`. Added `src/main/ipc/__tests__/transcriber.test.ts` covering the production handlers, since none existed before.
- **De-duplicated shared test setup between `src/main/__tests__/transcriber-integration.test.ts` and `transcriberService.test.ts`** into `src/main/__tests__/helpers/transcriberTestHelpers.ts` (`createTranscriberCallbacks`, `resetTranscriberSessionState`, `createSilentAudio`), and added integration tests covering mic+system transcript merging/tagging and timestamp-based ordering.

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
