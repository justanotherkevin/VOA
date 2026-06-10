import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Permissions from '@/renderer/pages/Permissions';
import { PermissionsProvider } from '@/renderer/contexts/PermissionsProvider';

describe('Permissions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.electronAPI = {
      permissions: {
        check: vi.fn().mockResolvedValue({
          microphone: 'granted',
          accessibility: true,
          keyboardShortcut: true,
          screenRecording: 'granted',
        }),
      },
    } as any;
  });

  it('should render without crashing', async () => {
    render(
      <PermissionsProvider>
        <Permissions />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Permissions/i)).toBeTruthy();
    });
  });

  it('should display all four permission cards', async () => {
    render(
      <PermissionsProvider>
        <Permissions />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      const headings = screen.getAllByText(/Keyboard Shortcut/i);
      expect(headings.length).toBeGreaterThan(0);
      expect(screen.getByText(/Microphone Access/i)).toBeTruthy();
      expect(screen.getByText(/Accessibility Access/i)).toBeTruthy();
      expect(screen.getByText(/Screen Recording Access/i)).toBeTruthy();
    });
  });
});
