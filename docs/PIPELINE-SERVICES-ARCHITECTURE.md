# Pipeline vs Services Architecture

## Overview

The main process is organized into two distinct layers that work together to handle application workflows:

- **Pipeline** — Stateless transformations and ASR (automatic speech recognition)
- **Services** — Stateful orchestrators and business logic

This separation ensures that low-level transformations (ASR, text processing) remain testable in isolation, while high-level coordination (session management, preferences) stays in the service layer.

**The core rule:** Services call pipeline. Pipeline never imports services.

---

## The Pipeline Layer

**Location:** `src/main/pipeline/`

### Purpose

The pipeline contains **stateless, functional transformations** that know nothing about the application's domain. Each module handles one transformation step and can be tested without Electron, a running app, or any application context.

### Characteristics

- **No application context** — Don't know about meetings, sessions, users, or preferences
- **No Electron imports** — Can run in Node.js without Electron
- **Owned state only** — Each module manages only its own internal state (model lifecycle, initialization promises)
- **Invoked, not autonomous** — Wait to be called; don't reach out to other layers
- **Testable in isolation** — Unit test with `vitest` and mock data; no IPC, no window, no store needed

### Modules

| Module | Purpose | Input | Output |
|--------|---------|-------|--------|
| **`whisper-transcriber.ts`** | Xenova Whisper ASR | audio samples (Float32Array) | transcription chunks + final result |
| **`asr-factory.ts`** | ASR instantiation | model config (name, quantization) | `AsrTranscriber` instance |
| **`summarizer.ts`** | DistilBART summarization | transcript text | summary text |
| **`style-transfer.ts`** | FLAN-T5 text transformation | transcript + style mode | transformed text |
| **`text-cleaner.ts`** | Disfluency removal | transcript text | cleaned text |
| **`types.ts`** | Interface definitions | — | `AsrTranscriber`, `TranscriptionResult` |

### Example: Transcriber Lifecycle

```typescript
// pipeline/whisper-transcriber.ts (simplified)
class WhisperTranscriber {
  private transcriber: Transformers.AutomaticSpeechRecognition | null = null;

  async initialize(model: string, quantized: boolean): Promise<void> {
    // Lazy init: load model on first use
    this.transcriber = await pipeline(
      'automatic-speech-recognition',
      { model, quantize: quantized }
    );
  }

  async transcribe(audio: Float32Array): Promise<TranscriptionChunk> {
    // Pure transformation: input audio → output text
    const result = await this.transcriber!({ raw: true, sampling_rate: 16000 }, audio);
    return { text: result[0].transcript };
  }
}

export const whisperTranscriber = new WhisperTranscriber();
```

The pipeline **owns when it initializes** (lazy, on first use) and **how it caches** (internally deduplicates promises). The service layer doesn't care.

---

## The Services Layer

**Location:** `src/main/services/`

### Purpose

Services **coordinate business logic and state** across the application. They know about the domain (meetings, recordings, preferences) and orchestrate pipeline modules to implement workflows.

### Characteristics

- **Application-aware** — Understand meetings, sessions, user preferences, permissions
- **Stateful** — Manage buffers, caches, flags, and state machines
- **Orchestrators** — Call multiple pipeline modules in sequence
- **Event emitters** — Send IPC events to the renderer on state changes
- **Store integrators** — Read preferences, write persistent data
- **Can use Electron APIs** — Retrieve window references for IPC; integrate with app lifecycle

### Services

| Service | Purpose | Responsibilities |
|---------|---------|------------------|
| **`transcriber.ts`** | ASR pipeline orchestration | Session management (begin/end), segment buffering, model selection, async enrichment (summary, style-transfer), IPC callbacks |
| **`permissions.ts`** | Permission state tracking | Caches system permissions, emits change events, wraps OS permission APIs |
| **`meeting-detector.ts`** | Meeting detection polling | Polls active window every 5s, detects meeting entry/exit, emits IPC events, tracks dismissal state |

### Example: TranscriberService

