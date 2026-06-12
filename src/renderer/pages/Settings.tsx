import './settings.css';
import React, { useState, useEffect } from 'react';
import {
  Settings2, Sparkles, CircleDot, AudioLines, ShieldCheck, LockKeyhole, Keyboard,
  Search, Plus, Bell, Bookmark, Pause, PictureInPicture2, Speaker, Mic, Volume2,
  Info, SlidersHorizontal, Wind, Users, SunMoon, Palette, Rows3, Power, PanelTop,
  AppWindow, Cpu, Globe, HardDrive, Languages, ArrowLeftRight, Download,
  Folder, Trash2, CalendarClock, ArrowUpRight, ChevronRight, ChevronDown,
  Pencil, RotateCcw, Monitor, Accessibility
} from 'lucide-react';
import { SettingSwitch } from '@/renderer/components/settings/SettingSwitch';
import { SegmentedControl } from '@/renderer/components/settings/SegmentedControl';
import ShortcutConfigDialog from '@/renderer/components/ui/ShortcutConfigDialog';
import { useShortcuts } from '@/renderer/hooks/useShortcuts';
import { usePermissions } from '@/renderer/hooks/usePermissions';
import { APP_NAME, MODEL_META_DATA, CACHED_MODEL_META } from '@/lib/Constants';
import { RECORDING_SHORTCUT } from '@/lib/shortcuts';

type PaneId = 'general' | 'transcription' | 'recording' | 'audio' | 'privacy' | 'permissions' | 'shortcuts';

function MeterDots({ count, filled, variant }: { count: number; filled: number; variant: 'good' | 'warn' }) {
  return (
    <span className="s-meter">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`s-pip${i < filled ? ` s-pip-filled-${variant}` : ''}`} />
      ))}
    </span>
  );
}

function ComingSoon({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div title="Coming soon" aria-disabled="true" style={{ position: 'relative' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{ opacity: 0.45, pointerEvents: 'none', userSelect: 'none' }}>{children}</div>
      {hovered && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.72)', color: '#fff',
          borderRadius: 6, padding: '4px 10px',
          fontSize: 12, fontWeight: 500,
          pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
        }}>
          Coming soon
        </div>
      )}
    </div>
  );
}

