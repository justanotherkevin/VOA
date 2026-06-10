# Audio Transformer — Electron App Architecture Guide

## Overview

Audio Transformer is a macOS-focused Electron desktop app that records microphone and/or system audio, runs local AI transcription (Whisper/Parakeet via `@xenova/transformers`), and saves the output as "meetings" with optional summaries and style transfer.

---

## The Three Electron Processes

Every Electron app is built around three layers. Understanding where code lives is the foundation of everything else.

```
┌──────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS  (src/main/)           Node.js runtime             │
│                                                                  │
│  App lifecycle · BrowserWindow · Global shortcuts                │
│  AI transcription · electron-store · System tray                 │
│  Meeting detection · macOS permissions                           │
└────────────────────┬───────────────────┬─────────────────────────┘
                     │  IPC              │  IPC
                     ▼                  ▼
       ┌─────────────────────┐   ┌────────────────────────────────┐
       │  PRELOAD SCRIPT     │   │  RENDERER PROCESS              │
       │  src/main/preload.ts│   │  src/renderer/                 │
       │                     │   │                                │
       │  contextBridge  →   │   │  React + shadcn/ui + Tailwind  │
       │  window.electronAPI │   │  Hooks · Pages · Components    │
       └─────────────────────┘   └────────────────────────────────┘
```

- **Main process** — runs with full Node.js/Electron access. Cannot touch the DOM.
- **Preload script** — runs in a sandboxed context bridging both worlds. Exposes a typed API (`window.electronAPI`) to the renderer.
- **Renderer process** — a Chromium tab. No direct Node.js access; communicates only through `window.electronAPI`.

---

## Full Folder Structure

