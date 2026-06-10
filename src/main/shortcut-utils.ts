/**
 * Utility functions for keyboard shortcut validation and formatting
 */

/**
 * List of system-reserved shortcuts that should not be used
 * These are shortcuts that conflict with common OS shortcuts
 */
const RESERVED_SHORTCUTS = [
  'CommandOrControl+Q', // Quit
  'CommandOrControl+H', // Hide
  'CommandOrControl+M', // Minimize
  'CommandOrControl+W', // Close window
  'CommandOrControl+N', // New window
  'CommandOrControl+T', // New tab
  'Alt+F4', // Close window (Windows)
  'CommandOrControl+Alt+Delete', // Task manager / Force quit
];

/**
 * Validate if a shortcut is valid and not reserved
 * @param shortcut - The shortcut string to validate (e.g., 'CommandOrControl+Shift+D')
 * @returns Object with validation result and error message if invalid
 */
export function validateShortcut(shortcut: string): {
  valid: boolean;
  error?: string;
} {
  // Check if shortcut is empty
  if (!shortcut || shortcut.trim().length === 0) {
    return {
      valid: false,
      error: 'Shortcut cannot be empty',
    };
  }

  // Check if shortcut has at least one key
  const keys = shortcut.split('+').map(k => k.trim());
  if (keys.length === 0) {
    return {
      valid: false,
      error: 'Shortcut must contain at least one key',
    };
  }

  // Check if any key is empty
  if (keys.some(key => key.length === 0)) {
    return {
      valid: false,
      error: 'Shortcut contains empty keys',
    };
  }

  // Normalize the shortcut for comparison (case-insensitive)
  const normalizedShortcut = normalizeShortcut(shortcut);

  // Check against reserved shortcuts
  if (RESERVED_SHORTCUTS.some(
    reserved => normalizeShortcut(reserved) === normalizedShortcut
  )) {
    return {
      valid: false,
      error: 'This shortcut conflicts with a system shortcut. Please choose another.',
    };
  }

  return { valid: true };
}

/**
 * Normalize a shortcut string for comparison
 * Converts to uppercase and removes extra spaces
 * @param shortcut - The shortcut string to normalize
 * @returns Normalized shortcut string
 */
export function normalizeShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map(k => k.trim().toUpperCase())
    .join('+');
}

/**
 * Format a shortcut string for display
 * Converts to human-readable format with proper casing
 * @param shortcut - The shortcut string to format
 * @returns Formatted shortcut string
 */
export function formatShortcutForDisplay(shortcut: string): string {
  return shortcut
    .split('+')
    .map(k => {
      const key = k.trim();
      const displayMap: Record<string, string> = {
        'COMMANDORCONTROL': 'Cmd/Ctrl',
        'SHIFT': 'Shift',
        'ALT': 'Alt',
        'CTRL': 'Ctrl',
        'META': 'Meta',
        'SPACE': 'Space',
        'ARROWUP': '↑',
        'ARROWDOWN': '↓',
        'ARROWLEFT': '←',
        'ARROWRIGHT': '→',
      };
      return displayMap[key.toUpperCase()] || key;
    })
    .join(' + ');
}
