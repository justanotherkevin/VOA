import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import {
  attachGlobalElectronMock,
  resetElectronMockCallbacks,
  triggerNotificationShow,
  triggerNotificationHide,
  triggerCalendarMatch,
  triggerDictationChunk,
  triggerDictationReset,
} from '@/testing/electronMocks';
import Notification from '@/renderer/Notification';

// jsdom doesn't implement pointer capture / scrollIntoView, which
// @radix-ui/react-select relies on for its open/select interactions.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

describe('Notification Component', () => {
  beforeEach(() => {
    attachGlobalElectronMock();
    vi.clearAllMocks();
    resetElectronMockCallbacks();
  });

  describe('show/hide behavior', () => {
    it('should show notification when notification:show event is triggered', async () => {
      render(<Notification />);

      // Initially, notification should not be visible
      expect(
        screen.queryByTestId('notification-window'),
      ).not.toBeInTheDocument();

      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
        });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('notification-recording'),
        ).toBeInTheDocument();
        // The recording row shows a live mic waveform instead of the
        // activeWindow badge, to make room for the audio-level indicator.
        expect(
          screen.getByRole('img', { name: /live audio waveform/i }),
        ).toBeInTheDocument();
      });
      // Raw state kept for automation/a11y, not shown visually.
      expect(screen.getByText('recording')).toHaveClass('sr-only');
    });

    it('should hide notification when notification:hide event is triggered', async () => {
      render(<Notification />);

      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
        });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('notification-recording'),
        ).toBeInTheDocument();
      });

      act(() => {
        triggerNotificationHide();
      });

      // The window shell itself (data-testid="notification-window") toggles
      // straight to hidden — it never remounts between states.
      await waitFor(() => {
        expect(screen.getByTestId('notification-window')).toHaveClass('hidden');
      });
    });
  });

  describe('notification persistence and replacement', () => {
    it('should keep notification visible for recording (no auto-hide)', async () => {
      render(<Notification />);

      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
        });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('notification-recording'),
        ).toBeInTheDocument();
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(screen.getByTestId('notification-recording')).toBeInTheDocument();
      expect(screen.getByTestId('notification-window')).toHaveClass('block');
    });

    it('should replace old notification with new one (flip transition, shell stays mounted)', async () => {
      render(<Notification />);

      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
        });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('notification-recording'),
        ).toBeInTheDocument();
      });

      const shell = screen.getByTestId('notification-window');

      act(() => {
        triggerNotificationShow({
          title: 'Recording Stopped',
          message: 'Processing your audio...',
          state: 'recording-stopped',
          activeWindow: {
            title: 'Recording Stopped',
            owner: { name: 'Audio App' },
          },
        });
      });

      // Same shell throughout — no remount, no blink.
      await waitFor(
        () => {
          expect(
            screen.getByTestId('notification-recording-stopped'),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
      expect(screen.getByTestId('notification-window')).toBe(shell);
    });
  });

  describe('recording workflow', () => {
    it('should handle recording workflow: show → replace → hide', async () => {
      render(<Notification />);

      // Step 1: Recording starts
      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
        });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('notification-recording'),
        ).toBeInTheDocument();
      });

      // Step 2: Recording stops (notification updates)
      act(() => {
        triggerNotificationShow({
          title: 'Recording Stopped',
          message: 'Processing your audio...',
          state: 'recording-stopped',
        });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('notification-recording-stopped'),
        ).toBeInTheDocument();
      });

      // Step 3: Backend sends hide event after delay
      act(() => {
        triggerNotificationHide();
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-window')).toHaveClass('hidden');
      });
    });
  });

  describe('loading state', () => {
    it('renders the loading row with title/message', async () => {
      render(<Notification />);

      act(() => {
        triggerNotificationShow({
          title: 'Starting Recording…',
          message: 'Loading model…',
          state: 'loading',
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('notification-loading')).toBeInTheDocument();
      });
      expect(screen.getByText('Starting Recording…')).toBeInTheDocument();
      expect(screen.getByText('Loading model…')).toBeInTheDocument();
    });
  });

  describe('calendar match pill', () => {
    it('always renders a Select — pre-selected for a single match — with no decline button', async () => {
      render(<Notification />);

      act(() => {
        triggerCalendarMatch([{ id: 'evt-1', title: 'Weekly Sync — 2:00 PM' }]);
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('notification-calendar-match'),
        ).toBeInTheDocument();
      });
      expect(screen.getByRole('combobox')).toHaveTextContent(
        'Weekly Sync — 2:00 PM',
      );
      expect(
        screen.queryByRole('button', { name: /no/i }),
      ).not.toBeInTheDocument();
    });

    it('shows an unselected Select with a count placeholder when multiple matches are found', async () => {
      render(<Notification />);

      act(() => {
        triggerCalendarMatch([
          { id: 'evt-1', title: 'Weekly Sync — 2:00 PM' },
          { id: 'evt-2', title: '1:1 with Sam — 2:15 PM' },
        ]);
      });

      await waitFor(() => {
        expect(
          within(screen.getByRole('combobox')).getByText('2 meetings found'),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByRole('button', { name: /no/i }),
      ).not.toBeInTheDocument();
    });

    it('auto-closes after the countdown even without user interaction', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        render(<Notification />);

        act(() => {
          triggerCalendarMatch([{ id: 'evt-1', title: 'Weekly Sync' }]);
        });

        await vi.waitFor(() => {
          expect(
            screen.getByTestId('notification-calendar-match'),
          ).toBeInTheDocument();
        });

        act(() => {
          vi.advanceTimersByTime(10_000);
        });

        await vi.waitFor(() => {
          expect(
            screen.queryByTestId('notification-calendar-match'),
          ).not.toBeInTheDocument();
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('dictation live transcript list', () => {
    it('appends chunks in order and shows nothing before the first chunk arrives', async () => {
      render(<Notification />);

      act(() => {
        triggerNotificationShow({
          title: 'Dictation Started',
          message: 'Speak now...',
          isMeeting: false,
        });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('notification-recording'),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId('notification-dictation-transcript'),
      ).not.toBeInTheDocument();

      act(() => {
        triggerDictationChunk('first chunk');
      });
      act(() => {
        triggerDictationChunk('second chunk');
      });

      await waitFor(() => {
        const list = screen.getByTestId('notification-dictation-transcript');
        expect(within(list).getByText('first chunk')).toBeInTheDocument();
        expect(within(list).getByText('second chunk')).toBeInTheDocument();
      });
    });

    it('does not show the transcript list for a meeting recording', async () => {
      render(<Notification />);

      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
          isMeeting: true,
        });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('notification-recording'),
        ).toBeInTheDocument();
      });

      act(() => {
        triggerDictationChunk('should not render for meetings');
      });

      expect(
        screen.queryByTestId('notification-dictation-transcript'),
      ).not.toBeInTheDocument();
    });

    it('clears accumulated chunks on a dictation-reset event', async () => {
      render(<Notification />);

      act(() => {
        triggerNotificationShow({
          title: 'Dictation Started',
          message: 'Speak now...',
          isMeeting: false,
        });
      });
      act(() => {
        triggerDictationChunk('stale chunk from previous session');
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('notification-dictation-transcript'),
        ).toBeInTheDocument();
      });

      act(() => {
        triggerDictationReset();
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId('notification-dictation-transcript'),
        ).not.toBeInTheDocument();
      });
    });
  });
});
