import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../renderer/App';

// Mock the Electron preload API used by renderer hooks so tests run in JSDOM
// without the real Electron environment.
// (global as any).window.electronAPI is already mocked in setupTests.ts

describe('App', () => {
  it('should render', async () => {
    const result = render(<App />);
    await waitFor(() => {
      expect(result).toBeTruthy();
    });
  });
});
