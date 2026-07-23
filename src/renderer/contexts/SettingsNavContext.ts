import { createContext } from 'react';

export type SettingsPaneId =
  | 'general'
  | 'transcription'
  | 'recording'
  | 'audio'
  | 'privacy'
  | 'permissions'
  | 'shortcuts';

export interface SettingsNavContextType {
  activePane: SettingsPaneId;
  goPane: (pane: SettingsPaneId) => void;
}

export const SettingsNavContext = createContext<
  SettingsNavContextType | undefined
>(undefined);
