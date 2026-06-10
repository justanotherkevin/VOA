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
	) => Promise<boolean>;
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
	): Promise<boolean> => {
		try {
			const result =
				await window.electronAPI.settings.model.update(newPreferences as Record<string, unknown>);
			if (result.success && preferences) {
				setPreferences({ ...preferences, ...newPreferences });
				return true;
			} else {
				console.error('Failed to update preferences:', result.message);
				return false;
			}
		} catch (error) {
			console.error('Error updating preferences:', error);
			return false;
		}
	};

	return {
		preferences,
		isLoading,
		updatePreferences,
	};
}
