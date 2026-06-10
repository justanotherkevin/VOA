/**
 * Test support utilities for E2E tests and component testing
 * Exposes internal hooks and state to window for test code only
 * This file should only be imported in test setup, never in production code
 */

interface RecordingFlowTestHooks {
  triggerRecordingComplete: (
    chunks: Blob[],
    mimeType: string,
    startTime: number | null,
  ) => Promise<void>;
}

/**
 * Set up test hooks for recording flow testing
 * Exposes internal functions that tests can call to simulate recording completion
 */
export function setupRecordingFlowTestHooks(
  hooks: RecordingFlowTestHooks,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  (window as any).__recordingFlowHooks__ = hooks;
}

/**
 * Clean up test hooks after test completion
 */
export function cleanupRecordingFlowTestHooks(): void {
  if (typeof window === 'undefined') {
    return;
  }

  delete (window as any).__recordingFlowHooks__;
}

/**
 * Set recording active state for test coordination
 * Used by useTranscriber to determine if transcription is final or segment
 */
export function setRecordingActiveForTests(isActive: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  (window as any).__isRecordingActive = isActive;
}

/**
 * Get recording active state
 */
export function getRecordingActiveForTests(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return (window as any).__isRecordingActive ?? false;
}

/**
 * Expose the systemAudioEnabled state (getter + setter) so E2E tests can
 * read the current value and override it without a page reload.
 */
export function exposeSystemAudioSetterForTests(
  getter: () => boolean,
  setter: (enabled: boolean) => void,
): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window === 'undefined') return;
  (window as any).__getSystemAudioEnabled = getter;
  (window as any).__setSystemAudioEnabled = setter;
}

export function cleanupSystemAudioSetterForTests(): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window === 'undefined') return;
  delete (window as any).__getSystemAudioEnabled;
  delete (window as any).__setSystemAudioEnabled;
}

/**
 * Expose the PermissionsProvider's setPermissions state setter so E2E tests
 * can directly override permissions without relying on IPC or focus events.
 */
export function exposePermissionsSetterForTests(
  setter: (perms: Record<string, any>) => void,
): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window === 'undefined') return;
  (window as any).__setPermissions = setter;
}

export function cleanupPermissionsSetterForTests(): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window === 'undefined') return;
  delete (window as any).__setPermissions;
}
