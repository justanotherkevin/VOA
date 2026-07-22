import { useState, useEffect } from 'react';

export interface ModelPreferences {
  selectedModel: string;
  multilingual: boolean;
  quantized: boolean;
  language: string;
  asrType?: 'whisper' | 'parakeet';
}

interface UseModelPreferences {
  preferences: ModelPreferences | null;
  isLoading: boolean;
  updatePreferences: (
    preferences: Partial<ModelPreferences>,
  ) => Promise<{ success: boolean; message?: string }>;
}

export function useModelPreferences(): UseModelPreferences {
  const [preferences, setPreferences] = useState<ModelPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        const prefs = await window.electronAPI.settings.model.get();
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load model preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreferences();
  }, []);

  const updatePreferences = async (
    newPreferences: Partial<ModelPreferences>,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const result = await window.electronAPI.settings.model.update(
        newPreferences as Record<string, unknown>,
      );
      if (result.success && preferences) {
        setPreferences({ ...preferences, ...newPreferences });
        return { success: true };
      } else {
        console.error('Failed to update preferences:', result.message);
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      return { success: false, message: String(error) };
    }
  };

  return {
    preferences,
    isLoading,
    updatePreferences,
  };
}
