import React, { useState, ReactNode } from 'react';
import { SettingsNavContext, SettingsPaneId } from './SettingsNavContext';

interface SettingsNavProviderProps {
  children: ReactNode;
}

export function SettingsNavProvider({ children }: SettingsNavProviderProps) {
  const [activePane, setActivePane] = useState<SettingsPaneId>(
    () => (localStorage.getItem('ats-pane') as SettingsPaneId) || 'recording',
  );

  const goPane = (pane: SettingsPaneId) => {
    setActivePane(pane);
    localStorage.setItem('ats-pane', pane);
  };

  return (
    <SettingsNavContext.Provider value={{ activePane, goPane }}>
      {children}
    </SettingsNavContext.Provider>
  );
}
