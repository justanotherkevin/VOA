# Changelog

All notable changes to VOA are documented here.

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
