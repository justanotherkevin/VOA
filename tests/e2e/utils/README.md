# E2E Test Utilities

This directory contains helper functions and utilities for end-to-end testing of the Electron application using Playwright.

The helpers are organized in two layers:

1. **Common Helpers** - Generic, reusable helpers for all e2e tests
2. **Feature Helpers** - Domain-specific helpers built on top of common helpers

## Files

### `common.helpers.ts`

Generic, reusable helper functions for common Playwright operations. These can be used across all e2e test specs and features.

#### Common Helper Categories

**App Lifecycle**

- `launchElectronApp(env?)` - Launch the built Electron app (`dist/main/main.js`), merging `env` over `process.env`. Path is anchored to `common.helpers.ts` itself, not the caller's `__dirname`, so it keeps working if a spec moves.

**Electron Store Fixtures**

- `getStoreFilePath(storeName)` - Path to a named electron-store JSON file in the e2e app store directory.
- `writeE2eTestStore(storeName)` - Write default fixture data (empty meetings, default shortcuts, tiny Whisper model) to a named store file.
- `removeStoreFile(storeName)` - Delete a single named store file, without touching the rest of the store directory.

**Element Selection & Interaction (by selector or data-testid)**

- `clickElement(page, selector)` / `clickByTestId(page, testId)`
- `focusElement(page, selector)` / `focusByTestId(page, testId)`
- `scrollIntoView(page, selector)` / `scrollIntoViewByTestId(page, testId)`

**Element State Checks**

- `isElementVisible(page, selector)` / `isVisibleByTestId(page, testId)`
- `isElementEnabled(page, selector)` / `isEnabledByTestId(page, testId)`
- `isElementDisabled(page, selector)` / `isDisabledByTestId(page, testId)`

**Element Content & Attributes**

- `getElementText(page, selector)` / `getTextByTestId(page, testId)`
- `getElementAttribute(page, selector, attributeName)` / `getAttributeByTestId(page, testId, attributeName)`
- `countElements(page, selector)` - Count matching elements
- `hasClass(page, selector, className)` / `hasClassByTestId(page, testId, className)`

**Waiting & Timing**

- `waitForElement(page, selector, timeout)` - Wait for element to appear
- `waitForElementToDisappear(page, selector, timeout)` - Wait for element to disappear
- `wait(ms)` - Wait for specific time
- `waitForNavigation(page, timeout)` - Wait for navigation to complete

**Keyboard & Input**

- `pressKeys(page, keys)` - Press keyboard shortcut (e.g., "Control+Shift+A")
- `typeText(page, text)` - Type text into focused element
- `getFocusedTestId(page)` - Get data-testid of focused element

**Assertions (by selector or data-testid)**

- `assertElementIsVisible(page, selector)` / `assertVisibleByTestId(page, testId)`
- `assertElementNotVisible(page, selector)` / `assertNotVisibleByTestId(page, testId)`
- `assertElementEnabled(page, selector)` / `assertEnabledByTestId(page, testId)`
- `assertElementDisabled(page, selector)` / `assertDisabledByTestId(page, testId)`
- `assertElementContainsText(page, selector, text)`
- `assertElementHasText(page, selector, text)`

**Dialog Handling**

- `handleDialog(page, action)` - Handle browser dialogs (alert, confirm, prompt)

### `dictation.helpers.ts`

Contains helper functions specific to testing the dictation workflow. These helpers manage the complete recording → transcription → verification flow.

#### Audio Mocking

- `setupAudioMocking(page)` - Setup MediaRecorder and getUserMedia mocks before page loads

#### Recording Control

- `startRecording(page)` - Start recording by pressing the global shortcut (Control+Shift+Space)
- `stopRecording(page)` - Stop recording by pressing the global shortcut (Control+Shift+Space)
- `toggleRecording(page)` - Toggle recording state using the global shortcut
- `waitForRecordingToStart(page, timeout)` - Wait for recording status indicator
- `waitForRecordingToStop(page, timeout)` - Wait for ready status

#### Transcription Simulation

- `simulateTranscription(page, data)` - Dispatch transcription complete event with text and chunks
- `simulateTranscriptionUpdate(page, partialText)` - Dispatch partial transcription update event

#### Verification

- `verifyTranscriptInHistory(page, text, timeout)` - Check if transcribed text appears in history
- `getHistoryItemCount(page)` - Get number of items in transcript history

#### Complete Workflow

- `performDictationFlow(page, text, chunks)` - Execute full recording → transcription → verification flow

### `notification.helpers.ts`

Helpers for the notification window (`src/renderer/Notification.tsx`) — the waveform/state pill shown during recording, processing, and meeting-detected states.

- `triggerRecordingToggle(electronApp)` - Send the `recording:toggle` IPC event to the main window, simulating the global recording shortcut without depending on real OS-level shortcuts. Call `await page.waitForLoadState('domcontentloaded')` first, or the event can be sent before `useRecordingFlow`'s listener is registered and gets silently dropped.
- `waitForNotificationWindow(electronApp, timeoutMs?)` - Poll until the notification window (`notification.html`) appears and finish loading it; returns `null` (not a throw) if it never appears, so callers can assert directly on the result.
- `waitForNotificationText(notificationWindow, text, timeoutMs?)` - Wait for specific text (e.g. `'recording'`) to become visible inside the notification container. Uses Playwright's own locator waiting rather than a fixed delay, since `Notification.tsx` only renders state/app-name text once `activeWindow` resolves asynchronously (see `getActiveWindow()` in `src/main/active-window.ts`).

