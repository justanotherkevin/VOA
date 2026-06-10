import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import {
  attachGlobalElectronMock,
  resetElectronMockCallbacks,
  triggerNotificationShow,
  triggerNotificationHide,
} from '@/testing/electronMocks';
import Notification from '@/renderer/Notification';
import type { NotificationData } from '@/renderer/hooks/useNotifications';

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

      // Trigger notification:show event
      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
        });
      });

      // Wait for notification to appear
      await waitFor(() => {
        expect(screen.getByText('recording')).toBeInTheDocument();
        expect(screen.getByText('Test App')).toBeInTheDocument();
      });
    });

    it('should hide notification when notification:hide event is triggered', async () => {
      render(<Notification />);

      // Show notification first
      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('recording')).toBeInTheDocument();
      });

      // Trigger hide event
      act(() => {
        triggerNotificationHide();
      });

      // Wait for notification to become hidden
      await waitFor(
        () => {
          const container = screen.queryByText('recording')?.closest('.inline-block');
          if (container) {
            expect(container).toHaveClass('hidden');
          }
        },
        { timeout: 500 },
      );
    });
  });

  describe('notification persistence and replacement', () => {
    it('should keep notification visible for recording (no auto-hide)', async () => {
      render(<Notification />);

      // Show recording notification (no duration)
      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('recording')).toBeInTheDocument();
      });

      // Wait 2 seconds - notification should still be visible
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(screen.getByText('recording')).toBeInTheDocument();
    });

    it('should replace old notification with new one (fade transition)', async () => {
      render(<Notification />);

      // Show first notification
      act(() => {
        triggerNotificationShow({
          title: 'Recording Started',
          message: 'Speak now...',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('recording')).toBeInTheDocument();
      });

      // Show second notification (replaces first)
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

      // Should fade out old and show new
      await waitFor(
        () => {
          expect(screen.getByText('Audio App')).toBeInTheDocument();
          expect(screen.getByText('recording')).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
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
        expect(screen.getByText('recording')).toBeInTheDocument();
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
      });

      // Step 3: Backend sends hide event after delay
      act(() => {
        triggerNotificationHide();
      });

      // Notification should become hidden
      await waitFor(
        () => {
          const container = screen.queryByText('recording')?.closest('.inline-block');
          if (container) {
            expect(container).toHaveClass('hidden');
          }
        },
        { timeout: 500 },
      );
    });
  });
});
