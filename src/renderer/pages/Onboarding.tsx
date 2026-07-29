import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  Zap,
  CheckCircle,
  ArrowRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/renderer/components/button';
import { usePermissions } from '@/renderer/hooks/usePermissions';

type Step = 'permissions' | 'models' | 'demo';

const MOCK_TRANSCRIPT = `Kevin: Alright, let's get started. Today's main topic is Q3 priorities — we need to decide whether the export feature or dark mode ships first.

Sarah: I've been looking at the timeline and the export feature is more complex than we scoped. CSV is fine but PDF export adds at least two more weeks.

Marcus: Dark mode is basically done on the design side. I finished the token audit last week, it's really just implementation at this point.

Kevin: Okay. What's the business case for each?

Sarah: Export has way more enterprise demand. I've seen about twelve support tickets this month asking for it.

Kevin: Yeah, I think we go export first. Marcus, can we push dark mode to Q4?

Marcus: Yeah, works for me.

Kevin: Great. Sarah, can you own the technical spec?

Sarah: Sure, I can have a draft by end of week. One thing — Tom and Priya are both out in August so we need to be realistic about capacity.

Kevin: Good call. Can you confirm coverage before we lock the timeline?

Sarah: Will do.

Kevin: Marcus, I want a design review on the export flow before Sarah starts building. Can we move design reviews to Tuesdays?

Marcus: Yes, let's do that. I can do next Tuesday.

Kevin: Perfect. Export first, design review Tuesday, Sarah confirms August capacity. Talk next week.`;

const MOCK_SUMMARY = `The team agreed to ship the export feature (CSV + PDF) before dark mode in Q3, driven by ~12 enterprise support requests. Dark mode is design-complete but pushed to Q4. Key risk: two engineers (Tom and Priya) are on PTO in August — timeline needs to account for reduced capacity.`;

const MOCK_DECISIONS = [
  'Export feature ships before dark mode in Q3',
  'Dark mode deferred to Q4',
  'Design reviews move to a fixed Tuesday cadence',
];

const MOCK_ACTION_ITEMS = [
  {
    owner: 'Sarah',
    task: 'Draft technical spec for export feature by end of week',
  },
  { owner: 'Sarah', task: 'Confirm August PTO coverage with the team' },
  { owner: 'Marcus', task: 'Schedule design review for next Tuesday' },
];

