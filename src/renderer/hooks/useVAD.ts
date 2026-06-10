/**
 * Custom hook for Voice Activity Detection (VAD) lifecycle management
 * Handles MicVAD initialization, state management, and audio segment accumulation
 * Separates VAD concerns from MediaRecorder/audio capture logic
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { MicVAD } from '@ricky0123/vad-web';
import { VAD_CONFIG } from '@/renderer/utils/VadConfig';
import { sendAudioToTranscriber } from '@/renderer/utils/ElectronAPIHelper';

export interface UseVADReturn {
  isInitialized: boolean;
  startListening: () => void;
  stopListening: () => void;
  stopListeningAndFlush: () => void;
  cleanup: () => void;
}

interface VADCallbacks {
  onSpeechEnd?: (audio: Float32Array) => void;
}

const combineAudioFrames = (frames: Float32Array[]): Float32Array => {
  const totalLength = frames.reduce((sum, frame) => sum + frame.length, 0);
  const combined = new Float32Array(totalLength);
  let offset = 0;
  for (const frame of frames) {
    combined.set(frame, offset);
    offset += frame.length;
  }
  return combined;
};

/**
 * Hook for managing VAD (Voice Activity Detection) lifecycle
 * Pre-initializes VAD on mount and keeps it paused until recording starts
 * Handles audio segment accumulation and transmission to transcriber
 *
 * @param callbacks - Optional callbacks for VAD events
 * @returns VAD control methods and state
 */
export function useVAD(callbacks?: VADCallbacks): UseVADReturn {
  const vadRef = useRef<MicVAD | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const currentSegmentRef = useRef<Float32Array[]>([]);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const forceSendOnNextSpeechEndRef = useRef<boolean>(false);
  const handleOnSpeechEndRef = useRef<(audio: Float32Array) => void>();

  const clearPauseTimer = () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  const sendSegmentToTranscriber = useCallback(
    async (audioFrames: Float32Array[]): Promise<void> => {
      try {
        const combined = combineAudioFrames(audioFrames);
        await sendAudioToTranscriber(Array.from(combined));
      } catch (error) {
        console.error('[VAD] Error sending segment to transcriber:', error);
      }
    },
    [],
  );

  useEffect(() => {
    const flushCurrentSegments = () => {
      sendSegmentToTranscriber(currentSegmentRef.current);
      currentSegmentRef.current = [];
    };

    const handleSpeechEnd = (audio: Float32Array) => {
      currentSegmentRef.current.push(audio);
      clearPauseTimer();
      // when audio recording ends trigged by shortkey
      if (forceSendOnNextSpeechEndRef.current) {
        forceSendOnNextSpeechEndRef.current = false;
        console.log('[VAD] Force-flush on recording stop — frames:', currentSegmentRef.current.length, 'samples:', currentSegmentRef.current.reduce((s, f) => s + f.length, 0));
        flushCurrentSegments();
        callbacks?.onSpeechEnd?.(audio);
        return;
      }
      // when triggered by voice pausing detection
      console.log('[VAD] Speech ended — scheduling flush in', VAD_CONFIG.PAUSE_TIMEOUT_MS, 'ms, frames:', currentSegmentRef.current.length);
      pauseTimerRef.current = setTimeout(() => {
        flushCurrentSegments();
        pauseTimerRef.current = null;
      }, VAD_CONFIG.PAUSE_TIMEOUT_MS);

      callbacks?.onSpeechEnd?.(audio);
    };

    handleOnSpeechEndRef.current = handleSpeechEnd;
  }, [sendSegmentToTranscriber, callbacks]);

  useEffect(() => {
    const initVad = async () => {
      try {
        const vad = await MicVAD.new({
          onSpeechStart: () => {},
          onSpeechEnd: (audio: Float32Array) => {
            handleOnSpeechEndRef.current?.(audio);
          },
          submitUserSpeechOnPause: true,
          baseAssetPath: VAD_CONFIG.BASE_ASSET_PATH,
          onnxWASMBasePath: VAD_CONFIG.ONNX_WASM_BASE_PATH,
        });

        vadRef.current = vad;
        vadRef.current.pause();
        setIsInitialized(true);
      } catch (error) {
        console.error('[VAD] Initialization failed:', error);
      }
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => initVad());
    } else {
      const timer = setTimeout(initVad, 100);
      return () => clearTimeout(timer);
    }

    return () => {
      vadRef.current = null;
    };
  }, []);

  const getVad = (): MicVAD | null => vadRef.current;

  const startListening = useCallback(() => {
    getVad()?.start();
  }, []);

  const stopListening = useCallback(() => {
    getVad()?.pause();
  }, []);

  const stopListeningAndFlush = useCallback(() => {
    // submitUserSpeechOnPause: true causes MicVAD to fire onSpeechEnd on pause
    // flag ensures that handler sends immediately instead of waiting for timeout
    forceSendOnNextSpeechEndRef.current = true;
    getVad()?.pause();
  }, []);

  const cleanup = useCallback(() => {
    getVad()?.pause();
    currentSegmentRef.current = [];
    clearPauseTimer();
  }, []);

  return {
    isInitialized,
    startListening,
    stopListening,
    stopListeningAndFlush,
    cleanup,
  };
}