```typescript
// src/main/services/transcriber.ts
export class TranscriberService {
  private sessions = new Map<number, SessionBuffer>();
  private transcriber: AsrTranscriber | null = null;

  beginSession(startedAt: number): void {
    // State management: open a new session buffer
    const sessionId = Date.now();
    this.sessions.set(sessionId, {
      startedAt,
      segments: [],
      // ...
    });
  }

  async transcribe(args: TranscribeArgs, callbacks: TranscriberCallbacks): Promise<void> {
    // Orchestration: delegate to pipeline
    const prefs = getModelPreferences(); // Read preferences from store

    await this.transcriber.initialize(prefs.model, prefs.quantized);
    const result = await this.transcriber.transcribe(args.audio);

    // Business logic: buffer, enrich, emit
    const session = this.sessions.get(args.sessionId);
    session.segments.push(result);

    callbacks.onUpdate(result); // IPC event to renderer
  }

  async endSession(endedAt: number, callbacks: TranscriberCallbacks): Promise<void> {
    // State management: close session, persist, then enrich asynchronously
    const session = this.sessions.get(endedAt);
    const meeting = await saveMeeting({
      transcript: session.segments.map(s => s.text).join(' '),
      startedAt: session.startedAt,
      summary: null, // pending
    });

    callbacks.onMeetingSaved(meeting); // IPC event: meeting created (summary pending)

    // Enrich asynchronously (don't block endSession)
    this.enrichMeetingWithSummary(meeting.id, callbacks);
  }

  private async enrichMeetingWithSummary(
    meetingId: string,
    callbacks: TranscriberCallbacks,
  ): Promise<void> {
    // Background work: call pipeline modules without blocking
    const transcript = getMeeting(meetingId).transcript;

    const summary = await summarizerService.summarize(transcript);
    // Pipeline called here; pipeline doesn't know about this service or the meeting

    updateMeeting(meetingId, { summary });
    callbacks.onMeetingSaved(getMeeting(meetingId)); // IPC event: meeting updated
  }
}
```

The service **orchestrates**, **manages state**, **integrates with store/preferences**, and **emits IPC events**. The pipeline modules are **called** but don't know they're being called or by whom.

---

## The Boundary

### What Pipeline Can Do

✅ Load AI models (with lazy initialization and deduplication)  
✅ Transform text (summarize, style-transfer, clean)  
✅ Transcribe audio  
✅ Export singletons for reuse  
✅ Own internal state (model cache, initialization promises)  

### What Pipeline Cannot Do

❌ Import services  
❌ Call IPC (`ipcMain.handle`, `webContents.send`)  
❌ Read from the store or preferences  
❌ Understand application context (meetings, sessions, users)  
❌ Call `getMainWindow()` or retrieve window references  

### What Services Can Do

✅ Call pipeline modules  
✅ Manage state and buffers  
✅ Read preferences and store data  
✅ Emit IPC events via `webContents.send()`  
✅ Understand and enforce business logic  

### What Services Cannot Do

❌ Duplicate low-level logic already in pipeline  
❌ Expose raw IPC handlers (those belong in `ipc/` layer)  
❌ Manage UI state (that's the renderer's job)  

---

## Interaction Patterns

### Pattern 1: Request-Response via IPC

The renderer requests transcription. The flow:

```
Renderer → IPC Handler → Service → Pipeline → Back to Renderer via Callbacks
```

```typescript
// 1. Renderer sends audio
window.electronAPI.transcriber.transcribe({ audio, sessionId });

// 2. IPC handler routes to service
// src/main/ipc/transcriber.ts
ipcMain.handle('transcriber:start', async (event, args) => {
  const callbacks = makeCallbacks(event); // Create callback wrappers
  return transcriberService.transcribe(args, callbacks);
});

// 3. Service orchestrates pipeline
// src/main/services/transcriber.ts
async transcribe(args, callbacks) {
  const result = await this.transcriber.transcribe(args.audio); // Call pipeline
  this.buffer(result); // Service state management
  callbacks.onUpdate(result); // Emit IPC event back
}

// 4. Pipeline does the work (knows nothing about service/IPC)
// src/main/pipeline/whisper-transcriber.ts
async transcribe(audio) {
  return this.transcriber({ raw: true }, audio); // Pure transformation
}
```

### Pattern 2: Background Enrichment

After a session ends, the service asynchronously enriches the meeting without blocking the response:

```typescript
endSession(endedAt, callbacks) {
  const meeting = saveMeeting({ transcript, summary: null }); // Save pending
  callbacks.onMeetingSaved(meeting); // Notify renderer immediately

  this.enrichMeetingWithSummary(meeting.id, callbacks); // Fire and forget
}

async enrichMeetingWithSummary(meetingId, callbacks) {
  const summary = await summarizerService.summarize(transcript); // Call pipeline
  updateMeeting(meetingId, { summary }); // Update store
  callbacks.onMeetingSaved(getMeeting(meetingId)); // Notify renderer of update
}
```

The pipeline (`summarizerService`) is called, but it doesn't know it's enriching a meeting or that an IPC event will follow. It just transforms text.

---

## Adding New Features

### Scenario 1: Add a New Text Transformation

**Pipeline-only change:**

1. Create `src/main/pipeline/new-transformer.ts`
2. Implement stateless transformation
3. Unit test without Electron

```typescript
// src/main/pipeline/sentiment-analyzer.ts
export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  const classifier = await pipeline('zero-shot-classification', { model: '...' });
  const result = await classifier(text, ['positive', 'negative', 'neutral']);
  return result;
}
```

4. Service calls it when needed