```
voa/
│
├── src/
│   │
│   ├── main/                            ← Main process (Node.js)
│   │   ├── main.ts                      ← Entry: creates windows, inits all services
│   │   ├── preload.ts                   ← contextBridge API + Channels type definition
│   │   ├── store.ts                     ← Persistent storage (electron-store)
│   │   ├── transcriberService.ts        ← AI transcription orchestrator (singleton)
│   │   ├── shortcut-manager.ts          ← Global hotkey registration (singleton)
│   │   ├── notification-window.ts       ← Frameless always-on-top overlay window
│   │   ├── meeting-detector.ts          ← Polls active window for Zoom/Teams/Meet
│   │   ├── permissions-service.ts       ← macOS mic/accessibility/screen checks
│   │   ├── active-window.ts             ← Native active window detection (macOS)
│   │   ├── menu.ts                      ← Platform-specific app menu builder
│   │   ├── model-cache.ts               ← ONNX model file cache management
│   │   └── util.ts                      ← Path resolution, isDebug, pasteText
│   │
│   │   ├── ipc/                         ← IPC handlers (one file per domain)
│   │   │   ├── index.ts                 ← Registers all handlers (called from main.ts)
│   │   │   ├── transcriber.ts           ← transcriber:start / session-start / session-end
│   │   │   ├── settings.ts              ← Model prefs, ASR type config
│   │   │   ├── meetings.ts              ← Meeting CRUD + meeting preferences
│   │   │   ├── shortcuts.ts             ← Get/update global shortcut bindings
│   │   │   └── notifications.ts         ← Notification window state + active window
│   │   │
│   │   ├── transcriber/                 ← AI pipeline components
│   │   │   ├── index.ts                 ← Exports default whisperTranscriber instance
│   │   │   ├── types.ts                 ← AsrTranscriber interface
│   │   │   ├── asr-factory.ts           ← Factory: creates Whisper or Parakeet
│   │   │   ├── whisper-transcriber.ts   ← Whisper ONNX implementation
│   │   │   ├── text-cleaner.ts          ← Cleans raw transcription artifacts
│   │   │   ├── summarizer.ts            ← Optional text summarization
│   │   │   └── style-transfer.ts        ← Optional writing style matching
│   │   │
│   │   ├── ipcWrapper/                  ← Preload-side wrappers (used by preload.ts)
│   │   │   └── audioCapture.ts          ← desktopCapturer API for system audio
│   │   │
│   │   ├── models/                      ← Electron-specific singleton modules
│   │   │   ├── tray.ts                  ← System tray icon + menu
│   │   │   └── debugger.ts              ← DevTools installer (dev-only)
│   │   │
│   │   └── utils/
│   │       ├── audioHelper.ts           ← Audio buffer decode helpers
│   │       └── common.ts                ← Shared main-process utilities
│   │
│   ├── renderer/                        ← React frontend (Chromium/browser)
│   │   ├── App.tsx                      ← Root: routing, hook wiring, status
│   │   ├── index.tsx                    ← ReactDOM.render entry point
│   │   ├── index.html                   ← Main window HTML + CSP meta tag
│   │   ├── notification.html            ← Notification overlay HTML
│   │   ├── Notification.tsx             ← Notification overlay React component
│   │   └── preload.d.ts                 ← TS types for window.electronAPI
│   │
│   │   ├── pages/                       ← Full-page route components
│   │   │   ├── Meetings.tsx             ← Primary view: meeting list + detail
│   │   │   ├── Settings.tsx             ← Model, shortcut, recording config
│   │   │   ├── Permissions.tsx          ← Permission grant/status UI
│   │   │   ├── Dictionary.tsx           ← Custom vocabulary
│   │   │   └── StyleMatching.tsx        ← Writing style preference
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                      ← Feature-level composed components
│   │   │   │   ├── MainLayout.tsx       ← App shell with sidebar
│   │   │   │   ├── Sidebar.tsx          ← Navigation + status indicator
│   │   │   │   ├── MeetingList.tsx      ← Scrollable past meetings list
│   │   │   │   ├── MeetingDetail.tsx    ← Single meeting view/edit
│   │   │   │   ├── Transcript.tsx       ← Transcript + timestamp chips
│   │   │   │   ├── AIModel.tsx          ← Model selector UI
│   │   │   │   ├── ShortcutConfigDialog.tsx  ← Hotkey recorder dialog
│   │   │   │   └── ...
│   │   │   ├── button.tsx               ← shadcn/ui Button
│   │   │   ├── card.tsx                 ← shadcn/ui Card
│   │   │   ├── GlassSurface.tsx         ← Frosted glass container
│   │   │   ├── live-waveform.tsx        ← Real-time audio waveform
│   │   │   └── icons/                   ← Custom SVG icon components
│   │   │
│   │   ├── hooks/                       ← All renderer business logic lives here
│   │   │   ├── useRecordingFlow.ts      ← Orchestrates record → transcribe lifecycle
│   │   │   ├── useAudioRecorder.ts      ← MediaRecorder + VAD integration
│   │   │   ├── useSystemAudioRecorder.ts← desktopCapturer system audio recording
│   │   │   ├── useVAD.ts                ← Voice Activity Detection (MicVAD)
│   │   │   ├── useTranscriber.ts        ← Transcription state + IPC listeners
│   │   │   ├── useNotificationFlow.ts   ← Notification state transitions
│   │   │   ├── useNotifications.ts      ← Notification overlay state machine
│   │   │   ├── useMeetings.ts           ← Meeting list CRUD state
│   │   │   ├── useMeetingDetector.ts    ← IPC listeners for meeting detection
│   │   │   ├── useModelPreferences.ts   ← Model config get/set
│   │   │   ├── useShortcuts.ts          ← Shortcut preferences
│   │   │   ├── usePermissions.ts        ← Permission check/refresh
│   │   │   └── useTranscriptHistory.ts  ← Legacy transcript history
│   │   │
│   │   ├── contexts/
│   │   │   ├── PermissionsContext.ts    ← Permission state context definition
│   │   │   └── PermissionsProvider.tsx  ← Context provider wrapper
│   │   │
│   │   ├── utils/
│   │   │   ├── RecordingUtils.ts        ← Blob → Float32Array + IPC transcribe call
│   │   │   ├── AudioUtils.ts            ← Audio resampling / channel mixing
│   │   │   ├── TranscriberListeners.ts  ← Consolidates 6+ IPC event listener setups
│   │   │   ├── ElectronAPIHelper.ts     ← Typed window.electronAPI wrappers
│   │   │   ├── VadConfig.ts             ← VAD CDN asset path configuration
│   │   │   └── BlobFix.ts               ← Safari/Electron Blob mime type patches
│   │   │
│   │   └── testing/
│   │       └── TestHooks.ts             ← E2E test seams exposed on window object
│   │
│   ├── lib/                             ← Shared code (main + renderer)
│   │   ├── Constants.ts                 ← App-wide constants
│   │   ├── shortcuts.ts                 ← Shortcut key label helpers
│   │   └── utils.ts                     ← shadcn/ui cn() utility
│   │
│   ├── __tests__/                       ← Integration/component tests (Vitest)
│   ├── __mocks__/                       ← Mock implementations
│   └── testing/                         ← Shared test helpers (mediaMocks, electronMocks)
│
├── tests/
│   └── e2e/                             ← End-to-end tests (Playwright + Electron)
│       ├── fixtures*.ts                 ← Dev + prod test fixtures
│       ├── mocks/                       ← Audio files + keyboard/mic mocks
│       └── utils/                       ← Dictation flow helpers, reporters
│
├── assets/                              ← Static assets: icons, images
├── docs/                                ← Developer documentation
├── public/                              ← Vite public dir (WASM, model files)
│
├── electron.vite.config.ts              ← Build config (main + preload + renderer)
├── vite.renderer.config.ts              ← Renderer-only Vite overrides
├── vitest.config.ts                     ← Unit test runner config
├── playwright.config.ts                 ← E2E dev mode config
├── playwright.build.config.ts           ← E2E production build config
├── tailwind.config.cjs                  ← Tailwind CSS config
├── postcss.config.cjs                   ← PostCSS + Tailwind v4 plugin
└── components.json                      ← shadcn/ui component generator config
```

