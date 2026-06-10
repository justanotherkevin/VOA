# App Architecture

Three layers: **Frontend** (audio capture + UI) | **App State** (state machine + queue + storage) | **Backend** (transcription pipeline).

---

## 1. System Overview

High-level three-column view. Start here.

```mermaid
flowchart LR
  FE["🖥️ Frontend<br> (Renderer Process)<br> <br> Captures audio<br> Displays UI<br> Subscribes to state"]

  SM["⚡ App State<br> (Main Process)<br> <br> State machine<br> Audio process queue<br> Storage"]

  BE["⚙️ Backend<br> (Main Process)<br> <br> TranscriberService<br> Whisper ASR<br> Post-processing"]

  FE -- "IPC: state update<br> (recording start / stop)" --> SM
  FE -- "IPC: audio Float32Array<br> → enqueue" --> SM
  SM -- "subscribed to queue<br> → dequeue + process" --> BE
  BE -- "transcribed text<br> → save" --> SM
  SM -- "app status broadcast" --> FE
  SM -- "transcribed text broadcast" --> FE
  SHORTCUT["⌨️ ShortcutManager<br> (Main Process)<br> global ⌘⇧Space"] -- "recording:toggle<br> → trigger start" --> FE
```

---

## 2. Frontend Detail

What lives in the renderer process.

```mermaid
flowchart TD
  SHORTCUT_IN["← recording:toggle<br> from ShortcutManager"]
  STATE_IN["← app status broadcast<br> from state machine"]
  TEXT_IN["← transcribed text broadcast<br> from state machine"]

  subgraph FRONTEND["🖥️ Frontend  (Renderer / Browser APIs)"]
    direction TB

    subgraph RECORDING["Recording Flow"]
      START["Start audio recording"]
      BRANCH{{"VAD<br> enabled?"}}
      VAD_INIT["Initialize MicVAD<br> (starts in paused state)"]
      VAD_START["MicVAD.start()<br> listen for pause in speech"]
      VAD_DETECT["MicVAD<br> onSpeechEnd → raw frames<br> (fires during recording)"]
      CAPTURE["Capture audio<br> (MediaRecorder blob)"]
      STOP["Audio recording end"]
      VAD_FLUSH["MicVAD.pause()<br> flush remaining frames"]
      CONVERT["Blob → Float32<br> audio sample collection"]
    end

    subgraph DISPLAY["UI"]
      TEXT_DISPLAY["Transcribed text display<br> subscribes to text broadcast"]
      NOTIF["Notification window<br> subscribes to app status"]
    end
  end

  AUDIO_OUT["→ IPC: audio Float32Array<br> enqueue in audio process queue"]
  STATE_OUT["→ IPC: state update<br> to state machine"]

  SHORTCUT_IN --> START
  START --> STATE_OUT
  START --> CLEAR["IPC: clear session buffer<br> (sent before first audio)"]
  START --> BRANCH
  BRANCH -- "VAD yes" --> VAD_INIT
  BRANCH -- "VAD no" --> CAPTURE
  VAD_INIT --> VAD_START
  VAD_START -- detects pause --> VAD_DETECT
  VAD_DETECT -- "segment ready<br> {sessionId, audio, isLastSegment:false}" --> AUDIO_OUT
  VAD_START --> STOP
  CAPTURE --> STOP
  STOP --> VAD_FLUSH
  STOP --> STATE_OUT
  VAD_FLUSH -- "{sessionId, audio, isLastSegment:true}" --> AUDIO_OUT
  STOP -- "VAD no" --> CONVERT
  CONVERT -- "{sessionId, audio, isLastSegment:true}" --> AUDIO_OUT
  STATE_IN --> NOTIF
  TEXT_IN --> TEXT_DISPLAY
```

---

## 3. App State / State Machine Detail

The central coordinator. Frontend and backend both connect through here.

