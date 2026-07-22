import React from 'react';
import { MessageSquare } from 'lucide-react';
import {
  TranscriptTagRenderer,
  type TranscriptTagStyle,
} from '../ui/TranscriptTagRenderer';
import { Section } from './Section';

interface MeetingTranscriptProps {
  transcript: string;
  hasTags: boolean;
  tagStyle: TranscriptTagStyle;
  onTagStyleChange: (style: TranscriptTagStyle) => void;
}

export function MeetingTranscript({
  transcript,
  hasTags,
  tagStyle,
  onTagStyleChange,
}: MeetingTranscriptProps) {
  return (
    <Section
      icon={<MessageSquare size={15} />}
      title="Transcript"
      action={
        hasTags ? (
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => onTagStyleChange('pill')}
              title="Pill style"
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                tagStyle === 'pill'
                  ? 'bg-[#7c6ff7]/20 text-[#7c6ff7] border border-[#7c6ff7]/30'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              Pill
            </button>
            <button
              onClick={() => onTagStyleChange('gutter')}
              title="Gutter style"
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                tagStyle === 'gutter'
                  ? 'bg-[#7c6ff7]/20 text-[#7c6ff7] border border-[#7c6ff7]/30'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              Gutter
            </button>
          </div>
        ) : undefined
      }
    >
      {transcript ? (
        <div className="text-gray-400 text-sm font-mono leading-relaxed whitespace-pre-wrap">
          {hasTags ? (
            <TranscriptTagRenderer text={transcript} style={tagStyle} />
          ) : (
            transcript
          )}
        </div>
      ) : (
        <p className="text-gray-600 text-sm italic">No transcript available</p>
      )}
    </Section>
  );
}
