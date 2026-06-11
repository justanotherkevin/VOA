# VOA

A desktop app that captures audio (mic, system, or both) and transcribes it using local AI models.

## Language

**Recording**:
A completed audio capture session with a transcript. Every save to persistent storage is a Recording, regardless of who was speaking or whether other people were present.
_Avoid_: Session, transcript, entry

**Meeting**:
A Recording where another person or application was detected during capture (e.g. Zoom, Google Meet, Teams). Auto-detected via the active window; can be manually overridden.
_Avoid_: Call, conference

**Monologue**:
A Recording where the user was speaking alone — no meeting app was detected. The default type when auto-detection finds no meeting context.
_Avoid_: Solo recording, note, dictation

**Recording Type**:
An attribute of every Recording. One of `"meeting"` or `"monologue"`. Set automatically at recording start based on MeetingDetector; user can override after the fact.
_Avoid_: Mode, category

**Session**:
The in-progress audio capture between pressing start and pressing stop. A Session becomes a Recording when it ends and is persisted. Sessions are transient; Recordings are permanent.
_Avoid_: Recording (when referring to the in-progress state)

**VAD Segment**:
A chunk of mic audio bounded by detected speech. VAD (Voice Activity Detection) splits continuous mic audio into segments separated by silence pauses. Multiple segments within one Session are merged into a single Recording.
_Avoid_: Chunk, clip

**System Audio**:
Audio captured from the Mac's loopback — everything playing through the speakers. Recorded in parallel with mic audio during a Session when enabled. Labeled `[System]` in transcripts when both sources are present.
_Avoid_: Meeting audio, loopback audio (in user-facing contexts)

**Transcript**:
The full text output of transcribing a Recording's audio. A property of a Recording, not a standalone entity.
_Avoid_: Transcription (as a noun for the saved result)

**Summary**:
A short AI-generated paragraph distilling the key points of a Recording's transcript. Produced asynchronously after the Recording is saved. Applied to both Meeting and Monologue recordings.
_Avoid_: Abstract, overview

**Action Items**:
A list of AI-extracted tasks or follow-ups identified in a Recording's transcript. Produced alongside the Summary after saving. Applied to both Meeting and Monologue recordings — a Monologue can contain tasks just as a Meeting can.
_Avoid_: To-dos, tasks

**Tag**:
An AI-inferred topic label extracted from a Recording's transcript after saving. Not yet implemented. Intended purpose: link related Recordings by shared topics and enable topic-based search across the library. Tags are derived from content, not entered by the user.
_Avoid_: Label, category, user tag

**Participant**:
A named person whose voice appears in a Recording. Not yet implemented. Intended future use: tag each spoken sentence in the transcript to a specific participant (speaker diarisation). Currently stored as an empty array on every Recording.
_Avoid_: Speaker, attendee

## Example dialogue

> **Dev:** When the user records a Zoom call, what do we save?
> **Domain expert:** A Recording with type "meeting". The transcript has `[Mic]` and `[System]` labels interleaved since both sources were captured.
>
> **Dev:** What if they just open the app and start talking with no meeting app open?
> **Domain expert:** That's a Monologue — same Recording structure, type is "monologue", transcript has no labels since it's mic-only.
>
> **Dev:** Can a Session produce more than one Recording?
> **Domain expert:** No. One Session always produces exactly one Recording (or nothing, if there's no audio).