```mermaid
flowchart TD
  FE_STATE_IN["← IPC: state update<br> from frontend"]
  FE_AUDIO_IN["← IPC: Float32Array<br> from frontend"]
  BE_TEXT_IN["← transcribed text<br> from TranscriberService"]

  subgraph MIDDLE["⚡ App State  (Main Process)"]
    direction TB

    subgraph STATE_MACHINE["State Machine"]
      IDLE(["idle"])
      RECORDING(["recording"])
      PROCESSING(["processing"])
      DONE(["done"])
      IDLE --> RECORDING
      RECORDING --> PROCESSING
      PROCESSING --> DONE
      DONE --> IDLE
    end

    subgraph QUEUE["Audio Process Queue"]
      Q_IN["enqueue<br> {sessionId, audio: Float32Array,<br> isLastSegment: boolean}"]
      Q_PROC["dequeue<br> → send to TranscriberService"]
      Q_LOOP["wait for segment done<br> → dequeue next"]
      Q_IN --> Q_PROC --> Q_LOOP --> Q_PROC
    end

    subgraph STORAGE["Storage  (electron-store)"]
      SAVE["save meeting<br> text + metadata"]
      READ["read meetings<br> preferences · shortcuts"]
    end

    STATE_MACHINE -- "state changed<br> → broadcast" --> BROADCAST["broadcast<br> app status to frontend<br> + notification window"]
    BE_TEXT_IN --> SAVE
    BE_TEXT_IN --> STATE_MACHINE
  end

  QUEUE_OUT["→ subscribed by TranscriberService<br> dequeue trigger"]

  FE_STATE_IN --> STATE_MACHINE
  FE_AUDIO_IN --> Q_IN
  Q_PROC --> QUEUE_OUT
```

---

## 4. Backend Detail

Pure processing. No state ownership. Subscribes to the queue, returns text.

```mermaid
flowchart TD
  QUEUE_IN["← dequeue trigger<br> from audio process queue<br> (Float32Array segment)"]

  subgraph BACKEND["⚙️ Backend  (Main Process)"]
    direction TB

    subgraph TSVC["TranscriberService"]
      CLEAR_BUF["on session start:<br> clear session buffer"]
      SESSION["Session buffer<br> accumulates transcribed text<br> per sessionId"]
      WHISPER["Whisper ASR<br> @xenova/transformers<br> speech → raw text"]
      CLEAN["cleanText<br> remove disfluencies"]
      SUMM["SummarizerService<br> DistilBART  (optional)"]
      STYLE["StyleTransferService<br> FLAN-T5  (optional)"]
      LAST{{"isLastSegment?"}}
    end

    CLIP["pasteToActiveWindow<br> clipboard inject<br> (once per session)"]
  end

  TEXT_OUT["→ final transcribed text<br> to state machine → storage<br> + broadcast to frontend"]
  PARTIAL_OUT["→ partial text broadcast<br> to notification window (live preview)"]

  QUEUE_IN --> CLEAR_BUF
  CLEAR_BUF --> WHISPER
  WHISPER --> CLEAN --> SUMM --> STYLE
  STYLE --> SESSION
  SESSION --> PARTIAL_OUT
  SESSION --> LAST
  LAST -- "no: wait for next segment" --> QUEUE_IN
  LAST -- "yes: concatenate buffer" --> CLIP
  CLIP --> TEXT_OUT
```

---

## 5. State Machine States

```mermaid
stateDiagram-v2
  [*] --> idle

  idle      --> recording   : TOGGLE_START<br> (shortcut or meeting auto-detect)
  recording --> processing  : TOGGLE_STOP
  processing --> done       : TRANSCRIPTION_COMPLETE
  done      --> idle        : RESET  (300ms after done)

  recording --> error : ERROR
  processing --> error : ERROR
  error --> idle : RESET

  note right of recording
    Broadcasts "recording" state
    to frontend + notification window
  end note

  note right of processing
    Audio queue drains here.
    Each segment dequeued → TranscriberService → done signal
  end note
```

---

## 6. IPC Channel Map

| Channel                     | Direction       | Trigger                 | Purpose                                          |
| --------------------------- | --------------- | ----------------------- | ------------------------------------------------ |
| `recording:toggle`          | Main → Renderer | Global shortcut ⌘⇧Space | Tell frontend to start recording                 |
| `recording:event`           | Renderer → Main | User starts / stops     | Drive state machine (TOGGLE_START, TOGGLE_STOP)  |
| `recording:state-changed`   | Main → Renderer | Every state transition  | Frontend + notification window subscribe to this |
| `session:clear`             | Renderer → Main | Recording start         | Clear session buffer before first audio arrives  |
| `vad:frame`                 | Renderer → Main | MicVAD onSpeechEnd      | Raw Float32Array → enqueue {sessionId, audio, isLastSegment} |
| `transcriber:chunk`         | Main → Renderer | Whisper streaming       | Partial transcript for live display              |
| `transcriber:complete`      | Main → Renderer | Pipeline finished       | Final text + metadata                            |
| `meeting-detector:detected` | Main → Renderer | Active window poll      | Auto-start prompt                                |
| `meeting-detector:ended`    | Main → Renderer | Active window poll      | Auto-stop                                        |
| `meetings:get-all`          | Renderer → Main | Page load               | Read stored meetings                             |
| `meetings:saved`            | Main → Renderer | After save completes    | Push refresh to Meetings page                    |
