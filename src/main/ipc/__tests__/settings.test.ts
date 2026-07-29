import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CHANNELS } from '@/lib/ipc-channels';

const handlers: Record<string, Function> = {};
const mockIpcMain = {
  handle: (channel: string, handler: Function) => {
    handlers[channel] = handler;
  },
};

const mockGetOnboardingCompleted = vi.fn();
const mockSaveOnboardingCompleted = vi.fn();

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  app: { getLoginItemSettings: vi.fn(), setLoginItemSettings: vi.fn() },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
}));

vi.mock('electron-log', () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@/main/store', () => ({
  getTranscriptHistory: vi.fn(),
  clearTranscriptHistory: vi.fn(),
  getModelPreferences: vi.fn(),
  updateModelPreferences: vi.fn(),
  getAppPreferences: vi.fn(),
  saveAppPreferences: vi.fn(),
  getAudioPreferences: vi.fn(),
  saveAudioPreferences: vi.fn(),
  getUIPreferences: vi.fn(),
  saveUIPreferences: vi.fn(),
  getLMStudioPreferences: vi.fn(),
  saveLMStudioPreferences: vi.fn(),
  getSummarizerProvider: vi.fn(),
  saveSummarizerProvider: vi.fn(),
  getOnboardingCompleted: (...args: any[]) =>
    mockGetOnboardingCompleted(...args),
  saveOnboardingCompleted: (...args: any[]) =>
    mockSaveOnboardingCompleted(...args),
}));

vi.mock('../../model-cache', () => ({
  listCachedModels: vi.fn(),
  deleteModel: vi.fn(),
  clearAllCache: vi.fn(),
  getCachePaths: vi.fn(),
}));

vi.mock('../../gguf-model-cache', () => ({
  isModelDownloaded: vi.fn(),
  getModelPath: vi.fn(),
  downloadModel: vi.fn(),
  cancelDownload: vi.fn(),
  deleteModel: vi.fn(),
}));

vi.mock('../../services/transcriber', () => ({
  default: {
    isSessionActive: vi.fn(),
    applyModelPreferences: vi.fn(),
  },
}));

vi.mock('../../state/volatile', () => ({
  getMainWindow: vi.fn(),
}));

describe('Settings IPC Handlers — Onboarding', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(handlers)) delete handlers[key];
    process.env = { ...originalEnv };
    delete process.env.E2E_TEST;
    delete process.env.E2E_ONBOARDING;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function loadAndRegister() {
    const { registerSettingsHandlers } = await import('../settings');
    registerSettingsHandlers();
    return handlers;
  }

  it('registers GET_COMPLETED and SET_COMPLETED handlers', async () => {
    const h = await loadAndRegister();
    expect(h[CHANNELS.ONBOARDING.GET_COMPLETED]).toBeDefined();
    expect(h[CHANNELS.ONBOARDING.SET_COMPLETED]).toBeDefined();
  });

  it('GET_COMPLETED returns the stored value when E2E_TEST is not set', async () => {
    mockGetOnboardingCompleted.mockReturnValue(false);
    const h = await loadAndRegister();

    const result = await h[CHANNELS.ONBOARDING.GET_COMPLETED]();

    expect(result).toBe(false);
  });

  it('GET_COMPLETED returns true when E2E_TEST is set and E2E_ONBOARDING is unset, even if the store says false', async () => {
    mockGetOnboardingCompleted.mockReturnValue(false);
    process.env.E2E_TEST = 'true';
    const h = await loadAndRegister();

    const result = await h[CHANNELS.ONBOARDING.GET_COMPLETED]();

    expect(result).toBe(true);
    expect(mockGetOnboardingCompleted).not.toHaveBeenCalled();
  });

  it('GET_COMPLETED returns the stored value when both E2E_TEST and E2E_ONBOARDING are set', async () => {
    mockGetOnboardingCompleted.mockReturnValue(false);
    process.env.E2E_TEST = 'true';
    process.env.E2E_ONBOARDING = 'true';
    const h = await loadAndRegister();

    const result = await h[CHANNELS.ONBOARDING.GET_COMPLETED]();

    expect(result).toBe(false);
    expect(mockGetOnboardingCompleted).toHaveBeenCalled();
  });

  it('SET_COMPLETED persists via saveOnboardingCompleted and returns success', async () => {
    const h = await loadAndRegister();

    const result = await h[CHANNELS.ONBOARDING.SET_COMPLETED]({}, true);

    expect(mockSaveOnboardingCompleted).toHaveBeenCalledWith(true);
    expect(result).toEqual({ success: true });
  });

  it('SET_COMPLETED returns failure when saving throws', async () => {
    mockSaveOnboardingCompleted.mockImplementation(() => {
      throw new Error('disk full');
    });
    const h = await loadAndRegister();

    const result = await h[CHANNELS.ONBOARDING.SET_COMPLETED]({}, true);

    expect(result.success).toBe(false);
  });
});
