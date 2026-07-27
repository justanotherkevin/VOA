import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Settings from '@/renderer/pages/Settings';
import { MemoryRouter } from 'react-router-dom';
import { RECORDING_SHORTCUT, DICTATION_SHORTCUT } from '@/lib/shortcuts';
import type { SettingsPaneId } from '@/renderer/contexts/SettingsNavContext';
import { UIPreferencesProvider } from '@/renderer/contexts/UIPreferencesProvider';

vi.mock('@/renderer/hooks/useShortcuts', () => ({
  useShortcuts: (kind: 'recording' | 'dictation' = 'recording') => ({
    currentShortcut:
      kind === 'recording' ? RECORDING_SHORTCUT : DICTATION_SHORTCUT,
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
      <UIPreferencesProvider>
        <MemoryRouter>
          <Settings transcriber={mockTranscriber} />
        </MemoryRouter>
      </UIPreferencesProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('settings-pane-recording')).toBeInTheDocument();
    });
  });

  it('should show Recording pane by default', async () => {
    render(
      <UIPreferencesProvider>
        <MemoryRouter>
          <Settings transcriber={mockTranscriber} />
        </MemoryRouter>
      </UIPreferencesProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('settings-row-auto-record')).toBeDefined();
    });
  });

  it('should show Transcription pane and model options when active', async () => {
    mockActivePane = 'transcription';
    render(
      <UIPreferencesProvider>
        <MemoryRouter>
          <Settings transcriber={mockTranscriber} />
        </MemoryRouter>
      </UIPreferencesProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('settings-model-option-tiny')).toBeDefined();
      expect(screen.getByTestId('settings-model-option-base')).toBeDefined();
      expect(screen.getByTestId('settings-model-option-small')).toBeDefined();
      expect(screen.getByTestId('settings-model-option-medium')).toBeDefined();
    });
  });

  it('should show Permissions pane and permission status when active', async () => {
    mockActivePane = 'permissions';
    render(
      <UIPreferencesProvider>
        <MemoryRouter>
          <Settings transcriber={mockTranscriber} />
        </MemoryRouter>
      </UIPreferencesProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('settings-row-microphone')).toBeDefined();
      expect(screen.getByTestId('settings-row-accessibility')).toBeDefined();
    });
  });

  it('should show Shortcuts pane and recording shortcut when active', async () => {
    mockActivePane = 'shortcuts';
    render(
      <UIPreferencesProvider>
        <MemoryRouter>
          <Settings transcriber={mockTranscriber} />
        </MemoryRouter>
      </UIPreferencesProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('settings-row-start-stop-recording'),
      ).toBeDefined();
      expect(
        screen.getByTestId('settings-row-start-stop-dictation'),
      ).toBeDefined();
    });
  });
});
