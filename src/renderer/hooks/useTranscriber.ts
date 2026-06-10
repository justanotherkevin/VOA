import { useCallback, useMemo, useState, useEffect } from 'react';
import Constants from '@/lib/Constants';
import { getRecordingActiveForTests } from '@/renderer/testing/TestHooks';
import {
  setupTranscriberListeners,
  cleanupTranscriberListeners,
} from '@/renderer/utils/TranscriberListeners';

interface ProgressItem {
	file: string;
	loaded: number;
	progress: number;
	total: number;
	name: string;
	status: string;
}

type Timetype = [number, number | null];
type BlobChunks = Array<{ text: string; timestamp: Timetype }>;

interface TranscriberUpdateData {
	data: [string, { chunks: BlobChunks }];
	text: string;
}

interface StoredTranscript {
	id: string;
	date: number;
	text: string;
	chunks: BlobChunks;
}

interface TranscriberCompleteData {
	data: {
		text: string;
		chunks: BlobChunks;
	};
	savedTranscript?: StoredTranscript | null;
}

export interface TranscriberData {
	isBusy: boolean;
	text: string;
	chunks: BlobChunks;
}

export interface Transcriber {
	restTranscript: () => void;
	isBusy: boolean;
	isModelLoading: boolean;
	progressItems: ProgressItem[];
	start: (audioBlob: Blob, startedAt?: number, endedAt?: number) => void;
	output?: TranscriberData;
}

export function useTranscriber(): Transcriber {
	const [transcript, setTranscript] = useState<TranscriberData | undefined>(
		undefined,
	);
	const [isBusy, setIsBusy] = useState(false);
	const [isModelLoading, setIsModelLoading] = useState(false);

	const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

	useEffect(() => {
		const unsubscribers = setupTranscriberListeners({
			onProgress: (message: any) => {
				setProgressItems((prev) =>
					prev.map((item) => {
						if (item.file === (message as any).file) {
							return { ...item, progress: (message as any).progress };
						}
						return item;
					}),
				);
			},
			onUpdate: (data: TranscriberData) => {
				setTranscript(data);
			},
			onComplete: (data: TranscriberData) => {
				setTranscript(data);
				setIsBusy(false);
			},
			onInitiate: (message: any) => {
				setIsModelLoading(true);
				setProgressItems((prev) => [...prev, message as ProgressItem]);
			},
			onReady: () => {
				setIsModelLoading(false);
			},
			onError: (message: any) => {
				setIsBusy(false);
				alert(
					`${(message as any)?.data?.message ?? (message as any) ?? 'An unknown error occurred.'} This is most likely because you are using Safari on an M1/M2 Mac. Please try again from Chrome, Firefox, or Edge.\n\nIf this is not the case, please file a bug report.`,
				);
			},
			onDone: (message: any) => {
				setProgressItems((prev) =>
					prev.filter((item) => item.file !== (message as any).file),
				);
			},
		});

		return () => {
			cleanupTranscriberListeners(unsubscribers);
		};
	}, []);

	const restTranscript = () => {
		setTranscript(undefined);
	};

	const postRequest = async (audioBuffer: AudioBuffer, startedAt?: number, endedAt?: number) => {
		if (audioBuffer) {
			setTranscript(undefined);
			setIsBusy(true);

			let audio: Float32Array;
			if (audioBuffer.numberOfChannels === 2) {
				const SCALING_FACTOR = Math.sqrt(2);
				const left = audioBuffer.getChannelData(0);
				const right = audioBuffer.getChannelData(1);

				audio = new Float32Array(left.length);
				for (let i = 0; i < audioBuffer.length; ++i) {
					audio[i] = (SCALING_FACTOR * (left[i] + right[i])) / 2;
				}
			} else {
				audio = audioBuffer.getChannelData(0);
			}

			await window.electronAPI.transcriber.start({
				audio: Array.from(audio),
				startedAt: startedAt ?? Date.now() - (audioBuffer.duration * 1000),
				endedAt: endedAt ?? Date.now(),
			});
		}
	};

	const transcriber = {
		restTranscript,
		isBusy,
		isModelLoading,
		progressItems,
		start: postRequest,
		output: transcript,
	};

	return transcriber;
}
