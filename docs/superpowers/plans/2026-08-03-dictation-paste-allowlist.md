# Dictation Paste Allow-List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded, regression-prone `pasteOnComplete` boolean with a real Settings → Transcription control: an enable switch plus an allow-list of apps, so dictation auto-paste only fires when the app focused at completion time is on the list.

**Architecture:** `TranscriberService` derives paste eligibility from `sessionType === 'dictation'` (already tracked internally) plus a new persisted `pastePreferences` domain and a fresh `getActiveWindow()` check at paste time — no boolean is passed in from the renderer anymore. A new `listRunningApps()` in `active-window.ts` powers the Settings UI's app picker.

**Tech Stack:** Electron (main/renderer/preload), `electron-store`, React, Vitest, AppleScript via `child_process.execFile`.

## Global Constraints

- macOS only — the feature (and its Settings section) does not appear/function on Windows/Linux. `pasteTextToActiveWindow` and the new `listRunningApps()` are both macOS-only.
- Default state: `{ enabled: false, allowedApps: [] }` — ships off, never surprises a user who hasn't opted in.
- The independent, already-disabled `shouldPasteText()` per-segment kill switch in `util.ts` is untouched — out of scope.
- No Windows paste mechanism is added in this plan.

---

### Task 1: Paste preferences schema and storage

**Files:**

- Modify: `src/main/store/schema.ts`
- Modify: `src/main/store/preferences.ts`

**Interfaces:**

- Produces: `PastePreferences` type (`{ enabled: boolean; allowedApps: string[] }`), `DEFAULT_PASTE_PREFERENCES`, `getPastePreferences(): PastePreferences`, `savePastePreferences(prefs: Partial<PastePreferences>): void`. Exported from `@/main/store` via the existing `export *` barrel — no barrel edit needed.

- [ ] **Step 1: Add the `PastePreferences` interface and default constant**

In `src/main/store/schema.ts`, add the interface near the other preference interfaces (after `CalendarPreferences`, before `StoreSchema`):

```ts
export interface PastePreferences {
  enabled: boolean;
  allowedApps: string[];
}
```

Add `pastePreferences?: PastePreferences;` to the `StoreSchema` interface, alongside the other `*Preferences?` fields (next to `calendarPreferences?: StoredCalendarPreferences;`).

Add the default constant next to the other `DEFAULT_*` constants (after `DEFAULT_CALENDAR_PREFERENCES`):

```ts
export const DEFAULT_PASTE_PREFERENCES: PastePreferences = {
  enabled: false,
  allowedApps: [],
};
```

- [ ] **Step 2: Add get/save functions**

