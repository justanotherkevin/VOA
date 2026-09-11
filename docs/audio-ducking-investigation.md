# Recording/Dictation Ducks Other Apps' Audio

## Status (current)

Partially fixed, not solved. Starting a recording or dictation session still
audibly disturbs whatever else is playing (YouTube, music) on at least one
common setup (Bluetooth mic/output, e.g. AirPods). One real fix landed
(constraint consistency across mic streams); one experiment was tried and
reverted at the user's request (mute system output during dictation, Wispr
Flow's approach — technically worked, but the user prefers hearing the ducked
audio over silence). The actual root-cause fix (native mic capture, bypassing
Chromium's `getUserMedia`) was scoped but not built. Leaving this here for
whoever picks it up next.

## Problem

The moment a recording or dictation session starts, other apps' audio gets
quieter and/or distorted (a playing YouTube video, Spotify, etc.). Reported
as recurring — apparently "solved before," but nothing in git history,
`docs/`, or `CHANGELOG.md` records an earlier fix, so either the earlier fix
was never committed, or the setup at the time (different mic, different macOS
version) just didn't trigger it.

## Root causes (there are two, and they stack)

### 1. macOS ducks all other audio when a "voice processing" mic stream opens

Any `getUserMedia({ audio: { echoCancellation: true } })` call on macOS can
route the mic through Core Audio's `VoiceProcessingIO` audio unit. Apple
deliberately ducks every other sound on the machine while that unit is active
— it's the same mechanism a phone/video call uses to make your voice clearer.
This is a known, still-open Apple complaint
([forum thread since 2020](https://developer.apple.com/forums/thread/664346)),
not something VOA is doing wrong per se.

**Chromium will not let you fully opt out of this via JS constraints.**
`echoCancellation: false` reduces but does not guarantee zero audio
processing on macOS — Chromium's own tracker has closed requests for finer
control as "Won't Fix / Intended Behavior"
([issue 327472528](https://issues.chromium.org/issues/327472528),
[bug 486656](https://bugs.chromium.org/p/chromium/issues/detail?id=486656)).

**What was found and fixed (this investigation):** three separate places
opened their own mic stream with conflicting settings — a classic drift bug,
not a deliberate design:

| File | Before | After |
|---|---|---|
| `src/renderer/hooks/useAudioRecorder.ts` | `echoCancellation/AGC/noiseSuppression: false` (correct, original) | unchanged |
| `src/renderer/hooks/useVAD.ts` | `true` (copied from `@ricky0123/vad-web`'s own library defaults when the app took ownership of `getStream`/`resumeStream` in commit `951c3af`) | `false` — now matches the recorder |
| `src/renderer/components/live-waveform.tsx` | `true` (hardcoded, notification-window mic meter) | `false` — now matches the recorder |

This is a real, shipped fix (see git log for the commit on this file's date).
It removes one trigger for the ducking, but macOS/Chromium's own AEC decision
isn't fully controllable from JS, so it does **not** guarantee ducking never
happens again, especially not for reason #2 below.

**If a fourth mic-opening call site ever gets added**, it needs to use the
same three `false` flags or this regresses again. There is no single shared
constant for this yet — `src/renderer/utils/MicConstraints.ts` currently only
handles device-ID selection, not the processing flags. Worth consolidating if
this bites again.

### 2. Bluetooth mic (AirPods) forces a lower-quality output profile

Independent of the above: the moment **any** app opens the AirPods'
microphone, macOS drops the AirPods out of high-quality stereo output
(AAC/A2DP) into a mono, lower-bitrate "phone call" profile (HFP). This is a
Bluetooth hardware/profile limitation, not a Core Audio ducking setting, and
`echoCancellation: false` does nothing for it. Confirmed against a direct
competitor with the same problem: Wispr Flow (another dictation app) documents
this exact issue and ships two mitigations — switch off the Bluetooth mic, or
mute system audio while dictating
([Wispr Flow help](https://docs.wisprflow.ai/articles/8533503284-knwon-audio-playback-airpod-issues-ios-macos)).

This is almost certainly what the user is actually hitting day to day (their
setup: AirPods). Testing confirmed it happens even on dictation (F2, mic-only,
no system-audio loopback involved), ruling out the meeting-recording loopback
path as the cause.

## What was tried

### A. Match constraints across all mic streams — kept

Described above. Real, low-risk fix, already committed. Necessary but not
sufficient.

### B. Mute system output during dictation (Wispr-Flow-style) — reverted

Prototype: on dictation start, mute system output via `osascript`
(`set volume output muted true`); restore the previous mute state on stop
(explicit stop path + a teardown safety net for error paths). New
`src/main/utils/systemOutputMute.ts`, IPC channel
`system-audio:set-capture-mute`, wired through `useRecordingFlow.ts`.

This worked as designed (build passed, backend/frontend tests passed,
verified against the real app) — user confirmed it functioned, then asked
for it to be reverted: **"i rather still have incoming ducked audio when i do
my dictation"** than have it go silent. Fully reverted; no trace left in the
tree. If someone wants this again, it's cheap to redo (see this doc's
Sources for the shape), ideally behind a Settings toggle (default off, like
Wispr) rather than hardcoded, so it's opt-in.

### C. Native mic capture (bypasses Chromium's `getUserMedia` entirely) — not built, real fix

Researched how Claude Code's own terminal `/voice` dictation avoids this
problem entirely: it does not use Chromium/`getUserMedia` at all. It captures
audio through a native binary (`.node` NAPI addon), falling back to shelling
out to `sox`/`rec` (macOS/Linux) or `arecord` (Linux) if that binary can't
load ([Claude Code docs](https://code.claude.com/docs/en/voice-dictation),
[GitHub issue confirming the native-module architecture](https://github.com/anthropics/claude-code/issues/34136)).
Because it's push-to-talk with no simultaneous playback to echo-cancel
against, it never opens a `VoiceProcessingIO` unit in the first place — there
is nothing to duck.

Apple also ships a real API for apps that *do* need voice processing but want
to control the ducking:
[`AVAudioVoiceProcessingOtherAudioDuckingConfiguration`](https://developer.apple.com/documentation/avfaudio/avaudiovoiceprocessingotheraudioduckingconfiguration)
(`duckingLevel`, `enableAdvancedDucking`) on `AVAudioInputNode`, and the
AudioUnit-level equivalent `AUVoiceIOOtherAudioDuckingConfiguration`. Neither
is reachable from `getUserMedia`/WebRTC — this is native Swift/AudioToolbox
surface only.

**The actual fix, if this needs to go away for good:** stop capturing the mic
through Chromium's `getUserMedia` in `useAudioRecorder.ts`/`useVAD.ts`, and
instead capture it natively from the Electron main process, e.g.:

- Shell out to `sox`/`rec` (same approach as Claude Code's own fallback),
  piping raw PCM back over IPC, or
- A small native Node addon around a plain (non-voice-processing)
  `AVAudioEngine` input tap — similar in spirit to the `electron-audio-loopback`
  native dependency this app already uses for system audio.

This is an architecture change, not a patch: `useAudioRecorder`, `useVAD`,
and `live-waveform.tsx` all currently consume a browser `MediaStream`
(`MediaRecorder`, `AudioContext`/`AnalyserNode`). Moving capture to the main
process means all three need to switch to consuming raw PCM over IPC instead.
Real effort, not attempted here — scoped only.

## If you pick this up

1. Confirm which cause you're chasing first — test on speakers/wired mic
   (cause #1, mostly mitigated) vs. AirPods (cause #2, unmitigated).
2. For AirPods specifically, the two options are: steer the app off the
   Bluetooth mic during capture (detect + auto-select built-in mic, or warn),
   or accept the mute-while-dictating tradeoff (see attempt B) as an opt-in
   setting.
3. For the "even non-Bluetooth ducking still happens sometimes" case, that's
   attempt C — the native-capture rewrite. Bigger lift, the only approach
   that removes the problem at the root instead of working around it.

## Sources

- [Apple Developer Forums — Audio ducking with VoiceProcessingIO](https://developer.apple.com/forums/thread/664346)
- [Chromium issue 327472528 — echoCancellation/noiseSuppression cannot be disabled on macOS](https://issues.chromium.org/issues/327472528)
- [Chromium bug 486656 — echoCancellation: false does not remove all audio processing](https://bugs.chromium.org/p/chromium/issues/detail?id=486656)
- [Chrome for Developers — macOS native echo cancellation](https://developer.chrome.com/blog/macos-native-echo-cancellation)
- [Wispr Flow — known audio playback / AirPods issues (macOS)](https://docs.wisprflow.ai/articles/8533503284-knwon-audio-playback-airpod-issues-ios-macos)
- [swissmacuser — AirPods suddenly change to low quality audio in macOS](https://swissmacuser.ch/airpods-suddenly-change-to-low-quality-audio-in-macos/)
- [Mitch's blog — force microphone when using AirPods on macOS](https://www.dermitch.de/post/macos-force-microphone-when-using-airpods/)
- [Claude Code Docs — Voice dictation](https://code.claude.com/docs/en/voice-dictation)
- [GitHub — anthropics/claude-code native audio-capture module issues](https://github.com/anthropics/claude-code/issues/34136)
- [Apple Developer Documentation — `AVAudioVoiceProcessingOtherAudioDuckingConfiguration`](https://developer.apple.com/documentation/avfaudio/avaudiovoiceprocessingotheraudioduckingconfiguration)
