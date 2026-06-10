import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Home from '@/renderer/pages/Home';
import { MemoryRouter } from 'react-router-dom';
import { PermissionsProvider } from '@/renderer/contexts/PermissionsProvider';

// Mock the transcriber hook
vi.mock('@/renderer/hooks/useTranscriber', () => ({
  useTranscriber: () => ({
    output: null,
    model: 'Xenova/whisper-tiny',
    setModel: vi.fn(),
  }),
}));

// Mock child components to simplify testing
vi.mock('@/renderer/components/ui/Recording', () => ({
  default: () => <div data-testid="recording">Recording Component</div>,
}));

vi.mock('@/renderer/components/ui/History', () => ({
  default: () => <div data-testid="history">History Component</div>,
}));

vi.mock('@/renderer/components/ui/StatsCards', () => ({
  default: () => <div data-testid="stats">Stats Cards</div>,
}));

// Mock other hooks that make IPC calls
vi.mock('@/renderer/hooks/useTranscriptHistory', () => ({
  useTranscriptHistory: () => ({
    history: [],
    clearHistory: vi.fn(),
  }),
}));

vi.mock('@/renderer/hooks/useShortcuts', () => ({
  useShortcuts: () => ({
    currentShortcut: 'Ctrl+Shift+D',
    updateShortcut: vi.fn(),
  }),
}));

vi.mock('@/renderer/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  }),
}));

vi.mock('@/renderer/hooks/useRecordingFlow', () => ({
  useRecordingFlow: vi.fn(),
}));

describe('Home Page', () => {
  const mockTranscriber = {
    output: { chunks: [] },
    model: 'Xenova/whisper-tiny',
    setModel: vi.fn(),
  };

  it('should render without crashing', async () => {
    render(
      <PermissionsProvider>
        <MemoryRouter>
          <Home transcriber={mockTranscriber} />
        </MemoryRouter>
      </PermissionsProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    });
  });

  it('should display the main heading', async () => {
    render(
      <PermissionsProvider>
        <MemoryRouter>
          <Home transcriber={mockTranscriber} />
        </MemoryRouter>
      </PermissionsProvider>,
    );
    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeTruthy();
    });
  });

  it('should render history component', async () => {
    render(
      <PermissionsProvider>
        <MemoryRouter>
          <Home transcriber={mockTranscriber} />
        </MemoryRouter>
      </PermissionsProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('history')).toBeDefined();
    });
  });
});
