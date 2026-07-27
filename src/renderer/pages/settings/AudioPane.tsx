import {
  ChevronDown,
  Info,
  Mic,
  SlidersHorizontal,
  Speaker,
  Users,
  Volume2,
  Wind,
} from 'lucide-react';
import { SettingSwitch } from '@/renderer/components/settings/SettingSwitch';
import { ComingSoon, PaneHeader, SectionLabel, SettingRow } from './shared';

interface AudioPrefs {
  micGain: number;
  noiseSuppression: boolean;
  labelSpeakers: boolean;
}

export function AudioPane({
  systemAudioEnabled,
  updateRecordingPref,
  audioPrefs,
  updateAudioPref,
}: {
  systemAudioEnabled: boolean;
  updateRecordingPref: (key: string, value: unknown) => Promise<void>;
  audioPrefs: AudioPrefs;
  updateAudioPref: (key: string, value: unknown) => Promise<void>;
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
            title="Capture system audio"
            description="Record your mic and the audio from your speakers."
            actions={
              <SettingSwitch
                checked={systemAudioEnabled}
                onChange={(v) => updateRecordingPref('systemAudioEnabled', v)}
                accent
              />
            }
          />
          <ComingSoon>
            <SettingRow
              icon={Mic}
              title="Microphone"
              actionsGap={6}
              actions={
                <span className="s-select">
                  MacBook Pro Mic{' '}
                  <ChevronDown size={13} color="var(--s-text3)" />
                </span>
              }
            />
          </ComingSoon>
          <ComingSoon>
            <SettingRow
              icon={Volume2}
              title="System output"
              actionsGap={6}
              actions={
                <span className="s-select">
                  Studio Display{' '}
                  <ChevronDown size={13} color="var(--s-text3)" />
                </span>
              }
            />
          </ComingSoon>
        </div>
        <div className="s-note">
          <Info size={13} />
          System audio capture requires macOS 14 Sonoma or later.
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
