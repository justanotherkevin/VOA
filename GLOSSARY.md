# VOA

VOA records audio on the user's device and turns it into text, summaries, and action items without sending the audio to another server.

## Language

### Capture

**Recording**:
Any single audio capture session, from the moment capture starts until it stops. Every Recording is exactly one kind, e.g., a Meeting or a Dictation, and the user picks the kind when capture starts. A Recording keeps its Transcript but not the audio.
_Avoid_: Session, transcript (when you mean the whole capture)

**Meeting**:
A Recording made so that the conversation can be reviewed and summarized later. The number of people speaking does not decide whether a Recording is a Meeting.
_Avoid_: Call, recording (when you mean a Meeting specifically)

**Dictation**:
A Recording made so that the spoken words get placed into the app the user is working in.
_Avoid_: Voice note, voice memo

### Output

**Transcript**:
The text of everything that was said during a Recording.
_Avoid_: Notes

**Summary**:
A shorter version of a Meeting's Transcript that states what was discussed.
_Avoid_: Meeting notes, notes

**Notes**:
Text that the user writes themselves during or after a Meeting.
_Avoid_: Summary, meeting notes
