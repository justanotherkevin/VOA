import { describe, it, expect, vi, beforeEach } from 'vitest';
import { globalShortcut } from 'electron';
import { ShortcutManager } from '../shortcut-manager';
import {
  getShortcuts,
  updateRecordingToggleShortcut,
  updateDictationToggleShortcut,
} from '../store';

vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn().mockReturnValue(true),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
    isRegistered: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../store', () => ({
  getShortcuts: vi.fn(),
  updateRecordingToggleShortcut: vi.fn(),
  updateDictationToggleShortcut: vi.fn(),
  getModelPreferences: vi.fn(),
}));

vi.mock('../active-window', () => ({
  getActiveWindow: vi.fn().mockResolvedValue({ name: 'Test Window' }),
  logFocusedWindowInfo: vi.fn(),
}));

vi.mock('../notification-window', () => ({
  updateNotificationState: vi.fn(),
}));

vi.mock('../state/volatile', () => ({
  getMainWindow: vi.fn().mockReturnValue({ webContents: { send: vi.fn() } }),
}));

describe('ShortcutManager', () => {
  let shortcutManager: ShortcutManager;

  beforeEach(() => {
    vi.clearAllMocks();
    shortcutManager = new ShortcutManager();
  });

  describe('register', () => {
    it('should register a global shortcut', () => {
      const handler = vi.fn();
      const success = shortcutManager.register(
        'Cmd+Shift+X',
        'Test shortcut',
        handler,
      );

      expect(success).toBe(true);
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'Cmd+Shift+X',
        handler,
      );
    });
  });

  describe('updateRecordingShortcut', () => {
    it('should unregister the old shortcut and register the new one', () => {
      const oldShortcut = 'Cmd+Shift+Space';
      const newShortcut = 'Cmd+Shift+D';

      (getShortcuts as any).mockReturnValue({ recordingToggle: oldShortcut });

      shortcutManager.updateRecordingShortcut(newShortcut);

      expect(globalShortcut.unregister).toHaveBeenCalledWith(oldShortcut);
      expect(updateRecordingToggleShortcut).toHaveBeenCalledWith(newShortcut);

      expect(globalShortcut.register).toHaveBeenCalled();
    });
  });

  describe('updateDictationShortcut', () => {
    it('should unregister the old dictation shortcut and register the new one', () => {
      const oldShortcut = 'F2';
      const newShortcut = 'F3';

      (getShortcuts as any).mockReturnValue({ dictationToggle: oldShortcut });

      shortcutManager.updateDictationShortcut(newShortcut);

      expect(globalShortcut.unregister).toHaveBeenCalledWith(oldShortcut);
      expect(updateDictationToggleShortcut).toHaveBeenCalledWith(newShortcut);

      expect(globalShortcut.register).toHaveBeenCalled();
    });
  });

  describe('setupDefaultShortcuts', () => {
    it('registers both the recording and dictation shortcuts independently', () => {
      (getShortcuts as any).mockReturnValue({
        recordingToggle: 'Cmd+Shift+Space',
        dictationToggle: 'F2',
      });

      shortcutManager.setupDefaultShortcuts();

      expect(globalShortcut.register).toHaveBeenCalledWith(
        'Cmd+Shift+Space',
        expect.any(Function),
      );
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'F2',
        expect.any(Function),
      );
      expect(globalShortcut.register).toHaveBeenCalledTimes(2);
    });
  });
});
