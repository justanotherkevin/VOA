import log from 'electron-log';
import { getActiveWindow, type ActiveWindow } from '../active-window';
import {
  getMeetingPreferences,
  getDismissedMeetingKeys,
  addDismissedMeetingKey,
  type MeetingPreferences,
} from '../store';
import { CHANNELS } from '@/lib/ipc-channels';
import { getMainWindow } from '../state/volatile';

// Apps that indicate a meeting is likely in progress
const MEETING_APP_PATTERNS = [
  'zoom',
  'microsoft teams',
  'teams',
  'slack',
  'discord',
  'webex',
  'gotomeeting',
  'google meet',
  'facetime',
  'skype',
  'bluejeans',
];

// Window title keywords (for browsers running Google Meet, etc.)
// These are checked with .includes() - can appear anywhere in title
const MEETING_TITLE_SUBSTRING_PATTERNS = [
  'zoom.us',
  'meet.google.com',
  'zoom meeting',
  'teams meeting',
  'webex meeting',
];

// These are checked with .startsWith() - must appear at beginning of title
// This is more precise: "Meet - " at the START means Google Meet in browser
const MEETING_TITLE_PREFIX_PATTERNS = [
  'meet -', // Google Meet in browser: "Meet - abc-defg-hij"
  'meet —', // Google Meet with em-dash variant
  'zoom -', // Zoom in browser
  'teams -', // Teams in browser
];

/**
 * Extract a validated meeting room code from a window title.
 * Only returns codes that match known structured formats — never browser/user info.
 *
 * Returns null if no valid room code is found, which means the title is NOT
 * a real in-room meeting page (e.g. loading screen, end-meeting page).
 *
 * Examples:
 *   "Meet - gnh-ddfz-zns - High memory usage"  → "gnh-ddfz-zns"
 *   "Meet - Google Chrome - Kevin"             → null  (not a room)
 *   "Zoom - 85012345678"                       → "85012345678"
 */
