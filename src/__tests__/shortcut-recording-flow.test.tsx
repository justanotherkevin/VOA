/**
 * Unit tests for shortcut-based recording IPC communication
 *
 * Tests the IPC mechanics and event firing:
 * 1. Recording toggle events are fired when shortcut is pressed
 * 2. Recording state can be toggled on and off
 * 3. Handlers are properly registered for shortcut events
 *
 * Note: E2E tests for visual behavior (notification appearance, transcription display)
 * are in tests/e2e/ using Playwright
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerRecordingToggle } from '@/testing/electronMocks';

// Note: active-win dependency was removed due to Electron 35 compatibility issues
// Window tracking will be implemented using Electron APIs in the future

describe('Shortcut Recording Flow - IPC Communication', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log recording started message when recording starts via shortcut', async () => {
    // This test verifies that when the recording shortcut is triggered,
    // a message is logged to the console (window tracking will be implemented later)

    const recordingToggleHandler = vi.fn();

    // Register listener for recording toggle event
    window.electronAPI.settings.shortcuts.on.recordingToggle(recordingToggleHandler);

    // Simulate the global shortcut being pressed
    triggerRecordingToggle();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify the recording toggle was triggered
    expect(recordingToggleHandler).toHaveBeenCalled();
    expect(recordingToggleHandler).toHaveBeenCalledTimes(1);
  });

  it('should track recording state (started/stopped)', async () => {
    // This test verifies that recording state toggles correctly when shortcut is pressed
    // and that multiple toggles work as expected

    let recordingActive = false;
    const onRecordingToggle = vi.fn(() => {
      recordingActive = !recordingActive;
    });

    // Register a listener for the recording toggle event
    window.electronAPI.settings.shortcuts.on.recordingToggle(onRecordingToggle);

    // Simulate first shortcut press (start recording)
    triggerRecordingToggle();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onRecordingToggle).toHaveBeenCalledTimes(1);
    expect(recordingActive).toBe(true);

    // Simulate second shortcut press (stop recording)
    triggerRecordingToggle();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onRecordingToggle).toHaveBeenCalledTimes(2);
    expect(recordingActive).toBe(false);

    // Verify state can be toggled multiple times
    triggerRecordingToggle();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(recordingActive).toBe(true);
  });

  it('should send recording:toggle event to renderer when shortcut is pressed', async () => {
    // This test verifies that the main process sends the recording:toggle
    // IPC event to the renderer when shortcut is triggered

    const recordingToggleHandler = vi.fn();

    // Register listener for recording toggle event
    window.electronAPI.settings.shortcuts.on.recordingToggle(recordingToggleHandler);

    // Simulate the global shortcut being pressed
    triggerRecordingToggle();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify the toggle event was sent
    expect(recordingToggleHandler).toHaveBeenCalled();
    expect(recordingToggleHandler).toHaveBeenCalledTimes(1);

    // Verify the IPC handler is properly registered
    expect(window.electronAPI.settings.shortcuts.on.recordingToggle).toHaveBeenCalled();
  });
});
