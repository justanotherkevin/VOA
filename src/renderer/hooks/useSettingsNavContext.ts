import { useContext } from 'react';
import { SettingsNavContext } from '@/renderer/contexts/SettingsNavContext';

export function useSettingsNavContext() {
  const context = useContext(SettingsNavContext);
  if (!context) {
    throw new Error(
      'useSettingsNavContext must be used within SettingsNavProvider',
    );
  }
  return context;
}
