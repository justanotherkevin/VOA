# VOA

| On boarding                                                                                                                           | Structured Data Preview                                     |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| <video src="https://github.com/user-attachments/assets/563177b7-e329-40ed-bd36-76ffc375a7b9" autoplay loop muted playsinline></video> | ![Available LLM models](docs/screenshots/smart-summary.png) |

**VOA** is a macOS desktop app that turns any meeting or call into structured notes — summary, key decisions, and action items — automatically, using local AI. Press a hotkey from any app, speak, and get a searchable transcript with an LLM-generated structured summary. Transcription runs fully on-device via Whisper; structured summaries use LM Studio. No cloud, no API keys, your audio never leaves your machine.

![Electron](https://img.shields.io/badge/Electron-2B2E3A?logo=electron&logoColor=9FEAF9)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38BDF8?logo=tailwindcss&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

---

## Why VOA

Most meeting recorders give you a raw transcript and stop there, or they send your audio to a cloud LLM to extract action items. VOA uses [Whisper](https://github.com/openai/whisper) for on-device speech-to-text and [LM Studio](https://lmstudio.ai) for structured extraction. Every meeting ends with a summary, a decisions list, tagged topics, and concrete action items, generated entirely on your Mac.

The local approach is also the privacy answer: no cloud subscription, no bot joining your call, no API keys, no audio saved and ever leaving your machine. It works with any app — Zoom, Teams, Google Meet, phone calls, in-person conversations, or your own voice memos.

---

## Features

- **Global hotkey capture** — start and stop recording from any app (configurable shortcut, default F1)
- **On-device Whisper transcription** — runs locally via `@xenova/transformers` + ONNX Runtime; no cloud
- **Voice Activity Detection** — automatically segments speech from silence using `@ricky0123/vad-web`
- **Smart meeting detection** — detects active calls in Zoom, Teams, Google Meet, and Slack via Accessibility API
- **AI summaries with rolling context** — for long meetings, the transcript is processed in chunks and the summary is updated incrementally; bring your own model via LM Studio or Ollama
- **Meetings and monologues** — distinguishes group calls from solo voice capture
- **Privacy-first** — all audio processing stays on your Mac; no telemetry, no account required

---

## AI Stack

| Purpose              | Model / Tool                                | Notes                                                           |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| Speech-to-text       | OpenAI Whisper (via `@xenova/transformers`) | Runs in Node.js via ONNX Runtime; downloaded and cached locally |
| Structured summaries | Any instruct model via LM Studio or Ollama  | Local OpenAI-compatible inference server; bring your own model  |

### Whisper model options

| Model  | Size    | Speed    | Accuracy |
| ------ | ------- | -------- | -------- |
| Tiny   | ~75 MB  | ⚡⚡⚡⚡ | ★★☆☆     |
| Base   | ~142 MB | ⚡⚡⚡   | ★★★☆     |
| Small  | ~466 MB | ⚡⚡     | ★★★★     |
| Medium | ~1.5 GB | ⚡       | ★★★★     |

English-only variants available for each model (faster, smaller).

---

## How It Works

```mermaid
sequenceDiagram
    participant User
    participant Main as Main Process
    participant Renderer as Renderer Process
    participant VAD as VAD (useVAD)
    participant IPC as IPC Bridge
    participant Transcriber as TranscriberService
    participant LMStudio as LM Studio

    User->>Main: Press hotkey (any app)
    Main->>Renderer: recording:toggle

    Renderer->>VAD: startListening()
    Renderer->>IPC: startTranscriberSession()

    loop While recording
        VAD->>VAD: Detect speech segment
        VAD->>IPC: transcriber:start (Float32Array)
        IPC->>Transcriber: transcribe(segment)
        Transcriber-->>Renderer: real-time transcript updates
    end

    User->>Main: Press hotkey again
    Renderer->>IPC: endTranscriberSession()
    Transcriber-->>Renderer: meeting:saved (summaryStatus: not-started)

    Note over Renderer: Meeting recordings show "✨ Meeting details" button
    User->>Renderer: Click "Meeting details"
    Renderer->>IPC: meetings:enrich(meetingId)
    IPC->>Transcriber: triggerEnrichment()
    Transcriber->>LMStudio: POST /v1/chat/completions
    LMStudio-->>Transcriber: structured JSON (summary + decisions + action items)
    Transcriber-->>Renderer: meeting:updated (summaryStatus: ready)
```

The main process registers a global shortcut and handles all AI inference. The renderer manages audio capture via Web Audio API + VAD, streaming raw `Float32Array` segments over IPC. Whisper runs in the Node.js main process via ONNX Runtime. Structured summaries are generated on-demand via a `fetch()` call to an OpenAI-compatible endpoint (`/v1/chat/completions`) — LM Studio and Ollama both work. Nothing runs automatically after recording ends. If the inference server is unreachable when you click "Meeting details", VOA fails fast with a system notification and marks the meeting as failed — no silent errors, and you can retry at any time once a server is running. The transcript is always preserved.

---

## Example Output

Given a recorded business call, here is what each stage of the pipeline produces.

**Stage 1 — Whisper transcript** (raw speech-to-text)

```
Glad to see things are going well and business is starting to pick up. Andrea told me about
your outstanding numbers on Tuesday. Keep up the good work. Now to other business, I am going
to suggest a payment schedule for the outstanding monies that is due. One, can you pay the
balance of the license agreement as soon as possible? Two, I suggest we setup or you suggest,
what you can pay on the back royalties, would you feel comfortable with paying every two weeks?
Every month, I will like to catch up and maintain current royalties. So, if we can start the
current royalties and maintain them every two weeks as all stores are required to do, I would
appreciate it. Let me know if this works for you.
```

**Stage 2 — text-cleaner**

Strips filler words and spoken disfluencies ("um", "uh", false starts) from the raw transcript. For clean speech the output is nearly identical; the cleaner mainly targets artifacts introduced by VAD segmentation.

**Stage 3 — LM Studio structured summary** (generated on demand when you click "Meeting details")

```json
{
  "summary": "A business update call covering strong recent performance and a proposed payment
               schedule for outstanding license fees and back royalties, suggesting bi-weekly
               payments going forward.",
  "decisions": [
    "Establish bi-weekly royalty payment schedule",
    "Maintain current royalties on the same bi-weekly cadence required of all stores"
  ],
  "topics": ["payment schedule", "license agreement", "back royalties", "business performance"],
  "actionItems": [
    { "text": "Pay balance of the license agreement as soon as possible", "done": false },
    { "text": "Propose a payment amount for back royalties", "done": false },
    { "text": "Confirm bi-weekly payment schedule works", "done": false }
  ]
}
```

The summary, decisions, topics, and action items are rendered in the meeting detail view shown in the screenshot at the top of this README.

---

## Getting Started

### Requirements

- macOS 13 (Ventura) or later
- Apple Silicon or Intel Mac
- Node.js 18+
- ~500 MB disk space for the Tiny Whisper model (more for larger models)
- [LM Studio](https://lmstudio.ai) or [Ollama](https://ollama.com) — required for AI meeting summaries; transcription works without it

### Quick start

```bash
git clone https://github.com/justanotherkevin/voa.git
cd voa
npm install
npm start
```

On first run, VOA downloads the selected Whisper model (~75 MB for Tiny). Subsequent launches use the cached model.

### Permissions

VOA requires three macOS permissions to function:

| Permission       | Why                                 |
| ---------------- | ----------------------------------- |
| Microphone       | Record your voice                   |
| Accessibility    | Detect when a meeting app is active |
| Screen Recording | Capture system audio from speakers  |

VOA's built-in permissions screen walks you through granting each one.

---

## Tech Stack

| Layer                    | Technology                                       |
| ------------------------ | ------------------------------------------------ |
| Desktop shell            | Electron 35                                      |
| UI                       | React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| AI inference (ASR)       | `@xenova/transformers` (Whisper)                 |
| ONNX Runtime             | `onnxruntime-node` + `onnxruntime-web`           |
| Structured summaries     | LM Studio / Ollama (local OpenAI-compatible)     |
| Voice Activity Detection | `@ricky0123/vad-web`                             |
| Persistent storage       | `electron-store`                                 |
| Build                    | `electron-vite`, `electron-builder`              |
| Testing                  | Vitest, Playwright                               |

---

## Root Cause Analysis (RCA)

Engineering decisions made to solve non-obvious problems discovered during development.

---

<details>
<summary><strong>RCA-1: VAD Model Hallucination on Long Audio</strong> — Whisper producing looping or fabricated text on long recordings</summary>

**Root cause:** The Silero VAD model (`@ricky0123/vad-web`) is small and lightweight — it is not designed to process arbitrarily long audio streams. Feeding it a full recording caused hallucination artifacts that propagated into the Whisper transcript.

**Solution:** Real-time audio segmentation. Instead of passing a full recording blob to Whisper, VAD fires an `onSpeechEnd` callback each time speech pauses. The hook accumulates `Float32Array` frames from each burst and flushes them as a combined segment after a 500ms silence window (`PAUSE_TIMEOUT_MS`). Whisper only ever sees short, clean speech segments grouped by natural pauses — never a raw long stream.

A second edge case: when the user stops recording mid-speech via hotkey, the 500ms timer would delay or drop the final segment. This is handled by setting a `forceSendOnNextSpeechEndRef` flag before calling `.pause()`. MicVAD's `submitUserSpeechOnPause: true` causes it to fire `onSpeechEnd` on pause; the flag tells the handler to flush immediately rather than start the timer.

**Key files:** `src/renderer/hooks/useVAD.ts`, `src/renderer/utils/VadConfig.ts`

</details>

<details>
<summary><strong>RCA-2: Why we moved off on-device ONNX for structured summaries</strong> — Qwen2.5 ONNX crashes and JSON reliability drove the migration to LM Studio</summary>

Three compounding problems made on-device ONNX inference for structured summaries untenable:

**SIGTRAP crashes:** Running Qwen2.5-1.5B via `onnxruntime-node` in the Electron main process caused `SIGTRAP` crashes that killed the entire app. Isolating it to an Electron `utilityProcess` helped contain crashes but added IPC complexity.

**Quantization fragility:** `dtype: 'q4'` (1.7 GB) triggered crashes; `dtype: 'q8'` (~900 MB) did not. `onnxruntime-node` had to be pinned to `1.14.0` via `package.json` overrides — any drift reintroduced the crash.

**JSON schema reliability:** Small models (1.5B–3B parameters) cannot reliably follow strict key-name contracts. The model consistently paraphrased field names (`"summarize"` instead of `"summary"`, `"action_items"` instead of `"actionItems"`) despite explicit one-shot examples. This is a known limitation at this parameter count; reliable structured output requires 7B+ models.

**Resolution:** Migrated structured summaries to LM Studio, an OpenAI-compatible local inference server that handles model management, hardware acceleration, and model selection. The app now sends `POST /v1/chat/completions` to `http://localhost:1234` — no bundled model, no ONNX crashes, user picks any 7B+ model they already have. See `docs/lm-studio-migration.md` for the full analysis.

</details>

---

## Contributing

Issues and pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

---

## License

MIT — [Kevin Hu](https://github.com/justanotherkevin)
