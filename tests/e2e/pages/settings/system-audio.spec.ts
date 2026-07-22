import { test, expect } from '@e2e/fixtures';
import {
  getSystemAudioToggle,
  navigateToSettings,
  wait,
  pollUntil,
} from '@e2e/utils/common.helpers';

async function getMeetingPrefs(page: any): Promise<Record<string, any>> {
  return page.evaluate(() =>
    (window as any).electronAPI.settings.recording.get(),
  );
}

async function setSystemAudioEnabled(
  page: any,
  enabled: boolean,
): Promise<void> {
  await pollUntil(() =>
    page.evaluate(
      () => !!(window as any).electronAPI?.settings?.recording?.update,
    ),
  );
  await page.evaluate(
    (val: boolean) =>
      (window as any).electronAPI.settings.recording.update({
        systemAudioEnabled: val,
      }),
    enabled,
  );
}

test.describe('System Audio — Settings toggle', () => {
  test('toggle enables and persists systemAudioEnabled preference', async ({
    page,
  }) => {
    // Navigate away from Settings first so the component remounts fresh and
    // reads current store state on next navigation.
    await page.locator('button[title="Meetings"]').click();
    await setSystemAudioEnabled(page, false);

    await navigateToSettings(page, 'Audio');

    const toggle = await getSystemAudioToggle(page);
    await expect(toggle).toBeVisible({ timeout: 5000 });

    await toggle.click();
    await wait(300);

    const prefs = await getMeetingPrefs(page);
    expect(prefs.systemAudioEnabled).toBe(true);
  });

  test('disabling the toggle persists systemAudioEnabled=false', async ({
    page,
  }) => {
    await page.locator('button[title="Meetings"]').click();
    await setSystemAudioEnabled(page, true);

    await navigateToSettings(page, 'Audio');

    const toggle = await getSystemAudioToggle(page);
    await expect(toggle).toBeVisible({ timeout: 5000 });

    await toggle.click();
    await wait(300);

    const prefs = await getMeetingPrefs(page);
    expect(prefs.systemAudioEnabled).toBe(false);
  });
});
