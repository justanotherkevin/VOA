import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecordingFlow } from '@/renderer/hooks/useRecordingFlow';
import type { UseAudioRecorderReturn } from '@/renderer/hooks/useAudioRecorder';
import type { UseSystemAudioRecorderReturn } from '@/renderer/hooks/useSystemAudioRecorder';
import type { Transcriber } from '@/renderer/hooks/useTranscriber';
import {
  attachGlobalElectronMock,
  resetElectronMockCallbacks,
  triggerRecordingToggle,
  triggerModelStatusChanged,
} from '@/testing/electronMocks';

function buildAudioRecorder(): UseAudioRecorderReturn {
  return {
    isRecording: false,
    duration: 0,
    mimeType: undefined,
    hasPendingVadSegment: false,
    startRecording: vi.fn(async () => {}),
    stopRecording: vi.fn(),
    resetRecordingState: vi.fn(),
    setOnRecordingComplete: vi.fn(),
    cleanup: vi.fn(),
  };
}

function buildSystemAudioRecorder(): UseSystemAudioRecorderReturn {
  return {
    startSystemRecording: vi.fn(async () => {}),
    stopSystemRecording: vi.fn(),
  };
}

function buildTranscriber(): Transcriber {
  return {
    restTranscript: vi.fn(),
    isBusy: false,
    progressItems: [],
    start: vi.fn(),
    output: undefined,
  };
}

function updateStateCallsWith(state: string) {
  return (
    window.electronAPI.notifications.updateState as ReturnType<typeof vi.fn>
  ).mock.calls.some(([payload]: any[]) => payload.state === state);
}

describe('useRecordingFlow — model-status-gated notification', () => {
  beforeEach(() => {
    attachGlobalElectronMock();
    vi.clearAllMocks();
    resetElectronMockCallbacks();
  });

  it('cold start: shows loading before recording, and recording only after the model reports ready', async () => {
    (window.electronAPI.transcriber.getModelStatus as any).mockResolvedValue({
      status: 'idle',
      model: null,
      quantized: null,
    });

    const audioRecorder = buildAudioRecorder();
    const systemAudioRecorder = buildSystemAudioRecorder();
    const transcriber = buildTranscriber();

    await act(async () => {
      renderHook(() =>
        useRecordingFlow({ audioRecorder, systemAudioRecorder, transcriber }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      triggerRecordingToggle();
    });

    // Loading fires synchronously, before startRecording's await settles.
    expect(updateStateCallsWith('loading')).toBe(true);
    expect(updateStateCallsWith('recording')).toBe(false);

    act(() => {
      triggerModelStatusChanged({
        status: 'ready',
        model: 'Xenova/whisper-tiny',
        quantized: false,
      });
    });

    await waitFor(() => {
      expect(updateStateCallsWith('recording')).toBe(true);
    });
  });

  it('warm start: goes straight to recording, with no intervening loading notification', async () => {
    (window.electronAPI.transcriber.getModelStatus as any).mockResolvedValue({
      status: 'ready',
      model: 'Xenova/whisper-tiny',
      quantized: false,
    });

    const audioRecorder = buildAudioRecorder();
    const systemAudioRecorder = buildSystemAudioRecorder();
    const transcriber = buildTranscriber();

    await act(async () => {
      renderHook(() =>
        useRecordingFlow({ audioRecorder, systemAudioRecorder, transcriber }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      triggerRecordingToggle();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(updateStateCallsWith('recording')).toBe(true);
    });
    expect(updateStateCallsWith('loading')).toBe(false);
  });

  it('load failure: ensureReady does not hang — recording notification still fires', async () => {
    (window.electronAPI.transcriber.getModelStatus as any).mockResolvedValue({
      status: 'idle',
      model: null,
      quantized: null,
    });

    const audioRecorder = buildAudioRecorder();
    const systemAudioRecorder = buildSystemAudioRecorder();
    const transcriber = buildTranscriber();

    await act(async () => {
      renderHook(() =>
        useRecordingFlow({ audioRecorder, systemAudioRecorder, transcriber }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      triggerRecordingToggle();
    });

    act(() => {
      triggerModelStatusChanged({
        status: 'error',
        message: 'Failed to load model',
      });
    });

    await waitFor(() => {
      expect(updateStateCallsWith('recording')).toBe(true);
    });
  });
});
