import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioRecorder } from '@/renderer/hooks/useAudioRecorder';

/**
 * Mock useVAD so we can control isInitialized and the returned methods.
 * The mock is reassigned per-test via `mockVadReturn`.
 */
const mockStartListening = vi.fn();
const mockStopListening = vi.fn();
const mockStopListeningAndFlush = vi.fn();
const mockCleanup = vi.fn();

let mockVadReturn = {
  isInitialized: false,
  startListening: mockStartListening,
  stopListening: mockStopListening,
  stopListeningAndFlush: mockStopListeningAndFlush,
  cleanup: mockCleanup,
};

vi.mock('@/renderer/hooks/useVAD', () => ({
  useVAD: () => mockVadReturn,
}));

describe('useAudioRecorder — VAD duplicate paste prevention', () => {
  let onRecordingComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onRecordingComplete = vi.fn().mockResolvedValue(undefined);
    mockVadReturn = {
      isInitialized: false,
      startListening: mockStartListening,
      stopListening: mockStopListening,
      stopListeningAndFlush: mockStopListeningAndFlush,
      cleanup: mockCleanup,
    };
  });

  describe('when VAD is NOT initialized', () => {
    it('calls onRecordingComplete after MediaRecorder stops (normal flow)', async () => {
      mockVadReturn.isInitialized = false;

      const { result } = renderHook(() => useAudioRecorder());
      result.current.setOnRecordingComplete(onRecordingComplete);

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.stopRecording();
      });

      // MediaRecorder mock fires dataavailable synchronously in stop()
      // so the callback should have been called
      expect(onRecordingComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('when VAD IS initialized', () => {
    it('does NOT call onRecordingComplete via the MediaRecorder dataavailable path', async () => {
      mockVadReturn.isInitialized = true;

      const { result } = renderHook(() => useAudioRecorder());
      result.current.setOnRecordingComplete(onRecordingComplete);

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.stopRecording();
      });

      // Full audio transcription must be skipped to prevent duplicate paste
      expect(onRecordingComplete).not.toHaveBeenCalled();
    });



    it('starts VAD listening when recording starts', async () => {
      mockVadReturn.isInitialized = true;

      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(mockStartListening).toHaveBeenCalledTimes(1);
    });

    it('stops VAD listening when recording stops', async () => {
      mockVadReturn.isInitialized = true;

      const { result } = renderHook(() => useAudioRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.stopRecording();
      });

      expect(mockStopListeningAndFlush).toHaveBeenCalledTimes(1);
    });
  });
});
