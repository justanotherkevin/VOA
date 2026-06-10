# Audio-to-Text Flow Diagram

End-to-end flow from user trigger to transcribed text output.

```mermaid
flowchart TD
    subgraph ELECTRON["⚙️ Electron Main Process (Node.js)"]
        direction TB
        SM["ShortcutManager\nGlobal keyboard listener\n⌘⇧Space"]
        IPC_TOGGLE["IPC: recording:toggle"]
        IPC_START["IPC: transcriber:start\n(audio Float32Array)"]
        IPC_SESSION_START["IPC: transcriber:session-start"]
        IPC_SESSION_END["IPC: transcriber:session-end"]

        subgraph TRANSCRIBER_SVC["TranscriberService"]
            SESSION["Session Buffer\nbeginSession() / endSession()"]
            WHISPER["Whisper ASR\n@xenova/transformers"]
            CLEAN["cleanText()\nRemove disfluencies"]
            SUMMARIZE["SummarizerService\nDistilBART (optional)"]
            STYLE["StyleTransferService\nFLAN-T5 (optional)"]
        end

        STORE["electron-store\nPersist meeting entry"]
        PASTE["pasteTextToActiveWindow()\nClipboard paste"]
        IPC_CHUNKS["IPC: transcriber:chunk\n(streaming back)"]
        IPC_COMPLETE["IPC: transcriber:complete\n(final result)"]

        SM --> IPC_TOGGLE
        IPC_START --> TRANSCRIBER_SVC
        IPC_SESSION_START --> SESSION
        IPC_SESSION_END --> SESSION
        SESSION -->|"endSession: flush buffer"| STORE
        WHISPER --> CLEAN --> SUMMARIZE --> STYLE
        STYLE -->|"stream chunks"| IPC_CHUNKS
        STYLE -->|"final text"| PASTE
        STYLE -->|"final text"| IPC_COMPLETE
    end

    subgraph RENDERER["🖥️ Renderer Process (React / Browser)"]
        direction TB
        SHORTCUT_EVENT["window.electronAPI\n.onRecordingToggle()"]

        subgraph RECORDING_FLOW["useRecordingFlow"]
            TOGGLE["handleToggleRecording()"]
        end

        subgraph AUDIO_RECORDER["useAudioRecorder"]
            MEDIA_REC["MediaRecorder\naudio/webm chunks"]
            MTYPE{{"VAD\ninitialized?"}}
        end

        subgraph VAD_HOOK["useVAD (MicVAD)"]
            VAD_LISTEN["startListening()\nMicVAD.start()"]
            VAD_SPEECH["onSpeechEnd\naccumulate frames"]
            PAUSE_TIMER["500ms pause timer"]
            FLUSH["flushRemaining()\non recording stop"]
        end

        NOTIF["useNotificationFlow\nidle → recording\n→ processing → done"]
        TRANSCRIBER_HOOK["useTranscriber\n(state: isBusy, output)"]
        SEND_AUDIO["sendAudioToTranscriber()\nElectronAPIHelper"]

        SHORTCUT_EVENT --> TOGGLE
        TOGGLE -->|"start"| MEDIA_REC
        TOGGLE -->|"start"| VAD_LISTEN
        TOGGLE -->|"stop"| FLUSH
        TOGGLE --> NOTIF
        MEDIA_REC --> MTYPE
        MTYPE -->|"VAD active\nskip full-audio path"| VAD_HOOK
        MTYPE -->|"no VAD\nfull audio blob"| SEND_AUDIO
        VAD_SPEECH --> PAUSE_TIMER --> SEND_AUDIO
        FLUSH --> SEND_AUDIO
        TRANSCRIBER_HOOK -->|"output.text ready"| NOTIF
    end

    %% Cross-boundary IPC arrows
    IPC_TOGGLE -->|IPC| SHORTCUT_EVENT
    SEND_AUDIO -->|IPC| IPC_START
    TOGGLE -->|IPC| IPC_SESSION_START
    TOGGLE -->|IPC| IPC_SESSION_END
    IPC_CHUNKS -->|IPC stream| TRANSCRIBER_HOOK
    IPC_COMPLETE -->|IPC| TRANSCRIBER_HOOK

    VAD_LISTEN --> VAD_SPEECH

    %% Styling
    classDef electronNode fill:#1e3a5f,color:#e2e8f0,stroke:#3b82f6
    classDef rendererNode fill:#1a3a2a,color:#e2e8f0,stroke:#22c55e
    classDef ipcNode fill:#3b1f5e,color:#e2e8f0,stroke:#a855f7

    class SM,TRANSCRIBER_SVC,SESSION,WHISPER,CLEAN,SUMMARIZE,STYLE,STORE,PASTE electronNode
    class SHORTCUT_EVENT,TOGGLE,MEDIA_REC,MTYPE,VAD_LISTEN,VAD_SPEECH,PAUSE_TIMER,FLUSH,NOTIF,TRANSCRIBER_HOOK,SEND_AUDIO rendererNode
    class IPC_TOGGLE,IPC_START,IPC_SESSION_START,IPC_SESSION_END,IPC_CHUNKS,IPC_COMPLETE ipcNode
```

## Process Boundary

| Layer | Environment | Responsibilities |
|-------|-------------|-----------------|
| **Renderer** | Browser / React | Capture audio, VAD, UI state, notification transitions, shortcut event handling |
| **IPC Bridge** | `window.electronAPI` / `ipcMain` | Type-safe message passing; no direct Node.js or browser APIs cross the boundary |
| **Main Process** | Node.js / Electron | Whisper inference, post-processing, clipboard paste, persistent storage |

## Two Audio Paths

### Path A — VAD Mode (primary)
MicVAD segments speech in real-time → 500ms silence flushes a segment → sent immediately via IPC → Whisper transcribes → text pasted incrementally. Full MediaRecorder blob is **skipped** to avoid duplicate paste.

### Path B — Fallback (no VAD)
MediaRecorder records entire session → on stop, full blob sent via IPC → single Whisper pass → text pasted once.

## Session Lifecycle

```
startTranscriberSession(startedAt)   →  TranscriberService.beginSession()
  [VAD segments transcribed silently, buffered in sessionBuffer]
endTranscriberSession(endedAt)       →  TranscriberService.endSession()
  → joins buffer → post-processing → saveMeeting() → electron-store
```