const MOCK_TOPICS = [
  'Q3 roadmap',
  'Export feature',
  'Dark mode',
  'August capacity',
  'Design review cadence',
];

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'permissions', label: 'Permissions' },
    { id: 'models', label: 'Models' },
    { id: 'demo', label: 'See It Work' },
  ];
  const currentIndex = steps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-2 mb-10">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                i < currentIndex
                  ? 'bg-green-500 text-white'
                  : i === currentIndex
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white/40'
              }`}
            >
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span
              className={`text-sm ${i === currentIndex ? 'text-white' : 'text-white/40'}`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-px ${i < currentIndex ? 'bg-green-500/50' : 'bg-white/10'}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function PermissionsStep({ onNext }: { onNext: () => void }) {
  const { permissions, openSettings } = usePermissions();
  const micGranted = permissions.microphone === 'granted';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">
          Let's get you set up
        </h2>
        <p className="text-white/60">
          Audio Transformer records your meetings locally. We need microphone
          access to get started.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 p-5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <Mic size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Microphone Access</p>
            <p className="text-xs text-white/50">Required to record meetings</p>
          </div>
        </div>
        {micGranted ? (
          <div className="flex items-center gap-1.5 text-green-400 text-sm">
            <CheckCircle size={16} />
            Granted
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => openSettings('microphone')}
          >
            Open Settings
            <ExternalLink size={13} className="ml-1.5" />
          </Button>
        )}
      </div>

      {!micGranted && (
        <p className="text-xs text-white/40">
          After granting access in System Settings, switch back here — we'll
          detect it automatically.
        </p>
      )}

      <Button className="w-full" disabled={!micGranted} onClick={onNext}>
        Continue
        <ArrowRight size={15} className="ml-1.5" />
      </Button>
    </div>
  );
}

type BarState = 'checking' | 'downloading' | 'complete' | 'error';

function DownloadBar({
  label,
  sublabel,
  percent,
  state,
  error,
  onRetry,
}: {
  label: string;
  sublabel: string;
  percent: number;
  state: BarState;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-white/50">{sublabel}</p>
        </div>
        {state === 'complete' ? (
          <div className="flex items-center gap-1.5 text-green-400 text-sm">
            <CheckCircle size={16} />
          </div>
        ) : state === 'error' ? (
          <span className="text-xs text-red-400">Failed</span>
        ) : state === 'checking' ? (
          <span className="text-xs text-white/60">Checking…</span>
        ) : (
          <span className="text-xs text-white/60">{Math.round(percent)}%</span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={state === 'checking' ? 0 : Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-white transition-all"
          style={{ width: state === 'checking' ? '0%' : `${percent}%` }}
        />
      </div>
      {state === 'error' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-red-400">{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

export function ModelsStep({ onNext }: { onNext: () => void }) {
  const [llmState, setLlmState] = useState<BarState>('checking');
  const [llmPercent, setLlmPercent] = useState(0);
  const [llmError, setLlmError] = useState<string | undefined>(undefined);
  const [llmAttempt, setLlmAttempt] = useState(0);

  const [asrState, setAsrState] = useState<BarState>('checking');
  const [asrPercent, setAsrPercent] = useState(0);
  const [asrError, setAsrError] = useState<string | undefined>(undefined);
  const [asrAttempt, setAsrAttempt] = useState(0);
  // Whisper's progress event fires once per file (config/tokenizer/encoder/
  // decoder); track loaded/total per file and sum them for a true overall
  // percentage rather than using a single event's own `progress` field.
  const asrFileProgress = useRef<
    Record<string, { loaded: number; total: number }>
  >({});

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = window.electronAPI.builtinLlm.on.downloadProgress(
      (...args: unknown[]) => {
        const progress = args[0] as {
          downloadedBytes: number;
          totalBytes: number;
        };
        if (!progress || progress.totalBytes === 0) return;
        setLlmPercent((progress.downloadedBytes / progress.totalBytes) * 100);
      },
    );

    const run = async () => {
      try {
        const status = await window.electronAPI.builtinLlm.getStatus();
        if (cancelled) return;
        if (status.downloaded) {
          setLlmState('complete');
          setLlmPercent(100);
          return;
        }
        setLlmState('downloading');
        const result = await window.electronAPI.builtinLlm.download();
        if (cancelled) return;
        if (result.success) {
          setLlmState('complete');
          setLlmPercent(100);
        } else {
          setLlmState('error');
          setLlmError(result.message ?? 'Download failed');
        }
      } catch (err) {
        if (cancelled) return;
        setLlmState('error');
        setLlmError(String(err));
      }
    };
    run();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [llmAttempt]);

  useEffect(() => {
    let cancelled = false;
    asrFileProgress.current = {};

    const unsubscribe = window.electronAPI.transcriber.on.progress(
      (...args: unknown[]) => {
        const progress = args[0] as {
          file?: string;
          loaded?: number;
          total?: number;
        };
        if (!progress || !progress.file || typeof progress.total !== 'number')
          return;
        asrFileProgress.current[progress.file] = {
          loaded: progress.loaded ?? 0,
          total: progress.total,
        };
        const files = Object.values(asrFileProgress.current);
        const loadedSum = files.reduce((sum, f) => sum + f.loaded, 0);
        const totalSum = files.reduce((sum, f) => sum + f.total, 0);
        if (totalSum > 0) {
          setAsrPercent((loadedSum / totalSum) * 100);
        }
      },
    );

    const run = async () => {
      setAsrState('downloading');
      try {
        const result = await window.electronAPI.settings.model.update({
          selectedModel: 'Xenova/whisper-base',
        });
        if (cancelled) return;
        if (result.success) {
          setAsrState('complete');
          setAsrPercent(100);
        } else {
          setAsrState('error');
          setAsrError(result.message ?? 'Download failed');
        }
      } catch (err) {
        if (cancelled) return;
        setAsrState('error');
        setAsrError(String(err));
      }
    };
    run();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [asrAttempt]);

  const bothComplete = llmState === 'complete' && asrState === 'complete';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">
          Downloading your models
        </h2>
        <p className="text-white/60">
          Everything runs on your device. This happens once.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 p-5 space-y-5 bg-white/5">
        <DownloadBar
          label="AI Summarization Model"
          sublabel="Qwen2.5 1.5B · ~1.1 GB"
          percent={llmPercent}
          state={llmState}
          error={llmError}
          onRetry={() => {
            setLlmState('checking');
            setLlmPercent(0);
            setLlmError(undefined);
            setLlmAttempt((n) => n + 1);
          }}
        />
        <DownloadBar
          label="Speech Recognition Model"
          sublabel="Whisper Base · ~142 MB"
          percent={asrPercent}
          state={asrState}
          error={asrError}
          onRetry={() => {
            setAsrState('checking');
            setAsrPercent(0);
            setAsrError(undefined);
            setAsrAttempt((n) => n + 1);
          }}
        />
      </div>

      <Button className="w-full" disabled={!bothComplete} onClick={onNext}>
        Continue
        <ArrowRight size={15} className="ml-1.5" />
      </Button>
      {!bothComplete && (
        <p className="text-xs text-white/40 text-center">
          This can take a few minutes on a slow connection.
        </p>
      )}
    </div>
  );
}

function DemoStep() {
  const navigate = useNavigate();
  const [showOutput, setShowOutput] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setShowOutput(true);
    }, 1800);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">
          See it in action
        </h2>
        <p className="text-white/60">
          Here's a sample meeting transcript. Hit the button below to see what
          Audio Transformer generates for you after every call.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Sample Transcript — Q3 Sync
          </span>
          <span className="text-xs text-white/30">14 min</span>
        </div>
        <div className="px-4 py-4 max-h-48 overflow-y-auto space-y-3 text-sm text-white/70 leading-relaxed">
          {MOCK_TRANSCRIPT.split('\n\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>

      {!showOutput ? (
        <Button
          className="w-full"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 size={15} className="animate-spin mr-2" />
              Generating summary…
            </>
          ) : (
            <>
              <Zap size={15} className="mr-2" />✨ Generate Meeting Summary
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                Summary
              </p>
              <p className="text-sm text-white/80 leading-relaxed">
                {MOCK_SUMMARY}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                Key Decisions
              </p>
              <ul className="space-y-1">
                {MOCK_DECISIONS.map((d, i) => (
                  <li key={i} className="text-sm text-white/70 flex gap-2">
                    <span className="text-white/30 mt-0.5">•</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                Action Items
              </p>
              <ul className="space-y-2">
                {MOCK_ACTION_ITEMS.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <div className="w-4 h-4 mt-0.5 rounded border border-white/20 flex-shrink-0" />
                    <span className="text-white/70">
                      <span className="text-white/90 font-medium">
                        {item.owner}
                      </span>{' '}
                      — {item.task}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                Topics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MOCK_TOPICS.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={async () => {
              try {
                await window.electronAPI.onboarding.setCompleted(true);
              } catch {
                // A failed flag write must not trap the user on onboarding.
              }
              navigate('/');
            }}
          >
            Enter the App
            <ArrowRight size={15} className="ml-1.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState<Step>('permissions');

  return (
    <div className="flex bg-[#111] items-center justify-center p-8 min-h-screen">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-1">
            Audio Transformer
          </p>
          <StepIndicator current={step} />
        </div>

        {step === 'permissions' && (
          <PermissionsStep onNext={() => setStep('models')} />
        )}
        {step === 'models' && <ModelsStep onNext={() => setStep('demo')} />}
        {step === 'demo' && <DemoStep />}
      </div>
    </div>
  );
}
