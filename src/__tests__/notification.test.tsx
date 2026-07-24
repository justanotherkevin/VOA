import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import {
  attachGlobalElectronMock,
  resetElectronMockCallbacks,
  triggerNotificationShow,
  triggerNotificationHide,
  triggerCalendarMatch,
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
      expect(screen.queryByText('Test App')).not.toBeInTheDocument();

      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Recording Started')).toBeInTheDocument();
        expect(screen.getByText('Test App')).toBeInTheDocument();
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
        expect(screen.getByText('Recording Started')).toBeInTheDocument();
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
        expect(screen.getByText('Recording Started')).toBeInTheDocument();
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(screen.getByText('Recording Started')).toBeInTheDocument();
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
        expect(screen.getByText('Recording Started')).toBeInTheDocument();
      });

      const shell = screen.getByTestId('notification-window');

      act(() => {
        triggerNotificationShow({
          title: 'Recording Stopped',
          message: 'Processing your audio...',
          activeWindow: {
            title: 'Recording Stopped',
            owner: { name: 'Audio App' },
          },
        });
      });

      // Same shell throughout — no remount, no blink.
      await waitFor(
        () => {
          expect(screen.getByText('Audio App')).toBeInTheDocument();
          expect(screen.getByText('Recording Stopped')).toBeInTheDocument();
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
        expect(screen.getByText('Recording Started')).toBeInTheDocument();
      });

      // Step 2: Recording stops (notification updates)
      act(() => {
        triggerNotificationShow({
          title: 'Recording Stopped',
          message: 'Processing your audio...',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Test App')).toBeInTheDocument();
        expect(screen.getByText('Recording Stopped')).toBeInTheDocument();
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

  describe('calendar match pill', () => {
    it('always renders a Select — pre-selected for a single match — with no decline button', async () => {
      render(<Notification />);

      act(() => {
        triggerCalendarMatch([{ id: 'evt-1', title: 'Weekly Sync — 2:00 PM' }]);
      });

      await waitFor(() => {
        expect(screen.getByText('Which meeting?')).toBeInTheDocument();
      });
      expect(screen.getByRole('combobox')).toHaveTextContent(
        'Weekly Sync — 2:00 PM',
      );
      expect(screen.queryByText('No')).not.toBeInTheDocument();
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
        expect(screen.getByText('2 meetings found')).toBeInTheDocument();
      });
      expect(screen.queryByText('No')).not.toBeInTheDocument();
    });

    it('choosing an option calls calendar.selectMatch and closes the pill', async () => {
      const user = userEvent.setup();
      render(<Notification />);

      act(() => {
        triggerCalendarMatch([
          { id: 'evt-1', title: 'Weekly Sync — 2:00 PM' },
          { id: 'evt-2', title: '1:1 with Sam — 2:15 PM' },
        ]);
      });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('combobox'));
      const option = await screen.findByText('1:1 with Sam — 2:15 PM');
      await user.click(option);

      expect(window.electronAPI.calendar.selectMatch).toHaveBeenCalledWith(
        'evt-2',
      );
      // Selecting immediately closes the pill (reverts to the recording state).
      await waitFor(() => {
        expect(screen.queryByText('Which meeting?')).not.toBeInTheDocument();
      });
    });

    it('auto-closes after the countdown even without user interaction', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        render(<Notification />);

        act(() => {
          triggerCalendarMatch([{ id: 'evt-1', title: 'Weekly Sync' }]);
        });

        await vi.waitFor(() => {
          expect(screen.getByText('Which meeting?')).toBeInTheDocument();
        });

        act(() => {
          vi.advanceTimersByTime(10_000);
        });

        await vi.waitFor(() => {
          expect(screen.queryByText('Which meeting?')).not.toBeInTheDocument();
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