function ModelInfoTooltip({ description, children }: { description: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: 'relative', flex: 1, minWidth: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.72)', color: '#fff',
          borderRadius: 6, padding: '6px 12px',
          fontSize: 12, fontWeight: 500,
          pointerEvents: 'none', whiteSpace: 'normal',
          maxWidth: 260, textAlign: 'center', lineHeight: 1.5,
          zIndex: 10,
        }}>
          {description}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [activePane, setActivePane] = useState<PaneId>(() => (localStorage.getItem('ats-pane') as PaneId) || 'recording');

  const goPane = (p: PaneId) => { setActivePane(p); localStorage.setItem('ats-pane', p); };

  const [autoRecordMode, setAutoRecordMode] = useState<'manual' | 'ask' | 'auto' | 'auto-stop'>('manual');
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
  const [watchedApps, setWatchedApps] = useState({ zoom: true, teams: true, meet: true, slack: false });
  const [whileRecording, setWhileRecording] = useState({ floatingRecorder: true, chime: true, pauseOnSilence: false });

  const [uiPrefs, setUiPrefs] = useState({ theme: 'dark' as const, accentLight: '#2f6bed', accentDark: '#4f8cff', density: 'comfortable' as const });
  const [appPrefs, setAppPrefs] = useState({ launchAtLogin: false, showMenuBar: true, showDockIcon: true });
  const [audioPrefs, setAudioPrefs] = useState({ micGain: 62, noiseSuppression: true, labelSpeakers: true });
  const [modelPrefs, setModelPrefs] = useState({ selectedModel: 'Xenova/whisper-tiny', asrType: 'whisper' as const });
  const [cachedModels, setCachedModels] = useState<Array<{ name: string; size: number; path: string; source: 'xenova' | 'hf' }>>([]);
  const [isDeletingModel, setIsDeletingModel] = useState<string | null>(null);
  const [summarizerStatus, setSummarizerStatus] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  // progress: null = file started but percentage unknown (large files saved to HF disk cache)
  const [summarizerProgress, setSummarizerProgress] = useState<Array<{ file: string; progress: number | null }>>([]);
  const [cachePaths, setCachePaths] = useState<{ xenova: string; hf: string } | null>(null);

  const [isShortcutDialogOpen, setIsShortcutDialogOpen] = useState(false);

  const { currentShortcut, isSaving, updateShortcut, resetShortcut } = useShortcuts();
  const { permissions, openSettings: openPermSettings } = usePermissions();

  useEffect(() => {
    const loadAllPrefs = async () => {
      try {
        const [recording, ui, app, audio, model] = await Promise.all([
          window.electronAPI.settings.recording.get(),
          window.electronAPI.settings.ui.get(),
          window.electronAPI.settings.app.get(),
          window.electronAPI.settings.audio.get(),
          window.electronAPI.settings.model.get(),
        ]);

        if (recording) {
          setAutoRecordMode(recording.autoRecordMode || 'manual');
          setSystemAudioEnabled(!!recording.systemAudioEnabled);
        }
        if (ui) {
          setUiPrefs((prev) => ({ ...prev, ...ui }));
          applyTheme({ ...uiPrefs, ...ui });
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

        const cacheRes = await window.electronAPI.settings.model.cache.list();
        if (cacheRes?.success) {
          setCachedModels(cacheRes.models);
          const hasQwen = cacheRes.models.some((m: any) => m.source === 'hf');
          setSummarizerStatus(hasQwen ? 'ready' : 'idle');
        }
        const paths = await window.electronAPI.settings.model.cache.getPaths();
        if (paths) setCachePaths(paths);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadAllPrefs();
  }, []);

  useEffect(() => {
    const refreshModels = () =>
      window.electronAPI.settings.model.cache.list().then((res: any) => {
        if (res?.success) setCachedModels(res.models);
      });

    const unsubProgress = window.electronAPI.summarizer.on.progress((data: any) => {
      if (!data?.file) return;
      // 'initiate'/'download' fire for all files including large ones saved to HF disk cache.
      // Those never emit 'progress' (no byte-level streaming in Node.js file path mode),
      // so we show them with an indeterminate bar (progress: null).
      if (data.status === 'initiate' || data.status === 'download') {
        setSummarizerStatus('downloading');
        setSummarizerProgress((prev) => {
          if (prev.some((p) => p.file === data.file)) return prev;
          return [...prev, { file: data.file, progress: null }];
        });
        return;
      }
      if (data.status === 'progress' && typeof data.progress === 'number') {
        setSummarizerStatus('downloading');
        setSummarizerProgress((prev) => {
          const idx = prev.findIndex((p) => p.file === data.file);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { file: data.file, progress: data.progress };
            return updated;
          }
          return [...prev, { file: data.file, progress: data.progress }];
        });
      }
    });
    const unsubReady = window.electronAPI.summarizer.on.ready(() => {
      setSummarizerStatus('ready');
      setSummarizerProgress([]);
      refreshModels();
    });
    const unsubError = window.electronAPI.summarizer.on.error(() => {
      setSummarizerStatus('error');
      setSummarizerProgress([]);
    });
    return () => { unsubProgress(); unsubReady(); unsubError(); };
  }, []);

  function applyTheme(prefs: typeof uiPrefs) {
    const isDark = prefs.theme === 'dark' || (prefs.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }

  const resolvedTheme = uiPrefs.theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : uiPrefs.theme;

  const accentValue = resolvedTheme === 'dark' ? uiPrefs.accentDark : uiPrefs.accentLight;

  async function updateRecordingPref(key: string, value: unknown) {
    const update = { [key]: value };
    if (key === 'autoRecordMode') setAutoRecordMode(value as any);
    if (key === 'systemAudioEnabled') setSystemAudioEnabled(value as boolean);
    await window.electronAPI.settings.recording.update(update);
  }

  async function updateUIAndApply(key: string, value: string) {
    const newPrefs = { ...uiPrefs, [key]: value };
    setUiPrefs(newPrefs as any);
    applyTheme(newPrefs as any);
    await window.electronAPI.settings.ui.update({ [key]: value });
  }

  async function setAccent(light: string, dark: string) {
    const newPrefs = { ...uiPrefs, accentLight: light, accentDark: dark };
    setUiPrefs(newPrefs);
    applyTheme(newPrefs);
    await window.electronAPI.settings.ui.update({ accentLight: light, accentDark: dark });
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

  async function updateModelPref(key: string, value: unknown) {
    const newPrefs = { ...modelPrefs, [key]: value };
    setModelPrefs(newPrefs as any);
    await window.electronAPI.settings.model.update({ [key]: value });
  }

  function isModelDownloaded(modelPath: string) {
    return cachedModels.some((m) => m.name.toLowerCase().includes(modelPath.split('/')[1]?.toLowerCase() || ''));
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }

  async function handleDeleteModel(model: { name: string; source: 'xenova' | 'hf' }) {
    if (!window.confirm(`Delete ${model.name}?`)) return;
    setIsDeletingModel(model.name);
    try {
      await window.electronAPI.settings.model.cache.delete(model.name, model.source);
      if (model.source === 'hf') setSummarizerStatus('idle');
      const res = await window.electronAPI.settings.model.cache.list();
      if (res?.success) setCachedModels(res.models);
    } finally {
      setIsDeletingModel(null);
    }
  }

  async function handlePrefetchSummarizer() {
    setSummarizerStatus('downloading');
    setSummarizerProgress([]);
    try {
      await window.electronAPI.summarizer.prefetch();
    } catch {
      setSummarizerStatus('error');
      setSummarizerProgress([]);
    }
  }

  async function handleResetShortcut() {
    if (window.confirm('Reset shortcut to default?')) await resetShortcut();
  }

  const accents = [
    { light: '#2f6bed', dark: '#4f8cff' },
    { light: '#6a5cf0', dark: '#8b80ff' },
    { light: '#13a98a', dark: '#2bd0ab' },
    { light: '#e0568a', dark: '#ff7aae' },
  ];

  const sidebarItems: Array<{ id: PaneId; label: string; icon: any; bg: string }> = [
    { id: 'general', label: 'General', icon: Settings2, bg: '#8a8f98' },
    { id: 'transcription', label: 'Transcription', icon: Sparkles, bg: '#7c5cff' },
    { id: 'recording', label: 'Recording', icon: CircleDot, bg: '#ef4d4d' },
    { id: 'audio', label: 'Audio', icon: AudioLines, bg: '#2f6bed' },
    { id: 'privacy', label: 'Privacy & Storage', icon: ShieldCheck, bg: '#1faa4d' },
    { id: 'permissions', label: 'Permissions', icon: LockKeyhole, bg: '#14b3c2' },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, bg: '#f0902e' },
  ];

  return (
    <div
      className={`settings-root settings-${resolvedTheme}${uiPrefs.density === 'compact' ? ' settings-compact' : ''}`}
      style={{
        height: '100%',
        display: 'flex',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        '--s-accent': accentValue,
      } as React.CSSProperties}
    >
      <nav
        style={{
          width: 232,
          background: 'var(--s-sidebar)',
          borderRight: '0.5px solid var(--s-hair)',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <div className="s-search" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: 'var(--s-field)',
          border: '0.5px solid var(--s-field-line)',
          borderRadius: 8,
          padding: '6px 9px',
          marginBottom: 8,
        }}>
          <Search size={14} color="var(--s-text3)" style={{ flexShrink: 0 }} />
          <input
            placeholder="Search settings"
            style={{
              border: 0,
              background: 'transparent',
              outline: 0,
              font: 'inherit',
              fontSize: 13,
              color: 'var(--s-text)',
              width: '100%',
            }}
          />
        </div>

        {sidebarItems.slice(0, 2).map((item) => (
          <button
            key={item.id}
            onClick={() => goPane(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 9px',
              borderRadius: 7,
              fontSize: 13.5,
              fontWeight: 450,
              border: 'none',
              background: activePane === item.id ? 'var(--s-accent)' : 'transparent',
              color: activePane === item.id ? '#fff' : 'var(--s-text2)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: item.bg,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                flexShrink: 0,
                boxShadow: activePane === item.id ? '0 0 0 1px rgba(255,255,255,.25) inset' : 'none',
              }}
            >
              <item.icon size={14} />
            </div>
            <span style={{ color: 'inherit' }}>{item.label}</span>
          </button>
        ))}

        <div style={{ height: 1, background: 'var(--s-hair)', margin: '7px 6px', border: 0 }} />
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--s-text3)', padding: '6px 9px 3px' }}>CAPTURE</div>

        {sidebarItems.slice(2, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => goPane(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 9px',
              borderRadius: 7,
              fontSize: 13.5,
              fontWeight: 450,
              border: 'none',
              background: activePane === item.id ? 'var(--s-accent)' : 'transparent',
              color: activePane === item.id ? '#fff' : 'var(--s-text2)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: item.bg,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                flexShrink: 0,
                boxShadow: activePane === item.id ? '0 0 0 1px rgba(255,255,255,.25) inset' : 'none',
              }}
            >
              <item.icon size={14} />
            </div>
            <span style={{ color: 'inherit' }}>{item.label}</span>
          </button>
        ))}

        <div style={{ height: 1, background: 'var(--s-hair)', margin: '7px 6px', border: 0 }} />
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--s-text3)', padding: '6px 9px 3px' }}>TRUST</div>

        {sidebarItems.slice(4, 6).map((item) => (
          <button
            key={item.id}
            onClick={() => goPane(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 9px',
              borderRadius: 7,
              fontSize: 13.5,
              fontWeight: 450,
              border: 'none',
              background: activePane === item.id ? 'var(--s-accent)' : 'transparent',
              color: activePane === item.id ? '#fff' : 'var(--s-text2)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: item.bg,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                flexShrink: 0,
                boxShadow: activePane === item.id ? '0 0 0 1px rgba(255,255,255,.25) inset' : 'none',
              }}
            >
              <item.icon size={14} />
            </div>
            <span style={{ color: 'inherit' }}>{item.label}</span>
          </button>
        ))}

        <div style={{ height: 1, background: 'var(--s-hair)', margin: '7px 6px', border: 0 }} />

        {sidebarItems.slice(6).map((item) => (
          <button
            key={item.id}
            onClick={() => goPane(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 9px',
              borderRadius: 7,
              fontSize: 13.5,
              fontWeight: 450,
              border: 'none',
              background: activePane === item.id ? 'var(--s-accent)' : 'transparent',
              color: activePane === item.id ? '#fff' : 'var(--s-text2)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: item.bg,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                flexShrink: 0,
                boxShadow: activePane === item.id ? '0 0 0 1px rgba(255,255,255,.25) inset' : 'none',
              }}
            >
              <item.icon size={14} />
            </div>
            <span style={{ color: 'inherit' }}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, overflowY: 'auto', padding: '26px 30px 40px', background: 'var(--s-page)' }}>
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          {activePane === 'recording' && (
            <div className="s-pane">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 680, letterSpacing: '-.2px', margin: 0, color: 'var(--s-text)' }}>Recording</h1>
                <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: '4px 0 0', lineHeight: 1.45 }}>
                  Choose when capture starts and what happens while you record.
                </p>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Auto-record meeting detection</div>
                <div style={{ fontSize: 11.5, color: 'var(--s-text3)', margin: '0 0 10px 3px' }}>detected locally — no bot joins the call</div>
                <div className="s-card-rows">
                  {(['manual', 'ask', 'auto', 'auto-stop'] as const).map((mode) => {
                    const labels = { manual: 'Manual only', ask: 'Ask me', auto: 'Auto-start', 'auto-stop': 'Auto-start & stop' };
                    const descs = {
                      manual: 'Start & stop with the shortcut F1.',
                      ask: 'Show a quick prompt when a meeting is detected.',
                      auto: 'Begin recording the moment a meeting starts.',
                      'auto-stop': 'Also stop when you leave the meeting.',
                    };
                    return (
                      <div
                        key={mode}
                        role="radio"
                        aria-checked={autoRecordMode === mode}
                        tabIndex={0}
                        className={`s-row s-pick${autoRecordMode === mode ? ' s-selected' : ''}`}
                        onClick={() => updateRecordingPref('autoRecordMode', mode)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && updateRecordingPref('autoRecordMode', mode)}
                      >
                        <span className="s-radio" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>{labels[mode]}</div>
                          <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2 }}>{descs[mode]}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Apps to watch</div>
                <ComingSoon>
                <div className="s-card-rows">
                  {[
                    { key: 'zoom' as const, name: 'Zoom', bg: '#2d8cff' },
                    { key: 'teams' as const, name: 'Microsoft Teams', bg: '#5b5fc7' },
                    { key: 'meet' as const, name: 'Google Meet', bg: '#1a9b5b' },
                    { key: 'slack' as const, name: 'Slack huddles', bg: '#611f69' },
                  ].map((app) => (
                    <div key={app.key} className="s-row">
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          background: app.bg,
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 700,
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        {app.name[0]}
                      </div>
                      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>{app.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                        <SettingSwitch
                          checked={watchedApps[app.key]}
                          onChange={(v) => setWatchedApps({ ...watchedApps, [app.key]: v })}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="s-row s-row-btn">
                    <Plus size={17} color="var(--s-accent)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--s-accent)' }}>Add an app…</div>
                  </div>
                </div>
                </ComingSoon>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>While recording</div>
                <ComingSoon>
                <div className="s-card-rows">
                  <div className="s-row">
                    <PictureInPicture2 size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Show floating recorder</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>A small always-on-top capsule with levels & a note field.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch
                        checked={whileRecording.floatingRecorder}
                        onChange={(v) => setWhileRecording({ ...whileRecording, floatingRecorder: v })}
                      />
                    </div>
                  </div>
                  <div className="s-row">
                    <Bell size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Play start / stop chime</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch
                        checked={whileRecording.chime}
                        onChange={(v) => setWhileRecording({ ...whileRecording, chime: v })}
                      />
                    </div>
                  </div>
                  <div className="s-row">
                    <Bookmark size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Mark a moment</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Drop a timestamp you can jump back to.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <span className="s-kbd">⌘</span>
                      <span className="s-kbd">M</span>
                    </div>
                  </div>
                  <div className="s-row">
                    <Pause size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Pause on long silence</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Skip dead air to save space.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch
                        checked={whileRecording.pauseOnSilence}
                        onChange={(v) => setWhileRecording({ ...whileRecording, pauseOnSilence: v })}
                      />
                    </div>
                  </div>
                </div>
                </ComingSoon>
              </div>
            </div>
          )}

          {activePane === 'audio' && (
            <div className="s-pane">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 680, letterSpacing: '-.2px', margin: 0, color: 'var(--s-text)' }}>Audio</h1>
                <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: '4px 0 0', lineHeight: 1.45 }}>
                  What gets captured and how speakers are labelled.
                </p>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Sources</div>
                <div className="s-card-rows">
                  <div className="s-row">
                    <Speaker size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Capture system audio</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Record your mic and the audio from your speakers.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch
                        checked={systemAudioEnabled}
                        onChange={(v) => updateRecordingPref('systemAudioEnabled', v)}
                        accent
                      />
                    </div>
                  </div>
                  <ComingSoon>
                  <div className="s-row">
                    <Mic size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Microphone</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span className="s-select">
                        MacBook Pro Mic <ChevronDown size={13} color="var(--s-text3)" />
                      </span>
                    </div>
                  </div>
                  </ComingSoon>
                  <ComingSoon>
                  <div className="s-row">
                    <Volume2 size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>System output</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span className="s-select">
                        Studio Display <ChevronDown size={13} color="var(--s-text3)" />
                      </span>
                    </div>
                  </div>
                  </ComingSoon>
                </div>
                <div className="s-note">
                  <Info size={13} />
                  System audio capture requires macOS 14 Sonoma or later.
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Input level</div>
                <ComingSoon>
                <div className="s-card-rows">
                  <div className="s-row">
                    <SlidersHorizontal size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Mic gain</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={audioPrefs.micGain}
                        onChange={(e) => updateAudioPref('micGain', +e.target.value)}
                        style={{ width: 120, accentColor: 'var(--s-accent)' }}
                      />
                    </div>
                  </div>
                  <div className="s-row">
                    <Wind size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Noise suppression</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Reduce keyboard clicks and background hum.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch
                        checked={audioPrefs.noiseSuppression}
                        onChange={(v) => updateAudioPref('noiseSuppression', v)}
                      />
                    </div>
                  </div>
                </div>
                </ComingSoon>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Speaker labels</div>
                <ComingSoon>
                <div className="s-card-rows">
                  <div className="s-row">
                    <Users size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Label speakers in transcripts</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Mark each line as You or Others.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch
                        checked={audioPrefs.labelSpeakers}
                        onChange={(v) => updateAudioPref('labelSpeakers', v)}
                      />
                    </div>
                  </div>
                </div>
                </ComingSoon>
              </div>
            </div>
          )}

          {activePane === 'general' && (
            <div className="s-pane">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 680, letterSpacing: '-.2px', margin: 0, color: 'var(--s-text)' }}>General</h1>
                <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: '4px 0 0', lineHeight: 1.45 }}>
                  Appearance and how the app lives on your Mac.
                </p>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Appearance</div>
                <div className="s-card-rows">
                  <div className="s-row">
                    <SunMoon size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Theme</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SegmentedControl
                        options={[
                          { label: 'Light', value: 'light' },
                          { label: 'Dark', value: 'dark' },
                          { label: 'Auto', value: 'auto' },
                        ]}
                        value={uiPrefs.theme}
                        onChange={(v) => updateUIAndApply('theme', v)}
                      />
                    </div>
                  </div>
                  <div className="s-row">
                    <Palette size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Accent color</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {accents.map((a, i) => (
                        <div
                          key={i}
                          className="s-acc-dot"
                          style={{
                            background: resolvedTheme === 'dark' ? a.dark : a.light,
                            outline: (resolvedTheme === 'dark' ? a.dark : a.light) === accentValue ? '2px solid var(--s-text2)' : '2px solid transparent',
                          }}
                          onClick={() => setAccent(a.light, a.dark)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="s-row">
                    <Rows3 size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Density</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SegmentedControl
                        options={[
                          { label: 'Comfortable', value: 'comfortable' },
                          { label: 'Compact', value: 'compact' },
                        ]}
                        value={uiPrefs.density}
                        onChange={(v) => updateUIAndApply('density', v)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Startup</div>
                <div className="s-card-rows">
                  <div className="s-row">
                    <Power size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Launch at login</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch
                        checked={appPrefs.launchAtLogin}
                        onChange={(v) => updateAppPref('launchAtLogin', v)}
                      />
                    </div>
                  </div>
                  <ComingSoon>
                  <div className="s-row">
                    <PanelTop size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Show in menu bar</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Start, stop and jot a note without opening the window.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch
                        checked={appPrefs.showMenuBar}
                        onChange={(v) => updateAppPref('showMenuBar', v)}
                      />
                    </div>
                  </div>
                  </ComingSoon>
                  <ComingSoon>
                  <div className="s-row">
                    <AppWindow size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Show Dock icon</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch
                        checked={appPrefs.showDockIcon}
                        onChange={(v) => updateAppPref('showDockIcon', v)}
                      />
                    </div>
                  </div>
                  </ComingSoon>
                </div>
              </div>
            </div>
          )}

          {activePane === 'transcription' && (
            <div className="s-pane">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 680, letterSpacing: '-.2px', margin: 0, color: 'var(--s-text)' }}>Transcription</h1>
                <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: '4px 0 0', lineHeight: 1.45 }}>
                  The on-device speech model. Everything runs locally on your Mac.
                </p>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Engine</div>
                <div className="s-card-rows">
                  <div className="s-row">
                    <Cpu size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Speech engine</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Whisper is supported today. Parakeet arrives in Phase 3.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SegmentedControl
                        options={[
                          { label: 'Whisper', value: 'whisper' },
                          { label: 'Parakeet', value: 'parakeet', disabled: true },
                        ]}
                        value={modelPrefs.asrType || 'whisper'}
                        onChange={(v) => updateModelPref('asrType', v)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>
                  Model
                  <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--s-text3)' }}>
                    current: Tiny ·{' '}
                    <span className="s-pill s-pill-good">
                      <span className="s-pdot" />
                      Ready
                    </span>
                  </span>
                </div>
                <div className="s-card-rows">
                  {MODEL_META_DATA.map((m) => (
                    <div
                      key={m.model}
                      role="radio"
                      aria-checked={modelPrefs.selectedModel === m.model}
                      tabIndex={0}
                      className={`s-row s-pick${modelPrefs.selectedModel === m.model ? ' s-selected' : ''}`}
                      onClick={() => updateModelPref('selectedModel', m.model)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && updateModelPref('selectedModel', m.model)}
                    >
                      <span className="s-radio" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>{m.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 5, flexWrap: 'wrap' }}>
                          {m.isEnglishOnly && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--s-text2)' }}>
                              <Globe size={12} color="var(--s-text3)" />
                              English
                            </span>
                          )}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--s-text2)' }}>
                            <HardDrive size={12} color="var(--s-text3)" />
                            {m.size}
                          </span>
                          <span style={{ fontSize: 11.5, color: 'var(--s-text2)' }}>
                            Speed <MeterDots count={4} filled={m.speed} variant="good" />
                          </span>
                          <span style={{ fontSize: 11.5, color: 'var(--s-text2)' }}>
                            Accuracy <MeterDots count={4} filled={m.accuracy} variant="warn" />
                          </span>
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {isModelDownloaded(m.model) ? (
                          <span className="s-pill s-pill-good">
                            <span className="s-pdot" />
                            Active
                          </span>
                        ) : (
                          <button
                            className="s-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Download size={13} />
                            Get
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(() => {
                const whisperModels = cachedModels.filter((m) => m.source === 'xenova');
                const qwenModel = cachedModels.find((m) => m.source === 'hf');
                const qwenMeta = CACHED_MODEL_META['Qwen2.5-1.5B-Instruct'];
                const showClearAll = cachedModels.length > 1 || (summarizerStatus === 'ready' && whisperModels.length > 0);

                return (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>
                      AI models
                    </div>
                    <div className="s-card-rows">
                      {/* Qwen row — always visible */}
                      <div className="s-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <ModelInfoTooltip description={qwenMeta.description}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Qwen2.5-1.5B-Instruct</div>
                              <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2 }}>
                                {summarizerStatus === 'ready' && qwenModel
                                  ? `${qwenMeta.subtitle} · ${formatBytes(qwenModel.size)}`
                                  : summarizerStatus === 'downloading'
                                  ? `${qwenMeta.subtitle} · downloading…`
                                  : `${qwenMeta.subtitle}`}
                              </div>
                            </div>
                          </ModelInfoTooltip>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                            {summarizerStatus === 'ready' ? (
                              <button
                                className="s-btn s-btn-danger"
                                onClick={() => handleDeleteModel({ name: 'Qwen2.5-1.5B-Instruct', source: 'hf' })}
                                disabled={isDeletingModel === 'Qwen2.5-1.5B-Instruct'}
                              >
                                {isDeletingModel === 'Qwen2.5-1.5B-Instruct' ? 'Deleting…' : 'Delete'}
                              </button>
                            ) : summarizerStatus === 'downloading' ? (
                              <span style={{ fontSize: 12, color: 'var(--s-text3)' }}>Downloading…</span>
                            ) : summarizerStatus === 'error' ? (
                              <button className="s-btn" onClick={handlePrefetchSummarizer}>
                                <Download size={13} />
                                Retry
                              </button>
                            ) : (
                              <button className="s-btn" onClick={handlePrefetchSummarizer}>
                                <Download size={13} />
                                Download
                              </button>
                            )}
                          </div>
                        </div>
                        {summarizerStatus === 'downloading' && summarizerProgress.length > 0 && (
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {summarizerProgress.map((item) => (
                              <div key={item.file}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--s-text2)', marginBottom: 3 }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{item.file}</span>
                                  <span>{item.progress === null ? '…' : `${Math.round(item.progress)}%`}</span>
                                </div>
                                <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--s-border)', overflow: 'hidden' }}>
                                  {item.progress === null ? (
                                    <div
                                      style={{
                                        height: 4, borderRadius: 2,
                                        background: 'var(--s-accent)',
                                        width: '30%',
                                        animation: 'summarizer-indeterminate 1.4s ease-in-out infinite',
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        height: 4, borderRadius: 2,
                                        background: 'var(--s-accent)',
                                        width: `${item.progress}%`,
                                        transition: 'width 0.2s ease',
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Whisper cached models */}
                      {whisperModels.map((m) => {
                        const meta = CACHED_MODEL_META[m.name];
                        const leftCol = (
                          <>
                            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>{m.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2 }}>
                              {meta ? `${meta.subtitle} · ${formatBytes(m.size)}` : formatBytes(m.size)}
                            </div>
                          </>
                        );
                        return (
                          <div key={m.name} className="s-row">
                            {meta
                              ? <ModelInfoTooltip description={meta.description}>{leftCol}</ModelInfoTooltip>
                              : <div style={{ flex: 1, minWidth: 0 }}>{leftCol}</div>
                            }
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                              <button
                                className="s-btn s-btn-danger"
                                onClick={() => handleDeleteModel(m)}
                                disabled={isDeletingModel === m.name}
                              >
                                {isDeletingModel === m.name ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Clear all */}
                      {showClearAll && (
                        <div
                          className="s-row s-row-btn"
                          onClick={async () => {
                            await window.electronAPI.settings.model.cache.clearAll();
                            setSummarizerStatus('idle');
                            const res = await window.electronAPI.settings.model.cache.list();
                            if (res?.success) setCachedModels(res.models);
                          }}
                        >
                          <Trash2 size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Clear all</div>
                        </div>
                      )}
                    </div>

                    {/* Cache path footer */}
                    {cachePaths && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--s-text3)' }}>
                        <Folder size={12} color="var(--s-text3)" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {cachePaths.hf}
                        </span>
                        <button
                          className="s-btn"
                          style={{ padding: '2px 8px', fontSize: 11.5, flexShrink: 0 }}
                          onClick={() => window.electronAPI.shell.openPath(cachePaths.hf)}
                        >
                          Reveal
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Language</div>
                <ComingSoon>
                <div className="s-card-rows">
                  <div className="s-row">
                    <Languages size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Spoken language</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span className="s-select">
                        English (US) <ChevronDown size={13} color="var(--s-text3)" />
                      </span>
                    </div>
                  </div>
                  <div className="s-row">
                    <ArrowLeftRight size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Translate to English</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch checked={false} onChange={() => {}} />
                    </div>
                  </div>
                </div>
                </ComingSoon>
              </div>
            </div>
          )}

          {activePane === 'privacy' && (
            <div className="s-pane">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 680, letterSpacing: '-.2px', margin: 0, color: 'var(--s-text)' }}>Privacy & Storage</h1>
                <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: '4px 0 0', lineHeight: 1.45 }}>
                  You're in control. Nothing is uploaded.
                </p>
              </div>

              <div className="s-hero" style={{ marginBottom: 22 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--s-good)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 650, color: 'var(--s-text)' }}>Everything stays on your Mac</h3>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--s-text2)', lineHeight: 1.5 }}>
                    Audio is transcribed on-device with a local model — no cloud, no account, and no bot ever joins your meetings. Your recordings never leave this computer.
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Storage</div>
                <div className="s-card-rows">
                  <ComingSoon>
                  <div className="s-row s-row-btn">
                    <Folder size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Library location</div>
                      <code style={{ fontSize: 11, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', background: 'var(--s-tint)', padding: '1px 5px', borderRadius: 4, color: 'var(--s-text2)', marginTop: 2, display: 'inline-block' }}>
                        {`~/Library/Application Support/${APP_NAME}`}
                      </code>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <button className="s-btn">
                        <ArrowUpRight size={13} />
                        Reveal
                      </button>
                    </div>
                  </div>
                  </ComingSoon>
                  <ComingSoon>
                  <div className="s-row">
                    <Trash2 size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Delete audio after transcribing</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Keep only the text. Smallest footprint.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <SettingSwitch checked={false} onChange={() => {}} />
                    </div>
                  </div>
                  </ComingSoon>
                  <ComingSoon>
                  <div className="s-row">
                    <CalendarClock size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Auto-delete recordings</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span className="s-select">
                        After 90 days <ChevronDown size={13} color="var(--s-text3)" />
                      </span>
                    </div>
                  </div>
                  </ComingSoon>
                </div>
                <div className="s-note">
                  <HardDrive size={13} />
                  100 meetings · 1.2 GB of audio · 4.4 MB of transcripts.
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', margin: '0 0 7px 3px' }}>Your data</div>
                <ComingSoon>
                <div className="s-card-rows">
                  <div className="s-row s-row-btn">
                    <Download size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Export everything</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>All transcripts & notes as Markdown.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <ChevronRight size={17} color="var(--s-text3)" />
                    </div>
                  </div>
                  <div className="s-row s-row-btn">
                    <Trash2 size={17} color="var(--s-danger)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-danger)' }}>Delete all data…</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      <ChevronRight size={17} color="var(--s-text3)" />
                    </div>
                  </div>
                </div>
                </ComingSoon>
              </div>
            </div>
          )}

          {activePane === 'permissions' && (
            <div className="s-pane">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 680, letterSpacing: '-.2px', margin: 0, color: 'var(--s-text)' }}>Permissions</h1>
                <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: '4px 0 0', lineHeight: 1.45 }}>
                  macOS access the app needs to capture meetings.
                </p>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div className="s-card-rows">
                  <div className="s-row">
                    <Mic size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Microphone</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Record your voice.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      {permissions.microphone === 'granted' ? (
                        <span className="s-pill s-pill-good">
                          <span className="s-pdot" />
                          Granted
                        </span>
                      ) : permissions.microphone === 'not-determined' ? (
                        <>
                          <span className="s-pill s-pill-warn">
                            <span className="s-pdot" />
                            Not set
                          </span>
                          <button className="s-btn" onClick={() => openPermSettings('microphone')}>
                            Allow
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="s-pill s-pill-danger">
                            <span className="s-pdot" />
                            Denied
                          </span>
                          <button className="s-btn" onClick={() => openPermSettings('microphone')}>
                            Fix
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="s-row">
                    <Accessibility size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Accessibility</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Detect when a meeting app is in a call.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      {permissions.accessibility ? (
                        <span className="s-pill s-pill-good">
                          <span className="s-pdot" />
                          Granted
                        </span>
                      ) : (
                        <>
                          <span className="s-pill s-pill-danger">
                            <span className="s-pdot" />
                            Denied
                          </span>
                          <button className="s-btn" onClick={() => openPermSettings('accessibility')}>
                            Fix
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="s-row">
                    <Monitor size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Screen & system audio</div>
                      <div style={{ fontSize: 12, color: 'var(--s-text2)', marginTop: 2, lineHeight: 1.4 }}>Capture the audio playing through your speakers.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                      {permissions.screenRecording === 'granted' ? (
                        <span className="s-pill s-pill-good">
                          <span className="s-pdot" />
                          Granted
                        </span>
                      ) : permissions.screenRecording === 'not-determined' ? (
                        <>
                          <span className="s-pill s-pill-warn">
                            <span className="s-pdot" />
                            Not set
                          </span>
                          <button className="s-btn" onClick={() => openPermSettings('screenRecording')}>
                            Allow
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="s-pill s-pill-danger">
                            <span className="s-pdot" />
                            Denied
                          </span>
                          <button className="s-btn" onClick={() => openPermSettings('screenRecording')}>
                            Fix
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="s-note">
                  <Info size={13} />
                  Manage these any time in System Settings → Privacy & Security.
                </div>
              </div>
            </div>
          )}

          {activePane === 'shortcuts' && (
            <div className="s-pane">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 680, letterSpacing: '-.2px', margin: 0, color: 'var(--s-text)' }}>Shortcuts</h1>
                <p style={{ fontSize: 13, color: 'var(--s-text2)', margin: '4px 0 0', lineHeight: 1.45 }}>
                  Drive the whole app from the keyboard.
                </p>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div className="s-card-rows">
                  <div className="s-row">
                    <CircleDot size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Start / stop recording</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      {currentShortcut.split('+').map((k, i) => (
                        <span key={i} className="s-kbd">
                          {k}
                        </span>
                      ))}
                      <button className="s-btn" data-testid="customize-shortcut-button" onClick={() => setIsShortcutDialogOpen(true)} disabled={isSaving}>
                        Change
                      </button>
                    </div>
                  </div>
                  <ComingSoon>
                  <div className="s-row">
                    <Bookmark size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Mark a moment</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <span className="s-kbd">⌘</span>
                      <span className="s-kbd">M</span>
                    </div>
                  </div>
                  </ComingSoon>
                  <ComingSoon>
                  <div className="s-row">
                    <Pencil size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Jot a note</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <span className="s-kbd">⌘</span>
                      <span className="s-kbd">⇧</span>
                      <span className="s-kbd">N</span>
                    </div>
                  </div>
                  </ComingSoon>
                  <ComingSoon>
                  <div className="s-row">
                    <Search size={17} color="var(--s-text2)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--s-text)' }}>Search meetings</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <span className="s-kbd">⌘</span>
                      <span className="s-kbd">K</span>
                    </div>
                  </div>
                  </ComingSoon>
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <button
                  className="s-btn"
                  onClick={handleResetShortcut}
                  disabled={isSaving || currentShortcut === RECORDING_SHORTCUT}
                >
                  <RotateCcw size={13} />
                  Reset to defaults
                </button>
              </div>

              <ShortcutConfigDialog
                isOpen={isShortcutDialogOpen}
                currentShortcut={currentShortcut}
                onSave={async (s) => {
                  const ok = await updateShortcut(s);
                  if (ok) setIsShortcutDialogOpen(false);
                }}
                onCancel={() => setIsShortcutDialogOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
