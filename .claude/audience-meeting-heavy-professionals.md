# Audience: Meeting-Heavy, Non-Technical Professionals

This file and its sibling `.claude/audience-engineers-and-makers.md` are the source of
truth for `docs/index.html` and `README.md` respectively. Every persuasive claim in
this document must be traceable to code or to a verified project fact, not to
aspiration. If a claim here cannot be traced, it does not go on the marketing page.

## Who this is for

People whose calendar is a wall of colored blocks from nine to five, and whose actual
work happens in the fifteen minutes between them. Project and product managers running
standups and stakeholder reviews. Consultants and account managers on client calls all
day. Recruiters doing back-to-back candidate screens. Teachers and researchers sitting
in interviews, office hours, and committee meetings. Clinicians moving from one
patient conversation to the next. Founders who are in five meetings before lunch and
writing code, or selling, or hiring, in whatever is left.

None of them write code. None of them know what a model is, in the AI sense. They open
a laptop, join a call, talk, and need to remember what was said and who is supposed to
do what afterward. Their day is measured in conversations, not tickets or commits.

## The problem in their words

"I can't actually listen when I'm also trying to type everything down."

"I said I'd follow up on something in that meeting three days ago and I have no idea
what it was."

"My notes from that call are just a wall of text. I'm never going to read that again."

"Somebody has to write the recap email and it's always me."

"I know we decided something in that meeting, I just can't tell you what, or who
owns it now."

The pain is not that meetings happen. It is that meetings produce nothing durable
unless someone burns their own attention turning them into notes, and that job
usually falls on the person who can least afford to stop listening.

## Why they have not already solved this

- **The bot is the problem.** Most recording tools join the call as a visible
  participant with its own name and avatar. People notice it, some ask about it, and
  some employers ban it outright, especially in regulated or client-facing work.
  Showing up as an obvious third party in the call changes how people talk.
- **They are not allowed to upload the conversation.** Client calls, patient
  conversations, and candidate interviews are often covered by confidentiality
  agreements, HIPAA-adjacent expectations, or plain company policy that forbids
  sending audio to a third-party server. This is a hard no for a lot of this
  audience's employers, not a preference.
- **Another subscription.** Most of what exists in this category is a paid,
  cloud-hosted product with a monthly fee. That is a purchase decision, an approval
  process, and a recurring cost, for something a single person wants to try.
  VOA is free, MIT licensed, no account and no subscription.
- **Setup friction per meeting.** Tools that require inviting a bot to a specific
  calendar event, or connecting to a specific meeting platform's API, add a step
  before every single call. If the tool is not already running, it is not going to
  get used.

## What actually lands, ranked

1. **Nobody in the meeting knows a recorder is running.**
   One-line phrasing: "There's no bot, no dial-in, nothing that shows up in the
   meeting for anyone else to notice."
   Verified fact: VOA runs locally on the user's own Mac and captures audio directly;
   it does not join the call as a participant, so other attendees see nothing and are
   not notified by the tool.

2. **Your conversation never leaves your Mac.**
   One-line phrasing: "Nothing about what you say gets uploaded anywhere. It stays on
   your computer."
   Verified fact: the only internet address the app contacts is huggingface.co, and
   only once, to download the AI models the first time you use it. There is no
   telemetry, no analytics, and no account system, so there is nothing to send your
   audio or text to even if the app wanted to.

3. **The recording itself is never kept as a sound file.**
   One-line phrasing: "The app listens and writes down what's said as it happens.
   It doesn't keep the audio afterward, only the text."
   Verified fact: confirmed by reviewing the entire codebase, there is no code path
   anywhere in the app that writes audio to disk. Speech is converted to text while
   it happens and only that text is stored.

4. **You get a summary, decisions, and action items, not a transcript to reread.**
   One-line phrasing: "You get a short summary, a list of what was decided, and a
   list of what people are supposed to do next, not a giant wall of text."
   Verified fact: the app's output is structured into a summary, a decisions list, an
   action items list, and topic tags, rather than a raw transcript dump.

