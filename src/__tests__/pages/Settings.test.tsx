import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Settings from '@/renderer/pages/Settings';
import { MemoryRouter } from 'react-router-dom';
import { RECORDING_SHORTCUT } from '@/lib/shortcuts';

vi.mock('@/renderer/hooks/useShortcuts', () => ({
  useShortcuts: () => ({
    currentShortcut: RECORDING_SHORTCUT,
    isSaving: false,
    updateShortcut: vi.fn(async () => true),
    resetShortcut: vi.fn(async () => true),
  }),
}));

vi.mock('@/renderer/hooks/usePermissions', () => ({
  usePermissions: () => ({
    permissions: {
      microphone: 'granted',
      accessibility: true,
      screenRecording: 'granted',
    },
    isLoading: false,
    openSettings: vi.fn(),
  }),
}));

describe('Settings Page', () => {
  const mockTranscriber = {
    output: null,
    isBusy: false,
    isModelLoading: false,
    progressItems: [],
    start: vi.fn(),
    restTranscript: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', async () => {
    render(
      <MemoryRouter>
        <Settings transcriber={mockTranscriber} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getAllByText('Recording').length).toBeGreaterThan(0);
    });
  });

  it('should display sidebar navigation items', async () => {
    render(
      <MemoryRouter>
        <Settings transcriber={mockTranscriber} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getAllByText('General').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Transcription').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Recording').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Audio').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Privacy & Storage').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Permissions').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Shortcuts').length).toBeGreaterThan(0);
    });
  });

  it('should show Recording pane by default', async () => {
    render(
      <MemoryRouter>
        <Settings transcriber={mockTranscriber} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Auto-record meeting detection')).toBeDefined();
    });
  });

  it('should navigate to Transcription pane and show model options', async () => {
    render(
      <MemoryRouter>
        <Settings transcriber={mockTranscriber} />
      </MemoryRouter>,
    );

    const transcriptionBtn = await screen.findAllByText('Transcription');
    fireEvent.click(transcriptionBtn[0]);

    await waitFor(() => {
      expect(screen.getAllByText('Tiny').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Base').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Small').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
    });
  });

  it('should navigate to Permissions pane and show permission status', async () => {
    render(
      <MemoryRouter>
        <Settings transcriber={mockTranscriber} />
      </MemoryRouter>,
    );

    const permissionsBtn = await screen.findAllByText('Permissions');
    fireEvent.click(permissionsBtn[0]);

    await waitFor(() => {
      expect(screen.getByText('Microphone')).toBeDefined();
      expect(screen.getByText('Accessibility')).toBeDefined();
    });
  });

  it('should navigate to Shortcuts pane and show recording shortcut', async () => {
    render(
      <MemoryRouter>
        <Settings transcriber={mockTranscriber} />
      </MemoryRouter>,
    );

    const shortcutsBtn = await screen.findAllByText('Shortcuts');
    fireEvent.click(shortcutsBtn[0]);

    await waitFor(() => {
      expect(screen.getByText('Start / stop recording')).toBeDefined();
    });
  });
});
