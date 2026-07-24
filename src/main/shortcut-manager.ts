import { globalShortcut } from 'electron';
import log from 'electron-log';
import {
  getShortcuts,
  updateRecordingToggleShortcut,
  updateDictationToggleShortcut,
} from '@/main/store';
import { RECORDING_SHORTCUT, DICTATION_SHORTCUT } from '@/lib/shortcuts';
import { executeCommand } from '@/main/commands/registry';

export interface ShortcutConfig {
  key: string;
  description: string;
  handler: () => void;
}

export class ShortcutManager {
  private shortcuts: Map<string, ShortcutConfig> = new Map();

  private isRecording = false;

  private isDictating = false;

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

  unregister(key: string): void {
    globalShortcut.unregister(key);
    this.shortcuts.delete(key);
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.shortcuts.clear();
  }

  isRegistered(key: string): boolean {
    return globalShortcut.isRegistered(key);
  }

  getRegisteredShortcuts(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values());
  }

  updateRecordingShortcut(newShortcut: string): void {
    const currentShortcuts = getShortcuts();

    this.unregister(currentShortcuts.recordingToggle);
    updateRecordingToggleShortcut(newShortcut);
    this.setupDefaultShortcuts();
  }

  updateDictationShortcut(newShortcut: string): void {
    const currentShortcuts = getShortcuts();

    this.unregister(currentShortcuts.dictationToggle);
    updateDictationToggleShortcut(newShortcut);
    this.setupDefaultShortcuts();
  }

  setupDefaultShortcuts(): void {
    const shortcuts = getShortcuts();

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

    this.register(
      shortcuts.dictationToggle || DICTATION_SHORTCUT,
      'Toggle dictation-to-paste session',
      () => {
        // Toggle state for logging; command dispatches the actual action
        this.isDictating = !this.isDictating;
        log.info(
          `[Shortcut] Dictation toggle pressed - isDictating: ${this.isDictating}`,
        );
        executeCommand('dictation.toggle');
      },
    );
  }
}
