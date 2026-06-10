import { globalShortcut, BrowserWindow } from 'electron';
import log from 'electron-log';
import { getShortcuts, updateRecordingToggleShortcut } from '@/main/store';
import { RECORDING_SHORTCUT } from '@/lib/shortcuts';
import { getMainWindow } from '@/main/state/volatile';
import { executeCommand } from '@/main/commands/registry';

export interface ShortcutConfig {
  key: string;
  description: string;
  handler: () => void;
}
/**
  User presses ⌘+⇧+Space in ANY app
    ↓
  [OS] → [Main Process: globalShortcut listener]
    ↓
  [Main Process] Send 'recording:toggle' IPC event
    ↓
  [Renderer] Receives event → Start/stop recording

  Without main process, renderer can only listen to keyboard events when app window is focused (useless for dictation).
 */

export class ShortcutManager {
  private shortcuts: Map<string, ShortcutConfig> = new Map();

  private isRecording = false;

  /**
   * Register a global shortcut that works even when the app is not in focus
   * @param key - The keyboard shortcut
   * @param description - A description of what the shortcut does
   * @param handler - Function to call when the shortcut is triggered
   */
  register(key: string, description: string, handler: () => void): boolean {
    try {
      const success = globalShortcut.register(key, handler);

      if (success) {
        this.shortcuts.set(key, { key, description, handler });
        return true;
      } else {
        return false;
      }
    } catch (error) {
      log.error(`Error registering global shortcut ${key}:`, error);
      return false;
    }
  }

  /**
   * Unregister a specific global shortcut
   * @param key - The keyboard shortcut to unregister
   */
  unregister(key: string): void {
    globalShortcut.unregister(key);
    this.shortcuts.delete(key);
  }

  /**
   * Unregister all global shortcuts
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.shortcuts.clear();
  }

  /**
   * Check if a shortcut is registered
   * @param key - The keyboard shortcut to check
   */
  isRegistered(key: string): boolean {
    return globalShortcut.isRegistered(key);
  }

  /**
   * Get all registered shortcuts
   */
  getRegisteredShortcuts(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Update the recording toggle shortcut
   * @param newShortcut - The new keyboard shortcut string
   */
  updateRecordingShortcut(newShortcut: string): void {
    const currentShortcuts = getShortcuts();

    // 1. Unregister the old shortcut
    this.unregister(currentShortcuts.recordingToggle);
    // 2. Update the store with the new shortcut
    updateRecordingToggleShortcut(newShortcut);
    // 3. Re-register with the new shortcut
    this.setupDefaultShortcuts();
  }

  /**
   * Initialize default shortcuts for the application
   */
  setupDefaultShortcuts(): void {
    const shortcuts = getShortcuts();

    // Register recording toggle shortcut with configurable key
    this.register(
      shortcuts.recordingToggle || RECORDING_SHORTCUT,
      'Toggle dictation process',
      () => {
        // Toggle state for logging; command dispatches the actual action
        this.isRecording = !this.isRecording;
        log.info(
          `[Shortcut] Recording toggle pressed - isRecording: ${this.isRecording}`,
        );
        executeCommand('recording.toggle');
      },
    );
  }
}
