import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionsService, OsPermissionProbe } from '../services/permissions';

function makeProbe(overrides: Partial<OsPermissionProbe> = {}): OsPermissionProbe {
  return {
    getMicrophoneStatus: vi.fn(() => 'granted'),
    getScreenRecordingStatus: vi.fn(() => 'granted'),
    isAccessibilityGranted: vi.fn(() => true),
    ...overrides,
  };
}

describe('PermissionsService', () => {
  it('returns current state after refresh', () => {
    const service = new PermissionsService(makeProbe());
    const state = service.refresh();
    expect(state.microphone).toBe('granted');
    expect(state.accessibility).toBe(true);
    expect(state.screenRecording).toBe('granted');
  });

  it('emits change event when state transitions', () => {
    const probe = makeProbe({ getMicrophoneStatus: vi.fn(() => 'denied') });
    const service = new PermissionsService(probe);
    service.refresh(); // sets initial state

    const listener = vi.fn();
    service.on('change', listener);

    vi.mocked(probe.getMicrophoneStatus).mockReturnValue('granted');
    service.refresh();

    expect(listener).toHaveBeenCalledOnce();
    const [next, previous] = listener.mock.calls[0];
    expect(next.microphone).toBe('granted');
    expect(previous.microphone).toBe('denied');
  });

  it('does not emit change event when state is identical', () => {
    const service = new PermissionsService(makeProbe());
    service.refresh();
    const listener = vi.fn();
    service.on('change', listener);
    service.refresh(); // same values
    expect(listener).not.toHaveBeenCalled();
  });

  it('isMicrophoneGranted reflects current state', () => {
    const probe = makeProbe({ getMicrophoneStatus: vi.fn(() => 'denied') });
    const service = new PermissionsService(probe);
    service.refresh();
    expect(service.isMicrophoneGranted()).toBe(false);
  });
});
