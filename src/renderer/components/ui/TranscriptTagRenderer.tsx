import React from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '../avatar';
import { Bubble, BubbleContent } from '../bubble';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
} from '../message';

export type TranscriptTagStyle = 'pill' | 'gutter';

export const HAS_TAGS_RE = /\[(Meeting|Mic)\]/i;

const MEETING_COLOR = '#7c6ff7';
const MIC_COLOR = '#f7914f';

type Source = 'meeting' | 'mic';

interface Segment {
  text: string;
  src?: Source;
}

function parseTranscript(text: string): Segment[] {
  const TAG_RE = /(\[Meeting\]|\[Mic\])/gi;
  const parts = text.split(TAG_RE);
  const segments: Segment[] = [];
  let currentSrc: Source | undefined;

  for (const part of parts) {
    if (/^\[Meeting\]$/i.test(part)) {
      currentSrc = 'meeting';
    } else if (/^\[Mic\]$/i.test(part)) {
      currentSrc = 'mic';
    } else {
      segments.push({ text: part, src: currentSrc });
      currentSrc = undefined;
    }
  }

  return segments;
}

function srcColor(src: Source) {
  return src === 'meeting' ? MEETING_COLOR : MIC_COLOR;
}

function srcLabel(src: Source) {
  return src === 'meeting' ? 'M' : '★';
}

function srcIcon(src: Source) {
  return src === 'meeting' ? Volume2 : Mic;
}

function srcAriaLabel(src: Source) {
  return src === 'meeting' ? 'System audio' : 'Mic audio';
}

function PillView({ segments }: { segments: Segment[] }) {
  return (
    <span>
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          {seg.src && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '10px',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: '100px',
                background: `${srcColor(seg.src)}26`,
                color: srcColor(seg.src),
                border: `1px solid ${srcColor(seg.src)}44`,
                verticalAlign: 'middle',
                margin: '0 3px 0 1px',
                lineHeight: '16px',
                letterSpacing: '0.01em',
                flexShrink: 0,
              }}
            >
              {srcLabel(seg.src)}
            </span>
          )}
          {seg.text}
        </React.Fragment>
      ))}
    </span>
  );
}

interface SegmentGroup {
  src?: Source;
  text: string;
}

function groupSegments(segments: Segment[]): SegmentGroup[] {
  const groups: SegmentGroup[] = [];
  for (const seg of segments) {
    const last = groups[groups.length - 1];
    if (last && last.src === seg.src) {
      last.text += seg.text;
    } else {
      groups.push({ src: seg.src, text: seg.text });
    }
  }
  return groups;
}

function GutterView({ segments }: { segments: Segment[] }) {
  const groups = groupSegments(segments).filter(
    (group) => group.src || group.text.trim(),
  );

  return (
    <MessageGroup>
      {groups.map((group, i) => {
        if (!group.src) {
          return (
            <p key={i} className="text-sm">
              {group.text}
            </p>
          );
        }

        const align = group.src === 'mic' ? 'end' : 'start';
        const color = srcColor(group.src);
        const Icon = srcIcon(group.src);

        return (
          <Message key={i} align={align}>
            <MessageAvatar>
              <Avatar aria-label={srcAriaLabel(group.src)}>
                <AvatarFallback
                  style={{ backgroundColor: `${color}26`, color }}
                >
                  <Icon size={14} />
                </AvatarFallback>
              </Avatar>
            </MessageAvatar>
            <MessageContent>
              <Bubble variant="muted">
                <BubbleContent>{group.text}</BubbleContent>
              </Bubble>
            </MessageContent>
          </Message>
        );
      })}
    </MessageGroup>
  );
}

interface TranscriptTagRendererProps {
  text: string;
  style: TranscriptTagStyle;
}

export function TranscriptTagRenderer({
  text,
  style,
}: TranscriptTagRendererProps) {
  const segments = parseTranscript(text);

  if (style === 'gutter') {
    return <GutterView segments={segments} />;
  }

  return <PillView segments={segments} />;
}

const STORAGE_KEY = 'transcriptTagStyle';

export function loadTagStyle(): TranscriptTagStyle {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pill' || saved === 'gutter') return saved;
  } catch {}
  return 'pill';
}

export function saveTagStyle(style: TranscriptTagStyle): void {
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {}
}