5. **It works for any conversation, not just video calls.**
   One-line phrasing: "It's not tied to Zoom or Teams. It works for in-person
   meetings, phone calls on speaker, even voice memos to yourself."
   Verified fact: the app captures from the microphone and system audio rather than
   integrating with a specific meeting platform's API, so it works for any audio
   source, and it automatically labels a recording when it detects Zoom, Teams,
   Google Meet, or Slack is the active app.

6. **It's free, with no catch.**
   One-line phrasing: "It's free and open source. No subscription, no account."
   Verified fact: VOA is free and MIT licensed, with no account system and no
   subscription.

7. **One shortcut, works from anywhere.**
   One-line phrasing: "One keyboard shortcut starts and stops it, from whatever
   you're doing."
   Verified fact: a single global shortcut, Cmd+Shift+Space, starts and stops
   recording from any app. A separate shortcut, F2, transcribes speech and types it
   directly into whatever window is focused.

## Words to use and words to avoid

| Avoid                          | Use instead                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Whisper                        | the speech recognition model, or just "it listens and writes down what's said" |
| GGUF                           | (do not mention; it is a file format detail, not a benefit)                    |
| VAD (voice activity detection) | "it only processes when someone is actually talking"                           |
| ONNX                           | (do not mention; internal implementation detail)                               |
| IPC                            | (do not mention; internal implementation detail)                               |
| utilityProcess                 | (do not mention; internal implementation detail)                               |
| quantization                   | (do not mention, or if needed, "a smaller, faster version of the model")       |
| inference                      | "processing," or just describe what happens: "it writes down what's said"      |
| local LLM                      | "a small AI model that runs on your Mac"                                       |
| on-device model                | "runs entirely on your Mac," or "nothing leaves your computer"                 |

General rule: if a term requires the reader to already know what a model, a runtime,
or a process boundary is, it does not belong on the page. Describe what the software
does for the person, not how it is built.

## What we must never claim

- **Never state a specific data retention or deletion policy unless it is verified
  in the code that ships.** The page previously said audio was "saved locally and
  deleted automatically three days after each recording." That was false: it
  described a retention policy that was in a changelog entry but never implemented in
  code, and it was published as a concrete privacy promise before anyone caught it.
  A privacy claim on this page is the single highest-risk sentence in the project.
  This audience decides whether to trust the tool based on exactly this kind of
  statement, and being wrong about it is not a bug, it is a broken promise about
  someone else's confidential conversation. Rule: every privacy claim in
  `docs/index.html` must be verified against the actual code before it is published,
  not assumed from a plan, a changelog entry, or a roadmap item.
- **Never promise verbatim or court-admissible transcription accuracy.** The default
  model is a mid-size model chosen for speed, and the two most accurate models are
  currently disabled due to a known crash. Say the transcription is good for
  following along and generating notes, not that it is perfect.
- **Never imply the summary is produced by a large, frontier-grade AI.** It runs on a
  small, 1.5-billion-parameter local model. It is reliable at producing structured
  output, not at deep reasoning. Do not compare it to ChatGPT-class models in
  capability.
- **Never claim cross-platform support.** VOA is macOS only. Do not imply a Windows
  or mobile version exists or is imminent unless it actually ships.
- **Never claim a one-click install exists** if it does not. See the installability
  gap below.
- **Never frame the tool's invisibility to other participants as a way to record
  people without their knowledge.** See the next section; this is a hard rule, not a
  style preference.

## Consent and the ethics line

This audience will use VOA on conversations involving other people: clients,
patients, candidates, students, colleagues. Consent law for recording conversations
varies by jurisdiction, and several places require the consent of every party on the
call, not just the person doing the recording.

VOA is invisible to other participants by design. That is a genuine, verified
advantage: no bot joins the call, nothing announces itself, nobody sees a new name in
the participant list. It is also, precisely because of that, a real risk: the same
property that makes the product good is what would make it attractive to market as a
tool for covert recording. That would be an ethical problem and, in many
jurisdictions, a legal one.

The rule for this project: marketing copy may say the tool is not disruptive and does
not put a bot in the call. It must never frame that invisibility as a way to record
people without their knowledge. No wording like "nobody has to know," "record
secretly," or anything that reads as an invitation to hide the recording from the
other people on the call.