---

## IPC Communication — How Main and Renderer Talk

All cross-process communication goes through `ipcMain` (main side) and `window.electronAPI` (renderer side). Direct imports between the two processes are impossible and intentional.

### Channel Naming Convention

```
feature:action
─────────────
transcriber:start
meetings:get-all
shortcuts:updateRecordingToggle
notification:update-state
```

### Request-Response (invoke/handle)

Used when the renderer needs data back from main. Renderer sends a request; main returns a Promise.

```
Renderer                    Preload                    Main
   │                           │                         │
   │ window.electronAPI        │                         │
   │ .meetings.getAll()        │                         │
   ├──────────────────────────►│ ipcRenderer.invoke()   │
   │                           ├────────────────────────►│ ipcMain.handle()
   │                           │                         │  return meetings[]
   │                           │◄────────────────────────┤
   │◄──────────────────────────┤ Promise resolves        │
```

### Push Events (send/on)

Used when main needs to push data to renderer unprompted (e.g. transcription progress, shortcut fired).

```
Main                        Preload                    Renderer
  │                           │                           │
  │ webContents.send()        │                           │
  ├──────────────────────────►│ ipcRenderer.on()         │
  │                           ├──────────────────────────►│ callback fires
  │                           │   'transcriber:update'    │ updates React state
```

### Preload as the Contract Layer

`src/main/preload.ts` defines two things that make the whole system safe and typed:

1. **`Channels` union type** — every valid channel name listed. TypeScript catches typos at compile time.
2. **`window.electronAPI` namespace** — organizes raw IPC calls into readable domain namespaces (`electronAPI.transcriber.start()`, `electronAPI.meetings.getAll()`, etc.).

The renderer only ever touches `window.electronAPI`. It never imports from Electron or Node.js.

---

## Core Recording and Transcription Pipeline

This is the main feature flow — from pressing a hotkey to a saved meeting.

