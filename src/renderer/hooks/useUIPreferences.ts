import { useEffect, useState } from 'react';
import type { UIPreferences } from '@/main/store/schema';
import { applyTheme } from '@/renderer/utils/theme';

const DEFAULT_UI_PREFS: UIPreferences = {
  theme: 'dark',
  accentLight: '#2f6bed',
  accentDark: '#4f8cff',
  density: 'comfortable',
};

export const ACCENTS = [
  { light: '#2f6bed', dark: '#4f8cff' },
  { light: '#6a5cf0', dark: '#8b80ff' },
  { light: '#13a98a', dark: '#2bd0ab' },
  { light: '#e0568a', dark: '#ff7aae' },
];

export function useUIPreferences() {
  const [uiPrefs, setUiPrefs] = useState<UIPreferences>(DEFAULT_UI_PREFS);

  useEffect(() => {
    window.electronAPI.settings.ui.get().then((ui) => {
      if (ui) {
        setUiPrefs((prev) => ({ ...prev, ...ui }));
        if (ui.theme) applyTheme(ui.theme);
      }
    });
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    uiPrefs.theme === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : uiPrefs.theme;

  const accentValue =
    resolvedTheme === 'dark' ? uiPrefs.accentDark : uiPrefs.accentLight;

  async function updateUIAndApply(key: string, value: string) {
    const newPrefs = { ...uiPrefs, [key]: value };
    setUiPrefs(newPrefs as UIPreferences);
    applyTheme(newPrefs.theme);
    await window.electronAPI.settings.ui.update({ [key]: value });
  }

  async function setAccent(light: string, dark: string) {
    const newPrefs = { ...uiPrefs, accentLight: light, accentDark: dark };
    setUiPrefs(newPrefs);
    await window.electronAPI.settings.ui.update({
      accentLight: light,
      accentDark: dark,
    });
  }

  return {
    uiPrefs,
    resolvedTheme,
    accentValue,
    updateUIAndApply,
    setAccent,
    accents: ACCENTS,
  };
}
