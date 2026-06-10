import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import {
  PermissionsContext,
  PermissionsStatus,
  PermissionsContextType,
} from './PermissionsContext';
import {
  exposePermissionsSetterForTests,
  cleanupPermissionsSetterForTests,
} from '@/renderer/testing/TestHooks';

interface PermissionsProviderProps {
  children: ReactNode;
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const [permissions, setPermissions] = useState<PermissionsStatus>({
    microphone: 'denied',
    accessibility: false,
    keyboardShortcut: false,
    screenRecording: 'denied',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [openSettingsError, setOpenSettingsError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const perms = await window.electronAPI.permissions.check();
      setPermissions(perms);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check permissions';
      setError(message);
    }
  }, []);

  const refreshPermission = async (permissionType: string) => {
    try {
      setRefreshError(null);
      await window.electronAPI.permissions.refresh(permissionType);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh permission';
      setRefreshError(message);
    }
  };

  const openSettings = async (permissionType: 'microphone' | 'accessibility' | 'screenRecording') => {
    try {
      setOpenSettingsError(null);
      await window.electronAPI.permissions.openSettings(permissionType);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open settings';
      setOpenSettingsError(message);
    }
  };

  // Initial permissions check on mount
  useEffect(() => {
    const checkPerms = async () => {
      try {
        setError(null);
        const perms = await window.electronAPI.permissions.check();
        setPermissions(perms);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to check permissions';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    checkPerms();
  }, []);

  // Auto-refresh permissions when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      refresh();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

  // Expose setter for E2E tests to override permissions without IPC
  useEffect(() => {
    exposePermissionsSetterForTests(setPermissions);
    return () => cleanupPermissionsSetterForTests();
  }, []);

  const value: PermissionsContextType = {
    permissions,
    isLoading,
    error,
    refreshError,
    openSettingsError,
    refresh,
    refreshPermission,
    openSettings,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}
