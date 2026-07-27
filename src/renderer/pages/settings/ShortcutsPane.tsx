import {
  Bookmark,
  CircleDot,
  Mic,
  Pencil,
  RotateCcw,
  Search,
} from 'lucide-react';
import ShortcutConfigDialog from '@/renderer/components/ui/ShortcutConfigDialog';
import { RECORDING_SHORTCUT, DICTATION_SHORTCUT } from '@/lib/shortcuts';
import { ComingSoon, PaneHeader, SettingRow } from './shared';

export function ShortcutsPane({
  currentShortcut,
  isSaving,
  updateShortcut,
  currentDictationShortcut,
  isDictationSaving,
  updateDictationShortcut,
  handleResetShortcut,
  isShortcutDialogOpen,
  setIsShortcutDialogOpen,
  isDictationShortcutDialogOpen,
  setIsDictationShortcutDialogOpen,
}: {
  currentShortcut: string;
  isSaving: boolean;
  updateShortcut: (newShortcut: string) => Promise<boolean>;
  currentDictationShortcut: string;
  isDictationSaving: boolean;
  updateDictationShortcut: (newShortcut: string) => Promise<boolean>;
  handleResetShortcut: () => Promise<void>;
  isShortcutDialogOpen: boolean;
  setIsShortcutDialogOpen: (open: boolean) => void;
  isDictationShortcutDialogOpen: boolean;
  setIsDictationShortcutDialogOpen: (open: boolean) => void;
}) {
  return (
    <div className="s-pane" data-testid="settings-pane-shortcuts">
      <PaneHeader
        title="Shortcuts"
        description="Drive the whole app from the keyboard."
      />

      <div style={{ marginBottom: 22 }}>
        <div className="s-card-rows">
          <SettingRow
            icon={CircleDot}
            testId="settings-row-start-stop-recording"
            title="Start / stop recording"
            actionsGap={5}
            actions={
              <>
                {currentShortcut.split('+').map((k, i) => (
                  <span key={i} className="s-kbd">
                    {k}
                  </span>
                ))}
                <button
                  className="s-btn"
                  data-testid="customize-shortcut-button"
                  onClick={() => setIsShortcutDialogOpen(true)}
                  disabled={isSaving}
                >
                  Change
                </button>
              </>
            }
          />
          <SettingRow
            icon={Mic}
            testId="settings-row-start-stop-dictation"
            title="Start / stop dictation"
            actionsGap={5}
            actions={
              <>
                {currentDictationShortcut.split('+').map((k, i) => (
                  <span key={i} className="s-kbd">
                    {k}
                  </span>
                ))}
                <button
                  className="s-btn"
                  data-testid="customize-dictation-shortcut-button"
                  onClick={() => setIsDictationShortcutDialogOpen(true)}
                  disabled={isDictationSaving}
                >
                  Change
                </button>
              </>
            }
          />
          <ComingSoon>
            <SettingRow
              icon={Bookmark}
              title="Mark a moment"
              actionsGap={5}
              actions={
                <>
                  <span className="s-kbd">⌘</span>
                  <span className="s-kbd">M</span>
                </>
              }
            />
          </ComingSoon>
          <ComingSoon>
            <SettingRow
              icon={Pencil}
              title="Jot a note"
              actionsGap={5}
              actions={
                <>
                  <span className="s-kbd">⌘</span>
                  <span className="s-kbd">⇧</span>
                  <span className="s-kbd">N</span>
                </>
              }
            />
          </ComingSoon>
          <ComingSoon>
            <SettingRow
              icon={Search}
              title="Search meetings"
              actionsGap={5}
              actions={
                <>
                  <span className="s-kbd">⌘</span>
                  <span className="s-kbd">K</span>
                </>
              }
            />
          </ComingSoon>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <button
          className="s-btn"
          onClick={handleResetShortcut}
          disabled={
            isSaving ||
            isDictationSaving ||
            (currentShortcut === RECORDING_SHORTCUT &&
              currentDictationShortcut === DICTATION_SHORTCUT)
          }
        >
          <RotateCcw size={13} />
          Reset to defaults
        </button>
      </div>

      <ShortcutConfigDialog
        isOpen={isShortcutDialogOpen}
        currentShortcut={currentShortcut}
        title="Customize Recording Shortcut"
        onSave={async (s) => {
          const ok = await updateShortcut(s);
          if (ok) setIsShortcutDialogOpen(false);
        }}
        onCancel={() => setIsShortcutDialogOpen(false)}
      />

      <ShortcutConfigDialog
        isOpen={isDictationShortcutDialogOpen}
        currentShortcut={currentDictationShortcut}
        title="Customize Dictation Shortcut"
        onSave={async (s) => {
          const ok = await updateDictationShortcut(s);
          if (ok) setIsDictationShortcutDialogOpen(false);
        }}
        onCancel={() => setIsDictationShortcutDialogOpen(false)}
      />
    </div>
  );
}
