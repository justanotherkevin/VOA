import { Page, expect } from '@playwright/test';
import {
  clickByTestId as clickByTestIdCommon,
  focusByTestId as focusByTestIdCommon,
  waitForElement as waitForElementCommon,
  waitForElementToDisappear as waitForElementToDisappearCommon,
  pressKeys as pressKeysCommon,
  isEnabledByTestId as isEnabledByTestIdCommon,
  getTextByTestId as getTextByTestIdCommon,
  getFocusedTestId as getFocusedTestIdCommon,
  assertVisibleByTestId as assertVisibleByTestIdCommon,
  assertNotVisibleByTestId as assertNotVisibleByTestIdCommon,
  assertEnabledByTestId as assertEnabledByTestIdCommon,
  handleDialog as handleDialogCommon,
  wait as waitCommon,
} from './common.helpers';

/**
 * Shortcut-specific helpers built on top of common helpers
 * Page is initialized once via initializeShortcutHelpers() to avoid passing it everywhere
 */

let page: Page;

/**
 * Initialize the shortcuts helpers with a page instance
 * Call this once in your test's beforeEach hook
 */
export function initializeShortcutHelpers(testPage: Page): void {
  page = testPage;
}

/**
 * Navigate to Settings page and open the Shortcuts pane.
 */
export async function navigateToSettings(): Promise<void> {
  await clickByTestIdCommon(page, 'nav-setting-button');
  // Wait for the Settings page to mount
  await waitForElementCommon(page, '.settings-root', 5000);
  // Navigate to the Shortcuts pane (Settings is pane-based)
  await page.locator('button:has-text("Shortcuts")').first().click();
  // Wait until the Change button (customize-shortcut-button) is visible
  await waitForElementCommon(page, '[data-testid="customize-shortcut-button"]', 5000);
}

/**
 * Open the shortcut configuration dialog
 */
export async function openShortcutDialog(): Promise<void> {
  await clickByTestIdCommon(page, 'customize-shortcut-button');
  await waitForElementCommon(page, '[data-testid="shortcut-config-dialog"]');
}

/**
 * Close the shortcut configuration dialog via Cancel button
 */
export async function closeShortcutDialog(): Promise<void> {
  await clickByTestIdCommon(page, 'dialog-cancel-button');
  await waitForElementToDisappearCommon(
    page,
    '[data-testid="shortcut-config-dialog"]',
  );
}

/**
 * Press individual keys in the dialog input area
 */
export async function pressKeysInDialog(keys: string[]): Promise<void> {
  await focusByTestIdCommon(page, 'keyboard-input-area');
  for (const key of keys) {
    await pressKeysCommon(page, key);
  }
}

/**
 * Press a combined key shortcut (e.g., "Control+Shift+A")
 * Uses JavaScript event dispatch for reliable event capture
 */
export async function pressShortcutInDialog(shortcut: string): Promise<void> {
  const inputArea = page.locator('[data-testid="keyboard-input-area"]');

  // Focus the input area
  await inputArea.focus();
  await waitCommon(50);

  // Split the shortcut and dispatch keyboard events for each key
  const keys = shortcut.split('+');

  // Get the raw keyboard key values for event dispatch
  const keyMap: Record<string, string> = {
    Control: 'Control',
    Ctrl: 'Control',
    Shift: 'Shift',
    Alt: 'Alt',
    Meta: 'Meta',
    Command: 'Meta',
    Cmd: 'Meta',
    KeyA: 'a',
    KeyK: 'k',
    KeyD: 'd',
    KeyX: 'x',
    KeyZ: 'z',
    Space: ' ',
    KeyA: 'a',
  };

  // Dispatch keydown events for all keys
  for (const key of keys) {
    const eventKey = keyMap[key] || key;
    const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(eventKey);

    await page.evaluate(
      (details) => {
        const element = document.querySelector(
          '[data-testid="keyboard-input-area"]',
        ) as HTMLElement;
        if (element) {
          const event = new KeyboardEvent('keydown', {
            key: details.key,
            code: details.code,
            bubbles: true,
            cancelable: true,
            ctrlKey: details.ctrlKey,
            shiftKey: details.shiftKey,
            altKey: details.altKey,
            metaKey: details.metaKey,
          });
          element.dispatchEvent(event);
        }
      },
      {
        key: eventKey,
        code: key,
        ctrlKey: keys.includes('Control') || keys.includes('Ctrl'),
        shiftKey: keys.includes('Shift'),
        altKey: keys.includes('Alt'),
        metaKey:
          keys.includes('Meta') ||
          keys.includes('Command') ||
          keys.includes('Cmd'),
      },
    );
  }

  // Wait for React to update
  await waitCommon(200);
}