function extractValidRoomCode(windowTitle: string): string | null {
  // Google Meet room codes: exactly 3 groups (3-4-3 lowercase letters)
  // e.g. "gnh-ddfz-zns", "qpn-stgm-rcb"
  const meetMatch = windowTitle.match(
    /meet\s*[-–—]\s*([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i,
  );
  if (meetMatch) return meetMatch[1].toLowerCase();

  // Zoom numeric meeting IDs (8–11 digits)
  const zoomMatch = windowTitle.match(/zoom\s*[-–—]\s*(\d{8,11})\b/i);
  if (zoomMatch) return zoomMatch[1];

  return null;
}

/**
 * Derive a stable tracking key for a detected meeting.
 * Prefers the structured room code from the window title.
 * Falls back to the app name for native meeting apps (Zoom.app, Teams.app)
 * where there is no room code in the title.
 */
function getMeetingTrackingKey(
  appName: string,
  windowTitle: string,
): string | null {
  const roomCode = extractValidRoomCode(windowTitle);
  if (roomCode) return roomCode;

  // For native apps detected by app name (not title), use the app name.
  // These apps manage their own in/out state so re-triggering is less of an issue,
  // but we still want dismissal to work within a session.
  const name = appName.toLowerCase();
  if (MEETING_APP_PATTERNS.some((p) => name.includes(p))) {
    return `native:${name}`;
  }

  return null;
}

function isMeetingApp(appName: string, windowTitle: string): boolean {
  const name = appName.toLowerCase();
  const title = windowTitle.toLowerCase();
  // Check if it's a known meeting app (e.g., Zoom.app, Microsoft Teams.app)
  if (MEETING_APP_PATTERNS.some((p) => name.includes(p))) {
    return true;
  }

  // Check if title starts with a meeting prefix AND contains a valid room code.
  // This rejects loading/end pages like "Meet - Google Chrome - Kevin" which have
  // the prefix but no structured room code (e.g. "gnh-ddfz-zns").
  if (MEETING_TITLE_PREFIX_PATTERNS.some((p) => title.startsWith(p))) {
    return extractValidRoomCode(windowTitle) !== null;
  }

  // Check if title contains meeting keywords anywhere (less precise, but catches URLs)
  if (MEETING_TITLE_SUBSTRING_PATTERNS.some((p) => title.includes(p))) {
    return true;
  }

  return false;
}

export class MeetingDetector {
  private pollInterval: NodeJS.Timeout | null = null;

  // The tracking key for the currently active meeting room.
  // null means no meeting is active.
  // For browser meetings: the room code (e.g. "gnh-ddfz-zns").
  // For native apps: "native:<appname>".
  private currentMeetingKey: string | null = null;

  start(): void {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      log.error('[MeetingDetector] Cannot start: mainWindow is null');
      return;
    }

    log.info('[MeetingDetector] Starting meeting detector...');

    this.poll();
    this.pollInterval = setInterval(() => this.poll(), 5000);
    log.info('[MeetingDetector] Polling started (interval: 5000ms)');
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    log.info('[MeetingDetector] Stopped');
  }

  isCurrentlyInMeeting(): boolean {
    return this.currentMeetingKey !== null;
  }

  async checkCurrentWindow(): Promise<boolean> {
    const win = await getActiveWindow();
    if (!win) return false;
    return isMeetingApp(win.owner.name, win.title);
  }

  async handleDismiss(meetingKey: string): Promise<void> {
    addDismissedMeetingKey(meetingKey);
    log.info(`[MeetingDetector] Dismissed meeting: ${meetingKey}`);
  }

  /**
   * Main polling loop - checks active window every 5 seconds
   */
  private async poll() {
    const prefs = getMeetingPreferences();
    if (prefs.autoRecordMode === 'manual') return;

    try {
      await this.checkActiveWindow(prefs);
    } catch (err) {
      log.error('[MeetingDetector] ❌ POLL ERROR:', err);
    }
  }

  /**
   * Check if active window is a meeting and handle state changes
   */
  private async checkActiveWindow(prefs: MeetingPreferences) {
    const win = await getActiveWindow();
    if (!win) {
      log.debug(
        '[MeetingDetector] getActiveWindow() returned undefined (no focused window)',
      );
      return;
    }

    const isInMeeting = isMeetingApp(win.owner.name, win.title);

    if (isInMeeting) {
      const meetingKey = getMeetingTrackingKey(win.owner.name, win.title);
      log.debug(
        `[MeetingDetector] 🔍 Meeting key: "${meetingKey}" | Title: "${win.title}"`,
      );
      this.handleMeetingDetected(win, meetingKey, prefs);
    }
    // how do you detect a meeting has ended?
    // its possible that you are screen sharing and not focused on the meeting window, just checking the active window is not enough.
  }

  /**
   * Handle when a meeting is detected
   */
  private handleMeetingDetected(
    win: ActiveWindow,
    meetingKey: string | null,
    prefs: MeetingPreferences,
  ) {
    // No trackable key means we can't reliably suppress re-triggers — skip
    if (!meetingKey) return;

    // Same room already being tracked — nothing to do
    if (meetingKey === this.currentMeetingKey) return;

    this.currentMeetingKey = meetingKey;

    // Already dismissed — check persisted store
    if (getDismissedMeetingKeys().includes(meetingKey)) {
      log.info(`[MeetingDetector] ⏭️ "${meetingKey}" already dismissed`);
      return;
    }

    log.info(
      `[MeetingDetector] 🎬 Meeting detected (mode: ${prefs.autoRecordMode}) | key: ${meetingKey}`,
    );
    const mainWindow = getMainWindow();
    mainWindow?.webContents.send(CHANNELS.MEETING_DETECTOR.DETECTED, {
      appName: win.owner.name,
      windowTitle: win.title,
      mode: prefs.autoRecordMode,
      meetingKey,
    });
  }

  /**
   * Handle when a meeting has ended
   */
  private handleMeetingEnded(prefs: MeetingPreferences) {
    if (this.currentMeetingKey === null) return;

    this.currentMeetingKey = null;

    log.info('[MeetingDetector] 🛑 Meeting ended');
    const mainWindow = getMainWindow();
    mainWindow?.webContents.send(CHANNELS.MEETING_DETECTOR.ENDED, {
      mode: prefs.autoRecordMode,
    });
  }
}

export const meetingDetector = new MeetingDetector();
