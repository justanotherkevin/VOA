import { useEffect, useRef } from 'react';

interface DetectedEvent {
  appName: string;
  windowTitle: string;
  mode: 'ask' | 'auto' | 'auto-stop';
  meetingKey: string;
}

interface UseMeetingDetectorParams {
  onAutoStart?: () => void;
  onAutoStop?: () => void;
  onAsk?: (event: DetectedEvent) => void;
  onEnded?: () => void;
}

export function useMeetingDetector({
  onAutoStart,
  onAutoStop,
  onAsk,
  onEnded,
}: UseMeetingDetectorParams) {
  const onAutoStartRef = useRef(onAutoStart);
  const onAutoStopRef = useRef(onAutoStop);
  const onAskRef = useRef(onAsk);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onAutoStartRef.current = onAutoStart;
    onAutoStopRef.current = onAutoStop;
    onAskRef.current = onAsk;
    onEndedRef.current = onEnded;
  });

  useEffect(() => {
    const unsubDetected = window.electronAPI.meetings.on.detected(
      (payload: any) => {
        const event = payload as DetectedEvent;
        if (event.mode === 'ask') {
          onAskRef.current?.(event);
        } else if (event.mode === 'auto' || event.mode === 'auto-stop') {
          onAutoStartRef.current?.();
        }
      },
    );

    const unsubEnded = window.electronAPI.meetings.on.ended((payload: any) => {
      const event = payload as { mode: string };
      onEndedRef.current?.();
      if (event.mode === 'auto-stop') {
        onAutoStopRef.current?.();
      }
    });

    return () => {
      unsubDetected();
      unsubEnded();
    };
  }, []);
}

/**
 * Dismiss a meeting detection prompt by its tracking key (room code or native app key).
 * Prevents the same meeting from being re-asked about until the meeting ends.
 */
export async function dismissMeetingDetection(meetingKey: string): Promise<void> {
  await window.electronAPI.meetings.dismiss(meetingKey);
}
