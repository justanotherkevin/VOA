import React from 'react';
import { Trash2, RotateCcw, History as HistoryIcon } from 'lucide-react';
import { Button } from '@/renderer/components/button';
import type { TranscriberData } from '@/renderer/hooks/useTranscriber';
import type { StoredTranscript } from '@/renderer/hooks/useTranscriptHistory';
import { formatAudioTimestamp } from '@/renderer/utils/AudioUtils';

interface HistoryProps {
  transcribedData?: TranscriberData;
  history: StoredTranscript[];
  onClearHistory: () => void;
}

export default function History({ transcribedData, history, onClearHistory }: HistoryProps) {
  // Combine current session data with stored history if needed,
  // or just display history. For now, let's display the stored history
  // as the main "History" feature.

  if (!history || history?.length === 0 && (!transcribedData || !transcribedData.chunks || transcribedData.chunks.length === 0)) {
    return (
      <div className="bg-white rounded-lg p-8 text-center">
        <p className="text-gray-500">No transcriptions yet. Start by recording some audio!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <HistoryIcon className="w-5 h-5" />
          History
        </h3>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearHistory} className="text-red-500 hover:text-red-700 hover:bg-red-50">
            Clear History
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Past History */}
        {history.map((item) => (
          <div key={item.id} data-testid="transcript-history-item" className="space-y-2 bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {new Date(item.date).toLocaleString()}
              </span>
            </div>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
