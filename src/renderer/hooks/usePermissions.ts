import { useContext } from 'react';
import { PermissionsContext } from '@/renderer/contexts/PermissionsContext';

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return context;
}

// Re-export PermissionsStatus for backwards compatibility
export type { PermissionsStatus } from '@/renderer/contexts/PermissionsContext';
