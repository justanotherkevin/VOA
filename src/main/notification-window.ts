import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import log from 'electron-log';
import { preloadPath, resolveHtmlPath } from '@/main/util';
import type { ActiveWindow } from '@/main/active-window';

// Constants for notification window
const NOTIFICATION_WIDTH = 520;
const NOTIFICATION_HEIGHT = 80;
const NOTIFICATION_MARGIN = 60;
const FADE_DURATION_MS = 300;
const FADE_BUFFER_MS = 50; // Buffer after fade animation to ensure UI is ready

export type NotificationState = 'idle' | 'in-meeting' | 'recording' | 'recording-stopped' | 'processing' | 'done';

export interface NotificationStatePayload {
  state: NotificationState;
  title: string;
  message: string;
  activeWindow?: ActiveWindow;
  meetingKey?: string;
}

export interface NotificationOptions {
  title: string;
  message: string;
  duration?: number;
  activeWindow?: ActiveWindow
}

let notificationWindow: BrowserWindow | null = null;
let hideTimer: NodeJS.Timeout | null = null;
let currentState: NotificationState = 'idle';

/**
 * Create the single persistent notification window (frameless, always-on-top)
 * This window is created once and persists for the entire app lifetime.
 * It is reused for all notifications.
 */
export function createNotificationWindow(): BrowserWindow {

  if (notificationWindow && !notificationWindow.isDestroyed()) {
    log.info('Notification window already exists, reusing it');
    return notificationWindow;
  }

  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  const isPackaged = app.isPackaged || process.env.E2E_TEST === 'true';

  notificationWindow = new BrowserWindow({
    width: NOTIFICATION_WIDTH,
    height: NOTIFICATION_HEIGHT,
    x: (screenWidth - NOTIFICATION_WIDTH) / 2,
    y: NOTIFICATION_MARGIN,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: isPackaged,
      webSecurity: isPackaged,
    },
  });

  // Load the notification HTML
  notificationWindow.loadURL(resolveHtmlPath('notification.html'));

  // Handle window close - set to null so it can be recreated if needed
  notificationWindow.on('closed', () => {
    notificationWindow = null;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });

  // Make window click-through on macOS
  if (process.platform === 'darwin') {
    notificationWindow.setIgnoreMouseEvents(true);
  }

  return notificationWindow;
}

/**
 * Update the notification state and send state update to the renderer
 * This is the primary way to control notification display and behavior
 */
export function updateNotificationState(payload: NotificationStatePayload): void {
  try {
    // Ensure the persistent window exists
    if (!notificationWindow || notificationWindow.isDestroyed()) {
      createNotificationWindow();
    }

    // Clear any existing auto-hide timer
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    // Update internal state
    currentState = payload.state;

    // Send state update to the renderer
    notificationWindow?.webContents.send('notification:update-state', payload);

    // Allow mouse interaction only for in-meeting state (so the "Start Recording" button is clickable)
    if (process.platform === 'darwin') {
      notificationWindow?.setIgnoreMouseEvents(payload.state !== 'in-meeting');
    }

    // Show the window for non-idle states
    if (payload.state !== 'idle') {
      notificationWindow?.showInactive();
    }

  } catch (error) {
    log.error('Error updating notification state:', error);
  }
}

/**
 * Show a notification with custom content using the persistent window
 * Updates the content of the existing window and displays it
 */
export function showNotification(options: NotificationOptions): void {
  try {
    // Ensure the persistent window exists
    if (!notificationWindow || notificationWindow.isDestroyed()) {
      createNotificationWindow();
    }

    // Clear any existing auto-hide timer
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    // Send notification data to the persistent window via IPC
    // The renderer will update the content and show the notification
    notificationWindow?.webContents.send('notification:show', {
      title: options.title,
      message: options.message,
      activeWindow: options.activeWindow,
    });

    // Show the persistent window (if it's hidden)
    notificationWindow?.showInactive();

    // Schedule auto-hide if duration is specified
    if (options.duration) {
      hideTimer = setTimeout(() => {
        // Send hide event to trigger fade-out animation
        notificationWindow?.webContents.send('notification:hide');

        // Wait for fade animation to complete before hiding the window
        setTimeout(() => {
          if (notificationWindow && !notificationWindow.isDestroyed()) {
            notificationWindow.hide();
          }
        }, FADE_DURATION_MS + FADE_BUFFER_MS);

        hideTimer = null;
      }, options.duration);
    }

  } catch (error) {
    log.error('Error showing notification:', error);
  }
}

/**
 * Hide the notification window
 */
export function hideNotification(): void {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.hide();
    log.info('Notification hidden');
  }

  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

/**
 * Close and destroy the notification window
 */
export function closeNotificationWindow(): void {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.close();
    notificationWindow = null;
    log.info('Notification window closed');
  }
}

/**
 * Check if notification window exists
 */
export function isNotificationWindowOpen(): boolean {
  return notificationWindow !== null && !notificationWindow.isDestroyed();
}

/**
 * Send an IPC event to the notification window
 * Used to update notification state from the main process
 */
export function sendToNotificationWindow(channel: string, data?: any): void {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    try {
      notificationWindow.webContents.send(channel, data);
    } catch (error) {
      log.error(`Error sending to notification window on channel ${channel}:`, error);
    }
  }
}
