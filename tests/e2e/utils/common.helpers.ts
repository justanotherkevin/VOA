import { Page, expect } from '@playwright/test';

/**
 * Generic element selectors and interactions
 * These helpers can be used across all e2e tests
 */

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
 */
export async function navigateToSettings(page: any): Promise<void> {
  await page.click('button[title="Settings"]');
  await page.waitForSelector('h1:has-text("Settings")', { timeout: 5000 });
}
/**
 * Find the system audio toggle label (the visible switch).
 * The underlying <input type="checkbox"> is sr-only so we click the <label> that
 * wraps it, which is the standard Tailwind toggle pattern used in Settings.tsx.
 */
export async function getSystemAudioToggle(page: any) {
  // The label wraps an sr-only checkbox next to the visual div inside the
  // "Capture System Audio" card.
  return page
    .locator('h2:has-text("Capture System Audio")')
    .locator(
      'xpath=ancestor::div[contains(@class,"flex")]//label[contains(@class,"inline-flex")]',
    )
    .first();
}
