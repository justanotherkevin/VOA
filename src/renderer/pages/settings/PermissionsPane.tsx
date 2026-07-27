import { Accessibility, Info, Mic, Monitor } from 'lucide-react';
import type { PermissionsStatus } from '@/renderer/contexts/PermissionsContext';
import { PaneHeader, SettingRow } from './shared';

export function PermissionsPane({
  permissions,
  openPermSettings,
}: {
  permissions: PermissionsStatus;
  openPermSettings: (
    permissionType: 'microphone' | 'accessibility' | 'screenRecording',
  ) => Promise<void>;
}) {
  return (
    <div className="s-pane" data-testid="settings-pane-permissions">
      <PaneHeader
        title="Permissions"
        description="macOS access the app needs to capture meetings."
      />

      <div style={{ marginBottom: 22 }}>
        <div className="s-card-rows">
          <SettingRow
            icon={Mic}
            testId="settings-row-microphone"
            title="Microphone"
            description="Record your voice."
            actions={
              permissions.microphone === 'granted' ? (
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
                  <button
                    className="s-btn"
                    onClick={() => openPermSettings('microphone')}
                  >
                    Allow
                  </button>
                </>
              ) : (
                <>
                  <span className="s-pill s-pill-danger">
                    <span className="s-pdot" />
                    Denied
                  </span>
                  <button
                    className="s-btn"
                    onClick={() => openPermSettings('microphone')}
                  >
                    Fix
                  </button>
                </>
              )
            }
          />
          <SettingRow
            icon={Accessibility}
            testId="settings-row-accessibility"
            title="Accessibility"
            description="Detect when a meeting app is in a call."
            actions={
              permissions.accessibility ? (
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
                  <button
                    className="s-btn"
                    onClick={() => openPermSettings('accessibility')}
                  >
                    Fix
                  </button>
                </>
              )
            }
          />
          <SettingRow
            icon={Monitor}
            title="Screen & system audio"
            description="Capture the audio playing through your speakers."
            actions={
              permissions.screenRecording === 'granted' ? (
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
                  <button
                    className="s-btn"
                    onClick={() => openPermSettings('screenRecording')}
                  >
                    Allow
                  </button>
                </>
              ) : (
                <>
                  <span className="s-pill s-pill-danger">
                    <span className="s-pdot" />
                    Denied
                  </span>
                  <button
                    className="s-btn"
                    onClick={() => openPermSettings('screenRecording')}
                  >
                    Fix
                  </button>
                </>
              )
            }
          />
        </div>
        <div className="s-note">
          <Info size={13} />
          Manage these any time in System Settings → Privacy & Security.
        </div>
      </div>
    </div>
  );
}
