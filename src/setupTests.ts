import { vi, beforeEach, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with @testing-library/jest-dom matchers
expect.extend(matchers);
import {
  attachGlobalElectronMock,
  resetElectronMockCallbacks,
} from '@/testing/electronMocks';
import { MockMediaRecorder, createMockAudioBuffer } from '@/testing/mediaMocks';

// Attach shared electronAPI mock (provides trigger helpers too)
attachGlobalElectronMock();

// Browser/media API mocks — only applicable in jsdom (renderer tests)
if (typeof window !== 'undefined') {
  const fakeStream = {
    id: 'fake-stream',
    getTracks: () => [],
    getAudioTracks: () => [],
  } as unknown as MediaStream;

  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue(fakeStream),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
  });

  Object.defineProperty(window, 'MediaRecorder', {
    writable: true,
    value: MockMediaRecorder,
  });

  const urls: string[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: vi.fn(() => {
      const u = `blob:fake/${urls.length}`;
      urls.push(u);
      return u;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(() => {}),
  });

  Object.defineProperty(window, 'AudioContext', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      decodeAudioData: vi.fn(async () => createMockAudioBuffer()),
      sampleRate: 44100,
    })),
  });

  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: MockResizeObserver,
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Prevent JSDOM "Not implemented: HTMLCanvasElement.getContext()" noise.
  // Guard needed because attachGlobalElectronMock() sets global.window = {}
  // in Node.js, making typeof window truthy even without a real DOM.
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as any;
  }
}

// Ensure mocks and callback registries are reset between tests
beforeEach(() => {
  vi.clearAllMocks();
  resetElectronMockCallbacks();
});
