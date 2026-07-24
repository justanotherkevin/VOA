import {
  Page,
  ElectronApplication,
  expect,
  _electron as electron,
} from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { e2eConfig } from '@e2e/config';
import { DEFAULT_SHORTCUTS } from '@/main/store';

/**
 * Generic element selectors and interactions
 * These helpers can be used across all e2e tests
 */

// Anchored to this file's own location (tests/e2e/utils/) rather than each
// caller's __dirname, so the path to the built main process can't drift when
// a spec file moves to a different directory depth.
const MAIN_JS_PATH = path.join(__dirname, '../../../dist/main/main.js');

/**
 * Path to a named electron-store JSON file in the e2e app store directory.
 */
export function getStoreFilePath(storeName: string): string {
  return path.join(e2eConfig.appStorePath, `${storeName}.json`);
}

/**
 * Write a named electron-store JSON file with the default fixture data
 * (empty meetings, default shortcuts, tiny Whisper model already warm in
 * the local transformers.js cache) so a fresh app launch reads known state.
 */
export function writeE2eTestStore(storeName: string): void {
  if (!fs.existsSync(e2eConfig.appStorePath)) {
    fs.mkdirSync(e2eConfig.appStorePath, { recursive: true });
  }
  fs.writeFileSync(
    getStoreFilePath(storeName),
    JSON.stringify(
      {
        meetings: [],
        meetingsMigrated: true,
        shortcuts: DEFAULT_SHORTCUTS,
        modelPreferences: {
          selectedModel: 'Xenova/whisper-tiny',
          multilingual: false,
          quantized: false,
          language: 'english',
          asrType: 'whisper',
        },
      },
      null,
      2,
    ),
  );
}

/**
 * Remove a single named electron-store JSON file, without touching the
 * rest of the store directory (which may be shared with other tests/apps).
 */
export function removeStoreFile(storeName: string): void {
  const file = getStoreFilePath(storeName);
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true });
  }
}

/**
 * Launch the built Electron app for e2e tests.
 * `env` is merged over `process.env`; pass NODE_ENV/E2E_STORE_NAME/etc. as needed.
 */
export async function launchElectronApp(
  env: Record<string, string | undefined> = {},
): Promise<ElectronApplication> {
  return electron.launch({
    args: [MAIN_JS_PATH],
    env: {
      ...process.env,
      E2E_TEST: 'true',
      ...env,
    },
  });
}

/**
 * Poll until both the main (index.html) and notification windows are visible.
 * Uses a 15-second deadline to accommodate slow app starts.
 */
