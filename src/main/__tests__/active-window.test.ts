/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promisify } from 'util';

const mockExecFileAsync = vi.fn();
const mockExecFile = Object.assign(vi.fn(), {
  [promisify.custom]: (...args: unknown[]) => mockExecFileAsync(...args),
});

vi.mock('child_process', () => ({
  execFile: mockExecFile,
  default: { execFile: mockExecFile },
}));

let mockPlatform = 'darwin';
vi.mock('os', () => ({
  platform: () => mockPlatform,
  default: { platform: () => mockPlatform },
}));

vi.mock('electron-log', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('listRunningApps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform = 'darwin';
  });

  it('returns de-duplicated app names on macOS', async () => {
    mockExecFileAsync.mockResolvedValue({
      stdout: 'Terminal|||iTerm2|||Terminal|||Slack',
    });

    const { listRunningApps } = await import('../active-window');
    const result = await listRunningApps();

    expect(result).toEqual(['Terminal', 'iTerm2', 'Slack']);
  });

  it('returns an empty array on non-macOS platforms without calling osascript', async () => {
    mockPlatform = 'win32';

    const { listRunningApps } = await import('../active-window');
    const result = await listRunningApps();

    expect(result).toEqual([]);
    expect(mockExecFileAsync).not.toHaveBeenCalled();
  });

  it('returns an empty array when the AppleScript call fails', async () => {
    mockExecFileAsync.mockRejectedValue(new Error('osascript failed'));

    const { listRunningApps } = await import('../active-window');
    const result = await listRunningApps();

    expect(result).toEqual([]);
  });
});
