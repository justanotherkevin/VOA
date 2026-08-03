import React from 'react';
import {
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
  Cpu,
  Download,
  Folder,
  Globe,
  HardDrive,
  Languages,
  Trash2,
} from 'lucide-react';
import { SegmentedControl } from '@/renderer/components/settings/SegmentedControl';
import { SettingSwitch } from '@/renderer/components/settings/SettingSwitch';
import { CACHED_MODEL_META, MODEL_META_DATA } from '@/lib/Constants';
import {
  ComingSoon,
  MeterDots,
  ModelInfoTooltip,
  PaneHeader,
  PickRow,
  SectionLabel,
  SettingRow,
} from './shared';

interface ModelPrefs {
  selectedModel: string;
  asrType: string;
}

interface LmStudioPrefs {
  baseUrl: string;
  model: string;
}

interface LmStudioTestResult {
  ok: boolean;
  models?: string[];
}

interface CachedModel {
  name: string;
  size: number;
  path: string;
}

type SummarizerProvider = 'lmstudio' | 'ollama' | 'builtin';

export function TranscriptionPane({
  modelPrefs,
  updateModelPref,
  isModelDownloaded,
  lmStudioPrefs,
  setLmStudioPrefs,
  lmStudioTestResult,
  setLmStudioTestResult,
  handleLmStudioPrefChange,
  saveLmStudioPrefs,
  handleTestLmStudio,
  lmStudioTesting,
  cachedModels,
  isDeletingModel,
  handleDeleteModel,
  handleClearAllCachedModels,
  cachePaths,
  formatBytes,
  summarizerProvider,
  handleSelectProvider,
  builtinStatus,
  downloadProgress,
  isDownloadingBuiltin,
  handleDownloadBuiltin,
  handleCancelDownload,
  handleDeleteBuiltin,
  pastePrefs,
  updatePastePref,
  runningApps,
  refreshRunningApps,
  platform,
}: {
  modelPrefs: ModelPrefs;
  updateModelPref: (key: string, value: unknown) => Promise<void>;
  isModelDownloaded: (modelPath: string) => boolean;
  lmStudioPrefs: LmStudioPrefs;
  setLmStudioPrefs: React.Dispatch<React.SetStateAction<LmStudioPrefs>>;
  lmStudioTestResult: LmStudioTestResult | null;
  setLmStudioTestResult: (result: LmStudioTestResult | null) => void;
  handleLmStudioPrefChange: (
    key: 'baseUrl' | 'model',
    value: string,
  ) => Promise<void>;
  saveLmStudioPrefs: () => Promise<void>;
  handleTestLmStudio: () => Promise<void>;
  lmStudioTesting: boolean;
  cachedModels: CachedModel[];
  isDeletingModel: string | null;
  handleDeleteModel: (model: { name: string }) => Promise<void>;
  handleClearAllCachedModels: () => Promise<void>;
  cachePaths: string | null;
  formatBytes: (bytes: number) => string;
  summarizerProvider: SummarizerProvider;
  handleSelectProvider: (provider: SummarizerProvider) => Promise<void>;
  builtinStatus: { downloaded: boolean; path: string } | null;
  downloadProgress: { downloadedBytes: number; totalBytes: number } | null;
  isDownloadingBuiltin: boolean;
  handleDownloadBuiltin: () => Promise<void>;
  handleCancelDownload: () => Promise<void>;
  handleDeleteBuiltin: () => Promise<void>;
  pastePrefs: { enabled: boolean; allowedApps: string[] };
  updatePastePref: (
    key: 'enabled' | 'allowedApps',
    value: unknown,
  ) => Promise<void>;
  runningApps: string[];
  refreshRunningApps: () => Promise<void>;
  platform: string;
}) {
  return (
    <div className="s-pane" data-testid="settings-pane-transcription">
      <PaneHeader
        title="Transcription"
        description="The on-device speech model. Everything runs locally on your Mac."
      />

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Engine</SectionLabel>
        <div className="s-card-rows">
          <SettingRow
            icon={Cpu}
            title="Speech engine"
            description="Whisper is supported today. Parakeet arrives in Phase 3."
            actions={
              <SegmentedControl
                options={[
                  { label: 'Whisper', value: 'whisper' },
                  {
                    label: 'Parakeet',
                    value: 'parakeet',
                    disabled: true,
                  },
                ]}
                value={modelPrefs.asrType || 'whisper'}
                onChange={(v) => updateModelPref('asrType', v)}
              />
            }
          />
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div className="s-section-label">
          Model
          <span
            style={{
              marginLeft: 8,
              fontWeight: 400,
              color: 'var(--s-text3)',
            }}
          >
            current: Tiny ·{' '}
            <span className="s-pill s-pill-good">
              <span className="s-pdot" />
              Ready
            </span>
          </span>
        </div>
        <div className="s-card-rows">
          {MODEL_META_DATA.map((m) => (
            <PickRow
              key={m.model}
              testId={`settings-model-option-${m.name.toLowerCase()}`}
              selected={modelPrefs.selectedModel === m.model}
              disabled={m.disabled === true}
              disabledReason={m.disabledReason}
              title={m.name}
              onSelect={() => updateModelPref('selectedModel', m.model)}
              right={
                m.disabled ? (
                  <span className="s-pill s-pill-danger">Unavailable</span>
                ) : isModelDownloaded(m.model) ? (
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
                )
              }
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginTop: 5,
                  flexWrap: 'wrap',
                }}
              >
                {m.isEnglishOnly && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11.5,
                      color: 'var(--s-text2)',
                    }}
                  >
                    <Globe size={12} color="var(--s-text3)" />
                    English
                  </span>
                )}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11.5,
                    color: 'var(--s-text2)',
                  }}
                >
                  <HardDrive size={12} color="var(--s-text3)" />
                  {m.size}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--s-text2)' }}>
                  Speed <MeterDots count={4} filled={m.speed} variant="good" />
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--s-text2)' }}>
                  Accuracy{' '}
                  <MeterDots count={4} filled={m.accuracy} variant="warn" />
                </span>
              </div>
            </PickRow>
          ))}
        </div>
      </div>

      {/* AI Provider */}
      <div style={{ marginBottom: 22 }}>
        <SectionLabel>AI Provider</SectionLabel>
        <div className="s-card-rows">
          <SettingRow
            icon={Globe}
            title="Provider"
            description={
              summarizerProvider === 'builtin'
                ? 'Runs fully on-device, no external server required'
                : 'Preset or enter a custom URL below'
            }
            actions={
              <SegmentedControl
                options={[
                  { label: 'Built-in', value: 'builtin' },
                  { label: 'LM Studio', value: 'lmstudio' },
                  {
                    label: 'Ollama',
                    value: 'ollama',
                    disabled: true,
                    tooltip: 'Coming soon',
                  },
                ]}
                value={summarizerProvider}
                onChange={(v) => handleSelectProvider(v as SummarizerProvider)}
              />
            }
          />

          {summarizerProvider === 'builtin' ? (
            <div className="s-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                {builtinStatus?.downloaded ? (
                  <span className="s-pill s-pill-good">
                    <span className="s-pdot" />
                    Ready
                  </span>
                ) : isDownloadingBuiltin ? (
                  <span style={{ fontSize: 12.5, color: 'var(--s-text2)' }}>
                    {downloadProgress && downloadProgress.totalBytes > 0
                      ? `Downloading… ${Math.round((downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100)}%`
                      : 'Downloading…'}
                  </span>
                ) : (
                  <span style={{ fontSize: 12.5, color: 'var(--s-text2)' }}>
                    ~1.1GB, downloads once
                  </span>
                )}
              </div>
              {builtinStatus?.downloaded ? (
                <button
                  className="s-btn s-btn-danger"
                  onClick={handleDeleteBuiltin}
                >
                  Delete
                </button>
              ) : isDownloadingBuiltin ? (
                <button className="s-btn" onClick={handleCancelDownload}>
                  Cancel
                </button>
              ) : (
                <button className="s-btn" onClick={handleDownloadBuiltin}>
                  <Download size={13} />
                  Download
                </button>
              )}
            </div>
          ) : (
            <>
              <SettingRow
                icon={ArrowUpRight}
                title="Base URL"
                actions={
                  <input
                    value={lmStudioPrefs.baseUrl}
                    onChange={(e) => {
                      setLmStudioPrefs((prev) => ({
                        ...prev,
                        baseUrl: e.target.value,
                      }));
                      setLmStudioTestResult(null);
                    }}
                    onBlur={saveLmStudioPrefs}
                    style={{
                      width: 210,
                      background: 'var(--s-field)',
                      border: '0.5px solid var(--s-field-line)',
                      borderRadius: 7,
                      padding: '4px 9px',
                      fontSize: 12.5,
                      color: 'var(--s-text)',
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                      outline: 'none',
                    }}
                  />
                }
              />
              <SettingRow
                icon={Cpu}
                title="Model"
                description="Leave empty to use loaded model"
                actions={
                  <input
                    value={lmStudioPrefs.model}
                    onChange={(e) =>
                      setLmStudioPrefs((prev) => ({
                        ...prev,
                        model: e.target.value,
                      }))
                    }
                    onBlur={saveLmStudioPrefs}
                    placeholder="e.g. qwen2.5-1.5b-instruct"
                    style={{
                      width: 210,
                      background: 'var(--s-field)',
                      border: '0.5px solid var(--s-field-line)',
                      borderRadius: 7,
                      padding: '4px 9px',
                      fontSize: 12.5,
                      color: 'var(--s-text)',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                }
              />
              <div className="s-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  {lmStudioTestResult !== null &&
                    (lmStudioTestResult.ok ? (
                      <span className="s-pill s-pill-good">
                        <span className="s-pdot" />
                        {`Connected — ${lmStudioTestResult.models?.length ?? 0} model${(lmStudioTestResult.models?.length ?? 0) !== 1 ? 's' : ''} available`}
                      </span>
                    ) : (
                      <span className="s-pill s-pill-danger">
                        <span className="s-pdot" />
                        Unreachable — is LM Studio running?
                      </span>
                    ))}
                </div>
                <button
                  className="s-btn"
                  onClick={handleTestLmStudio}
                  disabled={lmStudioTesting}
                >
                  {lmStudioTesting ? 'Testing…' : 'Test Connection'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cached Whisper models */}
      {cachedModels.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionLabel>AI models</SectionLabel>
          <div className="s-card-rows">
            {cachedModels.map((m) => {
              const meta = CACHED_MODEL_META[m.name];
              const leftCol = (
                <>
                  <div className="s-row-title">{m.name}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--s-text2)',
                      marginTop: 2,
                    }}
                  >
                    {meta
                      ? `${meta.subtitle} · ${formatBytes(m.size)}`
                      : formatBytes(m.size)}
                  </div>
                </>
              );
              return (
                <div key={m.name} className="s-row">
                  {meta ? (
                    <ModelInfoTooltip description={meta.description}>
                      {leftCol}
                    </ModelInfoTooltip>
                  ) : (
                    <div style={{ flex: 1, minWidth: 0 }}>{leftCol}</div>
                  )}
                  <div className="s-row-actions">
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
            {cachedModels.length > 1 && (
              <div
                className="s-row s-row-btn"
                onClick={handleClearAllCachedModels}
              >
                <Trash2
                  size={17}
                  color="var(--s-text2)"
                  style={{ flexShrink: 0 }}
                />
                <div
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: 'var(--s-text)',
                  }}
                >
                  Clear all
                </div>
              </div>
            )}
          </div>
          {cachePaths && (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11.5,
                color: 'var(--s-text3)',
              }}
            >
              <Folder
                size={12}
                color="var(--s-text3)"
                style={{ flexShrink: 0 }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {cachePaths}
              </span>
              <button
                className="s-btn"
                style={{
                  padding: '2px 8px',
                  fontSize: 11.5,
                  flexShrink: 0,
                }}
                onClick={() => window.electronAPI.shell.openPath(cachePaths!)}
              >
                Reveal
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Language</SectionLabel>
        <ComingSoon>
          <div className="s-card-rows">
            <SettingRow
              icon={Languages}
              title="Spoken language"
              actionsGap={6}
              actions={
                <span className="s-select">
                  English (US) <ChevronDown size={13} color="var(--s-text3)" />
                </span>
              }
            />
            <SettingRow
              icon={ArrowLeftRight}
              title="Translate to English"
              actions={<SettingSwitch checked={false} onChange={() => {}} />}
            />
          </div>
        </ComingSoon>
      </div>

      {platform === 'darwin' && (
        <div style={{ marginBottom: 22 }}>
          <SectionLabel>Paste on Complete</SectionLabel>
          <div className="s-card-rows">
            <SettingRow
              title="Paste transcript into active app when dictation completes"
              description="Only pastes when the focused app is checked below."
              actions={
                <SettingSwitch
                  checked={pastePrefs.enabled}
                  onChange={(v) => updatePastePref('enabled', v)}
                />
              }
            />
            {pastePrefs.enabled && (
              <>
                <SettingRow
                  title="Allowed apps"
                  actions={
                    <button
                      className="s-btn"
                      onClick={() => refreshRunningApps()}
                    >
                      Refresh
                    </button>
                  }
                />
                {Array.from(
                  new Set([...runningApps, ...pastePrefs.allowedApps]),
                ).map((appName) => (
                  <SettingRow
                    key={appName}
                    title={appName}
                    actions={
                      <SettingSwitch
                        checked={pastePrefs.allowedApps.includes(appName)}
                        onChange={(checked) => {
                          const nextAllowed = checked
                            ? [...pastePrefs.allowedApps, appName]
                            : pastePrefs.allowedApps.filter(
                                (a) => a !== appName,
                              );
                          updatePastePref('allowedApps', nextAllowed);
                        }}
                      />
                    }
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
