import { Bell, Bookmark, Pause, PictureInPicture2, Plus } from 'lucide-react';
import { SettingSwitch } from '@/renderer/components/settings/SettingSwitch';
import {
  ComingSoon,
  PaneHeader,
  PickRow,
  SectionLabel,
  SettingRow,
} from './shared';

type AutoRecordMode = 'manual' | 'ask' | 'auto' | 'auto-stop';

interface WatchedApps {
  zoom: boolean;
  teams: boolean;
  meet: boolean;
  slack: boolean;
}

interface WhileRecording {
  floatingRecorder: boolean;
  chime: boolean;
  pauseOnSilence: boolean;
}

export function RecordingPane({
  autoRecordMode,
  updateRecordingPref,
  watchedApps,
  setWatchedApps,
  whileRecording,
  setWhileRecording,
}: {
  autoRecordMode: AutoRecordMode;
  updateRecordingPref: (key: string, value: unknown) => Promise<void>;
  watchedApps: WatchedApps;
  setWatchedApps: (apps: WatchedApps) => void;
  whileRecording: WhileRecording;
  setWhileRecording: (state: WhileRecording) => void;
}) {
  return (
    <div className="s-pane" data-testid="settings-pane-recording">
      <PaneHeader
        title="Recording"
        description="Choose when capture starts and what happens while you record."
      />

      <div style={{ marginBottom: 22 }}>
        <div className="s-section-label" data-testid="settings-row-auto-record">
          Auto-record meeting detection
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--s-text3)',
            margin: '0 0 10px 3px',
          }}
        >
          detected locally — no bot joins the call
        </div>
        <div className="s-card-rows">
          {(['manual', 'ask', 'auto', 'auto-stop'] as const).map((mode) => {
            const labels = {
              manual: 'Manual only',
              ask: 'Ask me',
              auto: 'Auto-start',
              'auto-stop': 'Auto-start & stop',
            };
            const descs = {
              manual: 'Start & stop with the shortcut F1.',
              ask: 'Show a quick prompt when a meeting is detected.',
              auto: 'Begin recording the moment a meeting starts.',
              'auto-stop': 'Also stop when you leave the meeting.',
            };
            return (
              <PickRow
                key={mode}
                selected={autoRecordMode === mode}
                title={labels[mode]}
                onSelect={() => updateRecordingPref('autoRecordMode', mode)}
              >
                <div className="s-row-desc">{descs[mode]}</div>
              </PickRow>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Apps to watch</SectionLabel>
        <ComingSoon>
          <div className="s-card-rows">
            {[
              { key: 'zoom' as const, name: 'Zoom', bg: '#2d8cff' },
              {
                key: 'teams' as const,
                name: 'Microsoft Teams',
                bg: '#5b5fc7',
              },
              {
                key: 'meet' as const,
                name: 'Google Meet',
                bg: '#1a9b5b',
              },
              {
                key: 'slack' as const,
                name: 'Slack huddles',
                bg: '#611f69',
              },
            ].map((app) => (
              <SettingRow
                key={app.key}
                title={app.name}
                actions={
                  <SettingSwitch
                    checked={watchedApps[app.key]}
                    onChange={(v) =>
                      setWatchedApps({ ...watchedApps, [app.key]: v })
                    }
                  />
                }
              >
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
              </SettingRow>
            ))}
            <div className="s-row s-row-btn">
              <Plus
                size={17}
                color="var(--s-accent)"
                style={{ flexShrink: 0 }}
              />
              <div
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: 'var(--s-accent)',
                }}
              >
                Add an app…
              </div>
            </div>
          </div>
        </ComingSoon>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>While recording</SectionLabel>
        <ComingSoon>
          <div className="s-card-rows">
            <SettingRow
              icon={PictureInPicture2}
              title="Show floating recorder"
              description="A small always-on-top capsule with levels & a note field."
              actions={
                <SettingSwitch
                  checked={whileRecording.floatingRecorder}
                  onChange={(v) =>
                    setWhileRecording({
                      ...whileRecording,
                      floatingRecorder: v,
                    })
                  }
                />
              }
            />
            <SettingRow
              icon={Bell}
              title="Play start / stop chime"
              actions={
                <SettingSwitch
                  checked={whileRecording.chime}
                  onChange={(v) =>
                    setWhileRecording({ ...whileRecording, chime: v })
                  }
                />
              }
            />
            <SettingRow
              icon={Bookmark}
              title="Mark a moment"
              description="Drop a timestamp you can jump back to."
              actionsGap={5}
              actions={
                <>
                  <span className="s-kbd">⌘</span>
                  <span className="s-kbd">M</span>
                </>
              }
            />
            <SettingRow
              icon={Pause}
              title="Pause on long silence"
              description="Skip dead air to save space."
              actions={
                <SettingSwitch
                  checked={whileRecording.pauseOnSilence}
                  onChange={(v) =>
                    setWhileRecording({
                      ...whileRecording,
                      pauseOnSilence: v,
                    })
                  }
                />
              }
            />
          </div>
        </ComingSoon>
      </div>
    </div>
  );
}
