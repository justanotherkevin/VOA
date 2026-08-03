import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export const MODEL_LOAD_TOAST_ID = 'model-load';

export type ModelLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ModelStatusPayload {
  status: ModelLoadStatus;
  model: string | null;
  quantized: boolean | null;
  message?: string;
}

export interface UseModelStatusReturn {
  status: ModelLoadStatus;
  model: string | null;
  quantized: boolean | null;
  ensureReady: () => Promise<void>;
}

export function useModelStatus(): UseModelStatusReturn {
  const [status, setStatus] = useState<ModelLoadStatus>('idle');
  const [model, setModel] = useState<string | null>(null);
  const [quantized, setQuantized] = useState<boolean | null>(null);
  const statusRef = useRef<ModelLoadStatus>('idle');
  // Resolvers for callers awaiting ensureReady(); flushed on the next
  // 'ready' or 'error' push (a load failure must never hang a caller —
  // the error toast already surfaces the failure).
  const waitersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    let cancelled = false;

    window.electronAPI.transcriber.getModelStatus().then((payload) => {
      if (cancelled) return;
      const initial = payload as ModelStatusPayload;
      statusRef.current = initial.status;
      setStatus(initial.status);
      setModel(initial.model);
      setQuantized(initial.quantized);
    });

    // progress_callback fires very frequently during model load — only
    // update the toast on a meaningful percentage change so it doesn't
    // re-render on every tick.
    let lastToastProgress = -1;

    const unsubscribeStatus =
      window.electronAPI.transcriber.on.modelStatusChanged(
        (payload: unknown) => {
          const data = payload as ModelStatusPayload;
          const previous = statusRef.current;
          statusRef.current = data.status;
          setStatus(data.status);
          setModel(data.model);
          setQuantized(data.quantized);

          if (data.status === 'loading') {
            lastToastProgress = -1;
            toast.loading('Loading model…', { id: MODEL_LOAD_TOAST_ID });
          } else if (data.status === 'ready' && previous === 'loading') {
            toast.success('Model ready', { id: MODEL_LOAD_TOAST_ID });
          }

          if (data.status === 'ready' || data.status === 'error') {
            waitersRef.current.forEach((resolve) => resolve());
            waitersRef.current = [];
          }
        },
      );

    const unsubscribeProgress = window.electronAPI.transcriber.on.progress(
      (message: unknown) => {
        const progress = Math.floor((message as any)?.progress ?? 0);
        if (progress >= lastToastProgress + 10) {
          lastToastProgress = progress;
          toast.loading(`Loading model… ${progress}%`, {
            id: MODEL_LOAD_TOAST_ID,
          });
        }
      },
    );

    const unsubscribeError = window.electronAPI.transcriber.on.error(
      (message: unknown) => {
        toast.error(
          (message as any)?.data?.message ??
            (message as any) ??
            'An unknown error occurred.',
          { id: MODEL_LOAD_TOAST_ID },
        );
      },
    );

    return () => {
      cancelled = true;
      unsubscribeStatus();
      unsubscribeProgress();
      unsubscribeError();
    };
  }, []);

  const ensureReady = useCallback((): Promise<void> => {
    // A prior load failure must never hang a caller either — only 'loading'
    // (or the initial 'idle', before any push has arrived) actually waits.
    if (statusRef.current === 'ready' || statusRef.current === 'error') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      waitersRef.current.push(resolve);
    });
  }, []);

  return { status, model, quantized, ensureReady };
}
