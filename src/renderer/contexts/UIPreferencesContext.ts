import { createContext } from 'react';
import type { useUIPreferences } from '@/renderer/hooks/useUIPreferences';

export type UIPreferencesContextType = ReturnType<typeof useUIPreferences>;

export const UIPreferencesContext = createContext<
  UIPreferencesContextType | undefined
>(undefined);
