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
  | 'done'
  | 'calendar-match';

export interface CalendarMatchOption {
  id: string;
  title: string;
}

export interface NotificationData {
  state: NotificationState;
  title: string;
  message: string;
  activeWindow?: ActiveWindow;
  meetingKey?: string;
  calendarMatches?: CalendarMatchOption[];
}

// How long the pill stays mounted (window visible) after a 'done' state so
// its own exit animation (see App.css's .notification-flip-out) can finish
// before the content is torn down.
const DONE_LINGER_MS = 300;
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
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribeStateUpdate =
      window.electronAPI.notifications.on.updateState((data: unknown) => {
        const notificationData = data as NotificationData;

        if (clearTimeoutRef.current) {
          clearTimeout(clearTimeoutRef.current);
          clearTimeoutRef.current = null;
        }

        if (notificationData.state === 'idle') {
          setIsVisible(false);
          setNotification(null);
          return;
        }

        if (notificationData.state === 'done') {
          // Hide the window but keep the last content mounted briefly so its
          // exit animation can play before Notification.tsx unmounts it.
          setNotification(notificationData);
          setIsVisible(false);
          clearTimeoutRef.current = setTimeout(() => {
            setNotification(null);
            clearTimeoutRef.current = null;
          }, DONE_LINGER_MS);
          return;
        }

        // recording / recording-stopped / processing / in-meeting /
        // calendar-match: just swap the content. The notification window
        // shell itself never remounts between these states — Notification.tsx
        // owns the flip transition between the old and new content.
        setNotification(notificationData);
        setIsVisible(true);
      });

    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
      unsubscribeStateUpdate();
    };
  }, []);

  return {
    notification,
    isVisible,
  };
}
