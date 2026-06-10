import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Permissions IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have keyboard shortcut permission handler registered', async () => {
    const handlers: Record<string, Function> = {};

    const mockIpcMain = {
      handle: (channel: string, handler: Function) => {
        handlers[channel] = handler;
      },
    };

    vi.doMock('electron', () => ({
      ipcMain: mockIpcMain,
      BrowserWindow: {},
      shell: { openExternal: vi.fn() },
      systemPreferences: {
        getMediaAccessStatus: vi.fn().mockReturnValue('granted'),
        isTrustedAccessibilityClient: vi.fn().mockReturnValue(true),
      },
    }));

    const { registerPermissionsHandlers } = await import('../permissions');
    registerPermissionsHandlers();

    expect(handlers['permissions:check-keyboard-shortcut']).toBeDefined();
  });
});
