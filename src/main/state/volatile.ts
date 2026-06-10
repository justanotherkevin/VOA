import { BrowserWindow } from 'electron';
import { ShortcutManager } from '../shortcut-manager';

let mainWindow: BrowserWindow | null = null;
let shortcutManager: ShortcutManager | null = null;

/**
 * Set the main BrowserWindow instance.
 * Called when the window is created in main.ts.
 */
export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

/**
 * Get the current main BrowserWindow instance.
 * Returns null if window is not yet created or has been closed.
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Initialize the ShortcutManager instance.
 * Called once at startup in main.ts.
 */
export function initializeShortcutManager(): void {
  shortcutManager = new ShortcutManager();
}

/**
 * Get the ShortcutManager instance.
 * Must be called after initializeShortcutManager().
 */
export function getShortcutManager(): ShortcutManager {
  if (!shortcutManager) {
    throw new Error('ShortcutManager not initialized');
  }
  return shortcutManager;
}
