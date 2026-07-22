// Note: src/renderer/components/ui/AIModel.tsx also implements a model
// picker with disabled-state handling, but it isn't rendered anywhere — the
// live UI is Settings.tsx's own inline model list. Fix bugs there, not in
// AIModel.tsx.
import { test, expect } from '@e2e/fixtures';
import { navigateToSettings, wait, pollUntil } from '@e2e/utils/common.helpers';

async function getModelPrefs(page: any): Promise<Record<string, any>> {
  return page.evaluate(() => (window as any).electronAPI.settings.model.get());
}

async function updateModelPrefs(
  page: any,
  partial: Record<string, unknown>,
): Promise<{ success: boolean; message?: string }> {
  return page.evaluate(
    (p: Record<string, unknown>) =>
      (window as any).electronAPI.settings.model.update(p),
    partial,
  );
}

async function installTranscriberEventCapture(page: any): Promise<void> {
  await page.evaluate(() => {
    const api = (window as any).electronAPI.transcriber;
    (window as any).__transcriberEvents = { ready: 0, error: [], progress: 0 };
    api.on.ready(() => {
      (window as any).__transcriberEvents.ready += 1;
    });
    api.on.error((message: any) => {
      (window as any).__transcriberEvents.error.push(message);
    });
    api.on.progress(() => {
      (window as any).__transcriberEvents.progress += 1;
    });
  });
}

async function getTranscriberEvents(
  page: any,
): Promise<{ ready: number; error: any[]; progress: number }> {
  return page.evaluate(() => (window as any).__transcriberEvents);
}

test.describe('Settings — model switch toast lifecycle', () => {
  test('a failing model swap resolves with a transcriber:error broadcast — never stays stuck', async ({
    page,
  }) => {
    test.setTimeout(30_000);

    await pollUntil(
      () =>
        page.evaluate(
          () => !!(window as any).electronAPI?.settings?.model?.update,
        ),
      5_000,
    );

    await installTranscriberEventCapture(page);

    // Fails fast inside whisper-process.ts's pipeline() call with a normal
    // thrown error rather than triggering the flaky BFCArena native crash
    // (docs/whisper-onnxruntime-crash.md) — deterministic failure path.
    const result = await updateModelPrefs(page, {
      selectedModel: 'Xenova/this-model-does-not-exist-e2e-test',
      quantized: false,
    });

    expect(result.success).toBe(false);

    await pollUntil(
      async () => (await getTranscriberEvents(page)).error.length > 0,
      15_000,
    );

    const events = await getTranscriberEvents(page);
    expect(events.ready).toBe(0);
  });

  test('a successful model swap resolves with a transcriber:ready broadcast and persists the preference', async ({
    page,
  }) => {
    test.setTimeout(30_000);

    await pollUntil(
      () =>
        page.evaluate(
          () => !!(window as any).electronAPI?.settings?.model?.update,
        ),
      5_000,
    );

    const before = await getModelPrefs(page);

    await installTranscriberEventCapture(page);

    // Toggles the .en suffix on the same (reliable) tiny model rather than
    // switching model size, so this exercises a real swap deterministically.
    const result = await updateModelPrefs(page, {
      selectedModel: 'Xenova/whisper-tiny',
      quantized: false,
      multilingual: !before.multilingual,
    });

    expect(result.success).toBe(true);

    await pollUntil(
      async () => (await getTranscriberEvents(page)).ready > 0,
      15_000,
    );

    const after = await getModelPrefs(page);
    expect(after.multilingual).toBe(!before.multilingual);

    await updateModelPrefs(page, {
      selectedModel: before.selectedModel,
      quantized: before.quantized,
      multilingual: before.multilingual,
    });
  });
});

test.describe('Settings — disabled models cannot be selected', () => {
  test('Small is rendered disabled and clicking it does not trigger a model update', async ({
    page,
  }) => {
    test.setTimeout(20_000);

    await navigateToSettings(page, 'Transcription');

    const smallRow = page.locator('[role="radio"]', { hasText: 'Small' });
    await expect(smallRow).toBeVisible({ timeout: 5_000 });
    await expect(smallRow).toHaveAttribute('aria-disabled', 'true');
    await expect(smallRow.getByText('Unavailable')).toBeVisible();

    // Spying on the call, rather than only diffing the preference before/
    // after, catches a same-value no-op update that a diff check would miss.
    await page.evaluate(() => {
      (window as any).__modelUpdateCalls = 0;
      const original = (window as any).electronAPI.settings.model.update;
      (window as any).electronAPI.settings.model.update = (...args: any[]) => {
        (window as any).__modelUpdateCalls += 1;
        return original(...args);
      };
    });

    // force: true bypasses Playwright's own actionability check (which
    // already refuses to click aria-disabled elements) to verify the
    // onClick handler's `!m.disabled` guard itself blocks the action.
    await smallRow.click({ force: true });
    await wait(300);

    const calls = await page.evaluate(() => (window as any).__modelUpdateCalls);
    expect(calls).toBe(0);
  });
});
