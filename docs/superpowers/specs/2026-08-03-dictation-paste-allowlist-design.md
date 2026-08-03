# Dictation Paste Allow-List — Design

## Problem

Auto-pasting the transcribed text after a dictation session finishes has
regressed three times because it was controlled by a `pasteOnComplete: boolean`
flag hardcoded in the renderer (`useRecordingFlow.ts`'s `handleToggleDictation`),
plumbed through IPC into `TranscriberService`. There is no user-facing setting,
so the only way to "turn it off" was editing that literal — which future edits
to the same hook kept undoing.

This spec replaces that flag with a real Settings → Transcription control: an
enable switch plus an allow-list of apps. Auto-paste only fires when the
switch is on _and_ the app currently focused when transcription completes is
on the allow-list.

## Scope

macOS only. The existing paste mechanism (`pasteTextToActiveWindow` in
`src/main/util.ts`) shells out to an AppleScript `keystroke "v"` and has no
Windows/Linux implementation. `active-window.ts`'s active-window detection
supports macOS and Windows but not Linux; the new running-apps listing
(below) is macOS-only. The whole settings section is hidden on non-macOS
platforms. A Windows paste mechanism is out of scope for this change and can
be a separate follow-up.

## Root-cause fix: remove `pasteOnComplete`

`TranscriberService` already tracks `this.sessionType: 'meeting' | 'dictation'`
internally, making the separately-passed `pasteOnComplete` boolean redundant —
and it's the exact flag that kept regressing. This spec removes it entirely:

- `useRecordingFlow.ts`'s `handleToggleDictation` no longer passes
  `pasteOnComplete`.
- `preload.ts`'s session-start option type drops the `pasteOnComplete` field.
- `ipc/transcriber.ts`'s session-start handler no longer reads/forwards it.
- `TranscriberService.beginSession()` drops the `pasteOnComplete` option and
  the `this.pasteOnComplete` field.

Paste eligibility is now derived, not passed in.

## Storage & schema

`src/main/store/schema.ts` — new preference domain, following the existing
`*Preferences` pattern:

```ts
export interface PastePreferences {
  enabled: boolean;
  allowedApps: string[]; // app names as returned by getActiveWindow().owner.name
}
```

Default: `{ enabled: false, allowedApps: [] }` (feature ships off).

Added to `StoreSchema` as `pastePreferences?: PastePreferences`.

`src/main/store/preferences.ts` — `getPastePreferences()` / `savePastePreferences()`,
mirroring `getAudioPreferences()`/`saveAudioPreferences()` etc.

## Main process changes

### `active-window.ts`

New export `listRunningApps(): Promise<string[]>` — macOS-only, using
`System Events` (`get name of every process whose background only is false`),
returning de-duplicated app names. Separate AppleScript call from
`getActiveWindow()` (which gets only the single frontmost app). Same
`execFileAsync` pattern as the existing functions, so no shell-injection
surface changes.

On non-macOS platforms, resolves to `[]`.

### `services/transcriber.ts`

Replace the `pasteOnComplete`-gated logic at the three existing call sites
(`endSession()` ~line 293, `recoverLateSegment()` ~line 638, and the
already-disabled per-segment path at ~line 736 gated by `shouldPasteText()`,
which is untouched — separate/independent kill switch) with a single new
helper:

```ts
async function shouldPasteForSession(
  sessionType: 'meeting' | 'dictation',
): Promise<boolean> {
  if (sessionType !== 'dictation') return false;

  const prefs = getPastePreferences();
  if (!prefs.enabled || prefs.allowedApps.length === 0) return false;

  const activeWindow = await getActiveWindow();
  if (!activeWindow) return false; // safe default: no info => no paste

  return prefs.allowedApps.includes(activeWindow.owner.name);
}
```

`endSession()` and `recoverLateSegment()` call this instead of reading
`this.pasteOnComplete`/`meta.pasteOnComplete`. The `lastSessionMeta` snapshot
still records `sessionType` (needed by `recoverLateSegment()`, which runs
after the session object's state may have moved on) but no longer records
`pasteOnComplete`.

## IPC / preload surface

- `pastePreferences.get` / `pastePreferences.save` — new IPC channels and
  preload methods, following the existing preference-domain pattern (see
  audio/UI preferences in `preload.ts`).
- `system.listRunningApps()` — new IPC channel + preload method. Macos-only;
  resolves to `[]` elsewhere.

## Renderer: Settings → Transcription UI

New section in `src/renderer/pages/settings/TranscriptionPane.tsx`, hidden
entirely when `listRunningApps()`'s platform check indicates non-macOS:

- `SettingSwitch` — "Paste transcript into active app when dictation
  completes."
- When enabled: a checkbox list of app names, built from the union of
  currently-running apps (fetched via `listRunningApps()` on pane mount) and
  whatever's already saved in `allowedApps` (so a previously-checked app that
  isn't currently running — e.g. a closed Terminal — stays in the list,
  checked).
- A "Refresh" button re-runs `listRunningApps()` and re-merges with the saved
  list (never drops a previously-checked app just because it's not running
  right now).
- Each checkbox toggle saves immediately via `pastePreferences.save` — no
  separate Save button, matching the rest of the pane.

## Error handling

- `getActiveWindow()` / `listRunningApps()` failures (AppleScript error,
  Accessibility permission not granted, timeout) resolve to `undefined`/`[]`
  rather than throwing — paste is skipped, running-apps list is just empty.
  No new user-facing error surface for this; existing `log.error` calls in
  `active-window.ts` cover it.

## Testing

- New unit tests for `shouldPasteForSession()` covering: non-dictation
  session, feature disabled, empty allow-list, app not in list, app in list,
  `getActiveWindow()` returning `undefined`.
- New unit tests for `listRunningApps()` (mocking `execFileAsync`) and for
  `getPastePreferences()`/`savePastePreferences()`.
- Update `src/main/__tests__/transcriber-integration.test.ts`'s
  `'TranscriberService — dictation-shortcut paste-on-complete'` describe
  block (~line 305) to drop `pasteOnComplete`-based setup and instead mock
  `getPastePreferences()`/`getActiveWindow()`.
- Update `src/main/ipc/__tests__/transcriber.test.ts` to remove assertions
  about `pasteOnComplete` forwarding (the IPC no longer accepts that field).
- No e2e coverage exists for paste behavior today; none is added by this
  spec (pre-existing gap, not introduced here).

## Out of scope

- Windows/Linux paste support.
- Any change to the existing, independent `shouldPasteText()` per-segment
  kill switch in `util.ts` (stays hardcoded `false`, unrelated code path).
