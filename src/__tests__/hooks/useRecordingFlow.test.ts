/// <reference types="vitest/globals" />
/**
 * Tests for the chunk timer and delta accumulator added in useRecordingFlow.
 * Verifies that transcript deltas are dispatched to Qwen at 5-minute intervals.
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  useRecordingFlow,
  CHUNK_INTERVAL_MS,
} from '@/renderer/hooks/useRecordingFlow';
import { triggerRecordingToggle } from '@/testing/electronMocks';
import type { Transcriber } from '@/renderer/hooks/useTranscriber';
import type { UseAudioRecorderReturn } from '@/renderer/hooks/useAudioRecorder';
import type { UseSystemAudioRecorderReturn } from '@/renderer/hooks/useSystemAudioRecorder';

vi.mock('@/renderer/hooks/useNotificationFlow', () => ({
  useNotificationFlow: () => ({
    showRecordingStart: vi.fn(),
    showRecordingStopped: vi.fn(),
    showProcessing: vi.fn(),
    showError: vi.fn(),
    showDone: vi.fn(),
    showIdle: vi.fn(),
    showMeetingDetected: vi.fn(),
    showMeetingEnded: vi.fn(),
  }),
}));

vi.mock('@/renderer/hooks/useMeetingDetector', () => ({
  useMeetingDetector: vi.fn(),
}));

vi.mock('@/renderer/testing/TestHooks', () => ({
  setupRecordingFlowTestHooks: vi.fn(),
  cleanupRecordingFlowTestHooks: vi.fn(),
  setRecordingActiveForTests: vi.fn(),
  exposeSystemAudioSetterForTests: vi.fn(),
  cleanupSystemAudioSetterForTests: vi.fn(),
}));

function makeTranscriber(text = ''): Transcriber {
  return {
    isBusy: false,
    isModelLoading: false,
    progressItems: [],
    start: vi.fn(),
    restTranscript: vi.fn(),
    output: text ? { isBusy: false, text, chunks: [] } : undefined,
  };
}

function makeAudioRecorder(isRecording = false): UseAudioRecorderReturn {
  return {
    isRecording,
    startRecording: vi.fn(async () => {}),
    stopRecording: vi.fn(),
    setOnRecordingComplete: vi.fn(),
    cleanup: vi.fn(),
  };
}

function makeSystemAudioRecorder(): UseSystemAudioRecorderReturn {
  return {
    startSystemRecording: vi.fn(),
    stopSystemRecording: vi.fn(),
  };
}

describe('useRecordingFlow — chunk timer and delta accumulator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('calls submitChunk with transcript text when timer fires', async () => {
    const transcriber = makeTranscriber('hello from the meeting');
    const audioRecorder = makeAudioRecorder(false);

    renderHook(() =>
      useRecordingFlow({
        audioRecorder,
        systemAudioRecorder: makeSystemAudioRecorder(),
        transcriber,
      }),
    );

    // Start recording
    await act(async () => {
      triggerRecordingToggle();
    });

    // Advance past the 5-minute mark
    await act(async () => {
      vi.advanceTimersByTime(CHUNK_INTERVAL_MS);
    });

    expect(
      window.electronAPI.summarizer.submitChunk,
    ).toHaveBeenCalledOnce();
    expect(
      window.electronAPI.summarizer.submitChunk,
    ).toHaveBeenCalledWith('hello from the meeting');
  });

  it('does not call submitChunk when there is no transcript text', async () => {
    const transcriber = makeTranscriber(''); // no text yet
    const audioRecorder = makeAudioRecorder(false);

    renderHook(() =>
      useRecordingFlow({
        audioRecorder,
        systemAudioRecorder: makeSystemAudioRecorder(),
        transcriber,
      }),
    );

    await act(async () => {
      triggerRecordingToggle();
    });

    await act(async () => {
      vi.advanceTimersByTime(CHUNK_INTERVAL_MS);
    });

    expect(window.electronAPI.summarizer.submitChunk).not.toHaveBeenCalled();
  });

  it('sends only the delta on subsequent ticks', async () => {
    let transcriptText = 'first segment';
    const getTranscriber = () => makeTranscriber(transcriptText);

    const audioRecorder = makeAudioRecorder(false);

    const { rerender } = renderHook(() =>
      useRecordingFlow({
        audioRecorder,
        systemAudioRecorder: makeSystemAudioRecorder(),
        transcriber: getTranscriber(),
      }),
    );

    await act(async () => {
      triggerRecordingToggle();
    });

    // First tick — sends "first segment"
    await act(async () => {
      vi.advanceTimersByTime(CHUNK_INTERVAL_MS);
    });

    expect(window.electronAPI.summarizer.submitChunk).toHaveBeenCalledWith(
      'first segment',
    );

    // Transcript grows with new content
    transcriptText = 'first segment second segment';
    rerender();

    // Second tick — sends only the new part
    await act(async () => {
      vi.advanceTimersByTime(CHUNK_INTERVAL_MS);
    });

    expect(window.electronAPI.summarizer.submitChunk).toHaveBeenCalledTimes(2);
    expect(window.electronAPI.summarizer.submitChunk).toHaveBeenLastCalledWith(
      'second segment',
    );
  });

  it('clears the timer when recording stops', async () => {
    const transcriber = makeTranscriber('some text');

    // First render: not recording
    const audioRecorder = makeAudioRecorder(false);

    const { rerender } = renderHook(
      ({ ar }: { ar: UseAudioRecorderReturn }) =>
        useRecordingFlow({
          audioRecorder: ar,
          systemAudioRecorder: makeSystemAudioRecorder(),
          transcriber,
        }),
      { initialProps: { ar: audioRecorder } },
    );

    // Start recording
    await act(async () => {
      triggerRecordingToggle();
    });

    // Swap to isRecording: true so the next toggle hits the stop branch
    const stoppedRecorder = makeAudioRecorder(true);
    rerender({ ar: stoppedRecorder });

    // Stop recording
    await act(async () => {
      triggerRecordingToggle();
    });

    // Advance past one interval — timer should be gone
    await act(async () => {
      vi.advanceTimersByTime(CHUNK_INTERVAL_MS);
    });

    expect(window.electronAPI.summarizer.submitChunk).not.toHaveBeenCalled();
  });

  it('resets delta index on a new recording session', async () => {
    let transcriptText = 'session one text';
    const getTranscriber = () => makeTranscriber(transcriptText);
    const audioRecorder = makeAudioRecorder(false);

    const { rerender } = renderHook(
      ({ ar }: { ar: UseAudioRecorderReturn }) =>
        useRecordingFlow({
          audioRecorder: ar,
          systemAudioRecorder: makeSystemAudioRecorder(),
          transcriber: getTranscriber(),
        }),
      { initialProps: { ar: audioRecorder } },
    );

    // Session 1: start → tick → stop
    await act(async () => { triggerRecordingToggle(); });
    await act(async () => { vi.advanceTimersByTime(CHUNK_INTERVAL_MS); });

    expect(window.electronAPI.summarizer.submitChunk).toHaveBeenCalledWith(
      'session one text',
    );

    const stoppedRecorder = makeAudioRecorder(true);
    rerender({ ar: stoppedRecorder });
    await act(async () => { triggerRecordingToggle(); }); // stop

    // Session 2: new transcript text, fresh start
    transcriptText = 'session two text';
    const freshRecorder = makeAudioRecorder(false);
    rerender({ ar: freshRecorder });

    await act(async () => { triggerRecordingToggle(); }); // start again
    await act(async () => { vi.advanceTimersByTime(CHUNK_INTERVAL_MS); });

    // Should send full "session two text", not a delta from session 1
    expect(window.electronAPI.summarizer.submitChunk).toHaveBeenLastCalledWith(
      'session two text',
    );
  });
});
