import { ipcMain, app, shell, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import {
  getTranscriptHistory,
  clearTranscriptHistory,
  getModelPreferences,
  updateModelPreferences,
  getAppPreferences,
  saveAppPreferences,
  getAudioPreferences,
  saveAudioPreferences,
  getUIPreferences,
  saveUIPreferences,
  type AppPreferences,
  type AudioPreferences,
  type UIPreferences,
} from '../store';
import { listCachedModels, deleteModel, clearAllCache, getCachePaths } from '../model-cache';
import structuredSummarizerService from '../pipeline/structured-summarizer';
import { CHANNELS } from '@/lib/ipc-channels';
import { error as logError, info } from 'electron-log';

export function registerSettingsHandlers() {
  // Transcript History
  ipcMain.handle(CHANNELS.TRANSCRIPT_HISTORY.GET, async () => {
    return getTranscriptHistory();
  });

  ipcMain.handle(CHANNELS.TRANSCRIPT_HISTORY.CLEAR, async () => {
    info('[settings] Clearing transcript history');
    clearTranscriptHistory();
    return { success: true };
  });

  // Model Preferences
  ipcMain.handle(CHANNELS.MODEL.PREFERENCES_GET, async () => {
    return getModelPreferences();
  });

  ipcMain.handle(
    CHANNELS.MODEL.PREFERENCES_UPDATE,
    async (event, preferences: Record<string, any>) => {
      try {
        updateModelPreferences(preferences);
        return { success: true };
      } catch (error) {
        logError('[IPC] Error updating model preferences:', error);
        return { success: false, message: String(error) };
      }
    },
  );

  // Model Cache
  ipcMain.handle(CHANNELS.MODEL.CACHE_LIST, async () => {
    try {
      const models = await listCachedModels();
      return { success: true, models };
    } catch (error) {
      logError('[IPC] Error listing cached models:', error);
      return { success: false, models: [], message: String(error) };
    }
  });

  ipcMain.handle(CHANNELS.MODEL.CACHE_DELETE, async (event, modelName: string, source: 'xenova' | 'hf' = 'xenova') => {
    try {
      const success = await deleteModel(modelName, source);
      return {
        success,
        message: success ? 'Model deleted successfully' : 'Model not found',
      };
    } catch (error) {
      logError('[IPC] Error deleting model:', error);
      return { success: false, message: String(error) };
    }
  });

  ipcMain.handle(CHANNELS.MODEL.CACHE_CLEAR_ALL, async () => {
    try {
      const deletedCount = await clearAllCache();
      return {
        success: true,
        deletedCount,
        message: `Deleted ${deletedCount} model(s)`,
      };
    } catch (error) {
      logError('[IPC] Error clearing cache:', error);
      return { success: false, deletedCount: 0, message: String(error) };
    }
  });

  // App Preferences
  ipcMain.handle(CHANNELS.APP_PREFERENCES.GET, async () => {
    const prefs = getAppPreferences();
    const loginSettings = app.getLoginItemSettings();
    return { ...prefs, launchAtLogin: loginSettings.openAtLogin };
  });

  ipcMain.handle(CHANNELS.APP_PREFERENCES.UPDATE, async (_event, prefs: Partial<AppPreferences>) => {
    try {
      if (typeof prefs.launchAtLogin === 'boolean') {
        app.setLoginItemSettings({ openAtLogin: prefs.launchAtLogin });
      }
      saveAppPreferences(prefs);
      return { success: true };
    } catch (error) {
      logError('[IPC] Error updating app preferences:', error);
      return { success: false, message: String(error) };
    }
  });

  // Audio Preferences
  ipcMain.handle(CHANNELS.AUDIO_PREFERENCES.GET, async () => {
    return getAudioPreferences();
  });

  ipcMain.handle(CHANNELS.AUDIO_PREFERENCES.UPDATE, async (_event, prefs: Partial<AudioPreferences>) => {
    try {
      saveAudioPreferences(prefs);
      return { success: true };
    } catch (error) {
      logError('[IPC] Error updating audio preferences:', error);
      return { success: false, message: String(error) };
    }
  });

  // UI Preferences
  ipcMain.handle(CHANNELS.UI_PREFERENCES.GET, async () => {
    return getUIPreferences();
  });

  ipcMain.handle(CHANNELS.UI_PREFERENCES.UPDATE, async (_event, prefs: Partial<UIPreferences>) => {
    try {
      saveUIPreferences(prefs);
      return { success: true };
    } catch (error) {
      logError('[IPC] Error updating UI preferences:', error);
      return { success: false, message: String(error) };
    }
  });

  // Model Cache Paths
  ipcMain.handle(CHANNELS.MODEL.CACHE_PATHS, async () => {
    return getCachePaths();
  });

  // Summarizer Prefetch
  ipcMain.handle(CHANNELS.MODEL.SUMMARIZER_PREFETCH, async (event: IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender as any);
    const send = (channel: string, payload: unknown) => {
      try { win?.webContents.send(channel, payload); } catch {}
    };
    try {
      await structuredSummarizerService.initialize((data: any) =>
        send(CHANNELS.SUMMARIZER.PROGRESS, data),
      );
      send(CHANNELS.SUMMARIZER.READY, {});
      return { success: true };
    } catch (error) {
      send(CHANNELS.SUMMARIZER.ERROR, String(error));
      return { success: false, message: String(error) };
    }
  });

  // Shell — constrained to known cache dirs only
  ipcMain.handle(CHANNELS.SHELL.OPEN_PATH, async (_event, filePath: string) => {
    const { xenova, hf } = getCachePaths();
    if (filePath !== xenova && filePath !== hf && !filePath.startsWith(hf) && !filePath.startsWith(xenova)) {
      logError('[IPC] Refusing shell.openPath for non-cache path:', filePath);
      return;
    }
    await shell.openPath(filePath);
  });

  // ASR Type Management
  ipcMain.handle(CHANNELS.MODEL.GET_ASR_TYPE, async () => {
    const preferences = getModelPreferences();
    return preferences.asrType || 'whisper';
  });

  ipcMain.handle(CHANNELS.MODEL.SET_ASR_TYPE, async (event, asrType: string) => {
    try {
      if (asrType !== 'whisper' && asrType !== 'parakeet') {
        return {
          success: false,
          message: `Invalid ASR type: ${asrType}. Must be 'whisper' or 'parakeet'.`,
        };
      }

      if (asrType === 'parakeet') {
        return {
          success: false,
          message: 'Parakeet ASR will be available in Phase 3',
        };
      }

      updateModelPreferences({ asrType: asrType as 'whisper' | 'parakeet' });
      return { success: true };
    } catch (error) {
      logError('[IPC] Error updating ASR type:', error);
      return { success: false, message: String(error) };
    }
  });
}
