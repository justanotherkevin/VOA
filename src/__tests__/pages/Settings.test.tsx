import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Settings from '@/renderer/pages/Settings';
import { MemoryRouter } from 'react-router-dom';
import { RECORDING_SHORTCUT } from '@/lib/shortcuts';
import type { SettingsPaneId } from '@/renderer/contexts/SettingsNavContext';

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

// Nav (pane switching) now lives in the app Sidebar, outside Settings.tsx —
// mock the shared context directly so each test can render a specific pane
// without needing a real Sidebar in the tree.
let mockActivePane: SettingsPaneId = 'recording';
vi.mock('@/renderer/hooks/useSettingsNavContext', () => ({
  useSettingsNavContext: () => ({
    activePane: mockActivePane,
    goPane: vi.fn(),
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
    mockActivePane = 'recording';
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

  it('should show Transcription pane and model options when active', async () => {
    mockActivePane = 'transcription';
    render(
      <MemoryRouter>
        <Settings transcriber={mockTranscriber} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Tiny').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Base').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Small').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
    });
  });

  it('should show Permissions pane and permission status when active', async () => {
    mockActivePane = 'permissions';
    render(
      <MemoryRouter>
        <Settings transcriber={mockTranscriber} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Microphone')).toBeDefined();
      expect(screen.getByText('Accessibility')).toBeDefined();
    });
  });

  it('should show Shortcuts pane and recording shortcut when active', async () => {
    mockActivePane = 'shortcuts';
    render(
      <MemoryRouter>
        <Settings transcriber={mockTranscriber} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Start / stop recording')).toBeDefined();
    });
  });
});