In `src/main/store/preferences.ts`, add a new section at the end of the file (mirroring the `Audio Preferences` section's shape exactly):

```ts
// ─── Paste Preferences ────────────────────────────────────────────────────────

export function getPastePreferences(): PastePreferences {
  return getStore()?.get('pastePreferences') ?? DEFAULT_PASTE_PREFERENCES;
}

export function savePastePreferences(prefs: Partial<PastePreferences>): void {
  const store = getStore();
  const current = store?.get('pastePreferences') ?? DEFAULT_PASTE_PREFERENCES;
  store?.set('pastePreferences', { ...current, ...prefs });
}
```

Add `PastePreferences` and `DEFAULT_PASTE_PREFERENCES` to the existing import from `./schema` at the top of the file (alongside `AudioPreferences`, `DEFAULT_AUDIO_PREFERENCES`, etc.).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: No new errors. (No dedicated unit test is added here — no other `*Preferences` get/save pair in this file has one; `getAudioPreferences`/`saveAudioPreferences` etc. are only exercised indirectly through IPC, and Task 5 doesn't add IPC-level tests for this domain either, matching that existing precedent.)

- [ ] **Step 4: Commit**

```bash
git add src/main/store/schema.ts src/main/store/preferences.ts
git commit -m "feat: add pastePreferences store domain"
```

---

### Task 2: `listRunningApps()` in active-window.ts

**Files:**

- Modify: `src/main/active-window.ts`
- Create: `src/main/__tests__/active-window.test.ts`

**Interfaces:**

- Consumes: nothing new (reuses `execFileAsync` already defined in the file).
- Produces: `listRunningApps(): Promise<string[]>` — macOS-only, de-duplicated app names; resolves to `[]` on any other platform or on failure.

- [ ] **Step 1: Write the failing tests**

Create `src/main/__tests__/active-window.test.ts`:

```ts
/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promisify } from 'util';

const mockExecFileAsync = vi.fn();
const mockExecFile = Object.assign(vi.fn(), {
  [promisify.custom]: (...args: unknown[]) => mockExecFileAsync(...args),
});

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}));

let mockPlatform = 'darwin';
vi.mock('os', () => ({
  platform: () => mockPlatform,
}));

vi.mock('electron-log', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('listRunningApps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform = 'darwin';
  });

  it('returns de-duplicated app names on macOS', async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: 'Terminal|||iTerm2|||Terminal|||Slack',
    });

    const { listRunningApps } = await import('../active-window');
    const result = await listRunningApps();

    expect(result).toEqual(['Terminal', 'iTerm2', 'Slack']);
  });

  it('returns an empty array on non-macOS platforms without calling osascript', async () => {
    mockPlatform = 'win32';

    const { listRunningApps } = await import('../active-window');
    const result = await listRunningApps();

    expect(result).toEqual([]);
    expect(mockExecFileAsync).not.toHaveBeenCalled();
  });

  it('returns an empty array when the AppleScript call fails', async () => {
    mockExecFileAsync.mockRejectedValue(new Error('osascript failed'));

    const { listRunningApps } = await import('../active-window');
    const result = await listRunningApps();

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node node_modules/vitest/vitest.mjs run src/main/__tests__/active-window.test.ts`
Expected: FAIL — `listRunningApps` is not exported from `../active-window`.

- [ ] **Step 3: Implement `listRunningApps()`**

In `src/main/active-window.ts`, add a new AppleScript constant near `MAC_SCRIPT` (after it, before `WINDOWS_SCRIPT`):

```ts
/**
 * AppleScript to list all foreground (non-background) running apps on macOS,
 * for the dictation paste allow-list picker in Settings.
 * Security Note: same execFile-argument-array approach as MAC_SCRIPT above —
 * not shell-evaluated.
 */
const MAC_LIST_APPS_SCRIPT = `
tell application "System Events"
    set appNames to name of every process whose background only is false
end tell
set AppleScript's text item delimiters to "|||"
return appNames as text
`;
```

Add the function after `getActiveWindow()` (before `getMacActiveWindow()`):

```ts
/**
 * List the names of all foreground (non-background) running apps.
 * macOS-only — used to populate the dictation paste allow-list picker.
 * Resolves to [] on any other platform or if the AppleScript call fails.
 */
export async function listRunningApps(): Promise<string[]> {
  if (platform() !== 'darwin') {
    return [];
  }

  try {
    const { stdout } = await execFileAsync(
      'osascript',
      ['-e', MAC_LIST_APPS_SCRIPT],
      { timeout: 3000 },
    );
    const names = stdout
      .split('|||')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    return Array.from(new Set(names));
  } catch (error) {
    log.error('Failed to list running apps:', error);
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/main/__tests__/active-window.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/active-window.ts src/main/__tests__/active-window.test.ts
git commit -m "feat: add listRunningApps for the dictation paste allow-list"
```

---

### Task 3: `TranscriberService` — replace `pasteOnComplete` with `shouldPasteForSession()`

**Files:**

- Modify: `src/main/services/transcriber.ts`
- Modify: `src/main/__tests__/transcriber-integration.test.ts`
- Modify: `src/main/__tests__/helpers/transcriberTestHelpers.ts`

**Interfaces:**

- Consumes: `getPastePreferences()` (Task 1), `getActiveWindow()` (existing, from `@/main/active-window`).
- Produces: `TranscriberService.beginSession(startedAt: number, type?: 'meeting' | 'dictation'): void` (options param removed). `lastSessionMeta` no longer has a `pasteOnComplete` field.

- [ ] **Step 1: Update `transcriber-integration.test.ts`'s mocks**

At the top of `src/main/__tests__/transcriber-integration.test.ts`, add `getPastePreferences` to the existing `vi.mock('@/main/store', ...)` factory (after `generateTitle`):

```ts
  generateTitle: vi.fn((text: string) => text.slice(0, 20)),
  getPastePreferences: vi.fn(() => ({ enabled: false, allowedApps: [] })),
```

Add a new mock block right after the `@/main/store` mock:

```ts
vi.mock('@/main/active-window', () => ({
  getActiveWindow: vi.fn(async () => undefined),
}));
```

- [ ] **Step 2: Replace the `dictation-shortcut paste-on-complete` describe block**

Replace the entire `describe('TranscriberService — dictation-shortcut paste-on-complete', ...)` block (from `describe('TranscriberService — dictation-shortcut paste-on-complete', () => {` through its closing `});`) with:

```ts
describe('TranscriberService — dictation paste allow-list', () => {
  const callbacks = createTranscriberCallbacks();

  beforeEach(() => {
    vi.clearAllMocks();
    resetTranscriberSessionState();
  });

  async function enablePasteForApp(appName: string) {
    const { getPastePreferences } = await import('@/main/store');
    const { getActiveWindow } = await import('@/main/active-window');
    (getPastePreferences as any).mockReturnValue({
      enabled: true,
      allowedApps: [appName],
    });
    (getActiveWindow as any).mockResolvedValue({
      title: '',
      owner: { name: appName },
    });
  }

  it('still pastes when the trailing segment arrives late (after endSession already ran)', async () => {
    // Regression test: a short dictation utterance whose transcription is
    // still in flight when the stop-shortcut's endSession() fires used to
    // silently lose the paste entirely — the segment took the late-segment
    // recovery path, which never checked the paste eligibility.
    const { pasteTextToActiveWindow } = await import('@/main/util');
    const { saveMeeting } = await import('@/main/store');
    await enablePasteForApp('Terminal');

    transcriberService.beginSession(1000, 'dictation');
    await transcriberService.endSession(2000, callbacks);
    expect(pasteTextToActiveWindow).not.toHaveBeenCalled();

    await transcriberService.transcribe(
      { audio: SILENT_AUDIO, source: 'mic' },
      callbacks,
    );

    expect(pasteTextToActiveWindow).toHaveBeenCalledTimes(1);
    expect(pasteTextToActiveWindow).toHaveBeenCalledWith('transcribed text');
    expect(saveMeeting).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: 'transcribed text' }),
    );
  });

  it('does not double-paste when a late segment is appended to an already-saved dictation meeting', async () => {
    const { pasteTextToActiveWindow } = await import('@/main/util');
    await enablePasteForApp('Terminal');

    transcriberService.beginSession(1000, 'dictation');
    const svc = transcriberService as any;
    svc.sessionSegments.push({
      text: 'first segment',
      startedAt: 1000,
      source: 'mic',
    });
    svc.sessionSources.add('mic');
    await transcriberService.endSession(2000, callbacks);
    expect(pasteTextToActiveWindow).toHaveBeenCalledTimes(1);

    const { getMeetingById } = await import('@/main/store');
    (getMeetingById as any).mockReturnValueOnce(mockExistingMeeting());

    // A second, late-arriving segment for the same session — should append,
    // not re-paste (the combined text was already pasted once above).
    await transcriberService.transcribe(
      { audio: SILENT_AUDIO, source: 'mic' },
      callbacks,
    );

    expect(pasteTextToActiveWindow).toHaveBeenCalledTimes(1);
  });

  it('pastes the full combined transcript exactly once at endSession when the active app is allowed', async () => {
    const { pasteTextToActiveWindow } = await import('@/main/util');
    await enablePasteForApp('Terminal');

    transcriberService.beginSession(1000, 'dictation');
    const svc = transcriberService as any;
    svc.sessionSegments.push(
      { text: 'first segment', startedAt: 1000, source: 'mic' },
      { text: 'second segment', startedAt: 2000, source: 'mic' },
    );
    svc.sessionSources.add('mic');
    await transcriberService.endSession(3000, callbacks);

    expect(pasteTextToActiveWindow).toHaveBeenCalledTimes(1);
    expect(pasteTextToActiveWindow).toHaveBeenCalledWith(
      'first segment second segment',
    );
  });

  it('does not paste for a regular recording-shortcut (meeting) session even when paste is enabled', async () => {
    const { pasteTextToActiveWindow } = await import('@/main/util');
    await enablePasteForApp('Terminal');

    await seedAndEndSession(
      [{ text: 'some transcript', startedAt: 1000, source: 'mic' }],
      callbacks,
      { endedAt: 2000 },
    );

    expect(pasteTextToActiveWindow).not.toHaveBeenCalled();
  });

  it('does not paste when the feature is disabled', async () => {
    const { pasteTextToActiveWindow } = await import('@/main/util');
    const { getPastePreferences } = await import('@/main/store');
    (getPastePreferences as any).mockReturnValue({
      enabled: false,
      allowedApps: ['Terminal'],
    });

    transcriberService.beginSession(1000, 'dictation');
    const svc = transcriberService as any;
    svc.sessionSegments.push({
      text: 'dictated text',
      startedAt: 1000,
      source: 'mic',
    });
    svc.sessionSources.add('mic');
    await transcriberService.endSession(2000, callbacks);

    expect(pasteTextToActiveWindow).not.toHaveBeenCalled();
  });

  it('does not paste when the active app is not on the allow-list', async () => {
    const { pasteTextToActiveWindow } = await import('@/main/util');
    const { getPastePreferences } = await import('@/main/store');
    const { getActiveWindow } = await import('@/main/active-window');
    (getPastePreferences as any).mockReturnValue({
      enabled: true,
      allowedApps: ['Terminal'],
    });
    (getActiveWindow as any).mockResolvedValue({
      title: '',
      owner: { name: 'Slack' },
    });

    transcriberService.beginSession(1000, 'dictation');
    const svc = transcriberService as any;
    svc.sessionSegments.push({
      text: 'dictated text',
      startedAt: 1000,
      source: 'mic',
    });
    svc.sessionSources.add('mic');
    await transcriberService.endSession(2000, callbacks);

    expect(pasteTextToActiveWindow).not.toHaveBeenCalled();
  });

  it('does not paste when the active window cannot be detected', async () => {
    const { pasteTextToActiveWindow } = await import('@/main/util');
    const { getPastePreferences } = await import('@/main/store');
    const { getActiveWindow } = await import('@/main/active-window');
    (getPastePreferences as any).mockReturnValue({
      enabled: true,
      allowedApps: ['Terminal'],
    });
    (getActiveWindow as any).mockResolvedValue(undefined);

    transcriberService.beginSession(1000, 'dictation');
    const svc = transcriberService as any;
    svc.sessionSegments.push({
      text: 'dictated text',
      startedAt: 1000,
      source: 'mic',
    });
    svc.sessionSources.add('mic');
    await transcriberService.endSession(2000, callbacks);

    expect(pasteTextToActiveWindow).not.toHaveBeenCalled();
  });

  it('does not paste an empty transcript even when the active app is allowed', async () => {
    const { pasteTextToActiveWindow } = await import('@/main/util');
    await enablePasteForApp('Terminal');

    transcriberService.beginSession(1000, 'dictation');
    await transcriberService.endSession(2000, callbacks);

    expect(pasteTextToActiveWindow).not.toHaveBeenCalled();
  });
});
```

Note: the old suite's "resets pasteOnComplete after a session ends so it does not leak into the next session" test is intentionally dropped — it guarded a stateful boolean that no longer exists. Paste eligibility is now recomputed fresh from the store + `getActiveWindow()` on every `endSession()`/`recoverLateSegment()` call, so there is nothing to leak between sessions.

- [ ] **Step 3: Run the updated test file to confirm it fails against the old implementation**

Run: `node node_modules/vitest/vitest.mjs run src/main/__tests__/transcriber-integration.test.ts`
Expected: FAIL — `getPastePreferences`/`getActiveWindow` mocks are unused by current code; paste assertions fail because `beginSession(1000, 'dictation')` (no options) never sets any paste flag under the old implementation.

- [ ] **Step 4: Remove the `pasteOnComplete` reset line from the shared test helper**

In `src/main/__tests__/helpers/transcriberTestHelpers.ts`, delete this line from `resetTranscriberSessionState()`:

```ts
svc.pasteOnComplete = false;
```

- [ ] **Step 5: Implement `shouldPasteForSession()` and rewire the three call sites**

In `src/main/services/transcriber.ts`:

Add imports (extend the existing `@/main/store` import and add a new one):

```ts
import {
  saveMeeting,
  updateMeeting,
  getMeetingById,
  getModelPreferences,
  getCalendarPreferences,
  getPastePreferences,
  generateTitle,
  formatParticipantsTitle,
  type ModelPreferences,
} from '@/main/store';
import { getActiveWindow } from '@/main/active-window';
```

Remove the `pasteOnComplete` field from `lastSessionMeta`'s type (currently lines 72-78):

```ts
  private lastSessionMeta: {
    startedAt: number;
    endedAt: number;
    type: 'meeting' | 'dictation';
    endedAtMs: number;
  } | null = null;
```

Remove the `private pasteOnComplete = false;` field entirely (currently line 87).

Update `beginSession()`'s signature and body (currently lines 109-121) to drop the `options` parameter:

```ts
  beginSession(
    startedAt: number,
    type: 'meeting' | 'dictation' = 'dictation',
  ): void {
    this.sessionActive = true;
    this.sessionType = type;
    this.sessionStartedAt = startedAt;
    this.sessionSegments = [];
    this.sessionChunks = [];
    this.sessionSources = new Set();

    this.calendarMatches = [];
```

Add the new private method, placed just above `endSession()`:

```ts
  private async shouldPasteForSession(
    type: 'meeting' | 'dictation',
  ): Promise<boolean> {
    if (type !== 'dictation') return false;

    const prefs = getPastePreferences();
    if (!prefs.enabled || prefs.allowedApps.length === 0) return false;

    const activeWindow = await getActiveWindow();
    if (!activeWindow) return false;

    return prefs.allowedApps.includes(activeWindow.owner.name);
  }
```

In `endSession()`, replace (currently lines 248-264):

```ts
this.sessionActive = false;
const type = this.sessionType;
this.sessionType = 'dictation';
const shouldPasteOnComplete = this.pasteOnComplete;
this.pasteOnComplete = false;

// Snapshot meta for late-segment recovery before clearing state — a
// trailing segment that's still transcribing when the session ends
// arrives via recoverLateSegment() below instead of this method, so it
// needs pasteOnComplete carried along to still honor the dictation paste.
this.lastSessionMeta = {
  startedAt: this.sessionStartedAt!,
  endedAt,
  type,
  endedAtMs: Date.now(),
  pasteOnComplete: shouldPasteOnComplete,
};
```

with:

```ts
this.sessionActive = false;
const type = this.sessionType;
this.sessionType = 'dictation';

// Snapshot meta for late-segment recovery before clearing state — a
// trailing segment that's still transcribing when the session ends
// arrives via recoverLateSegment() below instead of this method, so it
// needs the session type carried along to still honor dictation paste
// eligibility (see shouldPasteForSession()).
this.lastSessionMeta = {
  startedAt: this.sessionStartedAt!,
  endedAt,
  type,
  endedAtMs: Date.now(),
};
```

Further down in `endSession()`, replace (currently lines 293-299):

```ts
    if (fullText) {
      if (shouldPasteOnComplete) {
        log(
          `[TranscriberService] Pasting combined dictation transcript (${fullText.length} chars) on session end`,
        );
        pasteTextToActiveWindow(fullText);
      }
```

with:

```ts
    if (fullText) {
      if (await this.shouldPasteForSession(type)) {
        log(
          `[TranscriberService] Pasting combined dictation transcript (${fullText.length} chars) on session end`,
        );
        pasteTextToActiveWindow(fullText);
      }
```

In `recoverLateSegment()`, replace (currently lines 633-643):

```ts
// Session ended with empty buffer — create the meeting now from this late segment.
// A dictation session's trailing segment commonly lands here (it was still
// transcribing when the shortcut's stop press ended the session), so honor
// the paste-on-complete intent here too — otherwise dictated text silently
// never reaches the clipboard/active window at all.
if (meta.pasteOnComplete) {
  log(
    `[TranscriberService] Pasting late-recovered dictation transcript (${outputText.length} chars)`,
  );
  pasteTextToActiveWindow(outputText);
}
```

with:

```ts
// Session ended with empty buffer — create the meeting now from this late segment.
// A dictation session's trailing segment commonly lands here (it was still
// transcribing when the shortcut's stop press ended the session), so honor
// paste eligibility here too — otherwise dictated text silently never
// reaches the clipboard/active window at all.
if (await this.shouldPasteForSession(meta.type)) {
  log(
    `[TranscriberService] Pasting late-recovered dictation transcript (${outputText.length} chars)`,
  );
  pasteTextToActiveWindow(outputText);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/main/__tests__/transcriber-integration.test.ts src/main/__tests__/transcriberService.test.ts`
Expected: PASS (all tests in both files — `transcriberService.test.ts` doesn't call `endSession`/`transcribe` so it's unaffected by this change, confirm it still passes unmodified)

- [ ] **Step 7: Commit**

```bash
git add src/main/services/transcriber.ts src/main/__tests__/transcriber-integration.test.ts src/main/__tests__/helpers/transcriberTestHelpers.ts
git commit -m "refactor: derive dictation paste eligibility from preferences + active window"
```

---

### Task 4: Remove the old `pasteOnComplete` IPC/preload/renderer plumbing

**Files:**

- Modify: `src/main/ipc/transcriber.ts`
- Modify: `src/main/ipc/__tests__/transcriber.test.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/hooks/useRecordingFlow.ts`

**Interfaces:**

- Produces: `electronAPI.transcriber.startSession(startedAt: number, options?: { forceType?: 'dictation' })` (drops `pasteOnComplete`). IPC `SESSION_START` handler no longer reads or forwards `pasteOnComplete`.

- [ ] **Step 1: Update `ipc/transcriber.ts`'s tests first (TDD against the new contract)**

In `src/main/ipc/__tests__/transcriber.test.ts`, update the four assertions currently checking `pasteOnComplete`:

Replace (line ~74-76):

```ts
expect(mockBeginSession).toHaveBeenCalledWith(123, 'meeting', {
  pasteOnComplete: false,
});
```

with:

```ts
expect(mockBeginSession).toHaveBeenCalledWith(123, 'meeting');
```

Replace (line ~85-87):

```ts
expect(mockBeginSession).toHaveBeenCalledWith(now, 'meeting', {
  pasteOnComplete: false,
});
```

with:

```ts
expect(mockBeginSession).toHaveBeenCalledWith(now, 'meeting');
```

Replace the whole test at line ~91-100:

```ts
it('SESSION_START with forceType=dictation forces type=dictation', async () => {
  const h = await loadAndRegister();
  await h[CHANNELS.TRANSCRIBER.SESSION_START](
    { sender: {} },
    { startedAt: 999, forceType: 'dictation', pasteOnComplete: true },
  );
  expect(mockBeginSession).toHaveBeenCalledWith(999, 'dictation', {
    pasteOnComplete: true,
  });
});
```

with:

```ts
it('SESSION_START with forceType=dictation forces type=dictation', async () => {
  const h = await loadAndRegister();
  await h[CHANNELS.TRANSCRIBER.SESSION_START](
    { sender: {} },
    { startedAt: 999, forceType: 'dictation' },
  );
  expect(mockBeginSession).toHaveBeenCalledWith(999, 'dictation');
});
```

Replace both assertions in the `setE2eForceMeeting` test (line ~171-183):

```ts
expect(mockBeginSession).toHaveBeenCalledWith(1, 'meeting', {
  pasteOnComplete: false,
});

// Flag is single-use — the next session goes back to honoring forceType.
mockBeginSession.mockClear();
await handlers[CHANNELS.TRANSCRIBER.SESSION_START](
  { sender: {} },
  { startedAt: 2, forceType: 'dictation' },
);
expect(mockBeginSession).toHaveBeenCalledWith(2, 'dictation', {
  pasteOnComplete: false,
});
```

with:

```ts
expect(mockBeginSession).toHaveBeenCalledWith(1, 'meeting');

// Flag is single-use — the next session goes back to honoring forceType.
mockBeginSession.mockClear();
await handlers[CHANNELS.TRANSCRIBER.SESSION_START](
  { sender: {} },
  { startedAt: 2, forceType: 'dictation' },
);
expect(mockBeginSession).toHaveBeenCalledWith(2, 'dictation');
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/main/ipc/__tests__/transcriber.test.ts`
Expected: FAIL — current handler still calls `beginSession(startedAt, type, { pasteOnComplete: ... })`.

- [ ] **Step 3: Update `ipc/transcriber.ts`**

Replace (currently lines 39-56):

```ts
ipcMain.handle(CHANNELS.TRANSCRIBER.SESSION_START, async (_event, args) => {
  const { startedAt, forceType, pasteOnComplete } = args || {};
  // The recording shortcut and the dictation shortcut are two distinct,
  // explicit user choices — no need to guess intent from the active
  // window. That auto-detection predates the dedicated dictation shortcut
  // (when a single shortcut had to infer meeting-vs-dictation), and left
  // unforced sessions started via the recording shortcut misclassified as
  // 'dictation' whenever the focused app wasn't on the meeting-app list.
  let type: 'meeting' | 'dictation' =
    forceType === 'dictation' ? 'dictation' : 'meeting';
  if (_e2eNextSessionForceMeeting) {
    type = 'meeting';
    _e2eNextSessionForceMeeting = false;
  }
  log('[transcriber:session-start] type:', type);
  transcriberService.beginSession(startedAt ?? Date.now(), type, {
    pasteOnComplete: !!pasteOnComplete,
  });
  startTrayAnimation();
});
```

with:

```ts
ipcMain.handle(CHANNELS.TRANSCRIBER.SESSION_START, async (_event, args) => {
  const { startedAt, forceType } = args || {};
  // The recording shortcut and the dictation shortcut are two distinct,
  // explicit user choices — no need to guess intent from the active
  // window. That auto-detection predates the dedicated dictation shortcut
  // (when a single shortcut had to infer meeting-vs-dictation), and left
  // unforced sessions started via the recording shortcut misclassified as
  // 'dictation' whenever the focused app wasn't on the meeting-app list.
  let type: 'meeting' | 'dictation' =
    forceType === 'dictation' ? 'dictation' : 'meeting';
  if (_e2eNextSessionForceMeeting) {
    type = 'meeting';
    _e2eNextSessionForceMeeting = false;
  }
  log('[transcriber:session-start] type:', type);
  transcriberService.beginSession(startedAt ?? Date.now(), type);
  startTrayAnimation();
});
```

- [ ] **Step 4: Run the test file to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/main/ipc/__tests__/transcriber.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Update `preload.ts`'s `startSession` type**

In `src/main/preload.ts`, replace (currently lines 46-53):

```ts
    startSession: (
      startedAt: number,
      options?: { forceType?: 'dictation'; pasteOnComplete?: boolean },
    ) =>
      ipcRenderer.invoke(CHANNELS.TRANSCRIBER.SESSION_START, {
        startedAt,
        ...options,
      }),
```

with:

```ts
    startSession: (
      startedAt: number,
      options?: { forceType?: 'dictation' },
    ) =>
      ipcRenderer.invoke(CHANNELS.TRANSCRIBER.SESSION_START, {
        startedAt,
        ...options,
      }),
```

- [ ] **Step 6: Update `useRecordingFlow.ts`**

In `src/renderer/hooks/useRecordingFlow.ts`, remove `pasteOnComplete` from the `handleToggleCapture` options type (currently lines 97-101):

```ts
  const handleToggleCapture = useCallback(
    async (sessionOptions?: {
      forceType?: 'dictation';
    }) => {
```

Replace `handleToggleDictation` (currently lines 190-194):

```ts
const handleToggleDictation = useCallback(
  () => handleToggleCapture({ forceType: 'dictation', pasteOnComplete: false }),
  [handleToggleCapture],
);
```

with:

```ts
const handleToggleDictation = useCallback(
  () => handleToggleCapture({ forceType: 'dictation' }),
  [handleToggleCapture],
);
```

- [ ] **Step 7: Run the full backend + frontend suites to check for regressions**

Run: `node node_modules/vitest/vitest.mjs run src/main src/renderer src/__tests__`
Expected: PASS (no test in the renderer suite currently asserts on `pasteOnComplete`, confirmed via prior search — this step is a regression check, not expected to surface new failures)

- [ ] **Step 8: Commit**

```bash
git add src/main/ipc/transcriber.ts src/main/ipc/__tests__/transcriber.test.ts src/main/preload.ts src/renderer/hooks/useRecordingFlow.ts
git commit -m "refactor: remove pasteOnComplete plumbing from session-start IPC"
```

---

### Task 5: New `pastePreferences` + `listRunningApps` IPC/preload surface

**Files:**

- Modify: `src/lib/ipc-channels.ts`
- Modify: `src/main/ipc/settings.ts`
- Modify: `src/main/preload.ts`

**Interfaces:**

- Consumes: `getPastePreferences`/`savePastePreferences` (Task 1), `listRunningApps` (Task 2).
- Produces: `electronAPI.settings.paste.get(): Promise<PastePreferences>`, `electronAPI.settings.paste.update(prefs: Record<string, unknown>): Promise<{ success: boolean; message?: string }>`, `electronAPI.settings.paste.listRunningApps(): Promise<string[]>`.

- [ ] **Step 1: Add IPC channel constants**

In `src/lib/ipc-channels.ts`, add after the `UI_PREFERENCES` block:

```ts
  PASTE_PREFERENCES: {
    GET: 'pastePreferences:get',
    UPDATE: 'pastePreferences:update',
  },
  SYSTEM: {
    LIST_RUNNING_APPS: 'system:list-running-apps',
  },
```

- [ ] **Step 2: Register the IPC handlers**

In `src/main/ipc/settings.ts`, add to the existing import from `'../store'` (alongside `getUIPreferences`, `saveUIPreferences`, etc.):

```ts
  getPastePreferences,
  savePastePreferences,
  type PastePreferences,
```

Add a new import:

```ts
import { listRunningApps } from '../active-window';
```

Add handlers after the `UI Preferences` block (following the exact same shape as `AUDIO_PREFERENCES`):

```ts
// Paste Preferences
ipcMain.handle(CHANNELS.PASTE_PREFERENCES.GET, async () => {
  return getPastePreferences();
});

ipcMain.handle(
  CHANNELS.PASTE_PREFERENCES.UPDATE,
  async (_event, prefs: Partial<PastePreferences>) => {
    try {
      savePastePreferences(prefs);
      return { success: true };
    } catch (error) {
      logError('[IPC] Error updating paste preferences:', error);
      return { success: false, message: String(error) };
    }
  },
);

ipcMain.handle(CHANNELS.SYSTEM.LIST_RUNNING_APPS, async () => {
  return listRunningApps();
});
```

- [ ] **Step 3: Add preload methods**

In `src/main/preload.ts`, inside the `settings: { ... }` object, add after the `ui: { ... }` block:

```ts
    paste: {
      get: () => ipcRenderer.invoke(CHANNELS.PASTE_PREFERENCES.GET),
      update: (prefs: Record<string, unknown>) =>
        ipcRenderer.invoke(CHANNELS.PASTE_PREFERENCES.UPDATE, prefs),
      listRunningApps: (): Promise<string[]> =>
        ipcRenderer.invoke(CHANNELS.SYSTEM.LIST_RUNNING_APPS),
    },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: No new errors. (No dedicated IPC test is added here, matching the existing precedent that `AUDIO_PREFERENCES`/`UI_PREFERENCES` handlers in `settings.ts` also have no direct test coverage in `ipc/__tests__/settings.test.ts` — that file only covers the onboarding-flag handlers.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ipc-channels.ts src/main/ipc/settings.ts src/main/preload.ts
git commit -m "feat: add pastePreferences and listRunningApps IPC surface"
```

---

### Task 6: Settings UI — Transcription pane paste allow-list section

**Files:**

- Modify: `src/renderer/pages/Settings.tsx`
- Modify: `src/renderer/pages/settings/TranscriptionPane.tsx`
- Modify: `src/testing/electronMocks.ts`
- Modify: `src/__tests__/pages/Settings.test.tsx`

**Interfaces:**

- Consumes: `electronAPI.settings.paste.get/update/listRunningApps` (Task 5), `electronAPI.platform` (existing).
- Produces: a new `TranscriptionPane` section, gated on `platform === 'darwin'`.

- [ ] **Step 1: Write the failing renderer test**

In `src/__tests__/pages/Settings.test.tsx`, add a new test in the `describe('Settings Page', ...)` block, after the existing "should show Transcription pane and model options when active" test:

```ts
  it('should show the paste-on-complete section in the Transcription pane', async () => {
    mockActivePane = 'transcription';
    render(
      <UIPreferencesProvider>
        <MemoryRouter>
          <Settings transcriber={mockTranscriber} />
        </MemoryRouter>
      </UIPreferencesProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Paste on Complete')).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Add the `paste` mock to the shared electron mock**

In `src/testing/electronMocks.ts`, inside the `settings: { ... }` object, add after the `ui: { ... }` block:

```ts
      paste: {
        get: vi.fn(async () => ({ enabled: false, allowedApps: [] })),
        update: vi.fn(async () => ({ success: true })),
        listRunningApps: vi.fn(async () => []),
      },
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pages/Settings.test.tsx`
Expected: FAIL — "Paste on Complete" text not found (`TranscriptionPane` doesn't render the section yet).

- [ ] **Step 4: Add state, load effect, and handler to `Settings.tsx`**

Add state after the `audioPrefs` declaration (currently ending at line 60):

```ts
const [pastePrefs, setPastePrefs] = useState<{
  enabled: boolean;
  allowedApps: string[];
}>({ enabled: false, allowedApps: [] });
const [runningApps, setRunningApps] = useState<string[]>([]);
```

In the `loadAllPrefs` effect (currently lines 121-162), add `paste` to the `Promise.all` destructure and add the running-apps fetch. Replace:

```ts
const [recording, app, audio, model] = await Promise.all([
  window.electronAPI.settings.recording.get(),
  window.electronAPI.settings.app.get(),
  window.electronAPI.settings.audio.get(),
  window.electronAPI.settings.model.get(),
]);

if (recording) {
  setAutoRecordMode(recording.autoRecordMode || 'manual');
}
if (app) {
  setAppPrefs((prev) => ({ ...prev, ...app }));
}
if (audio) {
  setAudioPrefs((prev) => ({ ...prev, ...audio }));
}
if (model) {
  setModelPrefs((prev) => ({ ...prev, ...model }));
}
```

with:

```ts
const [recording, app, audio, model, paste] = await Promise.all([
  window.electronAPI.settings.recording.get(),
  window.electronAPI.settings.app.get(),
  window.electronAPI.settings.audio.get(),
  window.electronAPI.settings.model.get(),
  window.electronAPI.settings.paste.get(),
]);

if (recording) {
  setAutoRecordMode(recording.autoRecordMode || 'manual');
}
if (app) {
  setAppPrefs((prev) => ({ ...prev, ...app }));
}
if (audio) {
  setAudioPrefs((prev) => ({ ...prev, ...audio }));
}
if (model) {
  setModelPrefs((prev) => ({ ...prev, ...model }));
}
if (paste) {
  setPastePrefs((prev) => ({ ...prev, ...paste }));
}

const apps = await window.electronAPI.settings.paste.listRunningApps();
if (apps) setRunningApps(apps);
```

Add a handler after `updateAudioPref` (currently ending at line 191):

```ts
async function updatePastePref(key: 'enabled' | 'allowedApps', value: unknown) {
  const newPrefs = { ...pastePrefs, [key]: value };
  setPastePrefs(newPrefs);
  await window.electronAPI.settings.paste.update({ [key]: value });
}

async function refreshRunningApps() {
  const apps = await window.electronAPI.settings.paste.listRunningApps();
  if (apps) setRunningApps(apps);
}
```

Pass the new props to `TranscriptionPane` (currently lines 404-432) — add after `handleDeleteBuiltin={handleDeleteBuiltin}`:

```tsx
              pastePrefs={pastePrefs}
              updatePastePref={updatePastePref}
              runningApps={runningApps}
              refreshRunningApps={refreshRunningApps}
              platform={window.electronAPI.platform}
```

- [ ] **Step 5: Add the section to `TranscriptionPane.tsx`**

Add to the destructured props (currently ending at line 105, right before the closing `}) {`):

```ts
  pastePrefs,
  updatePastePref,
  runningApps,
  refreshRunningApps,
  platform,
}: {
```

and to the accompanying prop-types block (add alongside the other type entries, matching the existing style):

```ts
  pastePrefs: { enabled: boolean; allowedApps: string[] };
  updatePastePref: (
    key: 'enabled' | 'allowedApps',
    value: unknown,
  ) => Promise<void>;
  runningApps: string[];
  refreshRunningApps: () => Promise<void>;
  platform: string;
```

Add the new section right after the `Language` section's closing `</div>` (currently line 519, just before the component's final closing `</div>\n  );\n}`):

```tsx
{
  platform === 'darwin' && (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel>Paste on Complete</SectionLabel>
      <div className="s-card-rows">
        <SettingRow
          title="Paste transcript into active app when dictation completes"
          description="Only pastes when the focused app is checked below."
          actions={
            <SettingSwitch
              checked={pastePrefs.enabled}
              onChange={(v) => updatePastePref('enabled', v)}
            />
          }
        />
        {pastePrefs.enabled && (
          <>
            <SettingRow
              title="Allowed apps"
              actions={
                <button className="s-btn" onClick={() => refreshRunningApps()}>
                  Refresh
                </button>
              }
            />
            {Array.from(
              new Set([...runningApps, ...pastePrefs.allowedApps]),
            ).map((appName) => (
              <SettingRow
                key={appName}
                title={appName}
                actions={
                  <SettingSwitch
                    checked={pastePrefs.allowedApps.includes(appName)}
                    onChange={(checked) => {
                      const nextAllowed = checked
                        ? [...pastePrefs.allowedApps, appName]
                        : pastePrefs.allowedApps.filter((a) => a !== appName);
                      updatePastePref('allowedApps', nextAllowed);
                    }}
                  />
                }
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pages/Settings.test.tsx`
Expected: PASS (all tests in the file — the shared electron mock defaults `platform: 'darwin'`, so the new section renders)

- [ ] **Step 7: Manual verification in the real app**

Per this repo's CLAUDE.md, renderer changes should be checked in the actual running app, not just Vitest:

Run: `npm run build && npm start` (or the project's existing dev script)

- Open Settings → Transcription, confirm the "Paste on Complete" section appears (macOS only).
- Toggle the switch on, confirm the app list populates from currently running apps.
- Check an app (e.g. Terminal), start a dictation session, switch focus to Terminal, stop dictation, confirm the transcript pastes.
- Switch focus to an app _not_ checked, repeat — confirm it does NOT paste.
- Click "Refresh" and confirm the list re-scans without losing existing checked apps.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/pages/Settings.tsx src/renderer/pages/settings/TranscriptionPane.tsx src/testing/electronMocks.ts src/__tests__/pages/Settings.test.tsx
git commit -m "feat: add dictation paste allow-list to Settings > Transcription"
```
