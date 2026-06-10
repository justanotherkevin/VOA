import { RECORDING_SHORTCUT } from '@/lib/shortcuts';
import { useState, useEffect } from 'react';

interface ShortcutPreferences {
  recordingToggle: string;
}

interface UseShortcuts {
  currentShortcut: string;
  isSaving: boolean;
  updateShortcut: (newShortcut: string) => Promise<boolean>;
  resetShortcut: () => Promise<boolean>;
}

export function useShortcuts(): UseShortcuts {
  const [currentShortcut, setCurrentShortcut] = useState(RECORDING_SHORTCUT);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadShortcut = async () => {
      try {
        const shortcuts = await window.electronAPI.settings.shortcuts.get();
        setCurrentShortcut(shortcuts.recordingToggle);
      } catch (error) {
        console.error('Failed to load shortcuts:', error);
      }
    };
    loadShortcut();
  }, []);

  const updateShortcut = async (newShortcut: string): Promise<boolean> => {
    setIsSaving(true);
    try {
      const result =
        await window.electronAPI.settings.shortcuts.updateRecordingToggle(newShortcut);
      if (result.success) {
        setCurrentShortcut(newShortcut);
        return true;
      } else {
        console.error('Failed to update shortcut:', result.message);
        return false;
      }
    } catch (error) {
      console.error('Error updating shortcut:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const resetShortcut = async (): Promise<boolean> => {
    return updateShortcut(RECORDING_SHORTCUT);
  };

  return {
    currentShortcut,
    isSaving,
    updateShortcut,
    resetShortcut,
  };
}
