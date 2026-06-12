import { vi } from 'vitest';

// Minimal Electron mock for unit tests running in Node.js (Vitest).
// Tests that need specific behavior should override _processFactory directly.
export const utilityProcess = {
  fork: vi.fn(() => ({
    postMessage: vi.fn(),
    on: vi.fn(),
    kill: vi.fn(),
  })),
};

export const app = {
  getPath: vi.fn(() => ''),
  getVersion: vi.fn(() => '0.0.0'),
};

export const ipcMain = {
  on: vi.fn(),
  handle: vi.fn(),
  removeHandler: vi.fn(),
};

export const shell = {
  openPath: vi.fn(),
  openExternal: vi.fn(),
};
