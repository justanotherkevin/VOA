import { useContext } from 'react';
import { UIPreferencesContext } from '@/renderer/contexts/UIPreferencesContext';

export function useUIPreferencesContext() {
  const context = useContext(UIPreferencesContext);
  if (!context) {
    throw new Error(
      'useUIPreferencesContext must be used within UIPreferencesProvider',
    );
  }
  return context;
}
