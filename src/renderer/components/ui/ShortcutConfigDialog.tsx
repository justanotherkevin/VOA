import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/renderer/components/button';
import { cn } from '@/renderer/utils/utils';
import { Kbd, KbdGroup } from '@/renderer/components/kbd';

// Helper to detect macOS in browser context (process is not available in renderer)
const isMacOS = (): boolean => {
  return navigator.platform.includes('Mac');
};

interface ShortcutConfigDialogProps {
  isOpen: boolean;
  currentShortcut: string;
  title?: string;
  onSave: (shortcut: string) => void;
  onCancel: () => void;
}

const KeyDisplay: React.FC<{ keys: string[] }> = ({ keys }) => {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <KbdGroup>
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            <Kbd className="">{key}</Kbd>
            {index < keys.length - 1 && (
              <span className="text-gray-400 font-medium">+</span>
            )}
          </React.Fragment>
        ))}
      </KbdGroup>
    </div>
  );
};

export const ShortcutConfigDialog: React.FC<ShortcutConfigDialogProps> = ({
  isOpen,
  currentShortcut,
  title = 'Customize Shortcut',
  onSave,
  onCancel,
}) => {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [displayKeys, setDisplayKeys] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  // Parse shortcut string to display keys
  const parseShortcut = (shortcut: string): string[] => {
    if (!shortcut) return [];
    return shortcut.split('+').map((k) => k.trim());
  };

  const currentShortcutKeys = parseShortcut(currentShortcut);

  // Auto-focus the input area when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Normalize key names for display and storage
  const normalizeKeyName = (key: string): string => {
    const keyMap: Record<string, string> = {
      Control: 'Ctrl',
      Meta: isMacOS() ? 'Cmd' : 'Meta',
      Alt: 'Alt',
      Shift: 'Shift',
      ' ': 'Space',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
    };

    if (keyMap[key]) return keyMap[key];
    return key.length === 1 ? key.toUpperCase() : key;
  };

  // Handle keyboard input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const key = e.key;
    const newPressedKeys = new Set(pressedKeys);

    // Add the pressed key
    if (key === 'Control') {
      newPressedKeys.add('Ctrl');
    } else if (key === 'Meta') {
      newPressedKeys.add(isMacOS() ? 'Cmd' : 'Meta');
    } else if (key === 'Shift') {
      newPressedKeys.add('Shift');
    } else if (key === 'Alt') {
      newPressedKeys.add('Alt');
    } else if (key !== 'Tab') {
      // Exclude Tab to prevent focus loss
      newPressedKeys.add(normalizeKeyName(key));
    }

    setPressedKeys(newPressedKeys);
    // Convert Set to array and sort for consistent display
    const sortedKeys = Array.from(newPressedKeys).sort();
    setDisplayKeys(sortedKeys);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Don't clear on key up, let user continue adding keys
  };

  const handleSave = () => {
    if (displayKeys.length > 0) {
      const electronFormat = convertToElectronFormat(displayKeys);
      onSave(electronFormat);
    }
  };

  const handleReset = () => {
    setPressedKeys(new Set());
    setDisplayKeys([]);
  };

  /**
   * Convert display keys back to Electron shortcut format
   * e.g., ['Ctrl', 'Shift', 'D'] -> 'CommandOrControl+Shift+D'
   */
  const convertToElectronFormat = (keys: string[]): string => {
    return keys
      .map((key) => {
        if (key === 'Cmd') return 'CommandOrControl';
        if (key === 'Ctrl') return 'CommandOrControl';
        if (key === 'Space') return ' ';
        if (key === '↑') return 'ArrowUp';
        if (key === '↓') return 'ArrowDown';
        if (key === '←') return 'ArrowLeft';
        if (key === '→') return 'ArrowRight';
        return key;
      })
      .join('+');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="shortcut-dialog-overlay"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        data-testid="shortcut-config-dialog"
      >
        {/* Header */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>

        {/* Current Shortcut */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-600 mb-3">
            Current Shortcut
          </p>
          <div
            className="p-3 bg-gray-50 rounded-md"
            data-testid="current-shortcut-display"
          >
            {currentShortcutKeys.length > 0 ? (
              <KeyDisplay keys={currentShortcutKeys} />
            ) : (
              <span className="text-gray-400 text-sm">
                No shortcut configured
              </span>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-600 mb-3">
            Press keys to set new shortcut
          </p>
          <div
            ref={inputRef}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            tabIndex={0}
            className={cn(
              'p-4 border-2 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
              displayKeys.length > 0
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400',
            )}
            data-testid="keyboard-input-area"
          >
            {displayKeys.length > 0 ? (
              <KeyDisplay keys={displayKeys} />
            ) : (
              <span className="text-gray-400 text-sm">
                Click here and press keys...
              </span>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            data-testid="dialog-cancel-button"
          >
            Cancel
          </Button>
          {displayKeys.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-gray-600"
              data-testid="dialog-clear-button"
            >
              Clear
            </Button>
          )}
          <Button
            variant="default"
            onClick={handleSave}
            disabled={displayKeys.length === 0}
            data-testid="dialog-save-button"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutConfigDialog;
