import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/renderer/App.css';
import {
  Mic,
  Pause,
  Loader2,
  Check,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { LiveWaveform } from '@/renderer/components/live-waveform';
import {
  useNotifications,
  type NotificationData,
} from '@/renderer/hooks/useNotifications';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/renderer/components/select';

const CALENDAR_MATCH_TIMEOUT_MS = 10_000;
// Must match the .notification-flip-out / .notification-flip-in keyframe
// durations in App.css.
const FLIP_OUT_MS = 200;
const FLIP_IN_MS = 280;

// Reverts the pill to the plain recording indicator. Purely a UI cleanup —
// the actual confirm/decline/select decision already lives in main-process
// session state by the time this fires (see TranscriberService.persistMeeting).
function closeCalendarMatchPill() {
  window.electronAPI.notifications.updateState({
    state: 'recording',
    title: '',
    message: 'Recording',
  });
}

function StateIcon({ state }: { state: NotificationData['state'] }) {
  switch (state) {
    case 'recording':
      return (
        <div className="flex items-center justify-center w-[30px] h-[30px] rounded-full shrink-0 bg-red-400/20 text-red-400">
          <Mic className="w-3.5 h-3.5" />
        </div>
      );
    case 'loading':
      return (
        <div className="flex items-center justify-center w-[30px] h-[30px] rounded-full shrink-0 bg-yellow-400/20 text-yellow-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        </div>
      );
    case 'recording-stopped':
      return (
        <div className="flex items-center justify-center w-[30px] h-[30px] rounded-full shrink-0 bg-amber-400/20 text-amber-400">
          <Pause className="w-3 h-3" />
        </div>
      );
    case 'processing':
      return (
        <div className="flex items-center justify-center w-[30px] h-[30px] rounded-full shrink-0 bg-indigo-400/20 text-indigo-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        </div>
      );
    case 'done':
      return (
        <div className="flex items-center justify-center w-[30px] h-[30px] rounded-full shrink-0 bg-green-400/20 text-green-400">
          <Check className="w-3.5 h-3.5" />
        </div>
      );
    case 'in-meeting':
    case 'calendar-match':
    default:
      return (
        <div className="flex items-center justify-center w-[30px] h-[30px] rounded-full shrink-0 bg-indigo-400/20 text-indigo-400">
          <CalendarIcon className="w-3.5 h-3.5" />
        </div>
      );
  }
}

function InMeetingRow({ notification }: { notification: NotificationData }) {
  const handleDismiss = () => {
    if (notification.meetingKey) {
      window.electronAPI.meetings.dismiss(notification.meetingKey);
    }
    window.electronAPI.notifications.updateState({
      state: 'idle',
      title: '',
      message: '',
    });
  };

  return (
    <div
      className="flex items-center gap-3 w-full"
      data-testid="notification-in-meeting"
    >
      <StateIcon state="in-meeting" />
      <div className="flex flex-col min-w-0 flex-1 gap-px">
        <span className="text-[12.5px] font-semibold truncate">
          {notification.title || 'Meeting'}
        </span>
        <span className="text-[11px] text-white/55 truncate">
          Meeting detected
        </span>
      </div>
      <button
        onClick={() => window.electronAPI.recordings.toggle()}
        className="shrink-0 rounded-full bg-indigo-400 text-black text-[11.5px] font-medium px-3 py-1 cursor-pointer hover:bg-indigo-300 transition-colors"
      >
        Start
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-full bg-white/10 text-white/70 text-[11.5px] px-2 py-1 cursor-pointer hover:bg-white/20 hover:text-white transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}

// Always presents a Select — even for a single candidate, pre-selected —
// so confirming which meeting this recording belongs to is one consistent
// interaction regardless of match count. There is no separate "No"/decline
// button: picking an option confirms immediately, and ignoring the pill lets
// it auto-close via the countdown below with nothing selected.
function CalendarMatchRow({
  notification,
}: {
  notification: NotificationData;
}) {
  const matches = notification.calendarMatches ?? [];
  // Tracks whether a selection was made so handleOpenChange knows to close
  // the pill once Radix reports its popup has actually finished closing —
  // state-driven rather than a fixed delay, so it can't race the Select's
  // own close animation (select.tsx's data-[state=closed]:fade-out) at any
  // timing (previously a hardcoded setTimeout(160) still detached the
  // option element under load).
  const selectedRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(
      closeCalendarMatchPill,
      CALENDAR_MATCH_TIMEOUT_MS,
    );
    return () => clearTimeout(timeout);
  }, []);

  const handleSelect = (id: string) => {
    window.electronAPI.calendar.selectMatch(id);
    selectedRef.current = true;
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && selectedRef.current) {
      closeCalendarMatchPill();
    }
  };

  if (matches.length === 0) return null;

  return (
    <div
      className="flex items-center gap-3 w-full"
      data-testid="notification-calendar-match"
    >
      <StateIcon state="calendar-match" />
      <span className="text-[12.5px] font-semibold shrink-0 whitespace-nowrap">
        Which meeting?
      </span>
      <Select
        onValueChange={handleSelect}
        onOpenChange={handleOpenChange}
        defaultValue={matches.length === 1 ? matches[0].id : undefined}
      >
        <SelectTrigger
          size="sm"
          className="h-6 flex-1 min-w-0 border-white/15 bg-white/10 text-xs text-white [&_span]:truncate"
        >
          <SelectValue placeholder={`${matches.length} meetings found`} />
        </SelectTrigger>
        <SelectContent>
          {matches.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const WAVEFORM_COLUMN_WIDTH = 80;

// Displays the "System" waveform by listening for levels the main window's
// real system-audio capture forwards over IPC (see audioCapture.ts /
// ipc/notifications.ts's relay) — this window never opens its own loopback
// capture. Returns a stable getter LiveWaveform can pull from each animation
// tick, so incoming levels don't trigger re-renders.
function useSystemAudioMeter(enabled: boolean) {
  const levelsRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!enabled) return;

    levelsRef.current = null;
    const unsubscribe = window.electronAPI.audio.onSystemAudioLevels(
      (levels: unknown) => {
        levelsRef.current = Uint8Array.from(levels as number[]);
      },
    );

    return () => {
      unsubscribe();
      levelsRef.current = null;
    };
  }, [enabled]);

  return useCallback(() => levelsRef.current, []);
}

