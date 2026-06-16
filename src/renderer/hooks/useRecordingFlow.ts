import { useEffect, useCallback, useRef, useState } from 'react';

export const CHUNK_INTERVAL_MS = 5 * 60 * 1000;
import type { Transcriber } from '@/renderer/hooks/useTranscriber';
import type { UseAudioRecorderReturn } from '@/renderer/hooks/useAudioRecorder';
import type { UseSystemAudioRecorderReturn } from '@/renderer/hooks/useSystemAudioRecorder';
import { finalizeRecordingAndTranscribe } from '@/renderer/utils/RecordingUtils';
import { useNotificationFlow } from '@/renderer/hooks/useNotificationFlow';
import { useMeetingDetector } from '@/renderer/hooks/useMeetingDetector';
import {
  setupRecordingFlowTestHooks,
  cleanupRecordingFlowTestHooks,
  setRecordingActiveForTests,
  exposeSystemAudioSetterForTests,
  cleanupSystemAudioSetterForTests,
} from '@/renderer/testing/TestHooks';

interface UseRecordingFlowParams {
  audioRecorder: UseAudioRecorderReturn;
  systemAudioRecorder: UseSystemAudioRecorderReturn;
  transcriber: Transcriber;
}

/**
 * Hook that orchestrates the recording workflow and transcription pipeline:
 * 1. Listens for recording toggle events from main process (global shortcut)
 * 2. Toggles recording on/off
 * 3. Initiates transcription when recording stops
 *
 * Notification State Responsibility:
 * - Renderer: Handles ALL notification states
 *   "Recording Started" → "Recording Stopped" → "Processing" → "Transcribing" → "Done"
 * - Main process: Only sends 'recording:toggle' IPC event (no notification updates)
 * - IPC handler (notifications.ts): Auto-fetches activeWindow when state is 'recording'
 *
 * This hook should be initialized at the app level (e.g., in Home component)
 * to ensure recording logic persists regardless of UI component visibility.
 */
