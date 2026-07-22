import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CHANNELS } from '@/lib/ipc-channels';

const handlers: Record<string, Function> = {};
const mockIpcMain = {
  handle: (channel: string, handler: Function) => {
    handlers[channel] = handler;
  },
};
const mockSend = vi.fn();
const mockFromWebContents = vi.fn(() => ({ webContents: { send: mockSend } }));

const mockBeginSession = vi.fn();
const mockEndSession = vi.fn();
const mockTranscribe = vi.fn();
const mockCheckCurrentWindow = vi.fn(async () => false);
const mockStartTray = vi.fn();
const mockStopTray = vi.fn();

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  BrowserWindow: { fromWebContents: mockFromWebContents },
}));

vi.mock('electron-log', () => ({
  log: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/main/services/transcriber', () => ({
  default: {
    beginSession: mockBeginSession,
    endSession: mockEndSession,
    transcribe: mockTranscribe,
  },
}));

vi.mock('@/main/services/meeting-detector', () => ({
  meetingDetector: { checkCurrentWindow: mockCheckCurrentWindow },
}));

vi.mock('@/main/models/tray', () => ({
  startTrayAnimation: mockStartTray,
  stopTrayAnimation: mockStopTray,
}));

describe('Transcriber IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(handlers)) delete handlers[key];
  });

  async function loadAndRegister() {
    const { registerTranscriberHandlers } = await import('../transcriber');
    registerTranscriberHandlers();
    return handlers;
  }

  it('registers SESSION_START, SESSION_END, and START handlers (not e2e channels)', async () => {
    const h = await loadAndRegister();
    expect(h[CHANNELS.TRANSCRIBER.SESSION_START]).toBeDefined();
    expect(h[CHANNELS.TRANSCRIBER.SESSION_END]).toBeDefined();
    expect(h[CHANNELS.TRANSCRIBER.START]).toBeDefined();
    expect(h['transcriber:e2e-force-meeting']).toBeUndefined();
    expect(h['transcriber:e2e-transcribe-file']).toBeUndefined();
    expect(h['transcriber:e2e-mock-enrich-meeting']).toBeUndefined();
  });

  it('SESSION_START calls checkCurrentWindow, beginSession, and starts tray animation', async () => {
    const h = await loadAndRegister();
    mockCheckCurrentWindow.mockResolvedValueOnce(true);
    await h[CHANNELS.TRANSCRIBER.SESSION_START](
      { sender: {} },
      { startedAt: 123 },
    );
    expect(mockBeginSession).toHaveBeenCalledWith(123, true);
    expect(mockStartTray).toHaveBeenCalled();
  });

  it('SESSION_START defaults startedAt to Date.now() when not provided', async () => {
    const h = await loadAndRegister();
    const now = 555;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await h[CHANNELS.TRANSCRIBER.SESSION_START]({ sender: {} }, {});
    expect(mockBeginSession).toHaveBeenCalledWith(now, false);
    vi.spyOn(Date, 'now').mockRestore();
  });

  it('SESSION_END calls transcriberService.endSession and stops tray animation', async () => {
    const h = await loadAndRegister();
    await h[CHANNELS.TRANSCRIBER.SESSION_END]({ sender: {} }, { endedAt: 456 });
    expect(mockEndSession).toHaveBeenCalledWith(456, expect.any(Object));
    expect(mockStopTray).toHaveBeenCalled();
  });

  it('START forwards args to transcriberService.transcribe with callbacks', async () => {
    const h = await loadAndRegister();
    const args = { audio: new Float32Array(10) };
    await h[CHANNELS.TRANSCRIBER.START]({ sender: {} }, args);
    expect(mockTranscribe).toHaveBeenCalledWith(args, expect.any(Object));
  });

  it('makeCallbacks sends IPC messages on the correct channels', async () => {
    const h = await loadAndRegister();
    await h[CHANNELS.TRANSCRIBER.START]({ sender: {} }, {});
    const callbacks = mockTranscribe.mock.calls[0][1];

    callbacks.onUpdate({ text: 'hi' });
    expect(mockSend).toHaveBeenCalledWith(CHANNELS.TRANSCRIBER.UPDATE, {
      text: 'hi',
    });

    callbacks.onProgress({ pct: 50 });
    expect(mockSend).toHaveBeenCalledWith(CHANNELS.TRANSCRIBER.PROGRESS, {
      pct: 50,
    });

    callbacks.onComplete({ text: 'done' });
    expect(mockSend).toHaveBeenCalledWith(CHANNELS.TRANSCRIBER.COMPLETE, {
      text: 'done',
    });

    callbacks.onError('boom');
    expect(mockSend).toHaveBeenCalledWith(CHANNELS.TRANSCRIBER.ERROR, 'boom');

    callbacks.onMeetingSaved({ id: 'm1' });
    expect(mockSend).toHaveBeenCalledWith(CHANNELS.MEETINGS.SAVED, {
      id: 'm1',
    });

    callbacks.onQueued({ queued: true });
    expect(mockSend).toHaveBeenCalledWith(CHANNELS.TRANSCRIBER.PROCESSING, {
      queued: true,
    });
  });

  it('swallows errors thrown by webContents.send', async () => {
    mockSend.mockImplementationOnce(() => {
      throw new Error('send failed');
    });
    const h = await loadAndRegister();
    await h[CHANNELS.TRANSCRIBER.START]({ sender: {} }, {});
    const callbacks = mockTranscribe.mock.calls[0][1];

    expect(() => callbacks.onUpdate({ text: 'hi' })).not.toThrow();
  });

  it('setE2eForceMeeting forces isMeeting on the next SESSION_START and resets after one use', async () => {
    const { registerTranscriberHandlers, setE2eForceMeeting } =
      await import('../transcriber');
    registerTranscriberHandlers();
    mockCheckCurrentWindow.mockResolvedValue(false);

    setE2eForceMeeting(true);
    await handlers[CHANNELS.TRANSCRIBER.SESSION_START](
      { sender: {} },
      { startedAt: 1 },
    );
    expect(mockBeginSession).toHaveBeenCalledWith(1, true);

    mockBeginSession.mockClear();
    await handlers[CHANNELS.TRANSCRIBER.SESSION_START](
      { sender: {} },
      { startedAt: 2 },
    );
    expect(mockBeginSession).toHaveBeenCalledWith(2, false);
  });
});
