# Navigation Map

## VOA

**recording**, **recordings list**, **saved recording**, **meeting** (legacy UI label)
→ `src/renderer/hooks/useMeetings.ts` (getMeetings, deleteMeeting, updateMeeting), `src/main/store.ts` (saveMeeting, getMeetings, updateMeeting)

**recording type**, **meeting/monologue classification**
→ `src/main/store.ts` (Meeting interface, saveMeeting), `src/main/services/meeting-detector.ts` (MeetingDetector)

**recording starts/stops**, **shortcut trigger**, **toggle recording**
→ `src/renderer/hooks/useRecordingFlow.ts` (handleToggleRecording), `src/renderer/hooks/useAudioRecorder.ts`

**transcription**, **processing**, **whisper**, **AI model**
→ `src/main/services/transcriber.ts` (TranscriberService, endSession, persistMeeting), `src/renderer/hooks/useTranscriber.ts`

**session**, **in-progress recording**, **begin/end session**
→ `src/main/services/transcriber.ts` (beginSession, endSession), `src/renderer/hooks/useRecordingFlow.ts`

**VAD**, **voice activity detection**, **segments**, **speech detection**
→ `src/renderer/hooks/useVAD.ts`, `src/main/services/transcriber.ts` (sessionSegments)

**system audio**, **loopback audio**, **meeting audio capture**
→ `src/renderer/hooks/useSystemAudioRecorder.ts`, `src/main/utils/audioHelper.ts` (startChunkRecorder), `src/main/preload/audioCapture.ts`

**notification pill**, **status overlay**, **recording indicator**
→ `src/renderer/hooks/useNotificationFlow.ts`, `src/main/notification-window.ts`

**meeting detection**, **auto-detect meeting app**, **zoom/meet/teams detection**
→ `src/main/services/meeting-detector.ts` (MeetingDetector), `src/renderer/hooks/useMeetingDetector.ts`

**settings**, **shortcut**, **keyboard shortcut**
→ `src/renderer/hooks/useShortcuts.ts`, `src/main/shortcut-manager.ts`

**summary**, **action items**, **AI enrichment**
→ `src/main/services/transcriber.ts` (enrichMeetingWithSummary), `src/main/pipeline/summarizer.ts`

**persistent storage**, **saving data**, **electron store**
→ `src/main/store.ts` (saveMeeting, getMeetings, updateMeeting, generateTitle)

**IPC channels**, **renderer↔main communication**
→ `src/lib/ipc-channels.ts`, `src/main/preload.ts`, `src/main/ipc/`