export async function getVisibleWindows(
  electronApp: ElectronApplication,
): Promise<{ main: Page; notification: Page }> {
  let main: Page | undefined, notification: Page | undefined;
  await electronApp.firstWindow();
  await expect
    .poll(
      () => {
        const windows = electronApp.windows();
        main = windows.find((w: any) => w.url().includes('index.html'));
        notification = windows.find((w: any) =>
          w.url().includes('notification.html'),
        );
        return main && notification;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();

  if (!main || !notification)
    throw new Error('Could not find main and notification windows');
  return { main, notification };
}

/**
 * Wait for an element to be visible
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 5000,
): Promise<void> {
  await page.waitForSelector(selector, { timeout });
}

/**
 * Wait for an element to be hidden/not visible
 */
export async function waitForElementToDisappear(
  page: Page,
  selector: string,
  timeout: number = 5000,
): Promise<void> {
  await page.waitForSelector(selector, { state: 'hidden', timeout });
}

/**
 * Click an element by selector
 */
export async function clickElement(
  page: Page,
  selector: string,
): Promise<void> {
  const element = page.locator(selector);
  await element.click();
}

/**
 * Click an element by data-testid
 */
export async function clickByTestId(page: Page, testId: string): Promise<void> {
  await clickElement(page, `[data-testid="${testId}"]`);
}

/**
 * Focus an element by selector
 */
export async function focusElement(
  page: Page,
  selector: string,
): Promise<void> {
  const element = page.locator(selector);
  await element.focus();
}

/**
 * Focus an element by data-testid
 */
export async function focusByTestId(page: Page, testId: string): Promise<void> {
  await focusElement(page, `[data-testid="${testId}"]`);
}

/**
 * Check if element is visible by selector
 */
export async function isElementVisible(
  page: Page,
  selector: string,
): Promise<boolean> {
  try {
    return await page.locator(selector).isVisible();
  } catch {
    return false;
  }
}

/**
 * Check if element is visible by data-testid
 */
export async function isVisibleByTestId(
  page: Page,
  testId: string,
): Promise<boolean> {
  return isElementVisible(page, `[data-testid="${testId}"]`);
}

/**
 * Check if element is enabled by selector
 */
export async function isElementEnabled(
  page: Page,
  selector: string,
): Promise<boolean> {
  try {
    return !(await page.locator(selector).isDisabled());
  } catch {
    return false;
  }
}

/**
 * Check if element is enabled by data-testid
 */
export async function isEnabledByTestId(
  page: Page,
  testId: string,
): Promise<boolean> {
  return isElementEnabled(page, `[data-testid="${testId}"]`);
}

/**
 * Check if element is disabled by selector
 */
export async function isElementDisabled(
  page: Page,
  selector: string,
): Promise<boolean> {
  try {
    return await page.locator(selector).isDisabled();
  } catch {
    return true;
  }
}

/**
 * Check if element is disabled by data-testid
 */
export async function isDisabledByTestId(
  page: Page,
  testId: string,
): Promise<boolean> {
  return isElementDisabled(page, `[data-testid="${testId}"]`);
}

/**
 * Get element text content by selector
 */
export async function getElementText(
  page: Page,
  selector: string,
): Promise<string | null> {
  return page.locator(selector).textContent();
}

/**
 * Get element text content by data-testid
 */
export async function getTextByTestId(
  page: Page,
  testId: string,
): Promise<string | null> {
  return getElementText(page, `[data-testid="${testId}"]`);
}

/**
 * Count elements matching selector
 */
export async function countElements(
  page: Page,
  selector: string,
): Promise<number> {
  return page.locator(selector).count();
}

/**
 * Press keyboard keys
 */
export async function pressKeys(page: Page, keys: string): Promise<void> {
  await page.keyboard.press(keys);
}

/**
 * Type text into focused element
 */
export async function typeText(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
}

/**
 * Get the currently focused element's data-testid
 */
export async function getFocusedTestId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    return document.activeElement?.getAttribute('data-testid') ?? null;
  });
}

/**
 * Assert element is visible by selector
 */
export async function assertElementIsVisible(
  page: Page,
  selector: string,
): Promise<void> {
  await expect(page.locator(selector)).toBeVisible();
}

/**
 * Assert element is visible by data-testid
 */
export async function assertVisibleByTestId(
  page: Page,
  testId: string,
): Promise<void> {
  await assertElementIsVisible(page, `[data-testid="${testId}"]`);
}

/**
 * Assert element is not visible by selector
 */
export async function assertElementNotVisible(
  page: Page,
  selector: string,
): Promise<void> {
  await expect(page.locator(selector)).not.toBeVisible();
}

/**
 * Assert element is not visible by data-testid
 */
export async function assertNotVisibleByTestId(
  page: Page,
  testId: string,
): Promise<void> {
  await assertElementNotVisible(page, `[data-testid="${testId}"]`);
}

/**
 * Assert element is enabled by selector
 */
export async function assertElementEnabled(
  page: Page,
  selector: string,
): Promise<void> {
  await expect(page.locator(selector)).toBeEnabled();
}

/**
 * Assert element is enabled by data-testid
 */
export async function assertEnabledByTestId(
  page: Page,
  testId: string,
): Promise<void> {
  await assertElementEnabled(page, `[data-testid="${testId}"]`);
}

/**
 * Assert element is disabled by selector
 */
export async function assertElementDisabled(
  page: Page,
  selector: string,
): Promise<void> {
  await expect(page.locator(selector)).toBeDisabled();
}

/**
 * Assert element is disabled by data-testid
 */
export async function assertDisabledByTestId(
  page: Page,
  testId: string,
): Promise<void> {
  await assertElementDisabled(page, `[data-testid="${testId}"]`);
}

/**
 * Assert element contains text by selector
 */
export async function assertElementContainsText(
  page: Page,
  selector: string,
  text: string,
): Promise<void> {
  await expect(page.locator(selector)).toContainText(text);
}

/**
 * Assert element has exact text by selector
 */
export async function assertElementHasText(
  page: Page,
  selector: string,
  text: string,
): Promise<void> {
  await expect(page.locator(selector)).toHaveText(text);
}

