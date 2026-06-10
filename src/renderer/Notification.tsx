import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/renderer/App.css';
import { LiveWaveform } from '@/renderer/components/live-waveform';
import { MessageCircle, Briefcase, Mail, AppWindow } from 'lucide-react';
import { useNotifications, type NotificationData } from '@/renderer/hooks/useNotifications';

type WindowCategory = 'messenger' | 'work' | 'email' | 'other';

function getWindowCategory(
  appName: string = '',
  windowTitle: string = '',
): WindowCategory {
  const app = appName.toLowerCase();
  const title = windowTitle.toLowerCase();

  const messengers = [
    'whatsapp',
    'telegram',
    'signal',
    'discord',
    'messages',
    'messenger',
    'wechat',
    'caprine',
  ];
  if (messengers.some((m) => app.includes(m))) return 'messenger';

  const workApps = ['slack', 'teams', 'zoom', 'skype', 'webex', 'meet'];
  if (workApps.some((w) => app.includes(w))) return 'work';

  const emailApps = ['mail', 'outlook', 'spark', 'thunderbird', 'airmail'];
  if (emailApps.some((e) => app.includes(e))) return 'email';
  if (title.includes('gmail') || title.includes('outlook')) return 'email';

  return 'other';
}

function getCategoryStyles(category: WindowCategory) {
  switch (category) {
    case 'messenger':
      return {
        icon: <MessageCircle className="w-4 h-4" />,
        badgeVariant: 'secondary' as const,
        label: 'Messenger',
        colorClass: 'text-green-400',
      };
    case 'work':
      return {
        icon: <Briefcase className="w-4 h-4" />,
        badgeVariant: 'default' as const,
        label: 'Work',
        colorClass: 'text-indigo-400',
      };
    case 'email':
      return {
        icon: <Mail className="w-4 h-4" />,
        badgeVariant: 'destructive' as const,
        label: 'Email',
        colorClass: 'text-orange-400',
      };
    default:
      return {
        icon: <AppWindow className="w-4 h-4" />,
        badgeVariant: 'outline' as const,
        label: 'App',
        colorClass: 'text-gray-400',
      };
  }
}

function InMeetingPill({ notification }: { notification: NotificationData }) {
  const handleDismiss = () => {
    if (notification.meetingKey) {
      window.electronAPI.meetings.dismiss(notification.meetingKey);
    }
    window.electronAPI.notifications.updateState({ state: 'idle', title: '', message: '' });
  };

  return (
    <div className="bg-gray-800/90 text-white px-4 py-2 rounded-full flex items-center gap-3 max-w-md">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <span className="text-xs font-medium truncate">{notification.title}</span>
      <span className="text-xs text-gray-400">Meeting detected</span>
      <button
        onClick={() => window.electronAPI.recordings.toggle()}
        className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded-full transition-colors cursor-pointer"
      >
        Start Recording
      </button>
      <button
        onClick={handleDismiss}
        className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
      >
        Dismiss
      </button>
    </div>
  );
}

function NotificationOverlay() {
  const { notification, isVisible, processing } = useNotifications();

  if (!notification) {
    return null;
  }

  if (notification.state === 'in-meeting') {
    return (
      <div
        className={`relative ${isVisible ? 'block' : 'hidden'}`}
        data-testid="notification-window"
      >
        <InMeetingPill notification={notification} />
      </div>
    );
  }

  const category = getWindowCategory(
    notification.activeWindow?.owner.name,
    notification.activeWindow?.title,
  );
  const styles = getCategoryStyles(category);

  return (
    <div
      className={`relative pointer-events-none ${isVisible ? 'block' : 'hidden'}`}
      data-testid="notification-window"
    >
      <div className="bg-gradient-to-r from-gray-400 to-gray-600 text-white px-6 rounded-full flex items-center gap-3 max-w-md w-100">
        <LiveWaveform
          active={!processing}
          processing={processing}
          barWidth={4}
          barHeight={6}
          barGap={2}
          barColor="white"
          fadeEdges={true}
        />

        <div className="flex items-center gap-3">
          {notification.activeWindow && (
            <div className={`flex items-center gap-2 ${styles.colorClass}`}>
              <span className="text-xs font-medium max-w-[120px] truncate">
                {notification.state}
              </span>
              {styles.icon}
              <span className="text-xs font-medium max-w-[120px] truncate">
                {notification.activeWindow.owner.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('notification-root');
if (container) {
  const root = createRoot(container);
  root.render(<NotificationOverlay />);
}

export default NotificationOverlay;
