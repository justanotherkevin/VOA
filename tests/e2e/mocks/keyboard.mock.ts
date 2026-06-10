/**
 * Keyboard Input Mock/Wrapper for E2E Tests
 *
 * Provides a centralized interface for keyboard input simulation.
 * Wraps Playwright's keyboard APIs for consistency and future flexibility.
 *
 * Currently uses Playwright's native keyboard automation which is sandboxed
 * within the browser/renderer process and doesn't require system-level access.
 *
 * Usage:
 *   import { setupKeyboardMock, pressKey, dispatchKeyboardEvent } from './mocks/keyboard.mock';
 *
 *   test('keyboard interaction', async () => {
 *     await pressKey(page, 'Control+A');
 *     await dispatchKeyboardEvent(page, 'keydown', { key: 'Control' });
 *   });
 */

import { Page } from '@playwright/test';

/**
 * Press a keyboard key using Playwright's keyboard automation
 * Supports key combinations like 'Control+A', 'Shift+Tab', etc.
 *
 * @param page - Playwright Page instance
 * @param keys - Key or key combination (e.g., 'Enter', 'Control+Shift+A')
 */
export async function pressKey(page: Page, keys: string): Promise<void> {
  await page.keyboard.press(keys);
}

/**
 * Type text into the focused element
 *
 * @param page - Playwright Page instance
 * @param text - Text to type
 */
export async function typeText(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
}

/**
 * Dispatch a raw keyboard event in the browser context
 * Uses JavaScript event creation and dispatch for precise control
 *
 * @param page - Playwright Page instance
 * @param eventType - 'keydown' | 'keyup' | 'keypress'
 * @param options - Keyboard event options
 */
export async function dispatchKeyboardEvent(
  page: Page,
  eventType: 'keydown' | 'keyup' | 'keypress',
  options: {
    key?: string;
    code?: string;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
  } = {}
): Promise<void> {
  await page.evaluate(
    ({ eventType: type, options: opts }) => {
      const event = new KeyboardEvent(type, {
        key: opts.key || '',
        code: opts.code || '',
        ctrlKey: opts.ctrlKey || false,
        shiftKey: opts.shiftKey || false,
        altKey: opts.altKey || false,
        metaKey: opts.metaKey || false,
        bubbles: true,
        cancelable: true,
      });

      document.activeElement?.dispatchEvent(event);
    },
    { eventType, options }
  );
}

/**
 * Focus an element and prepare for keyboard input
 * Ensures the element is ready to receive keyboard events
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector or data-testid
 */
export async function focusForKeyboardInput(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await element.focus();
  // Small delay to ensure focus state is stable
  await page.waitForTimeout(50);
}

/**
 * Simulate complex keyboard shortcut with multiple modifiers
 * Dispatches keydown for all modifier keys, then the main key
 *
 * @param page - Playwright Page instance
 * @param shortcut - Shortcut string (e.g., 'Control+Shift+A')
 * @param targetSelector - Optional selector to focus before sending keys
 */
export async function pressShortcut(
  page: Page,
  shortcut: string,
  targetSelector?: string
): Promise<void> {
  if (targetSelector) {
    await focusForKeyboardInput(page, targetSelector);
  }

  const keys = shortcut.split('+');
  const modifierStates = {
    ctrlKey: keys.includes('Control') || keys.includes('Ctrl'),
    shiftKey: keys.includes('Shift'),
    altKey: keys.includes('Alt'),
    metaKey: keys.includes('Meta') || keys.includes('Command') || keys.includes('Cmd'),
  };

  // Map key names to actual key values
  const keyMap: Record<string, string> = {
    Control: 'Control',
    Ctrl: 'Control',
    Shift: 'Shift',
    Alt: 'Alt',
    Meta: 'Meta',
    Command: 'Meta',
    Cmd: 'Meta',
    KeyA: 'a',
    KeyB: 'b',
    KeyC: 'c',
    KeyD: 'd',
    KeyE: 'e',
    KeyK: 'k',
    KeyX: 'x',
    KeyZ: 'z',
    Space: ' ',
    Enter: 'Enter',
    Escape: 'Escape',
    Tab: 'Tab',
    Backspace: 'Backspace',
  };

  // Dispatch keydown for all modifier keys
  for (const key of keys) {
    const keyValue = keyMap[key] || key;
    const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(keyValue);

    if (isModifier) {
      await dispatchKeyboardEvent(page, 'keydown', {
        key: keyValue,
        ctrlKey: modifierStates.ctrlKey,
        shiftKey: modifierStates.shiftKey,
        altKey: modifierStates.altKey,
        metaKey: modifierStates.metaKey,
      });
    }
  }

  // Dispatch keydown for the main (non-modifier) key
  for (const key of keys) {
    const keyValue = keyMap[key] || key;
    const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(keyValue);

    if (!isModifier) {
      await dispatchKeyboardEvent(page, 'keydown', {
        key: keyValue,
        ctrlKey: modifierStates.ctrlKey,
        shiftKey: modifierStates.shiftKey,
        altKey: modifierStates.altKey,
        metaKey: modifierStates.metaKey,
      });
    }
  }
}

/**
 * Setup keyboard mocking for E2E tests
 * Currently a no-op since we use native Playwright APIs
 * Provided for consistency and future flexibility
 */
export function setupKeyboardMock(): void {
  // Native Playwright keyboard automation is already "mocked"
  // in the sense that it's sandboxed within the browser context
}

/**
 * Cleanup keyboard mocks if needed
 * Currently a no-op
 */
export function cleanupKeyboardMock(): void {
  // No cleanup needed for native Playwright APIs
}
