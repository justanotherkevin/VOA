import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  Zap,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/renderer/components/button';
import { usePermissions } from '@/renderer/hooks/usePermissions';

type Step = 'permissions' | 'lmstudio' | 'demo';

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
    { id: 'lmstudio', label: 'AI Setup' },
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

function LmStudioStep({ onNext }: { onNext: () => void }) {
  const [url, setUrl] = useState('http://localhost:1234');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message?: string;
  } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await window.electronAPI.lmStudio.testConnection(url);
      setResult(res ?? { ok: false });
    } catch {
      setResult({ ok: false });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">
          Connect your AI
        </h2>
        <p className="text-white/60">
          Audio Transformer uses a local AI to generate summaries and action
          items — your data never leaves your machine.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 p-5 space-y-4 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">LM Studio</p>
            <p className="text-xs text-white/50">
              Don't have it?{' '}
              <button
                className="text-white/70 underline"
                onClick={() =>
                  window.electronAPI.shell.openExternal('https://lmstudio.ai')
                }
              >
                Download at lmstudio.ai
              </button>
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="lm-url"
            className="text-xs text-white/50 mb-1.5 block"
          >
            Server URL
          </label>
          <input
            id="lm-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="border-white/20  hover:bg-white/10 hover:text-white"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? (
              <Loader2 size={13} className="animate-spin mr-1.5" />
            ) : null}
            Test Connection
          </Button>
          {result && (
            <div
              className={`flex items-center gap-1.5 text-sm ${result.ok ? 'text-green-400' : 'text-red-400'}`}
            >
              {result.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {result.ok ? 'Connected' : 'Could not connect'}
            </div>
          )}
        </div>
      </div>

      {!result?.ok && (
        <p className="text-xs text-white/40">
          Open LM Studio → Local Server tab → Start Server, then test again.
        </p>
      )}

      <Button className="w-full" disabled={!result?.ok} onClick={onNext}>
        Continue
        <ArrowRight size={15} className="ml-1.5" />
      </Button>
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

          <Button className="w-full" onClick={() => navigate('/')}>
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
          <PermissionsStep onNext={() => setStep('lmstudio')} />
        )}
        {step === 'lmstudio' && <LmStudioStep onNext={() => setStep('demo')} />}
        {step === 'demo' && <DemoStep />}
      </div>
    </div>
  );
}
