import { ipcMain } from 'electron';
import * as ical from 'node-ical';
import {
  getCalendarPreferences,
  saveCalendarPreferences,
  type CalendarPreferences,
} from '../store';
import { CHANNELS } from '@/lib/ipc-channels';
import { error as logError } from 'electron-log';
import transcriberService from '../services/transcriber';

const TEST_CONNECTION_TIMEOUT_MS = 5000;

export function registerCalendarHandlers() {
  ipcMain.handle(CHANNELS.CALENDAR.GET_PREFERENCES, async () => {
    return getCalendarPreferences();
  });

  ipcMain.handle(
    CHANNELS.CALENDAR.SET_PREFERENCES,
    async (_event, prefs: Partial<CalendarPreferences>) => {
      try {
        saveCalendarPreferences(prefs);
        return { success: true };
      } catch (error) {
        logError('[IPC] Error saving calendar preferences:', error);
        return { success: false, message: String(error) };
      }
    },
  );

  ipcMain.handle(
    CHANNELS.CALENDAR.TEST_CONNECTION,
    async (_event, feedUrl: string) => {
      try {
        const url = new URL(feedUrl);
        if (!['http:', 'https:', 'webcal:'].includes(url.protocol)) {
          return {
            success: false,
            message: 'Only http://, https://, or webcal:// URLs are supported',
          };
        }
        const normalizedUrl =
          url.protocol === 'webcal:'
            ? feedUrl.replace(/^webcal:/, 'https:')
            : feedUrl;

        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          TEST_CONNECTION_TIMEOUT_MS,
        );
        let data: ical.CalendarResponse;
        try {
          // node-ical's .d.ts resolves the (url, options) overload to the
          // callback-style `void` signature instead of the Promise-returning
          // one — the runtime supports options + a Promise return (per its
          // README), the type declarations just don't express that overload.
          data = (await ical.async.fromURL(normalizedUrl, {
            signal: controller.signal,
          })) as unknown as ical.CalendarResponse;
        } finally {
          clearTimeout(timeout);
        }

        const eventCount = Object.values(data).filter(
          (item) => (item as { type?: unknown })?.type === 'VEVENT',
        ).length;
        return { success: true, eventCount };
      } catch (error) {
        logError('[IPC] Error testing calendar connection:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(CHANNELS.CALENDAR.DECLINE_MATCH, async () => {
    transcriberService.declineCalendarMatch();
    return { success: true };
  });

  ipcMain.handle(CHANNELS.CALENDAR.SELECT_MATCH, async (_event, id: string) => {
    transcriberService.selectCalendarMatch(id);
    return { success: true };
  });
}