```typescript
// src/main/services/transcriber.ts
const sentiment = await sentimentAnalyzer.analyzeSentiment(transcript);
```

### Scenario 2: Add a New Workflow (e.g., Auto-Tagging)

**Service + Pipeline change:**

1. **Pipeline:** Create `src/main/pipeline/tagger.ts` (stateless transformer)
   ```typescript
   export async function suggestTags(transcript: string): Promise<string[]> {
     // ML model + transformation
   }
   ```

2. **Service:** Add orchestration to `services/transcriber.ts`
   ```typescript
   async enrichMeetingWithTags(meetingId: string): Promise<void> {
     const transcript = getMeeting(meetingId).transcript;
     const tags = await taggerService.suggestTags(transcript); // Call pipeline
     updateMeeting(meetingId, { tags });
   }
   ```

3. **IPC:** Add handler in `ipc/transcriber.ts` if user needs on-demand tagging
   ```typescript
   ipcMain.handle('transcriber:tag', async (_event, meetingId) => {
     await transcriberService.enrichMeetingWithTags(meetingId);
   });
   ```

The pipeline module (`tagger`) doesn't know about meetings, the service, or IPC. It just transforms.

---

## Testing Strategy

### Pipeline Modules (Unit Tests)

Test without Electron, store, or IPC:

```typescript
// src/main/pipeline/__tests__/summarizer.test.ts
import { summarize } from '../summarizer';

it('should summarize a transcript', async () => {
  const transcript = 'Alice said... Bob replied... Alice concluded...';
  const summary = await summarize(transcript);
  expect(summary.length).toBeLessThan(transcript.length);
});
```

No mocks of Electron, no service layer, no `getMainWindow()`.

### Services (Integration Tests)

Test with mocked pipeline and store:

```typescript
// src/main/services/__tests__/transcriber.test.ts
import { TranscriberService } from '../transcriber';

it('should buffer segments and persist on session end', async () => {
  const service = new TranscriberService();
  const mockCallbacks = { onUpdate: vi.fn(), onMeetingSaved: vi.fn() };

  service.beginSession(Date.now());
  await service.transcribe({ audio: [...], sessionId }, mockCallbacks);

  const meeting = await service.endSession(Date.now(), mockCallbacks);

  expect(meeting.transcript).toContain('...');
  expect(mockCallbacks.onMeetingSaved).toHaveBeenCalled();
});
```

Mock the pipeline; test the orchestration logic.

---

## Common Mistakes

### ❌ Mistake 1: Pipeline imports service

```typescript
// src/main/pipeline/whisper-transcriber.ts
import { transcriberService } from '../services/transcriber'; // ❌ WRONG

async transcribe(audio) {
  const result = await this.transcriber(audio);
  transcriberService.updateBuffer(result); // ❌ Pipeline calling service
  return result;
}
```

**Fix:** Service calls pipeline, passes callbacks if needed.

```typescript
// Service calls pipeline
async transcribe(args, callbacks) {
  const result = await this.transcriber.transcribe(args.audio); // ✅ Right direction
  this.updateBuffer(result); // ✅ Service manages state
  callbacks.onUpdate(result);
}
```

### ❌ Mistake 2: Service duplicates pipeline logic

```typescript
// src/main/services/transcriber.ts
async transcribe(args, callbacks) {
  // ❌ Text cleaning logic shouldn't be here
  const cleaned = args.transcript
    .replace(/uh/g, '')
    .replace(/um/g, '');
  // ...
}
```

**Fix:** Delegate to pipeline.

```typescript
// ✅ Use the pipeline module
async transcribe(args, callbacks) {
  const result = await this.transcriber.transcribe(args.audio);
  const cleaned = cleanText(result.text); // ✅ Call pipeline
  // ...
}
```

### ❌ Mistake 3: Pipeline calls IPC directly

```typescript
// src/main/pipeline/summarizer.ts
import { ipcMain } from 'electron'; // ❌ WRONG

export async function summarize(text) {
  const summary = await model.summarize(text);
  ipcMain.emit('summary-ready', summary); // ❌ Pipeline triggering IPC
  return summary;
}
```

**Fix:** Return the result; let service emit IPC.

```typescript
// ✅ Pipeline returns; service emits
export async function summarize(text) {
  return await model.summarize(text);
}

// Service emits
await callbacks.onSummaryReady(summary);
```

---

## References

- **Service implementations:** `src/main/services/transcriber.ts`, `src/main/services/permissions.ts`, `src/main/services/meeting-detector.ts`
- **Pipeline modules:** `src/main/pipeline/whisper-transcriber.ts`, `src/main/pipeline/summarizer.ts`, `src/main/pipeline/style-transfer.ts`
- **IPC layer:** `src/main/ipc/transcriber.ts` — thin router between handlers and services
- **Test examples:** `src/main/__tests__/transcriberService.test.ts`
