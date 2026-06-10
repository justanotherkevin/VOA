import { createContext } from 'react';

export interface PermissionsStatus {
  microphone: string;
  accessibility: boolean;
  keyboardShortcut: boolean;
  screenRecording: string;
}

export interface PermissionsContextType {
  permissions: PermissionsStatus;
  isLoading: boolean;
  error: string | null;
  refreshError: string | null;
  openSettingsError: string | null;
  refresh: () => Promise<void>;
  refreshPermission: (permissionType: string) => Promise<void>;
  openSettings: (permissionType: 'microphone' | 'accessibility' | 'screenRecording') => Promise<void>;
}

export const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);