### `shortcuts.helpers.ts`

Contains helper functions specific to testing the customizable dictation shortcut feature. These are built on top of common helpers.

**Important**: This file uses a module-level `page` instance that must be initialized via `initializeShortcutHelpers(page)` before using any helper functions. This eliminates the need to pass `page` to every function call.

#### Initialization

- `initializeShortcutHelpers(page)` - **REQUIRED** Call this in your test's `beforeEach` hook to initialize the page context

#### Navigation Helpers

- `navigateToSettings()` - Navigate to the Settings page

#### Dialog Interaction Helpers

- `openShortcutDialog()` - Open the shortcut configuration dialog
- `closeShortcutDialog()` - Close the dialog via Cancel button
- `pressKeysInDialog(keys: string[])` - Press individual keys in the input area
- `pressShortcutInDialog(shortcut: string)` - Press a combined key shortcut (e.g., "Control+Shift+A")
- `clearDialogInput()` - Click the Clear button to reset entered keys
- `saveShortcut()` - Click Save Changes and wait for dialog to close
- `resetShortcut()` - Click Reset button and handle confirmation dialog

#### Verification Helpers

- `countDisplayedKeys()` - Get the count of displayed keys in the input area
- `getCurrentShortcutText()` - Get the current shortcut display text
- `isDialogVisible()` - Check if dialog is currently visible
- `isCustomizeButtonEnabled()` - Check if Customize button is enabled
- `isResetButtonEnabled()` - Check if Reset button is enabled
- `isSaveButtonEnabled()` - Check if Save button is enabled
- `getFocusedElementTestId()` - Get the test ID of the focused element
- `verifyCurrentShortcutDisplay()` - Get the count of kbd elements in current shortcut display

#### Assertion Helpers

- `assertDialogIsOpen()` - Assert that the dialog is visible
- `assertDialogIsClosed()` - Assert that the dialog is not visible
- `assertCustomizeButtonIsVisible()` - Assert that Customize button is visible
- `assertInputAreaHasPlaceholder()` - Assert that input area shows placeholder text
- `assertInputAreaHasKeys()` - Assert that input area has displayed keys

## Usage Example

```typescript
import { test, _electron as electron } from '@playwright/test';
import {
  initializeShortcutHelpers,
  navigateToSettings,
  openShortcutDialog,
  pressShortcutInDialog,
  saveShortcut,
  getCurrentShortcutText,
} from './utils/shortcuts.helpers';

test('should save custom shortcut', async () => {
  const electronApp = await electron.launch({...});
  const page = await electronApp.firstWindow();

  // Initialize helpers with page instance (required!)
  initializeShortcutHelpers(page);

  // Now use helpers without passing page
  await navigateToSettings();
  const initialShortcut = await getCurrentShortcutText();

  await openShortcutDialog();
  await pressShortcutInDialog('Control+Shift+K');
  await saveShortcut();

  const updatedShortcut = await getCurrentShortcutText();
  expect(updatedShortcut).not.toBe(initialShortcut);

  await electronApp.close();
});
```

## Creating New Feature Helpers

When adding new feature-specific helpers:

1. **Create a new file** - `<feature-name>.helpers.ts` in the `utils/` directory
2. **Import common helpers** - Use common helpers as building blocks
3. **Wrap domain logic** - Create feature-specific wrappers around common helpers
4. **Keep feature-specific** - Don't duplicate common helpers; reuse them instead

### Example: Creating Feature Helpers

```typescript
// tests/e2e/utils/authentication.helpers.ts
import { Page } from '@playwright/test';
import {
  clickByTestId,
  getTextByTestId,
  waitForElement,
  typeText,
  focusByTestId,
} from './common.helpers';

/**
 * Login with username and password
 */
export async function login(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  // Use common helpers to interact with login form
  await focusByTestId(page, 'username-input');
  await typeText(page, username);

  await focusByTestId(page, 'password-input');
  await typeText(page, password);

  await clickByTestId(page, 'login-button');
  await waitForElement(page, '[data-testid="dashboard"]');
}
```

## Best Practices for Helpers

When adding new helper functions (either common or feature-specific):

1. **Keep functions focused** - Each function should do one thing well
2. **Pass page as first parameter** - All helpers should accept `page: Page` as the first parameter
3. **Use parameterized selectors** - Don't hardcode selectors; pass them as parameters where possible
4. **Document with JSDoc** - Use clear JSDoc comments to document all parameters
5. **Return useful values** - Return values that tests need to assert on
6. **Handle waits internally** - Helpers should handle all waiting/synchronization internally
7. **Use consistent naming**:
   - Functions that check state use `is`/`get` prefix
   - Assertion functions use `assert` prefix
   - Functions that interact use verb prefix (click, press, type, etc.)
   - Functions that work with data-testid use `ByTestId` suffix

## Test IDs Used

The helpers rely on the following data-testid attributes in components:

- `shortcut-dialog-overlay` - Dialog overlay
- `shortcut-config-dialog` - Dialog container
- `current-shortcut-display` - Current shortcut display in dialog
- `keyboard-input-area` - Keyboard input area in dialog
- `dialog-cancel-button` - Cancel button
- `dialog-clear-button` - Clear button
- `dialog-save-button` - Save Changes button
- `reset-shortcut-button` - Reset button in Settings
- `customize-shortcut-button` - Customize button in Settings
- `current-shortcut-text` - Current shortcut text in Settings
