import React, { ReactNode } from 'react';
import { UIPreferencesContext } from './UIPreferencesContext';
import { useUIPreferences } from '@/renderer/hooks/useUIPreferences';

interface UIPreferencesProviderProps {
  children: ReactNode;
}

export function UIPreferencesProvider({
  children,
}: UIPreferencesProviderProps) {
  const value = useUIPreferences();
  return (
    <UIPreferencesContext.Provider value={value}>
      {children}
    </UIPreferencesContext.Provider>
  );
}
