import { toast } from 'sonner';

interface OptimisticUpdateResult {
  success: boolean;
  message?: string;
}

// Applies a renderer-side pref update optimistically: sets state immediately,
// then reverts to `previous` and shows a toast if the IPC call reports
// failure. Used by Settings.tsx's per-pref update handlers so each one
// doesn't repeat the same snapshot/set/await/revert sequence.
export async function applyOptimisticPrefUpdate<T>(
  previous: T,
  setValue: (value: T) => void,
  next: T,
  ipcUpdate: () => Promise<OptimisticUpdateResult | undefined | void>,
  fallbackMessage: string,
): Promise<void> {
  setValue(next);
  const result = await ipcUpdate();
  if (result && result.success === false) {
    setValue(previous);
    toast.error(result.message || fallbackMessage);
  }
}