/**
 * Clear the dialog input by clicking the Clear button
 */
export async function clearDialogInput(): Promise<void> {
  await clickByTestIdCommon(page, 'dialog-clear-button');
}

/**
 * Save the shortcut by clicking Save Changes
 */
export async function saveShortcut(): Promise<void> {
  await assertEnabledByTestIdCommon(page, 'dialog-save-button');
  await clickByTestIdCommon(page, 'dialog-save-button');
  await waitForElementToDisappearCommon(
    page,
    '[data-testid="shortcut-config-dialog"]',
  );
}

/**
 * Reset shortcut to default with confirmation
 */
export async function resetShortcut(): Promise<void> {
  await assertEnabledByTestIdCommon(page, 'reset-shortcut-button');

  // Set up dialog handler before clicking reset
  const dialogPromise = handleDialogCommon(page, 'accept');
  await clickByTestIdCommon(page, 'reset-shortcut-button');
  await dialogPromise;

  // Wait a bit for the reset to complete
  await waitCommon(1000);
}

/**
 * Get the count of displayed keys in the input area
 */
export async function countDisplayedKeys(): Promise<number> {
  const inputArea = page.locator('[data-testid="keyboard-input-area"]');
  return inputArea.locator('kbd').count();
}

/**
 * Get the current shortcut text from Settings page
 */
export async function getCurrentShortcutText(): Promise<string | null> {
  return getTextByTestIdCommon(page, 'p-setting-recording-shortcut');
}

/**
 * Check if shortcut dialog is visible
 */
export async function isDialogVisible(): Promise<boolean> {
  try {
    return await page
      .locator('[data-testid="shortcut-config-dialog"]')
      .isVisible();
  } catch {
    return false;
  }
}

/**
 * Check if Customize button is enabled
 */
export async function isCustomizeButtonEnabled(): Promise<boolean> {
  return isEnabledByTestIdCommon(page, 'customize-shortcut-button');
}

/**
 * Check if Reset button is enabled
 */
export async function isResetButtonEnabled(): Promise<boolean> {
  return isEnabledByTestIdCommon(page, 'reset-shortcut-button');
}

/**
 * Check if Save button is enabled
 */
export async function isSaveButtonEnabled(): Promise<boolean> {
  return isEnabledByTestIdCommon(page, 'dialog-save-button');
}

/**
 * Get the currently focused element's test ID
 */
export async function getFocusedElementTestId(): Promise<string | null> {
  return getFocusedTestIdCommon(page);
}

/**
 * Get the count of kbd elements in the current shortcut display
 */
export async function verifyCurrentShortcutDisplay(): Promise<number> {
  const currentShortcutDisplay = page.locator(
    '[data-testid="current-shortcut-display"]',
  );
  return currentShortcutDisplay.locator('kbd').count();
}

/**
 * Assert dialog is open
 */
export async function assertDialogIsOpen(): Promise<void> {
  await assertVisibleByTestIdCommon(page, 'shortcut-config-dialog');
}

/**
 * Assert dialog is closed
 */
export async function assertDialogIsClosed(): Promise<void> {
  await assertNotVisibleByTestIdCommon(page, 'shortcut-config-dialog');
}

/**
 * Assert Customize button is visible
 */
export async function assertCustomizeButtonIsVisible(): Promise<void> {
  await assertVisibleByTestIdCommon(page, 'customize-shortcut-button');
}

/**
 * Assert input area shows placeholder text
 */
export async function assertInputAreaHasPlaceholder(): Promise<void> {
  const inputArea = page.locator('[data-testid="keyboard-input-area"]');
  await expect(
    inputArea.locator('text=Click here and press keys'),
  ).toBeVisible();
}

/**
 * Assert input area has displayed keys (not placeholder)
 */
export async function assertInputAreaHasKeys(): Promise<void> {
  const count = await countDisplayedKeys();
  expect(count).toBeGreaterThan(0);
}
