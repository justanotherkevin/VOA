import {
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  HardDrive,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { SettingSwitch } from '@/renderer/components/settings/SettingSwitch';
import { APP_NAME } from '@/lib/Constants';
import { ComingSoon, PaneHeader, SectionLabel, SettingRow } from './shared';

export function PrivacyPane() {
  return (
    <div className="s-pane" data-testid="settings-pane-privacy">
      <PaneHeader
        title="Privacy & Storage"
        description="You're in control. Nothing is uploaded."
      />

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
          <h3
            style={{
              margin: '0 0 4px',
              fontSize: 15,
              fontWeight: 650,
              color: 'var(--s-text)',
            }}
          >
            Everything stays on your Mac
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              color: 'var(--s-text2)',
              lineHeight: 1.5,
            }}
          >
            Audio is transcribed on-device with a local model — no cloud, no
            account, and no bot ever joins your meetings. Your recordings never
            leave this computer.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Storage</SectionLabel>
        <div className="s-card-rows">
          <ComingSoon>
            <SettingRow
              icon={Folder}
              clickable
              title="Library location"
              actions={
                <button className="s-btn">
                  <ArrowUpRight size={13} />
                  Reveal
                </button>
              }
            >
              <code
                style={{
                  fontSize: 11,
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  background: 'var(--s-tint)',
                  padding: '1px 5px',
                  borderRadius: 4,
                  color: 'var(--s-text2)',
                  marginTop: 2,
                  display: 'inline-block',
                }}
              >
                {`~/Library/Application Support/${APP_NAME}`}
              </code>
            </SettingRow>
          </ComingSoon>
          <ComingSoon>
            <SettingRow
              icon={Trash2}
              title="Delete audio after transcribing"
              description="Keep only the text. Smallest footprint."
              actions={<SettingSwitch checked={false} onChange={() => {}} />}
            />
          </ComingSoon>
          <ComingSoon>
            <SettingRow
              icon={CalendarClock}
              title="Auto-delete recordings"
              actionsGap={6}
              actions={
                <span className="s-select">
                  After 90 days <ChevronDown size={13} color="var(--s-text3)" />
                </span>
              }
            />
          </ComingSoon>
        </div>
        <div className="s-note">
          <HardDrive size={13} />
          100 meetings · 1.2 GB of audio · 4.4 MB of transcripts.
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Your data</SectionLabel>
        <ComingSoon>
          <div className="s-card-rows">
            <SettingRow
              icon={Download}
              clickable
              title="Export everything"
              description="All transcripts & notes as Markdown."
              actions={<ChevronRight size={17} color="var(--s-text3)" />}
            />
            <SettingRow
              icon={Trash2}
              iconColor="var(--s-danger)"
              clickable
              title={
                <span style={{ color: 'var(--s-danger)' }}>
                  Delete all data…
                </span>
              }
              actions={<ChevronRight size={17} color="var(--s-text3)" />}
            />
          </div>
        </ComingSoon>
      </div>
    </div>
  );
}
