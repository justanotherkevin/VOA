/**
 * E2E Test Mocks
 *
 * Centralized exports for all E2E test mocks.
 * These mocks provide isolated, sandboxed APIs for testing without
 * accessing actual system hardware or creating side effects.
 */

export {
  setupMicrophoneMock,
  cleanupMicrophoneMock,
} from './microphone.mock';

export {
  setupKeyboardMock,
  cleanupKeyboardMock,
  pressKey,
  typeText,
  dispatchKeyboardEvent,
  focusForKeyboardInput,
  pressShortcut,
} from './keyboard.mock';
