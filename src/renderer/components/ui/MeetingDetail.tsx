import React, { useState, useEffect } from 'react';
import {
  AlignLeft,
  MessageSquare,
  CheckSquare,
  Copy,
  Mic,
  Trash2,
  Check,
  Lightbulb,
  Tag,
  Loader2,
  Sparkles,
  Download,
} from 'lucide-react';
import type { Meeting } from '@/renderer/hooks/useMeetings';
import {
  TranscriptTagRenderer,
  loadTagStyle,
  saveTagStyle,
  type TranscriptTagStyle,
} from './TranscriptTagRenderer';

interface MeetingDetailProps {
  meeting: Meeting | null;
  summarizerReady: boolean;
  onDelete?: (id: string) => void;
  onTitleChange?: (id: string, title: string) => void;
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (!ms) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function useCopyText() {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return { copied, copy };
}

const HAS_TAGS_RE = /\[(Meeting|Mic)\]/i;

export function MeetingDetail({
  meeting,
  summarizerReady,
  onDelete,
  onTitleChange,
}: MeetingDetailProps) {
  const { copied, copy } = useCopyText();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [tagStyle, setTagStyle] = useState<TranscriptTagStyle>(loadTagStyle);

  useEffect(() => {
    if (enriching && meeting?.summaryStatus === 'ready') setEnriching(false);
  }, [enriching, meeting?.summaryStatus]);

  const handleEnrich = async () => {
    if (!meeting || enriching) return;
    setEnriching(true);
    await window.electronAPI.meetings.enrich(meeting.id);
  };

  const handleTagStyleChange = (style: TranscriptTagStyle) => {
    setTagStyle(style);
    saveTagStyle(style);
  };

  const hasTags = meeting
    ? HAS_TAGS_RE.test(meeting.transcript) ||
      HAS_TAGS_RE.test(meeting.summary ?? '')
    : false;

  if (!meeting) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#111] text-gray-600">
        <div className="text-center">
          <Mic size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a meeting to view details</p>
          <p className="text-xs mt-1 opacity-60">or start a new recording</p>
        </div>
      </div>
    );
  }

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

  const fullText = [
    meeting.title,
    meeting.summary ? `\nOverview:\n${meeting.summary}` : '',
    meeting.decisions.length > 0
      ? `\nKey Decisions:\n${meeting.decisions.map((d) => `• ${d}`).join('\n')}`
      : '',
    meeting.topics.length > 0 ? `\nTopics: ${meeting.topics.join(', ')}` : '',
    meeting.actionItems.length > 0
      ? `\nAction Items:\n${meeting.actionItems.map((a) => `[${a.done ? 'x' : ' '}] ${a.text}`).join('\n')}`
      : '',
    `\nTranscript:\n${meeting.transcript}`,
  ]
    .filter(Boolean)
    .join('');

  const summaryReady = meeting.summaryStatus === 'ready';
  const summaryPending = meeting.summaryStatus === 'pending' || enriching;
  const summaryNotStarted = meeting.summaryStatus === 'not-started' && !enriching;

  const shouldShowSideDetails =
    (summaryReady && meeting.decisions.length > 0) ||
    (summaryReady && meeting.topics.length > 0) ||
    meeting.actionItems.length > 0 ||
    summaryPending;
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#111]">
      {/* Header */}
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
                  <span className="capitalize">
                    {meeting.audioSource} audio
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => copy(fullText)}
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

      {/* Sidebar split body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: Overview + Transcript */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* Overview */}
          <Section icon={<AlignLeft size={15} />} title="Overview">
            {summaryPending && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 size={13} className="animate-spin" />
                <span>Generating summary…</span>
              </div>
            )}
            {meeting.summaryStatus === 'failed' && (
              <p className="text-sm text-gray-600 italic">
                Summary unavailable.
              </p>
            )}
            {meeting.isMeeting && summaryNotStarted && !summarizerReady && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-[#2a2a2a] bg-[#161616]">
                <Download size={15} className="text-gray-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-gray-300 font-medium">Get AI meeting insights</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Download the AI model in{' '}
                    <span className="text-gray-400">Settings → Transcription</span>{' '}
                    to extract summary, decisions, topics, and action items.
                  </p>
                </div>
              </div>
            )}
            {meeting.isMeeting && summaryNotStarted && summarizerReady && (
              <button
                onClick={handleEnrich}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'rgba(124,111,247,0.12)', color: '#a59ef5', border: '1px solid rgba(124,111,247,0.2)' }}
              >
                <Sparkles size={14} />
                Meeting details
              </button>
            )}
            {summaryReady && meeting.summary && (
              <div className="text-gray-300 text-sm leading-relaxed">
                {HAS_TAGS_RE.test(meeting.summary) ? (
                  <TranscriptTagRenderer
                    text={meeting.summary}
                    style={tagStyle}
                  />
                ) : (
                  meeting.summary
                )}
              </div>
            )}
            {summaryReady && !meeting.summary && (
              <p className="text-sm text-gray-600 italic">
                No summary available.
              </p>
            )}
          </Section>

          {/* Full Transcript */}
          <Section
            icon={<MessageSquare size={15} />}
            title="Transcript"
            action={
              hasTags ? (
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => handleTagStyleChange('pill')}
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
                    onClick={() => handleTagStyleChange('gutter')}
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
            {meeting.transcript ? (
              <div className="text-gray-400 text-sm font-mono leading-relaxed whitespace-pre-wrap">
                {hasTags ? (
                  <TranscriptTagRenderer
                    text={meeting.transcript}
                    style={tagStyle}
                  />
                ) : (
                  meeting.transcript
                )}
              </div>
            ) : (
              <p className="text-gray-600 text-sm italic">
                No transcript available
              </p>
            )}
          </Section>
        </div>

        {/* Right column: Decisions, Topics, Action Items */}
        <div className="max-w-56 shrink-0">
          {/* Key Decisions — hidden when empty */}
          {shouldShowSideDetails && (
            <div className="border-l border-[#1e1e1e] bg-[#0f0f0f] overflow-y-auto px-4 py-6 space-y-6">
              {summaryReady && meeting.decisions.length > 0 && (
                <SideSection
                  icon={<Lightbulb size={13} />}
                  title="Key Decisions"
                >
                  <ul className="space-y-2">
                    {meeting.decisions.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed"
                      >
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: 'rgba(124,111,247,0.7)' }}
                        />
                        {d}
                      </li>
                    ))}
                  </ul>
                </SideSection>
              )}

              {/* Topics */}
              {summaryReady && meeting.topics.length > 0 && (
                <SideSection icon={<Tag size={13} />} title="Topics">
                  <div className="flex flex-wrap gap-1.5">
                    {meeting.topics.map((t, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full border"
                        style={{
                          background: 'rgba(124,111,247,0.1)',
                          borderColor: 'rgba(124,111,247,0.25)',
                          color: '#a59ef5',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </SideSection>
              )}

              {/* Action Items */}
              {meeting.actionItems.length > 0 && (
                <SideSection
                  icon={<CheckSquare size={13} />}
                  title="Action Items"
                >
                  <ul className="space-y-2">
                    {meeting.actionItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span
                          className={`mt-0.5 w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${
                            item.done
                              ? 'bg-green-600 border-green-600'
                              : 'border-[#3a3a3a]'
                          }`}
                        >
                          {item.done && (
                            <Check size={8} className="text-white" />
                          )}
                        </span>
                        <span
                          className={
                            item.done
                              ? 'text-gray-600 line-through'
                              : 'text-gray-300'
                          }
                        >
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </SideSection>
              )}

              {/* Pending / failed state in sidebar */}
              {summaryPending && (
                <SideSection
                  icon={<Lightbulb size={13} />}
                  title="Key Decisions"
                >
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Loader2 size={11} className="animate-spin" />
                    <span>Generating…</span>
                  </div>
                </SideSection>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-500">{icon}</span>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
        {action}
      </div>
      <div className="pl-5">{children}</div>
    </div>
  );
}

function SideSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-gray-600">{icon}</span>
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div>{children}</div>
    </div>
  );
}