/**
 * Handle browser dialog (alert, confirm, prompt)
 */
export async function handleDialog(
  page: Page,
  action: 'accept' | 'dismiss' = 'accept',
): Promise<string> {
  let dialogMessage = '';

  page.once('dialog', (dialog) => {
    dialogMessage = dialog.message();
    if (action === 'accept') {
      dialog.accept();
    } else {
      dialog.dismiss();
    }
  });

  return dialogMessage;
}

/**
 * Wait for a navigation to complete
 */
export async function waitForNavigation(
  page: Page,
  timeout: number = 5000,
): Promise<void> {
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout });
}

/**
 * Wait for a specific amount of time
 */
export async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// page.waitForFunction hangs in this Electron+Playwright setup, so poll from
// the test process instead.
export async function pollUntil(
  fn: () => Promise<boolean>,
  timeoutMs = 8000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await wait(150);
  }
  throw new Error(`pollUntil timed out after ${timeoutMs}ms`);
}

/**
 * Get an element's attribute value
 */
export async function getElementAttribute(
  page: Page,
  selector: string,
  attributeName: string,
): Promise<string | null> {
  return page.locator(selector).getAttribute(attributeName);
}

/**
 * Get an element's attribute by data-testid
 */
export async function getAttributeByTestId(
  page: Page,
  testId: string,
  attributeName: string,
): Promise<string | null> {
  return getElementAttribute(page, `[data-testid="${testId}"]`, attributeName);
}

/**
 * Check if element has class by selector
 */
export async function hasClass(
  page: Page,
  selector: string,
  className: string,
): Promise<boolean> {
  const classAttr = await getElementAttribute(page, selector, 'class');
  return classAttr?.includes(className) ?? false;
}

/**
 * Check if element has class by data-testid
 */
export async function hasClassByTestId(
  page: Page,
  testId: string,
  className: string,
): Promise<boolean> {
  return hasClass(page, `[data-testid="${testId}"]`, className);
}

/**
 * Get parent element by selector
 */
export async function getParentSelector(
  page: Page,
  selector: string,
): Promise<string> {
  return (
    (await page
      .locator(selector)
      .locator('xpath=..')
      .getAttribute('data-testid')) ?? ''
  );
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(
  page: Page,
  selector: string,
): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Scroll element into view by data-testid
 */
export async function scrollIntoViewByTestId(
  page: Page,
  testId: string,
): Promise<void> {
  await scrollIntoView(page, `[data-testid="${testId}"]`);
}

/**
 * Simulate a global keyboard shortcut (e.g., "Control+Shift+Space")
 * This uses Playwright's page.keyboard API to press combined key shortcuts
 * which may or may not trigger Electron's globalShortcut handler depending
 * on whether the Electron app window has focus.
 */
export async function simulateGlobalShortcut(
  page: Page,
  shortcut: string,
): Promise<void> {
  console.log(`[simulateGlobalShortcut] Simulating shortcut: ${shortcut}`);

  // Ensure the page has focus before simulating the shortcut
  await page.focus('body');
  await wait(100);

  // Use Playwright's keyboard press API
  // Playwright keyboard.press() supports combined keys like "Control+Shift+Space"
  await page.keyboard.press(shortcut);

  console.log(`[simulateGlobalShortcut] Shortcut pressed: ${shortcut}`);
  await wait(200);
}

/**
 * Navigate to the Settings page via the sidebar link.
 * Pass an optional pane label (e.g. 'Audio', 'Shortcuts') to also click that pane.
 */
export async function navigateToSettings(
  page: any,
  pane?: string,
): Promise<void> {
  await page.click('button[title="Settings"]');
  // Wait for the Settings page root to appear (pane-based layout, no single "Settings" h1)
  await page.waitForSelector('.settings-root', { timeout: 5000 });
  if (pane) {
    await page.locator(`button:has-text("${pane}")`).first().click();
    await page.waitForSelector(`h1:has-text("${pane}")`, { timeout: 5000 });
  }
}
/**
 * Find the system audio toggle switch in the Settings > Audio pane.
 * Rendered as a button[role="switch"] in the "Capture system audio" row.
 * Caller must have navigated to the Audio pane before calling this.
 */
export async function getSystemAudioToggle(page: any) {
  return page
    .locator('.s-row')
    .filter({ hasText: 'Capture system audio' })
    .locator('button[role="switch"]');
}
