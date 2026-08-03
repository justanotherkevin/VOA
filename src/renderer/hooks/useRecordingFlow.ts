import { useEffect, useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { Transcriber } from '@/renderer/hooks/useTranscriber';
import type { UseAudioRecorderReturn } from '@/renderer/hooks/useAudioRecorder';
import type { UseSystemAudioRecorderReturn } from '@/renderer/hooks/useSystemAudioRecorder';
import { finalizeRecordingAndTranscribe } from '@/renderer/utils/RecordingUtils';
import { useNotificationFlow } from '@/renderer/hooks/useNotificationFlow';
import { useMeetingDetector } from '@/renderer/hooks/useMeetingDetector';
import { useModelStatus } from '@/renderer/hooks/useModelStatus';
import {
  setupRecordingFlowTestHooks,
  cleanupRecordingFlowTestHooks,
  setRecordingActiveForTests,
  exposeSystemAudioCapabilitySetterForTests,
  cleanupSystemAudioCapabilitySetterForTests,
} from '@/renderer/testing/TestHooks';

export type AppStatus = 'idle' | 'recording' | 'loading';

interface UseRecordingFlowParams {
  audioRecorder: UseAudioRecorderReturn;
  systemAudioRecorder: UseSystemAudioRecorderReturn;
  transcriber: Transcriber;
}

interface UseRecordingFlowReturn {
  status: AppStatus;
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
}: UseRecordingFlowParams): UseRecordingFlowReturn {
  const transcriberRef = useRef(transcriber);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [systemAudioSupported, setSystemAudioSupported] = useState(false);
  const modelStatus = useModelStatus();
  // Tracks whether a session was explicitly started so the done-trigger never
  // misfires on mount or when transcript.output is undefined (VAD-only mode
  // never sets transcriber.isBusy, so we can't rely on that signal).
  const hasActiveSessionRef = useRef(false);
  // Tracks how the *currently active* session actually started: gates which
  // shortcut may stop it (see handleToggleCapture) and whether system audio
  // needs stopping (only started for meeting sessions).
  const isDictationSessionRef = useRef(false);
  const {
    isRecording,
    hasPendingVadSegment,
    startRecording,
    stopRecording,
    setOnRecordingComplete,
    cleanup,
  } = audioRecorder;
  const { startSystemRecording, stopSystemRecording } = systemAudioRecorder;

  // Keep a ref so handleToggleRecording always reads the latest value without
  // needing to be recreated (and without the onRecordingToggle listener
  // being re-registered) every time systemAudioSupported changes.
  const systemAudioSupportedRef = useRef(systemAudioSupported);
  useEffect(() => {
    systemAudioSupportedRef.current = systemAudioSupported;
  }, [systemAudioSupported]);

  useEffect(() => {
    window.electronAPI.audio.getCapability().then(setSystemAudioSupported);
  }, []);
  const {
    showRecordingStart,
    showLoading,
    showRecordingStopped,
    showProcessing,
    showError,
    showDone,
    showIdle,
    showMeetingDetected,
    showMeetingEnded,
  } = useNotificationFlow();

  const handleToggleCapture = useCallback(
    async (sessionOptions?: { forceType?: 'dictation' }) => {
      if (isRecording) {
        // Only the shortcut that matches the active session's type may stop it —
        // otherwise the other shortcut mid-session would stop the wrong capture
        // (e.g. dictation shortcut cutting off an in-progress meeting recording).
        const incomingIsDictation = sessionOptions?.forceType === 'dictation';
        if (incomingIsDictation !== isDictationSessionRef.current) {
          const activeLabel = isDictationSessionRef.current
            ? 'dictation'
            : 'meeting';
          toast.info(
            `Use the ${activeLabel} shortcut to stop the active ${activeLabel} session.`,
          );
          return;
        }
        const label = isDictationSessionRef.current ? 'Dictation' : 'Recording';
        setIsRecordingActive(false);
        stopRecording();
        // Dictation sessions never start system audio (see below), so never
        // stop it either. Meeting sessions always start it when supported.
        if (!isDictationSessionRef.current) {
          stopSystemRecording();
        }
        showRecordingStopped(label);
        showProcessing();
        setIsFinalizing(true);
      } else {
        const isDictation = sessionOptions?.forceType === 'dictation';
        // Meeting recordings require system audio (per product decision —
        // mic-only meeting capture isn't useful) so unsupported machines
        // block the whole session rather than silently degrading.
        if (!isDictation && !systemAudioSupportedRef.current) {
          toast.info(
            "This machine isn't supported for meeting recording (requires macOS 14 Sonoma or later). Dictation still works.",
          );
          return;
        }
        isDictationSessionRef.current = isDictation;
        const sessionStartedAt = Date.now();
        hasActiveSessionRef.current = true;
        setIsRecordingActive(true);
        const label = isDictation ? 'Dictation' : 'Recording';
        // Model may already be warm (no visible loading flash) — only
        // show the loading notification if it isn't. Audio capture below
        // starts immediately either way and is never gated on this.
        const modelAlreadyReady = modelStatus.status === 'ready';
        if (!modelAlreadyReady) {
          showLoading(label);
        }
        await startRecording();
        // Dictation is mic-only by design — never pull in system audio.
        // Capturing (near-)silent system audio here is what produced
        // Whisper's "[BLANK_AUDIO]" hallucination in dictated/pasted text.
        if (!isDictation) {
          startSystemRecording();
        }
        window.electronAPI.transcriber.startSession(
          sessionStartedAt,
          sessionOptions,
        );
        if (!modelAlreadyReady) {
          await modelStatus.ensureReady();
        }
        showRecordingStart(label, {
          isMeeting: !isDictation,
          systemAudioEnabled: !isDictation && systemAudioSupportedRef.current,
        });
      }
    },
    [
      isRecording,
      startRecording,
      stopRecording,
      startSystemRecording,
      stopSystemRecording,
      showRecordingStart,
      showLoading,
      showRecordingStopped,
      showProcessing,
      modelStatus.status,
      modelStatus.ensureReady,
    ],
  );

  const handleToggleRecording = useCallback(
    () => handleToggleCapture(),
    [handleToggleCapture],
  );

  const handleToggleDictation = useCallback(
    () => handleToggleCapture({ forceType: 'dictation' }),
    [handleToggleCapture],
  );

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
    onAsk: useCallback(
      (event) => {
        showMeetingDetected(event.appName, event.meetingKey);
      },
      [showMeetingDetected],
    ),
    onEnded: useCallback(() => {
      showMeetingEnded();
    }, [showMeetingEnded]),
  });

  // Expose isRecordingActive for test coordination
  useEffect(() => {
    setRecordingActiveForTests(isRecordingActive);
  }, [isRecordingActive]);

  // Expose systemAudioSupported getter+setter for E2E tests
  useEffect(() => {
    exposeSystemAudioCapabilitySetterForTests(
      () => systemAudioSupportedRef.current,
      setSystemAudioSupported,
    );
    return () => cleanupSystemAudioCapabilitySetterForTests();
  }, []);

  useEffect(() => {
    const unsubscribe =
      window.electronAPI.settings.shortcuts.on.recordingToggle(() => {
        handleToggleRecording();
      });

    return () => {
      unsubscribe();
    };
  }, [handleToggleRecording]);

  useEffect(() => {
    const unsubscribe =
      window.electronAPI.settings.shortcuts.on.dictationToggle(() => {
        handleToggleDictation();
      });

    return () => {
      unsubscribe();
    };
  }, [handleToggleDictation]);
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

  // When recording stops, end the session and transition to done state.
  // Uses hasActiveSessionRef instead of transcriber.output?.text because VAD-only
  // mode never sets transcriber.isBusy, so transcript text may be undefined when
  // recording stops for the first time (causing the notification to hang in processing).
  // Also waits on hasPendingVadSegment so the trailing mic segment flushed on stop
  // (stopListeningAndFlush) has actually been sent before session-end fires —
  // otherwise it arrives after the session/meeting is already saved and gets
  // routed through the backend's late-segment recovery path instead of merging
  // normally, producing a wrong audioSource and missing [Mic]/[Meeting] tags.
  useEffect(() => {
    if (
      !isRecordingActive &&
      !transcriber.isBusy &&
      !hasPendingVadSegment &&
      hasActiveSessionRef.current
    ) {
      hasActiveSessionRef.current = false;
      // Waits for the real backend teardown (endSession) to resolve before
      // touching UI state, instead of a fixed setTimeout that had no idea
      // whether a newer session had already started underneath it. If this
      // effect gets superseded (a new session starts before this resolves),
      // React runs the cleanup below and sets `cancelled`, so the stale
      // continuation skips its UI-state side effects instead of stomping
      // the new session.
      let cancelled = false;
      (async () => {
        await window.electronAPI.transcriber.endSession(Date.now());
        if (cancelled) return;
        showDone();

        // Keep the 300ms "done" fade before returning to idle.
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (cancelled) return;
        cleanup();
        showIdle();
        setIsRecordingActive(false);
        setIsFinalizing(false);
      })();

      return () => {
        cancelled = true;
      };
    }
  }, [
    isRecordingActive,
    transcriber.isBusy,
    hasPendingVadSegment,
    cleanup,
    showDone,
    showIdle,
  ]);

  const status: AppStatus = isRecordingActive
    ? 'recording'
    : modelStatus.status === 'loading' || isFinalizing
      ? 'loading'
      : 'idle';

  return { status };
}
