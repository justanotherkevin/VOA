# Electron App Architecture Guide

A practical guide for structuring Electron apps — focused on how the frontend and backend connect, and how to keep the codebase testable as it grows.

---

## Table of Contents

1. [The Two-Process Model](#the-two-process-model)
2. [Directory Structure](#directory-structure)
3. [The IPC Bridge — How Frontend and Backend Connect](#the-ipc-bridge)
4. [Organizing IPC Handlers](#organizing-ipc-handlers)
5. [Event-Driven Communication (Main → Renderer)](#event-driven-communication)
6. [The Command Pattern — One Action, Many Callers](#the-command-pattern)
7. [State Management](#state-management)
8. [Writing Testable Code in Electron](#writing-testable-code)
9. [Common Pitfalls](#common-pitfalls)

---

## The Two-Process Model

Every Electron app has two completely separate runtime environments. Understanding this boundary is the foundation for everything else.

```
┌──────────────────────────────────────────────────────────┐
│  Main Process (Node.js)                                  │
│  - Full access to OS, file system, native APIs           │
│  - Creates and controls windows                          │
│  - Runs AI calls, database, background jobs              │
│  - No DOM, no browser APIs                               │
└───────────────────────┬──────────────────────────────────┘
                        │  IPC (Inter-Process Communication)
                        │  The ONLY legal crossing point
┌───────────────────────┴──────────────────────────────────┐
│  Renderer Process (Chromium / browser-like)              │
│  - React / Vue / vanilla HTML — your UI                  │
│  - No direct access to Node.js or native APIs            │
│  - Communicates with main process only through IPC       │
└──────────────────────────────────────────────────────────┘
```

**The rule**: The renderer cannot import from your main process code. It cannot read files, call external APIs, or touch the OS. It can only ask the main process to do those things through IPC.

This separation is a feature, not a limitation. It forces a clean boundary between UI logic and system logic, making both independently testable.

---

## Directory Structure

Organize by process first, then by concern within each process.

```
my-app/
├── electron/                   # Main process — Node.js only
│   ├── main.ts                 # Entry point
│   ├── preload.ts              # IPC bridge (the only exception to separation)
│   │
│   ├── handlers/               # IPC channel registrations
│   │   ├── ipc/
│   │   │   ├── feature-a.ts
│   │   │   ├── feature-b.ts
│   │   │   └── index.ts        # Registers all handlers in one call
│   │   └── shortcuts/          # Keyboard shortcut handlers
│   │
│   ├── services/               # Business logic (no IPC, no Electron imports)
│   │   ├── feature-a.ts
│   │   └── feature-b.ts
│   │
│   ├── commands/               # Command Pattern (optional, see section 6)
│   │   ├── registry.ts
│   │   ├── execute.ts
│   │   └── types.ts
│   │
│   ├── state/
│   │   ├── volatile.ts         # In-memory runtime state
│   │   └── persistent.ts       # Saved-to-disk settings
│   │
│   └── shared/                 # Constants shared between main and preload
│       ├── events.ts           # IPC channel name constants
│       └── types.ts            # Types used on both sides of IPC
│
├── src/                        # Renderer process — browser-like
│   ├── main.tsx                # React/framework entry point
│   ├── App.tsx                 # Root component
│   ├── _pages/                 # Page-level components
│   ├── components/             # Reusable UI components
│   ├── contexts/               # State shared across the component tree
│   ├── hooks/                  # Custom hooks (including IPC hooks)
│   └── types/                  # Renderer-only types
│
└── shared/                     # Types used by BOTH processes
    └── types/
        ├── domain.ts           # Core domain types (safe to import anywhere)
        └── ipc.ts              # IPC channel type map
```

The key principle: **`electron/services/` contains no Electron imports.** Those files are pure TypeScript — functions that take inputs, return outputs, and can be tested with just `vitest` or `jest` and no Electron setup.

---

## The IPC Bridge

This is the most important pattern to get right. IPC in Electron works in three layers.

### Layer 1 — The Preload Script

The preload script (`electron/preload.ts`) is the only file that runs with Node access inside the renderer context. It uses `contextBridge` to expose a safe, typed API to the renderer:

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Request-response (renderer asks, main answers)
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),

  // Push events (main notifies renderer)
  onJobComplete: (callback) =>
    ipcRenderer.on('job-complete', (_event, result) => callback(result)),

  // Cleanup
  removeAllListeners: (channel) =>
    ipcRenderer.removeAllListeners(channel),
})
```

**Why `contextBridge` matters**: Never expose `ipcRenderer` directly to the renderer (`window.ipcRenderer = ipcRenderer`). That gives renderer code full access to all IPC channels, defeating the security model. `contextBridge` lets you expose only the specific API surface you intend.

### Layer 2 — The Main Process Handlers

In the main process, register handlers that respond to what the preload exposes:

```typescript
// electron/handlers/ipc/settings.ts
import { ipcMain } from 'electron'

export function registerSettingsHandlers(settingsService) {
  // ipcMain.handle → for request-response (pairs with ipcRenderer.invoke)
  ipcMain.handle('get-settings', async () => {
    return settingsService.load()
  })

  ipcMain.handle('save-settings', async (_event, data) => {
    return settingsService.save(data)
  })
}
```

### Layer 3 — The Renderer

The renderer calls the preload API as if it were a regular function:

```typescript
// src/hooks/useSettings.ts
const settings = await window.api.getSettings()
await window.api.saveSettings({ theme: 'dark' })
```

### The Two IPC Patterns

**Request-response** (`ipcRenderer.invoke` / `ipcMain.handle`):
- Use when the renderer needs data back from the main process
- Returns a Promise; the renderer awaits the result
- Example: fetching settings, reading a file, checking a connection

**Push events** (`webContents.send` / `ipcRenderer.on`):
- Use when the main process needs to notify the renderer of something that happened
- One-way, no reply expected
- Example: a background job completed, a file changed, a download progressed

Most data flows are one of these two patterns. If you find yourself needing something more complex (streaming, subscriptions), model it as repeated push events.

### Typed IPC Channels

Stringly-typed channel names (`'get-settings'`, `'save-settings'`) are the biggest source of silent bugs in Electron apps. A typo fails at runtime, not at compile time.

Define a single source of truth for channel names and their payload types:

```typescript
// shared/types/ipc.ts
export interface IpcChannels {
  'get-settings': { params: void; result: AppSettings }
  'save-settings': { params: Partial<AppSettings>; result: void }
  'job-complete': { params: JobResult; result: void }
}

// electron/shared/events.ts
export const CHANNELS = {
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  JOB_COMPLETE: 'job-complete',
} as const
```

Both the handler and the preload import `CHANNELS` instead of writing strings. Rename a channel in one place and TypeScript will flag everywhere that breaks.

---

## Organizing IPC Handlers

A common mistake is registering all IPC handlers in one file (`ipcHandlers.ts`). This becomes hard to navigate once the app has more than a handful of channels.

**Better**: One file per feature domain, with an `index.ts` that registers everything.

```typescript
// electron/handlers/ipc/settings.ts
export function registerSettingsHandlers(deps) {
  ipcMain.handle(CHANNELS.GET_SETTINGS, () => deps.settingsService.load())
  ipcMain.handle(CHANNELS.SAVE_SETTINGS, (_, data) => deps.settingsService.save(data))
}

// electron/handlers/ipc/index.ts
export function registerAllHandlers(deps) {
  registerSettingsHandlers(deps)
  registerJobHandlers(deps)
  registerWindowHandlers(deps)
}

// electron/main.ts
registerAllHandlers({ settingsService, jobService, mainWindow })
```

**Why dependency injection here**: Each handler file receives its dependencies (services, window references) as arguments rather than importing them directly. This is what makes individual handler files unit-testable — you can pass mock services in tests without needing a running Electron instance.

---

## Event-Driven Communication

Long-running operations (a background job, a download, a processing pipeline) should communicate progress back to the renderer via push events, not by blocking the IPC response.

### The Pattern

```typescript
// Main process service
class JobService {
  constructor(private mainWindow: BrowserWindow) {}

  async runJob(input) {
    this.mainWindow.webContents.send(CHANNELS.JOB_STARTED)

    try {
      const result = await this.processStep1(input)
      this.mainWindow.webContents.send(CHANNELS.JOB_PROGRESS, { step: 1, result })

      const final = await this.processStep2(result)
      this.mainWindow.webContents.send(CHANNELS.JOB_COMPLETE, final)
    } catch (err) {
      this.mainWindow.webContents.send(CHANNELS.JOB_ERROR, { message: err.message })
    }
  }
}
```

```typescript
// Renderer hook
function useJob() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState(null)

  useEffect(() => {
    window.api.onJobStarted(() => setStatus('running'))
    window.api.onJobComplete((data) => { setResult(data); setStatus('done') })
    window.api.onJobError(() => setStatus('error'))

    return () => window.api.removeAllListeners('job-complete')  // cleanup
  }, [])

  return { status, result }
}
```

### Defining Event Constants

Push events are especially prone to silent mismatches because the sender and receiver are in different processes. Keep all event channel names in one shared file:

```typescript
// electron/shared/events.ts
export const EVENTS = {
  JOB_STARTED: 'job-started',
  JOB_PROGRESS: 'job-progress',
  JOB_COMPLETE: 'job-complete',
  JOB_ERROR: 'job-error',
} as const
```

Both the main process service and the preload import from this file.

---

## The Command Pattern

As an app grows, the same action often needs to be triggered from multiple places: a keyboard shortcut, a button in the UI, a menu item, an IPC call. Without a pattern, you end up with the same logic duplicated in three places.

The Command Pattern solves this: define each action once in a registry, and every caller invokes it by ID.

```typescript
// electron/commands/types.ts
export interface Command {
  id: string
  handler: (deps: AppDeps) => Promise<void> | void
}

// electron/commands/registry.ts
export function createRegistry(deps: AppDeps): Record<string, Command> {
  return {
    'job.start': {
      id: 'job.start',
      handler: () => deps.jobService.runJob(deps.state.currentInput),
    },
    'window.hide': {
      id: 'window.hide',
      handler: () => deps.mainWindow.hide(),
    },
    'settings.open': {
      id: 'settings.open',
      handler: () => deps.mainWindow.webContents.send(EVENTS.SHOW_SETTINGS),
    },
  }
}

// electron/commands/execute.ts
export function executeCommand(id: string, registry: Record<string, Command>) {
  const command = registry[id]
  if (!command) throw new Error(`Unknown command: ${id}`)
  return command.handler()
}
```

The IPC layer becomes a thin router:

```typescript
// electron/handlers/ipc/commands.ts
ipcMain.handle('execute-command', (_event, id: string) => {
  return executeCommand(id, commandRegistry)
})
```

The renderer calls any action by ID, with no knowledge of what it does:

```typescript
window.api.executeCommand('job.start')
window.api.executeCommand('window.hide')
```

This also makes testing simple — you can invoke `executeCommand('job.start', registry)` in a unit test with a mocked registry, no IPC required.

---

## State Management

Electron apps have three distinct kinds of state. Conflating them causes bugs that are hard to reproduce.

### 1. Persistent State (survives restarts)

User settings, preferences, API keys. Store with a disk-backed library (electron-store or similar).

```typescript
// electron/state/persistent.ts
export function createPersistentStore() {
  // wraps electron-store or any key-value store
  return {
    get: (key) => store.get(key),
    set: (key, value) => store.set(key, value),
  }
}
```

### 2. Volatile Runtime State (resets on restart)

The current window reference, which step of a job is running, what data is loaded. Keep this in a plain module with explicit getters/setters — not a global mutable object accessed ad hoc.

```typescript
// electron/state/volatile.ts
interface AppState {
  mainWindow: BrowserWindow | null
  currentJob: Job | null
  isVisible: boolean
}

let state: AppState = {
  mainWindow: null,
  currentJob: null,
  isVisible: true,
}

export const getMainWindow = () => state.mainWindow
export const setMainWindow = (w: BrowserWindow) => { state.mainWindow = w }
export const getCurrentJob = () => state.currentJob
export const setCurrentJob = (j: Job | null) => { state.currentJob = j }
```

Explicit getters/setters let you add logging, validation, or side effects later without hunting down all write sites.

### 3. UI State (renderer only)

What tab is active, whether a modal is open, form field values. This lives entirely in React/your framework. The main process should never know about it.

### Avoiding State Sync Problems

The common mistake is trying to keep both processes in sync with a shared object. Don't. Instead:
- Main process owns authoritative state
- Renderer owns display state
- IPC events are the notification mechanism when authoritative state changes

When main process state changes (job finishes, settings update), it pushes an event. The renderer updates its display state in response.

---

## Writing Testable Code in Electron

The main challenge with testing Electron apps is that running an actual Electron instance is slow and fragile. The goal is to make most logic testable without Electron at all.

### The Key Rule: Keep Services Free of Electron Imports

If a file imports from `'electron'`, it can only be tested in an Electron context. Design your services to not need this.

```typescript
// BAD — untestable without Electron
import { ipcMain } from 'electron'
export class JobService {
  run() {
    ipcMain.emit('something')  // now you need a running Electron to test this
    return processData()
  }
}

// GOOD — pure TypeScript, testable anywhere
export class JobService {
  run() {
    return processData()  // no Electron dependency
  }
}

// IPC lives in the handler, not the service
ipcMain.handle('run-job', () => jobService.run())
```

### Dependency Injection for Testability

Pass dependencies as constructor arguments rather than importing them. This lets tests substitute mocks.

```typescript
// The service knows nothing about IPC or Electron
class DataProcessor {
  constructor(
    private storage: Storage,          // interface, not concrete class
    private notifier: Notifier,        // interface
  ) {}

  async process(input: Input) {
    const data = await this.storage.read(input.id)
    const result = await transform(data)
    await this.storage.write(input.id, result)
    this.notifier.notify('done', result)
    return result
  }
}

// In production: real implementations
const processor = new DataProcessor(diskStorage, ipcNotifier)

// In tests: mock implementations
const processor = new DataProcessor(mockStorage, mockNotifier)
const result = await processor.process(testInput)
expect(result).toEqual(expectedOutput)
```

### What to Test at Each Layer

| Layer | What to test | How |
|-------|-------------|-----|
| **Services** (`electron/services/`) | Business logic, transformations, error handling | Pure unit tests — no Electron, no IPC |
| **IPC Handlers** (`electron/handlers/`) | Correct handler registration, argument forwarding | Unit tests with mocked services |
| **Command Registry** (`electron/commands/`) | Correct routing by ID | Unit tests with mocked deps |
| **State** (`electron/state/`) | Getters/setters, state transitions | Unit tests |
| **Components** (`src/`) | Render output, user interaction | React Testing Library |
| **IPC contract** | That preload and main handlers agree on channel names/shapes | Integration test with real Electron |

The most valuable tests are at the service layer — they cover the actual logic with no test infrastructure overhead.

### Structuring for `__tests__` Co-location

Keep test files next to the code they test:

```
electron/services/
  data-processor.ts
  __tests__/
    data-processor.test.ts

electron/handlers/ipc/
  settings.ts
  __tests__/
    settings.test.ts
```

This makes it obvious what is and isn't tested, and keeps test imports short.

---

## Common Pitfalls

### Exposing `ipcRenderer` directly to the renderer

```typescript
// NEVER do this
window.ipcRenderer = ipcRenderer
```

This bypasses the security model and gives renderer code unrestricted access to all IPC channels. Always use `contextBridge.exposeInMainWorld`.

### Calling Node/Electron APIs from the renderer

If you find yourself wanting to `import fs from 'fs'` in a React component, stop. That code belongs in the main process. Add an IPC handler that does the file operation and have the renderer call it.

### Putting business logic in IPC handlers

```typescript
// BAD — the handler is doing too much
ipcMain.handle('process-data', async (_event, input) => {
  const data = await fs.readFile(input.path)
  const parsed = JSON.parse(data)
  const result = parsed.items.filter(x => x.active).map(transform)
  await db.save(result)
  return result
})

// GOOD — handler is a thin router
ipcMain.handle('process-data', async (_event, input) => {
  return dataService.process(input)
})
```

The handler knows nothing about the logic. The logic knows nothing about IPC. Both are independently testable.

### Shared mutable state across handlers

Avoid a global object that every handler reads and writes without coordination. Use the explicit getter/setter pattern (see State Management section) so state transitions are trackable.

### Not cleaning up IPC listeners in the renderer

Every `ipcRenderer.on()` call in the renderer must have a corresponding `removeListener` or `removeAllListeners` when the component unmounts. Failing to do this causes memory leaks and duplicate event handlers.

```typescript
useEffect(() => {
  window.api.onJobComplete(handleComplete)

  return () => {
    window.api.removeAllListeners('job-complete')  // cleanup on unmount
  }
}, [])
```

### Duplicating channel name strings

Define channel names in one `shared/events.ts` or `shared/ipc.ts` file. Both the preload and the main process import from it. Never write the same string literal twice.
