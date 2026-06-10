import { useState, useEffect, useCallback } from 'react';

export interface StoredTranscript {
	id: string;
	date: number;
	text: string;
	chunks: Array<{
		text: string;
		timestamp: [number, number | null];
	}>;
}

export function useTranscriptHistory() {
	const [history, setHistory] = useState<StoredTranscript[]>([]);

	const fetchHistory = useCallback(async () => {
		const data = await window.electronAPI.transcriptHistory.get();
		setHistory(data);
	}, []);

	const clearHistory = useCallback(async () => {
		await window.electronAPI.transcriptHistory.clear();
		setHistory([]);
	}, []);

	useEffect(() => {
		fetchHistory();

		// Subscribe to transcriber complete event to add the newly saved transcript
		const unsubscribe = window.electronAPI.transcriber.on.complete(
			(message: any) => {
				// Get the saved transcript from the event payload to avoid refetch
				const savedTranscript = message?.savedTranscript;
				if (savedTranscript) {
					// Update history with the new transcript at the beginning
					setHistory((prev) => [savedTranscript, ...prev.slice(0, 9)]);
				}
			},
		);

		return () => {
			unsubscribe();
		};
	}, []);

	return {
		history,
		clearHistory,
		refreshHistory: fetchHistory,
	};
}
