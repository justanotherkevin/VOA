import React from 'react';

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
  const groups = groupSegments(segments);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {groups.map((group, i) => (
        <div
          key={i}
          style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}
        >
          <div
            style={{
              flexShrink: 0,
              width: '18px',
              textAlign: 'right',
              paddingTop: '2px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: group.src ? srcColor(group.src) : 'transparent',
              opacity: group.src ? 0.75 : 0,
              userSelect: 'none',
            }}
          >
            {group.src ? srcLabel(group.src) : '·'}
          </div>
          <div style={{ flex: 1 }}>{group.text}</div>
        </div>
      ))}
    </div>
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
