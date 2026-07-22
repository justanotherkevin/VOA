import React, { useState } from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';
import type { Meeting } from '@/renderer/hooks/useMeetings';
import { formatDateTime, formatDuration } from '@/renderer/utils/formatters';

interface MeetingDetailHeaderProps {
  meeting: Meeting;
  copied: boolean;
  onCopy: () => void;
  onDelete?: (id: string) => void;
  onTitleChange?: (id: string, title: string) => void;
}

export function MeetingDetailHeader({
  meeting,
  copied,
  onCopy,
  onDelete,
  onTitleChange,
}: MeetingDetailHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const handleTitleClick = () => {
    setTitleDraft(meeting.title);
    setEditingTitle(true);
  };

  const handleTitleSave = () => {
    if (titleDraft.trim() && titleDraft !== meeting.title) {
      onTitleChange?.(meeting.id, titleDraft.trim());
    }
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleSave();
    if (e.key === 'Escape') setEditingTitle(false);
  };

  return (
    <div className="px-8 pt-8 pb-4 border-b border-[#222] shrink-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              className="text-2xl font-bold text-white bg-transparent border-b border-blue-500 outline-none w-full"
            />
          ) : (
            <h1
              className="text-2xl font-bold text-white cursor-pointer hover:text-gray-200 transition-colors"
              onClick={handleTitleClick}
              title="Click to edit title"
            >
              {meeting.title}
            </h1>
          )}
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            <span>{formatDateTime(meeting.startedAt)}</span>
            {meeting.durationMs > 0 && (
              <>
                <span>·</span>
                <span>Duration: {formatDuration(meeting.durationMs)}</span>
              </>
            )}
            {meeting.audioSource !== 'mic' && (
              <>
                <span>·</span>
                <span className="capitalize">{meeting.audioSource} audio</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-[#2a2a2a] hover:bg-[#333] px-3 py-1.5 rounded-lg transition-colors"
            title="Copy all"
          >
            {copied ? (
              <Check size={13} className="text-green-400" />
            ) : (
              <Copy size={13} />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(meeting.id)}
              className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors"
              title="Delete meeting"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
