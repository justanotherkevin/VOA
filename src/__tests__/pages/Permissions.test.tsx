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
      expect(
        screen.getByRole('heading', { level: 1, name: /permissions/i }),
      ).toBeTruthy();
    });
  });

  it('should display all four permission cards', async () => {
    render(
      <PermissionsProvider>
        <Permissions />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId(/^permission-card-/)).toHaveLength(4);
      expect(
        screen.getByRole('heading', { name: /Keyboard Shortcut/i }),
      ).toBeTruthy();
      expect(
        screen.getByRole('heading', { name: /Microphone Access/i }),
      ).toBeTruthy();
      expect(
        screen.getByRole('heading', { name: /Accessibility Access/i }),
      ).toBeTruthy();
      expect(
        screen.getByRole('heading', { name: /Screen Recording Access/i }),
      ).toBeTruthy();
    });
  });
});
