import { test, expect } from './fixtures';

test('debug: meetingPreferences persistence', async ({ page }) => {
  test.setTimeout(20_000);

  // Wait for electronAPI
  let apiReady = false;
  for (let i = 0; i < 20 && !apiReady; i++) {
    apiReady = await page.evaluate(() => !!(window as any).electronAPI?.updateMeetingPreferences);
    if (!apiReady) await new Promise(r => setTimeout(r, 200));
  }

  const before = await page.evaluate(() => (window as any).electronAPI.getMeetingPreferences());
  console.log('BEFORE:', JSON.stringify(before));

  await page.evaluate(() => (window as any).electronAPI.updateMeetingPreferences({ systemAudioEnabled: true }));
  
  const after = await page.evaluate(() => (window as any).electronAPI.getMeetingPreferences());
  console.log('AFTER update:', JSON.stringify(after));

  await page.reload({ waitUntil: 'networkidle' });

  const afterReload = await page.evaluate(() => (window as any).electronAPI.getMeetingPreferences());
  console.log('AFTER reload:', JSON.stringify(afterReload));
});