```
User presses shortcut
        │
        ▼
ShortcutManager (main)
  globalShortcut fires
  webContents.send('recording:toggle')
        │
        ▼ IPC push
useRecordingFlow (renderer)
  handleToggleRecording()
        │
        ├──► useAudioRecorder.startRecording()   ← mic via MediaRecorder
        ├──► useSystemAudioRecorder.start()      ← system audio (optional)
        ├──► useVAD.startListening()             ← VAD speech detection
        └──► electronAPI.transcriber.startSession()  ← tells main to start buffering
                │
                ▼ (VAD speech segments fire continuously)
        useVAD.onSpeechEnd → RecordingUtils
          → electronAPI.transcriber.start(audioData)
                │
                ▼ IPC invoke
        TranscriberService.transcribe() (main)
          → Whisper/Parakeet ONNX inference
          → text-cleaner → style-transfer
          → session buffer appended (not saved yet)
          → webContents.send('transcriber:complete', segmentText)
                │
                ▼ IPC push
        useTranscriber (renderer) updates output.text

User presses shortcut again
        │
        ▼
useRecordingFlow.handleToggleRecording()
  → stopRecording() / stopSystemRecording()
  → showProcessing notification
  → finalizeRecordingAndTranscribe() (full audio blob as fallback)
  → when transcriber.isBusy === false:
      electronAPI.transcriber.endSession(endedAt)
                │
                ▼ IPC invoke
        TranscriberService.endSession() (main)
          → joins all buffered segments
          → getSummary()
          → saveMeeting() → electron-store
          → webContents.send('meetings:saved', meeting)
          → webContents.send('transcriber:complete', fullText)
                │
                ▼ IPC push
        useMeetings (renderer) auto-refreshes meeting list
        useRecordingFlow → showDone → showIdle
```

### Notification State Machine

The notification overlay follows a strict state machine. **Main only sends `recording:toggle`; renderer drives all other state transitions.**

```
idle → recording → recording-stopped → processing → done → idle
```

---

## Startup Sequence

`app.whenReady()` in `main.ts` runs these in order:

1. `initializeStore()` — loads/migrates electron-store data
2. `permissionsService.refresh()` — caches macOS permission status
3. `createWindow()` — creates main BrowserWindow and registers all IPC handlers
4. `createNotificationWindow()` — creates hidden frameless overlay (reused across recordings)
5. `createTray(mainWindow)` — system tray icon
6. `shortcutManager.setupDefaultShortcuts(mainWindow)` — registers global hotkey
7. `meetingDetector.start(mainWindow)` — starts polling for active meeting apps

---

## Build System

The project uses **electron-vite**, which bundles all three processes independently.

| Process | Entry | Output |
|---------|-------|--------|
| Main | `src/main/main.ts` | `dist/main/` |
| Preload | `src/main/preload.ts` | `dist/preload/` (CJS) |
| Renderer | `src/renderer/index.html` | `dist/renderer/` |

The renderer builds two HTML entry points: `index.html` (main window) and `notification.html` (overlay).

Path alias `@/` maps to `src/` in all three bundles via `vite-tsconfig-paths`.

---

## Testing Strategy

| Layer | Framework | Location |
|-------|-----------|----------|
| Unit / Component | Vitest + jsdom + Testing Library | `src/__tests__/`, `src/renderer/hooks/__tests__/` |
| Main process unit | Vitest | `src/main/__tests__/` |
| E2E (dev mode) | Playwright + Electron | `tests/e2e/` + `playwright.config.ts` |
| E2E (production) | Playwright + Electron | `tests/e2e/` + `playwright.build.config.ts` |

E2E tests use Playwright's Electron integration. Test seams are exposed through `src/renderer/testing/TestHooks.ts`, which attaches helpers to `window` so Playwright can trigger recording flows without physical hardware.

---

## Comparison to a Typical Electron App

### What This App Does Well

