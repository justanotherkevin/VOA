import {
  ChevronDown,
  Mic,
  SlidersHorizontal,
  Speaker,
  Users,
  Volume2,
  Wind,
} from 'lucide-react';
import { SettingSwitch } from '@/renderer/components/settings/SettingSwitch';
import type { AudioInputDevice } from '@/renderer/hooks/useAudioDevices';
import { ComingSoon, PaneHeader, SectionLabel, SettingRow } from './shared';

interface AudioPrefs {
  micGain: number;
  noiseSuppression: boolean;
  labelSpeakers: boolean;
  selectedMicDeviceId?: string;
}

export function AudioPane({
  systemAudioSupported,
  audioPrefs,
  updateAudioPref,
  microphones,
  defaultOutputLabel,
  labelsAvailable,
}: {
  systemAudioSupported: boolean;
  audioPrefs: AudioPrefs;
  updateAudioPref: (key: string, value: unknown) => Promise<void>;
  microphones: AudioInputDevice[];
  defaultOutputLabel: string | null;
  labelsAvailable: boolean;
}) {
  return (
    <div className="s-pane" data-testid="settings-pane-audio">
      <PaneHeader
        title="Audio"
        description="What gets captured and how speakers are labelled."
      />

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Sources</SectionLabel>
        <div className="s-card-rows">
          <SettingRow
            icon={Speaker}
            title="Meeting capture"
            description={
              systemAudioSupported
                ? 'Meetings record your mic and the audio from your speakers.'
                : "Meeting recording requires macOS 14 Sonoma or later — this machine isn't supported. Dictation still works."
            }
            actions={
              systemAudioSupported ? (
                <span className="s-pill s-pill-good">
                  <span className="s-pdot" />
                  Supported
                </span>
              ) : (
                <span className="s-pill s-pill-danger">
                  <span className="s-pdot" />
                  Not supported
                </span>
              )
            }
          />
          <SettingRow
            icon={Mic}
            title="Microphone"
            actionsGap={6}
            description={
              !labelsAvailable
                ? 'Grant microphone access to see device names.'
                : undefined
            }
            actions={
              labelsAvailable ? (
                <span className="s-select">
                  <select
                    value={audioPrefs.selectedMicDeviceId ?? ''}
                    onChange={(e) =>
                      updateAudioPref(
                        'selectedMicDeviceId',
                        e.target.value || undefined,
                      )
                    }
                    style={{
                      appearance: 'none',
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">System default</option>
                    {microphones.map((mic) => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} color="var(--s-text3)" />
                </span>
              ) : undefined
            }
          />
          <SettingRow
            icon={Volume2}
            title="System output"
            description={defaultOutputLabel ?? undefined}
          />
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Input level</SectionLabel>
        <ComingSoon>
          <div className="s-card-rows">
            <SettingRow
              icon={SlidersHorizontal}
              title="Mic gain"
              actions={
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={audioPrefs.micGain}
                  onChange={(e) => updateAudioPref('micGain', +e.target.value)}
                  style={{ width: 120, accentColor: 'var(--s-accent)' }}
                />
              }
            />
            <SettingRow
              icon={Wind}
              title="Noise suppression"
              description="Reduce keyboard clicks and background hum."
              actions={
                <SettingSwitch
                  checked={audioPrefs.noiseSuppression}
                  onChange={(v) => updateAudioPref('noiseSuppression', v)}
                />
              }
            />
          </div>
        </ComingSoon>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Speaker labels</SectionLabel>
        <ComingSoon>
          <div className="s-card-rows">
            <SettingRow
              icon={Users}
              title="Label speakers in transcripts"
              description="Mark each line as You or Others."
              actions={
                <SettingSwitch
                  checked={audioPrefs.labelSpeakers}
                  onChange={(v) => updateAudioPref('labelSpeakers', v)}
                />
              }
            />
          </div>
        </ComingSoon>
      </div>
    </div>
  );
}
