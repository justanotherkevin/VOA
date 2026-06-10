import { useCallback } from 'react';
import { sendAudioToTranscriber } from '@/renderer/utils/ElectronAPIHelper';

export interface UseSystemAudioRecorderReturn {
  startSystemRecording: () => Promise<void>;
  stopSystemRecording: () => void;
}

export function useSystemAudioRecorder(): UseSystemAudioRecorderReturn {
  const startSystemRecording = useCallback(async () => {
    const started = await window.electronAPI.audio.startSystemAudio(
      async (audio: number[], startedAt: number, endedAt: number) => {
        await sendAudioToTranscriber(audio, 'system', startedAt, endedAt);
      },
    );
    if (!started) {
      console.warn('[useSystemAudioRecorder] system audio unavailable');
    }
  }, []);

  const stopSystemRecording = useCallback(() => {
    window.electronAPI.audio.stopSystemAudio();
  }, []);

  return { startSystemRecording, stopSystemRecording };
}
