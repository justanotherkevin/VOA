import { useCallback } from 'react';
import type { NotificationData } from './useNotifications';

export function useNotificationFlow() {
  const showRecordingStart = useCallback(
    (label: 'Recording' | 'Dictation' = 'Recording'): void => {
      window.electronAPI.notifications.updateState({
        state: 'recording',
        title: `${label} Started`,
        message: 'Speak now...',
      });
    },
    [],
  );

  const showRecordingStopped = useCallback(
    (label: 'Recording' | 'Dictation' = 'Recording'): void => {
      window.electronAPI.notifications.updateState({
        state: 'recording-stopped',
        title: `${label} Stopped`,
        message: 'Processing your audio...',
      });
    },
    [],
  );

  const showProcessing = useCallback((): void => {
    window.electronAPI.notifications.updateState({
      state: 'processing',
      title: 'Transcribing',
      message: 'Converting speech to text...',
    });
  }, []);

  const showDone = useCallback((): void => {
    window.electronAPI.notifications.updateState({
      state: 'done',
      title: 'Done',
      message: 'Transcription complete',
    });
  }, []);

  const showError = useCallback((message = 'Failed to process audio'): void => {
    window.electronAPI.notifications.updateState({
      state: 'done',
      title: 'Error',
      message,
    });
  }, []);

  const showIdle = useCallback((): void => {
    window.electronAPI.notifications.updateState({
      state: 'idle',
      title: '',
      message: '',
    });
  }, []);

  const showMeetingDetected = useCallback(
    (appName: string, meetingKey: string): void => {
      window.electronAPI.notifications.updateState({
        state: 'in-meeting',
        title: appName,
        message: 'Meeting detected',
        meetingKey,
      });
    },
    [],
  );

  const showMeetingEnded = useCallback((): void => {
    window.electronAPI.notifications.updateState({
      state: 'idle',
      title: '',
      message: '',
    });
  }, []);

  return {
    showRecordingStart,
    showRecordingStopped,
    showProcessing,
    showDone,
    showError,
    showIdle,
    showMeetingDetected,
    showMeetingEnded,
  };
}
