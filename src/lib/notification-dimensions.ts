// Single source of truth for the notification overlay's size, shared between
// the main-process BrowserWindow bounds (notification-window.ts) and the
// renderer's pill content (Notification.tsx) so the two stay in sync instead
// of drifting independently.
//
// Width is wide enough for the dual system-audio + mic waveform in
// RecordingRow (two 80px waveform columns + divider + title) alongside the
// plain-text rows the other notification states use; the pill itself has a
// smaller min-width and grows up to this for narrower states.
export const NOTIFICATION_WIDTH = 620;

// Applied as both the BrowserWindow height and the pill's min-height, so the
// window's native bounds and the DOM content height match instead of the
// pill shrink-wrapping to a smaller, independently-drifting value.
export const NOTIFICATION_HEIGHT = 80;

// BrowserWindow height used only while a Dictation is recording, so the live
// transcript list has room next to the pill. Electron clips content to the
// window bounds regardless of CSS overflow. Every other state uses
// NOTIFICATION_HEIGHT, so the transparent extra space never blocks clicks on
// the apps underneath, e.g. in the clickable meeting-detected prompt.
export const NOTIFICATION_DICTATION_WINDOW_HEIGHT = 220;
