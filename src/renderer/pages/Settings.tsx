import './settings.css';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useShortcuts } from '@/renderer/hooks/useShortcuts';
import { usePermissions } from '@/renderer/hooks/usePermissions';
import { useAudioDevices } from '@/renderer/hooks/useAudioDevices';
import { useSettingsNavContext } from '@/renderer/hooks/useSettingsNavContext';
import { useUIPreferencesContext } from '@/renderer/hooks/useUIPreferencesContext';
import { RecordingPane } from './settings/RecordingPane';
import { AudioPane } from './settings/AudioPane';
import { GeneralPane } from './settings/GeneralPane';
import { TranscriptionPane } from './settings/TranscriptionPane';
import { PrivacyPane } from './settings/PrivacyPane';
import { PermissionsPane } from './settings/PermissionsPane';
import { ShortcutsPane } from './settings/ShortcutsPane';
import { CalendarPane } from './settings/CalendarPane';

export default function Settings() {
  const { activePane } = useSettingsNavContext();

  const [autoRecordMode, setAutoRecordMode] = useState<
    'manual' | 'ask' | 'auto' | 'auto-stop'
  >('manual');
  const [systemAudioSupported, setSystemAudioSupported] = useState(false);
  const [watchedApps, setWatchedApps] = useState({
    zoom: true,
    teams: true,
    meet: true,
    slack: false,
  });
  const [whileRecording, setWhileRecording] = useState({
    floatingRecorder: true,
    chime: true,
    pauseOnSilence: false,
  });

  const {
    uiPrefs,
    resolvedTheme,
    accentValue,
    updateUIAndApply,
    setAccent,
    accents,
  } = useUIPreferencesContext();

  const [appPrefs, setAppPrefs] = useState({
    launchAtLogin: false,
    showMenuBar: true,
    showDockIcon: true,
  });
  const [audioPrefs, setAudioPrefs] = useState<{
    micGain: number;
    noiseSuppression: boolean;
    labelSpeakers: boolean;
    selectedMicDeviceId?: string;
  }>({
    micGain: 62,
    noiseSuppression: true,
    labelSpeakers: true,
  });
  const { microphones, defaultOutputLabel, labelsAvailable } =
    useAudioDevices();
  const [modelPrefs, setModelPrefs] = useState({
    selectedModel: 'Xenova/whisper-tiny',
    asrType: 'whisper' as const,
  });
  const [cachedModels, setCachedModels] = useState<
    Array<{ name: string; size: number; path: string }>
  >([]);
  const [isDeletingModel, setIsDeletingModel] = useState<string | null>(null);
  const [cachePaths, setCachePaths] = useState<string | null>(null);
  const [lmStudioPrefs, setLmStudioPrefs] = useState({
    baseUrl: 'http://localhost:1234',
    model: '',
  });
  const [lmStudioTestResult, setLmStudioTestResult] = useState<{
    ok: boolean;
    models?: string[];
  } | null>(null);
  const [lmStudioTesting, setLmStudioTesting] = useState(false);
  const [pastePrefs, setPastePrefs] = useState<{
    enabled: boolean;
    allowedApps: string[];
  }>({ enabled: false, allowedApps: [] });
  const [runningApps, setRunningApps] = useState<string[]>([]);

  const [summarizerProvider, setSummarizerProvider] = useState<
    'lmstudio' | 'ollama' | 'builtin'
  >('builtin');
  const [builtinStatus, setBuiltinStatus] = useState<{
    downloaded: boolean;
    path: string;
  } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    downloadedBytes: number;
    totalBytes: number;
  } | null>(null);
  const [isDownloadingBuiltin, setIsDownloadingBuiltin] = useState(false);

  const [calendarPrefs, setCalendarPrefs] = useState({ feedUrl: '' });
  const [calendarTestResult, setCalendarTestResult] = useState<{
    success: boolean;
    eventCount?: number;
    message?: string;
  } | null>(null);
  const [calendarTesting, setCalendarTesting] = useState(false);

  const [isShortcutDialogOpen, setIsShortcutDialogOpen] = useState(false);
  const [isDictationShortcutDialogOpen, setIsDictationShortcutDialogOpen] =
    useState(false);

  const { currentShortcut, isSaving, updateShortcut, resetShortcut } =
    useShortcuts('recording');
  const {
    currentShortcut: currentDictationShortcut,
    isSaving: isDictationSaving,
    updateShortcut: updateDictationShortcut,
    resetShortcut: resetDictationShortcut,
  } = useShortcuts('dictation');
  const { permissions, openSettings: openPermSettings } = usePermissions();

  useEffect(() => {
    window.electronAPI.audio.getCapability().then(setSystemAudioSupported);
  }, []);

  useEffect(() => {
    const loadAllPrefs = async () => {
      try {
        const [recording, app, audio, model, paste] = await Promise.all([
          window.electronAPI.settings.recording.get(),
          window.electronAPI.settings.app.get(),
          window.electronAPI.settings.audio.get(),
          window.electronAPI.settings.model.get(),
          window.electronAPI.settings.paste.get(),
        ]);

        if (recording) {
          setAutoRecordMode(recording.autoRecordMode || 'manual');
        }
        if (app) {
          setAppPrefs((prev) => ({ ...prev, ...app }));
        }
        if (audio) {
          setAudioPrefs((prev) => ({ ...prev, ...audio }));
        }
        if (model) {
          setModelPrefs((prev) => ({ ...prev, ...model }));
        }
        if (paste) {
          setPastePrefs((prev) => ({ ...prev, ...paste }));
        }

        const apps = await window.electronAPI.settings.paste.listRunningApps();
        if (apps) setRunningApps(apps);

        const cacheRes = await window.electronAPI.settings.model.cache.list();
        if (cacheRes?.success) setCachedModels(cacheRes.models);
        const paths = await window.electronAPI.settings.model.cache.getPaths();
        if (paths) setCachePaths(paths);
        const lmPrefs = await window.electronAPI.lmStudio.getPreferences();
        if (lmPrefs) setLmStudioPrefs((prev) => ({ ...prev, ...lmPrefs }));
        const calPrefs = await window.electronAPI.calendar.getPreferences();
        if (calPrefs) setCalendarPrefs((prev) => ({ ...prev, ...calPrefs }));

        const provider = await window.electronAPI.summarizerProvider.get();
        if (provider) setSummarizerProvider(provider);
        const status = await window.electronAPI.builtinLlm.getStatus();
        if (status) setBuiltinStatus(status);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadAllPrefs();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI.builtinLlm.on.downloadProgress(
      (progress: unknown) => {
        setDownloadProgress(
          progress as { downloadedBytes: number; totalBytes: number },
        );
      },
    );
    return unsubscribe;
  }, []);

  async function updateRecordingPref(key: string, value: unknown) {
    const update = { [key]: value };
    if (key === 'autoRecordMode') setAutoRecordMode(value as any);
    await window.electronAPI.settings.recording.update(update);
  }

  async function updateAppPref(key: string, value: unknown) {
    const newPrefs = { ...appPrefs, [key]: value };
    setAppPrefs(newPrefs);
    await window.electronAPI.settings.app.update({ [key]: value });
  }

  async function updateAudioPref(key: string, value: unknown) {
    const newPrefs = { ...audioPrefs, [key]: value };
    setAudioPrefs(newPrefs);
    await window.electronAPI.settings.audio.update({ [key]: value });
  }

  async function updatePastePref(key: 'enabled' | 'allowedApps', value: unknown) {
    const newPrefs = { ...pastePrefs, [key]: value };
    setPastePrefs(newPrefs);
    await window.electronAPI.settings.paste.update({ [key]: value });
  }

  async function refreshRunningApps() {
    const apps = await window.electronAPI.settings.paste.listRunningApps();
    if (apps) setRunningApps(apps);
  }

  async function updateModelPref(key: string, value: unknown) {
    const previousPrefs = modelPrefs;
    const newPrefs = { ...modelPrefs, [key]: value };
    setModelPrefs(newPrefs as any);

    const result = await window.electronAPI.settings.model.update({
      [key]: value,
    });
    if (!result?.success) {
      // Revert the optimistic update — the backend rejected the change
      // (e.g. a model swap while recording, or a failed model load). The
      // "model-load" toast (fed by transcriber:progress broadcasts) is
      // resolved separately via the transcriber:error broadcast this same
      // failure triggers — see ipc/settings.ts.
      setModelPrefs(previousPrefs);
      toast.error(result?.message || 'Failed to update model preference');
    }
  }

  function isModelDownloaded(modelPath: string) {
    return cachedModels.some((m) =>
      m.name
        .toLowerCase()
        .includes(modelPath.split('/')[1]?.toLowerCase() || ''),
    );
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }

  async function handleDeleteModel(model: { name: string }) {
    if (!window.confirm(`Delete ${model.name}?`)) return;
    setIsDeletingModel(model.name);
    try {
      await window.electronAPI.settings.model.cache.delete(model.name);
      const res = await window.electronAPI.settings.model.cache.list();
      if (res?.success) setCachedModels(res.models);
    } finally {
      setIsDeletingModel(null);
    }
  }

  async function handleClearAllCachedModels() {
    await window.electronAPI.settings.model.cache.clearAll();
    const res = await window.electronAPI.settings.model.cache.list();
    if (res?.success) setCachedModels(res.models);
  }

  async function handleLmStudioPrefChange(
    key: 'baseUrl' | 'model',
    value: string,
  ) {
    const updated = { ...lmStudioPrefs, [key]: value };
    setLmStudioPrefs(updated);
    setLmStudioTestResult(null);
    await window.electronAPI.lmStudio.savePreferences(updated);
  }

  async function saveLmStudioPrefs() {
    await window.electronAPI.lmStudio.savePreferences(lmStudioPrefs);
  }

  async function handleTestLmStudio() {
    setLmStudioTesting(true);
    setLmStudioTestResult(null);
    try {
      const result = await window.electronAPI.lmStudio.testConnection(
        lmStudioPrefs.baseUrl,
      );
      setLmStudioTestResult(result ?? { ok: false });
    } catch {
      setLmStudioTestResult({ ok: false });
    } finally {
      setLmStudioTesting(false);
    }
  }

  async function handleSelectProvider(
    provider: 'lmstudio' | 'ollama' | 'builtin',
  ) {
    const previous = summarizerProvider;
    setSummarizerProvider(provider);
    const result = await window.electronAPI.summarizerProvider.set(provider);
    if (!result?.success) {
      setSummarizerProvider(previous);
      toast.error(result?.message || 'Failed to update AI provider');
    }
  }

  async function handleDownloadBuiltin() {
    setIsDownloadingBuiltin(true);
    setDownloadProgress(null);
    try {
      const result = await window.electronAPI.builtinLlm.download();
      if (!result?.success) {
        toast.error(result?.message || 'Failed to download built-in model');
      }
      const status = await window.electronAPI.builtinLlm.getStatus();
      if (status) setBuiltinStatus(status);
    } finally {
      setIsDownloadingBuiltin(false);
      setDownloadProgress(null);
    }
  }

  async function handleCancelDownload() {
    await window.electronAPI.builtinLlm.cancelDownload();
  }

  async function handleDeleteBuiltin() {
    if (!window.confirm('Delete the built-in AI model?')) return;
    const result = await window.electronAPI.builtinLlm.delete();
    if (!result?.success) {
      toast.error(result?.message || 'Failed to delete built-in model');
    }
    const status = await window.electronAPI.builtinLlm.getStatus();
    if (status) setBuiltinStatus(status);
  }

  async function handleCalendarFeedUrlChange(value: string) {
    setCalendarPrefs({ feedUrl: value });
    setCalendarTestResult(null);
  }

  async function saveCalendarPrefs() {
    await window.electronAPI.calendar.savePreferences(calendarPrefs);
  }

  async function handleTestCalendarConnection() {
    setCalendarTesting(true);
    setCalendarTestResult(null);
    try {
      const result = await window.electronAPI.calendar.testConnection(
        calendarPrefs.feedUrl,
      );
      setCalendarTestResult(result ?? { success: false });
    } catch {
      setCalendarTestResult({ success: false });
    } finally {
      setCalendarTesting(false);
    }
  }

  async function handleResetShortcut() {
    if (window.confirm('Reset shortcuts to defaults?')) {
      await resetShortcut();
      await resetDictationShortcut();
    }
  }

  return (
    <div
      className={`settings-root settings-${resolvedTheme}${uiPrefs.density === 'compact' ? ' settings-compact' : ''}`}
      style={
        {
          height: '100%',
          display: 'flex',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          '--s-accent': accentValue,
        } as React.CSSProperties
      }
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '26px 30px 40px',
          background: 'var(--s-page)',
        }}
      >
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          {activePane === 'recording' && (
            <RecordingPane
              autoRecordMode={autoRecordMode}
              updateRecordingPref={updateRecordingPref}
              watchedApps={watchedApps}
              setWatchedApps={setWatchedApps}
              whileRecording={whileRecording}
              setWhileRecording={setWhileRecording}
            />
          )}

          {activePane === 'audio' && (
            <AudioPane
              systemAudioSupported={systemAudioSupported}
              audioPrefs={audioPrefs}
              updateAudioPref={updateAudioPref}
              microphones={microphones}
              defaultOutputLabel={defaultOutputLabel}
              labelsAvailable={labelsAvailable}
            />
          )}

          {activePane === 'general' && (
            <GeneralPane
              uiPrefs={uiPrefs}
              updateUIAndApply={updateUIAndApply}
              resolvedTheme={resolvedTheme}
              accentValue={accentValue}
              setAccent={setAccent}
              accents={accents}
              appPrefs={appPrefs}
              updateAppPref={updateAppPref}
            />
          )}

          {activePane === 'transcription' && (
            <TranscriptionPane
              modelPrefs={modelPrefs}
              updateModelPref={updateModelPref}
              isModelDownloaded={isModelDownloaded}
              lmStudioPrefs={lmStudioPrefs}
              setLmStudioPrefs={setLmStudioPrefs}
              lmStudioTestResult={lmStudioTestResult}
              setLmStudioTestResult={setLmStudioTestResult}
              handleLmStudioPrefChange={handleLmStudioPrefChange}
              saveLmStudioPrefs={saveLmStudioPrefs}
              handleTestLmStudio={handleTestLmStudio}
              lmStudioTesting={lmStudioTesting}
              cachedModels={cachedModels}
              isDeletingModel={isDeletingModel}
              handleDeleteModel={handleDeleteModel}
              handleClearAllCachedModels={handleClearAllCachedModels}
              cachePaths={cachePaths}
              formatBytes={formatBytes}
              summarizerProvider={summarizerProvider}
              handleSelectProvider={handleSelectProvider}
              builtinStatus={builtinStatus}
              downloadProgress={downloadProgress}
              isDownloadingBuiltin={isDownloadingBuiltin}
              handleDownloadBuiltin={handleDownloadBuiltin}
              handleCancelDownload={handleCancelDownload}
              handleDeleteBuiltin={handleDeleteBuiltin}
              pastePrefs={pastePrefs}
              updatePastePref={updatePastePref}
              runningApps={runningApps}
              refreshRunningApps={refreshRunningApps}
              platform={window.electronAPI.platform}
            />
          )}

          {activePane === 'privacy' && <PrivacyPane />}

          {activePane === 'permissions' && (
            <PermissionsPane
              permissions={permissions}
              openPermSettings={openPermSettings}
            />
          )}

          {activePane === 'shortcuts' && (
            <ShortcutsPane
              currentShortcut={currentShortcut}
              isSaving={isSaving}
              updateShortcut={updateShortcut}
              currentDictationShortcut={currentDictationShortcut}
              isDictationSaving={isDictationSaving}
              updateDictationShortcut={updateDictationShortcut}
              handleResetShortcut={handleResetShortcut}
              isShortcutDialogOpen={isShortcutDialogOpen}
              setIsShortcutDialogOpen={setIsShortcutDialogOpen}
              isDictationShortcutDialogOpen={isDictationShortcutDialogOpen}
              setIsDictationShortcutDialogOpen={
                setIsDictationShortcutDialogOpen
              }
            />
          )}

          {activePane === 'calendar' && (
            <CalendarPane
              calendarPrefs={calendarPrefs}
              handleCalendarFeedUrlChange={handleCalendarFeedUrlChange}
              saveCalendarPrefs={saveCalendarPrefs}
              calendarTestResult={calendarTestResult}
              calendarTesting={calendarTesting}
              handleTestCalendarConnection={handleTestCalendarConnection}
            />
          )}
        </div>
      </div>
    </div>
  );
}
