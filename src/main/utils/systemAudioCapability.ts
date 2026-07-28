export function isSystemAudioCaptureSupported(): boolean {
  if (process.platform !== 'darwin') return false;
  const [major] = process.getSystemVersion().split('.').map(Number);
  return major >= 14;
}
