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
  getLMStudioPreferences,
  saveLMStudioPreferences,
  type AppPreferences,
  type AudioPreferences,
  type UIPreferences,
  type LMStudioPreferences,
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

  // Summarizer Prefetch — no-op with LM Studio; model lifecycle is external
  ipcMain.handle(CHANNELS.MODEL.SUMMARIZER_PREFETCH, async (event: IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender as any);
    const send = (channel: string, payload: unknown) => {
      try { win?.webContents.send(channel, payload); } catch {}
    };
    try {
      await structuredSummarizerService.initialize();
      send(CHANNELS.SUMMARIZER.READY, {});
      return { success: true };
    } catch (error) {
      send(CHANNELS.SUMMARIZER.ERROR, String(error));
      return { success: false, message: String(error) };
    }
  });

  // Summarizer Submit Chunk — real-time rolling enrichment during recording
  ipcMain.handle(CHANNELS.SUMMARIZER.SUBMIT_CHUNK, async (_event, text: string) => {
    return structuredSummarizerService.submitChunk(text);
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

  // LM Studio Preferences
  ipcMain.handle(CHANNELS.LM_STUDIO.GET, async () => {
    return getLMStudioPreferences();
  });

  ipcMain.handle(CHANNELS.LM_STUDIO.SET, async (_event, prefs: Partial<LMStudioPreferences>) => {
    try {
      saveLMStudioPreferences(prefs);
      return { success: true };
    } catch (error) {
      logError('[IPC] Error saving LM Studio preferences:', error);
      return { success: false, message: String(error) };
    }
  });

  ipcMain.handle(CHANNELS.LM_STUDIO.TEST, async (_event, baseUrl: string) => {
    try {
      const url = new URL(`${baseUrl}/v1/models`);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { ok: false, error: 'Only http:// and https:// URLs are supported' };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      let response: Response;
      try {
        response = await fetch(url.toString(), { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        return { ok: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const json = await response.json();
      const models: string[] = (json?.data ?? []).map((m: { id: string }) => m.id).filter(Boolean);
      return { ok: true, models };
    } catch (error: unknown) {
      const message = (error as any)?.name === 'AbortError'
        ? 'Connection timed out after 3s'
        : ((error as any)?.message ?? String(error));
      return { ok: false, error: message };
    }
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