| Practice | Status |
|----------|--------|
| Preload contextBridge (no `nodeIntegration: true`) | ✅ Correctly sandboxed |
| Typed IPC channels (`Channels` union) | ✅ TypeScript catches channel typos |
| IPC organized by domain (`ipc/transcriber.ts`, `ipc/meetings.ts`) | ✅ Clear separation |
| Business logic in hooks, not components | ✅ `useRecordingFlow`, `useTranscriber`, etc. |
| Singleton services (TranscriberService, ShortcutManager) | ✅ Single source of truth |
| electron-store for persistence | ✅ Standard pattern |
| Separate notification window (frameless, always-on-top) | ✅ Good UX pattern |
| E2E tests with Playwright | ✅ Above average for Electron apps |

### Areas for Improvement

**1. `ipcWrapper/` folder is ambiguously named**

`src/main/ipcWrapper/audioCapture.ts` sounds like it belongs in `ipc/`, but it's actually a preload-side module imported directly by `preload.ts`. A clearer name would be `src/main/preload-api/audioCapture.ts` or moving it inside a `preload/` subfolder.

**2. `models/` folder naming is confusing**

`src/main/models/` contains `tray.ts` and `debugger.ts` — neither is a data model. In typical Electron apps, "models" means data shapes. Renaming this to `src/main/services/` or `src/main/electron/` would better reflect that these are Electron-specific singleton modules.

**3. `transcriberService.ts` is both an orchestrator and a pipeline step**

`TranscriberService` handles: session management, model switching, post-processing (style transfer, summarization, text cleaning), meeting persistence, and IPC communication. This is a lot for one class. As the pipeline grows, splitting into:
- `SessionManager` — session start/end, segment buffering
- `TranscriptionPipeline` — model init, inference, post-processing
- Keeping `TranscriberService` as a thin coordinator

...would make each piece independently testable.

**4. Renderer utils/ folder has mixed responsibilities**

`src/renderer/utils/` contains audio processing (`AudioUtils.ts`), IPC wrappers (`TranscriberListeners.ts`, `ElectronAPIHelper.ts`), and Blob patches (`BlobFix.ts`). Splitting into `utils/audio/` and `utils/ipc/` would make it easier to find things as the codebase grows.

**5. No shared types package between main and renderer**

Types like `Meeting` are defined in `src/main/store.ts` and re-imported by the renderer. In a typical larger Electron app, a `src/shared/types/` folder holds interfaces that both processes import, making the contract explicit and avoiding indirect dependency chains across process boundaries.

**6. `src/lib/` vs `src/renderer/utils/` distinction is clear**

`src/lib/` is strictly for code safe on BOTH main and renderer (no DOM, no Electron APIs):
- `Constants.ts` — app-wide configuration (models, languages, audio settings)
- `shortcuts.ts` — keyboard shortcut definitions
- `ipc-channels.ts` — IPC channel name constants

`src/renderer/utils/` is for renderer-only utilities:
- `cn()` — Tailwind class merging (requires `clsx` + `tailwind-merge`, DOM-specific)
- `AudioUtils.ts`, `RecordingUtils.ts` — audio/browser-specific helpers
- Anything that imports React or browser APIs

**Why this matters**: Prevents accidental imports of renderer-only code (or DOM APIs) into the main process, which would cause crashes. The rule is enforced by convention and reviewer awareness.

---

## Key Files Reference

| File | What to read when... |
|------|----------------------|
| `src/main/main.ts` | Understanding startup order, window creation |
| `src/main/preload.ts` | Understanding the full IPC API surface |
| `src/main/ipc/index.ts` | Adding a new IPC handler domain |
| `src/main/transcriberService.ts` | Debugging transcription or session behavior |
| `src/main/store.ts` | Understanding data persistence, Meeting shape |
| `src/renderer/hooks/useRecordingFlow.ts` | Tracing the end-to-end recording flow |
| `src/renderer/hooks/useTranscriber.ts` | Understanding how the renderer tracks transcription state |
| `src/renderer/App.tsx` | Understanding routing, top-level hook wiring |
| `electron.vite.config.ts` | Understanding the build pipeline |