Recommendation: `docs/index.html` should carry a brief, non-preachy line encouraging
users to tell the people they are meeting with that they are taking AI notes. This is
not just a legal hedge, it is simply better practice, and it costs the product
nothing since the value proposition ("no visible bot") survives disclosure perfectly
well: a human saying "I'm using an AI note-taker" is not disruptive in the way a bot
joining the call is.

This document is not legal advice, and the project should not offer any. Do not add
jurisdiction-specific consent guidance to the marketing page. If a user needs to know
whether their state or country requires all-party consent, that is their
responsibility to find out, and the page should not pretend to answer it for them.

## What we honestly cannot offer them yet

- **There is no downloadable app.** Zero releases exist today. The only way to
  install VOA is to clone the code repository and build it with developer tools. For
  a non-technical reader this is, realistically, a hard blocker: they are not going
  to open a terminal. The page must state this plainly rather than implying a normal
  install exists. Do not write copy that assumes a download link, a `.dmg`, or an App
  Store listing.
- **macOS only.** No Windows, no Linux, no phone app of any kind.
- **Meeting recording needs macOS 14 Sonoma or later.** Dictation alone works back to
  macOS 13 Ventura, but full recording does not.
- **The first run needs about 1.2 GB downloaded** and an internet connection to get
  the AI models, before anything works offline.
- **Accuracy is good, not perfect**, and the two most accurate transcription models
  are currently turned off because of a known crash. For a clinician or a recruiter
  who might care about precise wording, set that expectation up front rather than let
  them discover it.
- **The summary is produced by a small, local model.** It reliably produces
  structured notes, but it is not going to catch subtle nuance the way a person or a
  large cloud model might.

Given the installability gap, this audience is realistically not going to be able to
use VOA today unless someone technical installs it for them, or a packaged release
ships. That is worth being honest about internally, even if the page focuses on
capability rather than dwelling on the gap.

## How this maps to docs/index.html

In the order a visitor encounters the page:

1. **Hero / above the fold.** Lead with message #1 and #2 combined: no bot in your
   meeting, nothing uploaded. This is the strongest, most specific hook for this
   audience and should be the first thing they read, in plain language, not
   technical language.
2. **First feature section.** Message #4, structured output over transcript dump.
   Show what they actually get after a meeting: summary, decisions, action items.
   This is the "what do I get" answer that justifies reading further.
3. **Privacy section.** Message #3, audio is never kept as a file, stated carefully
   and only using language verified in this document. Pair it with the consent line
   from the "Consent and the ethics line" section above: encourage users to tell
   people they are taking AI notes. Do not state a retention or deletion policy.
4. **"Works everywhere you meet" section.** Message #5, not tied to a video call
   platform, works for in-person conversations and phone calls too. This broadens the
   audience beyond people who only take video calls.
5. **Pricing / cost section, if one exists.** Message #6, free and open source, no
   subscription, no account.
6. **Install / getting started section.** This is where the installability gap must
   be surfaced honestly, not buried. State plainly that this currently requires
   building from source, name the macOS version requirement, and name the roughly
   1.2 GB first-run download. Do not let the rest of the page's polish imply an
   easier install than what actually exists.
7. **Anywhere shortcuts are mentioned.** Message #7, Cmd+Shift+Space to start and
   stop, F2 for dictation, works can be a small supporting detail near the top or in
   a "how it works" section, not the headline.

## Open questions

- Should `docs/index.html` have a distinct visitor path for this audience versus the
  engineers-and-makers audience, or one page that serves both with the technical
  detail placed lower down? Right now this document assumes one page, ordered so the
  non-technical hook comes first.
- How should the page handle the installability gap without discouraging every
  non-technical visitor outright? An honest statement plus a "have someone technical
  set this up for you" framing is one option, but that has not been agreed on.
- Once Small/Medium Whisper models are re-enabled (see
  `docs/whisper-onnxruntime-crash.md`), does the accuracy framing in this document
  need to change, and should that trigger a page update?
- Is there an appetite for a packaged, double-click installer as a prerequisite
  before this audience is actively marketed to at all, given how hard the current
  install blocker is for a non-technical reader?
- Should the consent-disclosure line be a one-time note near the privacy section, or
  should it also appear near the shortcut/getting-started instructions, closer to
  where a user would actually start a recording?
