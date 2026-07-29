import React from 'react';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelsStep } from '@/renderer/pages/Onboarding';

// Small helper to get a promise + external resolve/reject, so tests can
// control exactly when each mocked IPC call settles instead of racing
// against Vitest's mocked-promise microtask resolution.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderModelsStep(onNext = vi.fn()) {
  render(
    <MemoryRouter>
      <ModelsStep onNext={onNext} />
    </MemoryRouter>,
  );
  return onNext;
}

function getLastCallback(mockFn: unknown) {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[calls.length - 1][0] as (...args: unknown[]) => void;
}

describe('Onboarding ModelsStep', () => {
  let statusDeferred: ReturnType<
    typeof deferred<{ downloaded: boolean; path: string }>
  >;
  let downloadDeferred: ReturnType<
    typeof deferred<{ success: boolean; message?: string }>
  >;
  let modelUpdateDeferred: ReturnType<
    typeof deferred<{ success: boolean; message?: string }>
  >;

  beforeEach(() => {
    statusDeferred = deferred();
    downloadDeferred = deferred();
    modelUpdateDeferred = deferred();
    (window.electronAPI.builtinLlm.getStatus as any).mockImplementation(
      () => statusDeferred.promise,
    );
    (window.electronAPI.builtinLlm.download as any).mockImplementation(
      () => downloadDeferred.promise,
    );
    (window.electronAPI.settings.model.update as any).mockImplementation(
      () => modelUpdateDeferred.promise,
    );
  });

  it('shows a checking state, not 0%, before the download status resolves', async () => {
    renderModelsStep();

    const bars = await screen.findAllByRole('progressbar');
    expect(bars).toHaveLength(2);

    // The LLM bar waits on builtinLlm.getStatus (unresolved in this test) and
    // must show "Checking…" rather than a misleading "0%".
    const llmBar = screen.getByRole('progressbar', {
      name: 'AI Summarization Model',
    });
    expect(llmBar).toHaveAttribute('aria-valuenow', '0');

    const llmRow = llmBar.parentElement as HTMLElement;
    expect(within(llmRow).getByText(/^Checking/)).toBeInTheDocument();
    expect(within(llmRow).queryByText('0%')).not.toBeInTheDocument();
  });

  it('renders bar 1 as complete when the model is already downloaded', async () => {
    statusDeferred.resolve({ downloaded: true, path: '/x' });

    renderModelsStep();

    await waitFor(() => {
      expect(
        screen.getByRole('progressbar', { name: 'AI Summarization Model' }),
      ).toHaveAttribute('aria-valuenow', '100');
    });
  });

  it('does not call download when the model is already downloaded', async () => {
    statusDeferred.resolve({ downloaded: true, path: '/x' });

    renderModelsStep();

    await waitFor(() => {
      expect(
        screen.getByRole('progressbar', { name: 'AI Summarization Model' }),
      ).toHaveAttribute('aria-valuenow', '100');
    });
    expect(window.electronAPI.builtinLlm.download).not.toHaveBeenCalled();
  });

  it("advances bar 1's progressbar on a builtinLlm download progress event", async () => {
    renderModelsStep();

    statusDeferred.resolve({ downloaded: false, path: '' });
    await waitFor(() => {
      expect(window.electronAPI.builtinLlm.download).toHaveBeenCalled();
    });

    const progressCb = getLastCallback(
      window.electronAPI.builtinLlm.on.downloadProgress,
    );

    act(() => {
      progressCb({ downloadedBytes: 50, totalBytes: 200 });
    });

    await waitFor(() => {
      expect(
        screen.getByRole('progressbar', { name: 'AI Summarization Model' }),
      ).toHaveAttribute('aria-valuenow', '25');
    });
  });

  it("advances bar 2's progressbar using the aggregate across per-file transcriber events", async () => {
    renderModelsStep();

    const progressCb = getLastCallback(
      window.electronAPI.transcriber.on.progress,
    );

    // A single event's own `progress` field (100%) would be wrong here — the
    // real aggregate across both files is 100 / (100 + 900) = 10%.
    act(() => {
      progressCb({
        file: 'config.json',
        loaded: 100,
        total: 100,
        progress: 100,
      });
      progressCb({ file: 'encoder.onnx', loaded: 0, total: 900, progress: 0 });
    });

    await waitFor(() => {
      expect(
        screen.getByRole('progressbar', { name: 'Speech Recognition Model' }),
      ).toHaveAttribute('aria-valuenow', '10');
    });
  });

  it('keeps Continue disabled until both downloads resolve, then enables it', async () => {
    const onNext = vi.fn();
    renderModelsStep(onNext);

    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeDisabled();

    statusDeferred.resolve({ downloaded: false, path: '' });
    downloadDeferred.resolve({ success: true });
    modelUpdateDeferred.resolve({ success: true });

    await waitFor(() => {
      expect(continueButton).not.toBeDisabled();
    });

    fireEvent.click(continueButton);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('shows the error message and a Retry control when builtinLlm.download fails', async () => {
    renderModelsStep();

    statusDeferred.resolve({ downloaded: false, path: '' });
    downloadDeferred.resolve({ success: false, message: 'network error' });

    await waitFor(() => {
      expect(screen.getByText('network error')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
