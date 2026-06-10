import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePermissions } from '@/renderer/hooks/usePermissions';
import { PermissionsProvider } from '@/renderer/contexts/PermissionsProvider';
import React from 'react';

describe('usePermissions hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch permissions on mount', async () => {
    const mockCheckPermissions = vi.fn().mockResolvedValue({
      microphone: 'granted',
      accessibility: false,
      keyboardShortcut: true,
      screenRecording: 'denied',
    });

    window.electronAPI = {
      permissions: { check: mockCheckPermissions },
    } as any;

    const { result } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => React.createElement(PermissionsProvider, null, children),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.permissions).toEqual({
      microphone: 'granted',
      accessibility: false,
      keyboardShortcut: true,
      screenRecording: 'denied',
    });
  });

  it('should start with loading state', () => {
    const mockCheckPermissions = vi.fn().mockImplementation(() => new Promise(() => {}));

    window.electronAPI = {
      permissions: { check: mockCheckPermissions },
    } as any;

    const { result } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => React.createElement(PermissionsProvider, null, children),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('should handle errors when fetching permissions', async () => {
    const mockError = new Error('Permission check failed');
    const mockCheckPermissions = vi.fn().mockRejectedValue(mockError);

    window.electronAPI = {
      permissions: { check: mockCheckPermissions },
    } as any;

    const { result } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => React.createElement(PermissionsProvider, null, children),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(mockError.message);
  });
});
