import { RECORDING_SHORTCUT, DICTATION_SHORTCUT } from '@/lib/shortcuts';
import { useState, useEffect } from 'react';

interface UseShortcuts {
  currentShortcut: string;
  isSaving: boolean;
  updateShortcut: (newShortcut: string) => Promise<boolean>;
  resetShortcut: () => Promise<boolean>;
}

export function useShortcuts(
  kind: 'recording' | 'dictation' = 'recording',
): UseShortcuts {
  const defaultShortcut =
    kind === 'recording' ? RECORDING_SHORTCUT : DICTATION_SHORTCUT;
  const [currentShortcut, setCurrentShortcut] = useState(defaultShortcut);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadShortcut = async () => {
      try {
        const shortcuts = await window.electronAPI.settings.shortcuts.get();
        setCurrentShortcut(
          kind === 'recording'
            ? shortcuts.recordingToggle
            : shortcuts.dictationToggle,
        );
      } catch (error) {
        console.error('Failed to load shortcuts:', error);
      }
    };
    loadShortcut();
  }, [kind]);

  const updateShortcut = async (newShortcut: string): Promise<boolean> => {
    setIsSaving(true);
    try {
      const result =
        kind === 'recording'
          ? await window.electronAPI.settings.shortcuts.updateRecordingToggle(
              newShortcut,
            )
          : await window.electronAPI.settings.shortcuts.updateDictationToggle(
              newShortcut,
            );
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
    return updateShortcut(defaultShortcut);
  };

  return {
    currentShortcut,
    isSaving,
    updateShortcut,
    resetShortcut,
  };
}
