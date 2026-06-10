import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import History from '@/renderer/components/ui/History';
import StatsCards from '@/renderer/components/ui/StatsCards';
import type { Transcriber } from '@/renderer/hooks/useTranscriber';
import { useTranscriptHistory } from '@/renderer/hooks/useTranscriptHistory';
import { useShortcuts } from '@/renderer/hooks/useShortcuts';
import { usePermissions } from '@/renderer/hooks/usePermissions';
import { Badge } from '@/renderer/components/badge';
import { KbdGroup, Kbd } from '../components/kbd';
interface HomeProps {
  transcriber: Transcriber;
}

export default function Home({ transcriber }: HomeProps) {
  const { history, clearHistory } = useTranscriptHistory();
  const { currentShortcut } = useShortcuts();
  const { permissions } = usePermissions();

  const formattedShortcut = currentShortcut
    .replace('CommandOrControl', '⌘')
    .replace('Shift', '⇧')
    .split('+')
    .map((key) => key.trim());

  const pm = permissions.microphone === 'granted';
  const pa = permissions.accessibility;

  return (
    <div className="w-full h-full overflow-auto">
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center">
            Home
          </h1>
          <p className="text-gray-600 text-sm mb-4">
            First dictation will take a moment to load models. Subsequent
            dictations will be faster.
          </p>

          <div className="flex gap-4">
            <p
              className="text-sm text-gray-600 mt-1"
              data-testid="current-shortcut-text"
            >
              Transcribe shortcut:
            </p>
            <KbdGroup>
              {formattedShortcut.map((key, index) => (
                <Kbd key={index}>{key}</Kbd>
              ))}
            </KbdGroup>
          </div>

          {/* Permission Status Indicators */}
          <div className="flex gap-2">
            <div className="flex w-full flex-wrap gap-2">
              <Badge
                variant="secondary"
                className={`cursor-pointer transition-colors hover:opacity-80 ${pm ? 'bg-green-200 text-green-700 dark:bg-blue-600' : 'bg-red-300 text-red-50 dark:bg-red-600'}`}
                onClick={() =>
                  window.electronAPI.permissions.openSettings('microphone')
                }
                title={
                  !pm
                    ? 'Click to open Microphone settings'
                    : 'Microphone access granted'
                }
              >
                {pm ? <Check size={14} /> : <AlertTriangle size={14} />}
                Microphone
              </Badge>
              <Badge
                variant="secondary"
                className={`cursor-pointer transition-colors hover:opacity-80 ${pa ? 'bg-green-200 text-green-700 dark:bg-blue-600' : 'bg-red-300 text-red-50 dark:bg-red-600'}`}
                onClick={() =>
                  window.electronAPI.permissions.openSettings('accessibility')
                }
                title={
                  !pa
                    ? 'Click to open Accessibility settings'
                    : 'Accessibility access granted'
                }
              >
                {pa ? <Check size={14} /> : <AlertTriangle size={14} />}
                Accessibility
              </Badge>
            </div>
          </div>
        </div>

        <History
          transcribedData={transcriber.output}
          history={history}
          onClearHistory={clearHistory}
        />
      </div>
    </div>
  );
}
