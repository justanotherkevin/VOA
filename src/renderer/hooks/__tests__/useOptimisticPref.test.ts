import { describe, it, expect, vi } from 'vitest';
import { toast } from 'sonner';
import { applyOptimisticPrefUpdate } from '@/renderer/hooks/useOptimisticPref';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

describe('applyOptimisticPrefUpdate', () => {
  it('sets the next value immediately and keeps it on success', async () => {
    const setValue = vi.fn();

    await applyOptimisticPrefUpdate(
      'previous',
      setValue,
      'next',
      async () => ({ success: true }),
      'fallback message',
    );

    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith('next');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reverts to the previous value and toasts on failure', async () => {
    const setValue = vi.fn();

    await applyOptimisticPrefUpdate(
      'previous',
      setValue,
      'next',
      async () => ({ success: false, message: 'server said no' }),
      'fallback message',
    );

    expect(setValue).toHaveBeenNthCalledWith(1, 'next');
    expect(setValue).toHaveBeenNthCalledWith(2, 'previous');
    expect(toast.error).toHaveBeenCalledWith('server said no');
  });

  it('falls back to the default message when the failure has none', async () => {
    await applyOptimisticPrefUpdate(
      'previous',
      vi.fn(),
      'next',
      async () => ({ success: false }),
      'fallback message',
    );

    expect(toast.error).toHaveBeenCalledWith('fallback message');
  });

  it('does not revert when the IPC call resolves without a result', async () => {
    const setValue = vi.fn();

    await applyOptimisticPrefUpdate(
      'previous',
      setValue,
      'next',
      async () => undefined,
      'fallback message',
    );

    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith('next');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
