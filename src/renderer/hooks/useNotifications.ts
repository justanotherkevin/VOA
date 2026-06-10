interface ActiveWindow {
  title: string;
  owner: {
    name: string;
    path?: string;
  };
}
import { useEffect, useState, useRef } from 'react';

type NotificationState =
  | 'idle'
  | 'in-meeting'
  | 'recording'
  | 'recording-stopped'
  | 'processing'
  | 'done';

export interface NotificationData {
  state: NotificationState;
  title: string;
  message: string;
  activeWindow?: ActiveWindow;
  meetingKey?: string;
}

const FADE_DURATION_MS = 300;
// const DEV_MODE = process.env.NODE_ENV === 'development';
const DEV_MODE = false;

const DEV_NOTIFICATION: NotificationData = {
  state: 'recording',
  title: 'Recording Started',
  message: 'Speak now... Press Cmd+Shift+Space to stop',
  activeWindow: {
    title: '#general - Slack',
    owner: { name: 'Slack' },
  },
};

export function useNotifications() {
  const [notification, setNotification] = useState<NotificationData | null>(
    DEV_MODE ? DEV_NOTIFICATION : null,
  );
  const [isVisible, setIsVisible] = useState(DEV_MODE);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribeStateUpdate = window.electronAPI.notifications.on.updateState(
      (data: unknown) => {
        const notificationData = data as NotificationData;

        if (fadeTimeoutRef.current) {
          clearTimeout(fadeTimeoutRef.current);
          fadeTimeoutRef.current = null;
        }

        // Handle state transitions
        if (notificationData.state === 'in-meeting') {
          // Show meeting prompt pill and keep it visible until recording starts or meeting ends
          setIsVisible((prevIsVisible) => {
            if (prevIsVisible) {
              setIsVisible(false);
              const timeout = setTimeout(() => {
                setNotification(notificationData);
                setIsVisible(true);
                fadeTimeoutRef.current = null;
              }, FADE_DURATION_MS);
              fadeTimeoutRef.current = timeout;
              return prevIsVisible;
            } else {
              setNotification(notificationData);
              return true;
            }
          });
        } else if (notificationData.state === 'done') {
          // Fade out and hide
          setIsVisible(false);
          const timeout = setTimeout(() => {
            setNotification(null);
            fadeTimeoutRef.current = null;
          }, FADE_DURATION_MS);
          fadeTimeoutRef.current = timeout;
        } else if (notificationData.state === 'idle') {
          // Hide idle state
          setIsVisible(false);
          setNotification(null);
        } else {
          // For recording, recording-stopped, processing states
          setIsVisible((prevIsVisible) => {
            if (prevIsVisible) {
              // Smoothly transition between states
              setIsVisible(false);
              const timeout = setTimeout(() => {
                setNotification(notificationData);
                setIsVisible(true);
                fadeTimeoutRef.current = null;
              }, FADE_DURATION_MS);
              fadeTimeoutRef.current = timeout;
              return prevIsVisible;
            } else {
              // Show immediately if not visible
              setNotification(notificationData);
              return true;
            }
          });
        }
      },
    );

    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
      unsubscribeStateUpdate();
    };
  }, []);

  const processing = notification?.state === 'processing';

  return {
    notification,
    isVisible,
    processing,
  };
}
