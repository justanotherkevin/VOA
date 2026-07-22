import { expect, test } from '@e2e/fixtures';
import {
  initializeShortcutHelpers,
  navigateToSettings,
  openShortcutDialog,
  closeShortcutDialog,
  pressShortcutInDialog,
  clearDialogInput,
  saveShortcut,
  assertDialogIsOpen,
  assertDialogIsClosed,
  assertCustomizeButtonIsVisible,
  assertInputAreaHasPlaceholder,
  assertInputAreaHasKeys,
} from '@e2e/utils/shortcuts-change.helpers';

test.describe('Customizable Dictation Shortcut', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    initializeShortcutHelpers(page);
  });

  test.afterEach(async ({ page }) => {
    // The Electron app persists between tests (worker-scoped), so open dialogs carry over.
    // Always close the dialog if it is still open to prevent state leaking into the next test.
    const dialog = page.locator('[data-testid="shortcut-config-dialog"]');
    if (await dialog.isVisible()) {
      await page.locator('[data-testid="dialog-cancel-button"]').click();
      await page.waitForSelector('[data-testid="shortcut-config-dialog"]', {
        state: 'hidden',
        timeout: 3000,
      });
    }
  });

  test('should open and close shortcut configuration dialog', async ({
    page,
  }) => {
    await navigateToSettings();
    await openShortcutDialog();
    await assertDialogIsOpen();

    const currentShortcutDisplay = page.locator(
      '[data-testid="current-shortcut-display"]',
    );
    await expect(currentShortcutDisplay).toBeVisible();

    await closeShortcutDialog();
    await assertDialogIsClosed();
    await assertCustomizeButtonIsVisible();
  });

  test('should be able to change recording shortcut', async ({ page }) => {
    await navigateToSettings();
    await openShortcutDialog();
    await closeShortcutDialog();
  });

  test('should save new shsortcut and persist it', async ({ page }) => {
    await navigateToSettings();
    await openShortcutDialog();
    await pressShortcutInDialog('Control+Shift+KeyK');
    await assertInputAreaHasKeys();
    await saveShortcut();
  });

  test('should clear entered keys with Clear button', async ({ page }) => {
    await navigateToSettings();
    await openShortcutDialog();
    await pressShortcutInDialog('Control+Shift+KeyD');
    await assertInputAreaHasKeys();
    await clearDialogInput();
    await assertInputAreaHasPlaceholder();

    const clearButton = page.locator('[data-testid="dialog-clear-button"]');
    await expect(clearButton).not.toBeVisible();
  });
});
