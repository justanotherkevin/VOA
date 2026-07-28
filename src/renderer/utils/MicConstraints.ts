export async function getPreferredMicConstraints(
  base: MediaTrackConstraints,
): Promise<MediaTrackConstraints> {
  try {
    const audioPrefs = await window.electronAPI.settings.audio.get();
    const deviceId = audioPrefs?.selectedMicDeviceId;
    if (deviceId) {
      return { ...base, deviceId: { exact: deviceId } };
    }
  } catch {
    // fall through to unconstrained defaults
  }
  return base;
}

export function isOverconstrainedError(error: unknown): boolean {
  return error instanceof Error && error.name === 'OverconstrainedError';
}
