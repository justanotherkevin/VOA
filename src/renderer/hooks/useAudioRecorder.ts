import { useCallback, useRef, useState } from 'react';
import {
  getSupportedMimeType,
  stopMediaStream,
} from '@/renderer/utils/RecordingUtils';
import { useVAD } from '@/renderer/hooks/useVAD';

export interface AudioRecorderState {
  isRecording: boolean;
  duration: number;
  mimeType: string | undefined;
}

export type OnRecordingCompleteCallback = (
  chunks: Blob[],
  mimeType: string,
  startTime: number | null,
) => Promise<void>;

export interface UseAudioRecorderReturn extends AudioRecorderState {
  // True while the mic's trailing VAD segment is still being sent/transcribed
  // after stopRecording() was called. Callers must wait for this to go false
  // before ending the transcriber session.
  hasPendingVadSegment: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecordingState: () => void;
  setOnRecordingComplete: (
    callback: OnRecordingCompleteCallback | null,
  ) => void;
  cleanup: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [mimeType, setMimeType] = useState<string | undefined>(undefined);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onRecordingCompleteRef = useRef<OnRecordingCompleteCallback | null>(
    null,
  );

  const {
    isInitialized: vadInitialized,
    hasPendingSegment: hasPendingVadSegment,
    startListening,
    stopListeningAndFlush,
    cleanup: vadCleanup,
  } = useVAD();

  const setOnRecordingComplete = useCallback(
    (callback: OnRecordingCompleteCallback | null) => {
      onRecordingCompleteRef.current = callback;
    },
    [],
  );

  const resetRecordingState = useCallback((): void => {
    setDuration(0);
    startTimeRef.current = Date.now();
  }, []);

  const requestAudioPermission = useCallback(async (): Promise<void> => {
    if (!streamRef.current) {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1,
        },
      });
    }
  }, []);

  const handleRecordingComplete = useCallback(
    async (
      chunks: Blob[],
      mimeType: string,
      startTime: number | null,
    ): Promise<void> => {
      try {
        await onRecordingCompleteRef.current?.(chunks, mimeType, startTime);
      } catch {
        // silently handle recording complete callback errors
      } finally {
        mediaRecorderRef.current = null;
        startTimeRef.current = null;
      }
    },
    [],
  );

  const initWebRecorder = useCallback((): MediaRecorder => {
    const chosenMime = getSupportedMimeType();
    setMimeType(chosenMime);
    // @ts-ignore - MediaRecorder constructor may accept undefined mimeType
    return new MediaRecorder(streamRef.current, { mimeType: chosenMime });
  }, []);

  const startRecording = useCallback(async () => {
    resetRecordingState();

    const handleDataAvailable = async (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }

      if (mediaRecorderRef.current?.state === 'inactive') {
        const chunks = [...chunksRef.current];
        chunksRef.current = [];

        // When VAD is active, audio segments are transcribed and pasted individually.
        // Skip full-audio transcription to avoid duplicating pasted text.
        if (vadInitialized) {
          mediaRecorderRef.current = null;
          startTimeRef.current = null;
          return;
        }

        const recordingMimeType = mediaRecorderRef.current?.mimeType;
        const recordingStartTime = startTimeRef.current;
        await handleRecordingComplete(
          chunks,
          recordingMimeType,
          recordingStartTime,
        );
      }
    };

    try {
      await requestAudioPermission();

      const mediaRecorder = initWebRecorder();
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.addEventListener('dataavailable', handleDataAvailable);
      mediaRecorder.start();

      if (vadInitialized) {
        startListening();
      }

      setIsRecording(true);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      durationIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      // silently handle microphone access errors
    }
  }, [
    resetRecordingState,
    requestAudioPermission,
    initWebRecorder,
    handleRecordingComplete,
    vadInitialized,
    startListening,
  ]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    stopListeningAndFlush();

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }
  }, [isRecording, stopListeningAndFlush]);

  const cleanup = useCallback(() => {
    vadCleanup();

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startTimeRef.current = null;
    streamRef.current = null;
    onRecordingCompleteRef.current = null;
  }, [vadCleanup]);

  return {
    isRecording,
    duration,
    mimeType,
    hasPendingVadSegment,
    startRecording,
    stopRecording,
    resetRecordingState,
    setOnRecordingComplete,
    cleanup,
  };
}