function RecordingRow({ notification }: { notification: NotificationData }) {
  const dual = Boolean(
    notification.isMeeting && notification.systemAudioEnabled,
  );
  const getSystemLevels = useSystemAudioMeter(dual);

  return (
    <div
      className="flex items-center gap-3 w-full"
      data-testid={`notification-${notification.state}`}
    >
      <StateIcon state="recording" />
      <span className="text-[12.5px] font-semibold truncate shrink-0 max-w-[160px]">
        {notification.title || 'Recording'}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        {dual && (
          <>
            <div
              className="flex flex-col items-center gap-1 shrink-0"
              style={{ width: WAVEFORM_COLUMN_WIDTH }}
            >
              <span className="text-[9px] font-medium uppercase tracking-wide text-white/40">
                System
              </span>
              <LiveWaveform
                active
                source="external"
                getExternalData={getSystemLevels}
                barWidth={4}
                barGap={2}
                barRadius={1.5}
                barColor="#ffc370"
                fadeEdges
                sensitivity={1}
                height={24}
              />
            </div>
            <div className="w-px self-stretch bg-white/12" />
          </>
        )}
        <div
          className="flex flex-col items-center gap-1 shrink-0"
          style={{ width: WAVEFORM_COLUMN_WIDTH }}
        >
          {dual && (
            <span className="text-[9px] font-medium uppercase tracking-wide text-white/40">
              Mic
            </span>
          )}
          <LiveWaveform
            active
            barWidth={4}
            barGap={2}
            barRadius={1.5}
            barColor="#ffffff"
            fadeEdges
            sensitivity={1}
            height={24}
          />
        </div>
      </div>
      <span className="sr-only">{notification.state}</span>
    </div>
  );
}

function DefaultRow({ notification }: { notification: NotificationData }) {
  return (
    <div
      className="flex items-center gap-3 w-full"
      data-testid={`notification-${notification.state}`}
    >
      <StateIcon state={notification.state} />
      <div className="flex flex-col min-w-0 flex-1 gap-px">
        <span className="text-[12.5px] font-semibold truncate">
          {notification.title || notification.state}
        </span>
        <span className="text-[11px] text-white/55 truncate">
          {notification.message}
        </span>
      </div>
      {notification.activeWindow && (
        <div className="shrink-0 flex items-center rounded-full bg-white/10 px-2 py-1 text-[10.5px] text-white/75">
          {notification.activeWindow.owner.name}
        </div>
      )}
      {/* Raw state, kept for automation/screen readers — intentionally not
          part of the visible design (see StateIcon for the visual cue). */}
      <span className="sr-only">{notification.state}</span>
    </div>
  );
}

function renderRow(notification: NotificationData) {
  if (notification.state === 'in-meeting') {
    return <InMeetingRow notification={notification} />;
  }
  if (notification.state === 'calendar-match') {
    return <CalendarMatchRow notification={notification} />;
  }
  if (notification.state === 'recording') {
    return <RecordingRow notification={notification} />;
  }
  return <DefaultRow notification={notification} />;
}

type FlipPhase = 'idle' | 'out' | 'in';

// Drives the top-hinged flip transition between notification states. The
// pill shell itself (App.css's .notification-pill) never remounts — only
// the content returned here swaps, on a delay matched to the flip-out /
// flip-in keyframe durations, so the two never overlap mid-animation.
function useFlippedContent(notification: NotificationData | null) {
  const [displayed, setDisplayed] = useState(notification);
  const [phase, setPhase] = useState<FlipPhase>('idle');
  const lastKeyRef = useRef<string | null>(
    notification ? JSON.stringify(notification) : null,
  );
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const key = notification ? JSON.stringify(notification) : null;
    if (key === lastKeyRef.current) return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!displayed || !notification) {
      // Nothing shown yet, or the pill is closing — swap immediately, no flip.
      lastKeyRef.current = key;
      setDisplayed(notification);
      setPhase('idle');
      return;
    }

    setPhase('out');
    timersRef.current.push(
      setTimeout(() => {
        lastKeyRef.current = key;
        setDisplayed(notification);
        setPhase('in');
        timersRef.current.push(setTimeout(() => setPhase('idle'), FLIP_IN_MS));
      }, FLIP_OUT_MS),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  return { displayed, phase };
}

function NotificationOverlay() {
  const { notification, isVisible } = useNotifications();
  const { displayed, phase } = useFlippedContent(notification);

  if (!displayed) {
    return null;
  }

  const flipClass =
    phase === 'out'
      ? 'notification-flip-out'
      : phase === 'in'
        ? 'notification-flip-in'
        : '';

  return (
    <div
      className={`relative ${isVisible ? 'block' : 'hidden'}`}
      data-testid="notification-window"
    >
      <div className="notification-pill">
        <div className={`notification-flip-wrap ${flipClass}`}>
          {renderRow(displayed)}
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
