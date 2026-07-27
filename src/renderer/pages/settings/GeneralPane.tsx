import {
  AppWindow,
  PanelTop,
  Palette,
  Power,
  Rows3,
  SunMoon,
} from 'lucide-react';
import { SegmentedControl } from '@/renderer/components/settings/SegmentedControl';
import { SettingSwitch } from '@/renderer/components/settings/SettingSwitch';
import { ComingSoon, PaneHeader, SectionLabel, SettingRow } from './shared';

interface UiPrefs {
  theme: 'light' | 'dark' | 'auto';
  accentLight: string;
  accentDark: string;
  density: 'comfortable' | 'compact';
}

interface AppPrefs {
  launchAtLogin: boolean;
  showMenuBar: boolean;
  showDockIcon: boolean;
}

export function GeneralPane({
  uiPrefs,
  updateUIAndApply,
  resolvedTheme,
  accentValue,
  setAccent,
  accents,
  appPrefs,
  updateAppPref,
}: {
  uiPrefs: UiPrefs;
  updateUIAndApply: (key: string, value: string) => Promise<void>;
  resolvedTheme: 'light' | 'dark';
  accentValue: string;
  setAccent: (light: string, dark: string) => Promise<void>;
  accents: { light: string; dark: string }[];
  appPrefs: AppPrefs;
  updateAppPref: (key: string, value: unknown) => Promise<void>;
}) {
  return (
    <div className="s-pane" data-testid="settings-pane-general">
      <PaneHeader
        title="General"
        description="Appearance and how the app lives on your Mac."
      />

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Appearance</SectionLabel>
        <div className="s-card-rows">
          <SettingRow
            icon={SunMoon}
            title="Theme"
            actions={
              <SegmentedControl
                options={[
                  { label: 'Light', value: 'light' },
                  { label: 'Dark', value: 'dark' },
                  { label: 'Auto', value: 'auto' },
                ]}
                value={uiPrefs.theme}
                onChange={(v) => updateUIAndApply('theme', v)}
              />
            }
          />
          <SettingRow
            icon={Palette}
            title="Accent color"
            actionsGap={10}
            actions={accents.map((a, i) => (
              <div
                key={i}
                className="s-acc-dot"
                style={{
                  background: resolvedTheme === 'dark' ? a.dark : a.light,
                  outline:
                    (resolvedTheme === 'dark' ? a.dark : a.light) ===
                    accentValue
                      ? '2px solid var(--s-text2)'
                      : '2px solid transparent',
                }}
                onClick={() => setAccent(a.light, a.dark)}
              />
            ))}
          />
          <SettingRow
            icon={Rows3}
            title="Density"
            actions={
              <SegmentedControl
                options={[
                  { label: 'Comfortable', value: 'comfortable' },
                  { label: 'Compact', value: 'compact' },
                ]}
                value={uiPrefs.density}
                onChange={(v) => updateUIAndApply('density', v)}
              />
            }
          />
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Startup</SectionLabel>
        <div className="s-card-rows">
          <SettingRow
            icon={Power}
            title="Launch at login"
            actions={
              <SettingSwitch
                checked={appPrefs.launchAtLogin}
                onChange={(v) => updateAppPref('launchAtLogin', v)}
              />
            }
          />
          <ComingSoon>
            <SettingRow
              icon={PanelTop}
              title="Show in menu bar"
              description="Start, stop and jot a note without opening the window."
              actions={
                <SettingSwitch
                  checked={appPrefs.showMenuBar}
                  onChange={(v) => updateAppPref('showMenuBar', v)}
                />
              }
            />
          </ComingSoon>
          <ComingSoon>
            <SettingRow
              icon={AppWindow}
              title="Show Dock icon"
              actions={
                <SettingSwitch
                  checked={appPrefs.showDockIcon}
                  onChange={(v) => updateAppPref('showDockIcon', v)}
                />
              }
            />
          </ComingSoon>
        </div>
      </div>
    </div>
  );
}