export function useRecordingFlow({
  audioRecorder,
  systemAudioRecorder,
  transcriber,
}: UseRecordingFlowParams): void {
  const transcriberRef = useRef(transcriber);
  const deltaIndexRef = useRef(0);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
  // Tracks whether a session was explicitly started so the done-trigger never
  // misfires on mount or when transcript.output is undefined (VAD-only mode
  // never sets transcriber.isBusy, so we can't rely on that signal).
  const hasActiveSessionRef = useRef(false);
  const {
    isRecording,
    startRecording,
    stopRecording,
    setOnRecordingComplete,
    cleanup,
  } = audioRecorder;
  const { startSystemRecording, stopSystemRecording } = systemAudioRecorder;

  // Keep a ref so handleToggleRecording always reads the latest value without
  // needing to be recreated (and without the onRecordingToggle listener
  // being re-registered) every time systemAudioEnabled changes.
  const systemAudioEnabledRef = useRef(systemAudioEnabled);
  useEffect(() => {
    systemAudioEnabledRef.current = systemAudioEnabled;
  }, [systemAudioEnabled]);

  useEffect(() => {
    window.electronAPI.settings.recording.get().then((prefs: any) => {
      setSystemAudioEnabled(!!prefs?.systemAudioEnabled);
    });
  }, []);
  const {
    showRecordingStart,
    showRecordingStopped,
    showProcessing,
    showError,
    showDone,
    showIdle,
    showMeetingDetected,
    showMeetingEnded,
  } = useNotificationFlow();

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      setIsRecordingActive(false);
      stopRecording();
      // Read from ref so this handler never has a stale systemAudioEnabled value,
      // even when re-wiring of the recording:toggle listener is still in flight.
      if (systemAudioEnabledRef.current) stopSystemRecording();
      showRecordingStopped();
      showProcessing();
    } else {
      const sessionStartedAt = Date.now();
      hasActiveSessionRef.current = true;
      setIsRecordingActive(true);
      await startRecording();
      if (systemAudioEnabledRef.current) startSystemRecording();
      window.electronAPI.transcriber.startSession(sessionStartedAt);
      showRecordingStart();
    }
  }, [
    isRecording,
    startRecording,
    stopRecording,
    startSystemRecording,
    stopSystemRecording,
    showRecordingStart,
    showRecordingStopped,
    showProcessing,
  ]);

  // Meeting detector integration:
  // - auto/auto-stop modes trigger recording directly
  // - ask mode shows a notification prompt so user can decide to start recording
  // - onEnded dismisses the in-meeting notification when the meeting window closes
  useMeetingDetector({
    onAutoStart: useCallback(() => {
      if (!isRecording) handleToggleRecording();
    }, [isRecording, handleToggleRecording]),
    onAutoStop: useCallback(() => {
      if (isRecording) handleToggleRecording();
    }, [isRecording, handleToggleRecording]),
    onAsk: useCallback((event) => {
      showMeetingDetected(event.appName, event.meetingKey);
    }, [showMeetingDetected]),
    onEnded: useCallback(() => {
      showMeetingEnded();
    }, [showMeetingEnded]),
  });

  // Expose isRecordingActive for test coordination
  useEffect(() => {
    setRecordingActiveForTests(isRecordingActive);
  }, [isRecordingActive]);

  // Expose systemAudioEnabled getter+setter for E2E tests
  useEffect(() => {
    exposeSystemAudioSetterForTests(
      () => systemAudioEnabledRef.current,
      setSystemAudioEnabled,
    );
    return () => cleanupSystemAudioSetterForTests();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI.settings.shortcuts.on.recordingToggle(() => {
      handleToggleRecording();
    });

    return () => {
      unsubscribe();
    };
  }, [handleToggleRecording]);
  // Use ref to capture transcriber without triggering re-setup
  useEffect(() => {
    transcriberRef.current = transcriber;
  }, [transcriber]);

  const handleRecordingComplete = useCallback(
    async (chunks: Blob[], mimeType: string, startTime: number | null) => {
      try {
        // Note: showProcessing already called in handleToggleRecording when stopping
        await finalizeRecordingAndTranscribe({
          chunks,
          mimeType,
          startTime,
          setRecordedBlob: () => {}, // Not used in this context
          setAudioUrl: () => {}, // Not used in this context
          transcriber: transcriberRef.current,
        });
      } catch (error) {
        showError('Failed to process audio');
      }
    },
    [showError],
  );

  // Set up the recording complete callback (only once on mount)
  useEffect(() => {
    setOnRecordingComplete(handleRecordingComplete);

    // Expose for E2E testing - allows tests to trigger recording complete with mock chunks
    setupRecordingFlowTestHooks({
      triggerRecordingComplete: handleRecordingComplete,
    });

    return () => {
      setOnRecordingComplete(null);
      cleanupRecordingFlowTestHooks();
    };
  }, [handleRecordingComplete, setOnRecordingComplete]);

  // Send transcript deltas to the summarizer at regular intervals while recording.
  // Resets the delta index each session so only new text is sent on each tick.
  useEffect(() => {
    if (!isRecordingActive) return;

    deltaIndexRef.current = 0;

    const timer = setInterval(() => {
      const text = transcriberRef.current.output?.text ?? '';
      const delta = text.slice(deltaIndexRef.current).trim();
      if (delta) {
        deltaIndexRef.current = text.length;
        window.electronAPI.summarizer.submitChunk(delta);
      }
    }, CHUNK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isRecordingActive]);

  // When recording stops, end the session and transition to done state.
  // Uses hasActiveSessionRef instead of transcriber.output?.text because VAD-only
  // mode never sets transcriber.isBusy, so transcript text may be undefined when
  // recording stops for the first time (causing the notification to hang in processing).
  useEffect(() => {
    if (!isRecordingActive && !transcriber.isBusy && hasActiveSessionRef.current) {
      hasActiveSessionRef.current = false;
      console.log('[RecordingFlow] Session ending — isRecordingActive:', isRecordingActive, 'isBusy:', transcriber.isBusy);
      window.electronAPI.transcriber.endSession(Date.now());
      showDone();

      // Schedule cleanup and reset after animation completes (300ms fade)
      const cleanupTimer = setTimeout(() => {
        cleanup();
        showIdle();
        setIsRecordingActive(false);
      }, 300);

      return () => clearTimeout(cleanupTimer);
    }
  }, [
    isRecordingActive,
    transcriber.isBusy,
    cleanup,
    showDone,
    showIdle,
  ]);
}
