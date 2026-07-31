# VOA v2: The Meeting Lifecycle

Status: **draft v0.1, for discussion.** Nothing here is approved for implementation.

## The premise

v1 treats a meeting as an audio file that becomes a transcript that becomes a
summary. The meeting exists in the app only _after_ it happens.

v2 treats a meeting as an object with a life: it exists before the audio, it
accumulates during, and it resolves after. The app becomes the place you keep
meeting notes across all three, not a transcription tool that happens to store
things.

Three phases:

1. **Before**: research and prep. What do I know about this person, what
   happened last time, what do I want to land this time.
2. **During**: reminders. Surface the things I decided to say, and track
   whether I've said them.
3. **After**: resolution. What did we decide, what did I commit to, what did I
   mean to raise and never got to.

## The spine: talking points

The single object that connects all three phases is a **talking point**. Not a
briefing document. A document is read once and forgotten; a talking point has
state that moves through the meeting.

```
TalkingPoint {
  id
  text          // "Ask about their Q3 migration timeline"
  rationale     // why this is here, shown on hover/expand
  source        // 'user' | 'history' | 'llm' — where it came from
  status        // 'planned' | 'raised' | 'missed'
  evidence      // transcript chunk + timestamp that marked it raised
}
```

Phase 1 produces them. Phase 2 surfaces the `planned` ones and flips them to
`raised`. Phase 3 reports on what's still `missed` and rolls those forward.

This is the thing none of the reference projects (tavily-ai/meeting-prep-agent,
Natively, Meetily) have. They all stop at "generate a document."

## Data model changes

### A meeting needs to exist before it is recorded

Today `Recording` is created at save time in `store/meetings.ts:11`, populated
from a finished recording. There is no object representing a meeting that
hasn't happened.

**Position:** introduce a separate `preps` collection rather than making
`Recording` nullable everywhere. A prep is keyed by calendar event id, holds the
talking points and the prep chat, and links to a `Recording` id once the meeting
is actually recorded. The existing recording pipeline stays untouched, which
matters given how much of it is working and tested.

The alternative (one object with a `status: 'scheduled' | 'recorded'`) is
cleaner on paper but forces changes through `saveMeeting`, `normalizeRecording`,
the migrations, and every renderer view that assumes a transcript exists.

### People need to be a real entity

`Recording.participants` is `string[]` free text (`store/schema.ts:27`). Phase 1
asks "have I met this person before", which needs a stable key. The ICS provider
already parses `ATTENDEE` into `{ name, email }`
(`ics-feed-calendar-provider.ts:48`), so email is the natural key. Free-text
participants stay as a display field; the person index is separate and derived.

### The 30 meeting cap is a blocker

`MAX_MEETINGS = 30` in `store/meetings.ts:7` evicts older meetings. Phase 1's
whole value is "what happened last time with this person," and last time may be
six months and 40 meetings ago. Long-term memory and an eviction policy tuned
for a JSON blob are in direct conflict.

This needs resolving before phase 1 is worth building. Options: raise the cap
and accept a large JSON file, move transcripts to individual files with an
index, or keep full records for N months and retain only summaries beyond that.
Third option is probably right, since RAG over summaries is cheaper anyway.

## Phase 1: Before

**Trigger.** Calendar lookahead. Note the gap: `CalendarProvider` today only
exposes `findMatchingEvents(atTime)`, which searches a 10 minute buffer around
_now_ for matching a recording in progress (`pipeline/types.ts:57`). Phase 1
needs "what's coming up in the next N hours/days," which is a new method on the
interface.

**Inputs.**

- The calendar event: title, time, attendees.
- History: past transcripts, summaries, and unresolved action items involving
  those attendees.
- Whatever the user brings: pasted notes, a job description, a deal doc.

**Interaction.** This is the part that differs most from the reference repos.
Theirs is `POST /api/analyze-meetings` with a date. Ours is a **conversation**
with a local model, grounded in the retrieved history. You talk through the
meeting, and the talking points fall out of the conversation. The generated
brief is a byproduct, not the product.

`node-llama-cpp` already backs this (`pipeline/llama-process.ts:53` creates a
`LlamaChatSession`). Multi-turn chat means not calling `resetChatHistory()` and
adding token streaming.

**Output.**

- A set of talking points, editable by hand. The user must be able to add, edit,
  and delete; LLM-generated points that can't be corrected are worse than none.
- A short brief for context: who this is, what happened last time, what's open.

**Explicit non-goal for v2.0: web research.** Tavily's version is web-first
because Tavily sells search. Our primary source is the user's own history, and
every web call about a named attendee contradicts "no cloud, no account
required." If web research lands, it is opt-in, off by default, and clearly
marked as leaving the machine.

**Done when:** the user has a short, edited list of things they want to say, and
knows what happened last time.

## Phase 2: During

**What it is not.** This is not a copilot that tells you what to say. It does
not generate answers to what the other person just said. It surfaces _your own_
prepared points and tracks them. That distinction keeps the product honest and
keeps the latency budget sane.

**Mechanism.** A second rolling pass alongside the one that already exists.
`structured-summarizer.ts:34` already runs a rolling prompt that merges new
transcript segments into a cumulative summary during recording. The new pass
takes the talking points plus the transcript so far and answers one question:
which points have been raised?

That is a much cheaper prompt than summarization, and it's a good fit for the
bundled Qwen 1.5B while the bigger model handles the summary.

**Cadence and latency.** Runs on the same chunk cadence as the rolling summary.
No new streaming ASR requirement, which is the expensive thing we avoid by not
building a copilot.

**Surface.** Passive and glanceable. Unraised points, dimmed as they get raised.
Never modal, never a popup mid-sentence. The existing notification window
(`notification-window.ts`) is the closest precedent for a non-intrusive surface,
though this probably wants its own panel.

**Done when:** the user can glance and see "3 of 5 covered, pricing not yet
raised" without breaking their attention.

## Phase 3: After

Mostly built already. `StructuredSummaryResult`
(`structured-summarizer.ts:24`) produces summary, decisions, topics, and action
items, and `Recording` stores them.

**What's new is the loop closing:**

- **Coverage report.** Planned vs raised vs missed. "You meant to bring up the
  migration timeline and never did" is a genuinely useful output and falls out
  of the phase 2 state for free.
- **Follow-up draft.** Missed points plus action items plus decisions, composed
  into something the user can send. Generated locally, never sent by the app.
- **Feed forward.** Missed points and open action items become candidate talking
  points for the next meeting with that person. This is what makes phase 3's
  output phase 1's input, and it is the thing that makes the app compound in
  value instead of producing 40 disconnected transcripts.

**Done when:** the user has a sendable follow-up, and the next meeting with this
person starts pre-loaded with what was left open.

## What already exists

| Need                              | Status                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| Calendar event with attendees     | `ics-feed-calendar-provider.ts`, needs a lookahead method     |
| Local chat model                  | `node-llama-cpp` wired, chat history currently reset per call |
| Bigger model for quality output   | LM Studio / Ollama HTTP path                                  |
| Rolling analysis during recording | `ROLLING_PROMPT_TEMPLATE`                                     |
| Post-meeting structure            | summary, decisions, topics, action items                      |
| Model tiering (cheap vs quality)  | both providers exist, not yet used by task                    |
| Embeddings for retrieval          | `@huggingface/transformers` present, unused for this          |
| Vector storage                    | none                                                          |
| Person index                      | none                                                          |
| Long-term retention               | blocked by `MAX_MEETINGS = 30`                                |

## Constraints

- **Local first.** Anything that sends a named person's data off the machine is
  opt-in and visible.
- **Don't destabilize the recording pipeline.** Phases 1 and 3 can be built
  almost entirely alongside it. Phase 2 is the only one that touches recording
  in progress.
- **`onnxruntime-node` caution.** Embeddings would run through the same native
  library implicated in `whisper-onnxruntime-crash.md`. Much smaller models and
  allocations, but the same binary, and worth an isolated test before
  committing.
- **Storage is a JSON blob.** electron-store is fine for 30 meetings and
  preferences. It is not fine for hundreds of transcripts plus embeddings.

## Open questions

1. **What is the memory key: the person, or the thread?** Retrieving by attendee
   email is simple. But a recurring "Acme weekly sync" with rotating attendees
   is arguably one continuous thread. Person-keyed is my recommendation for
   v2.0, with the calendar's recurring event id as a second key if it proves
   necessary.

2. **How much retention, and where?** Directly blocks phase 1. Needs a decision
   before that phase is worth starting.

3. **Is the prep interaction free-form chat, or guided?** Free chat is more
   flexible and less work. A guided flow ("who is this, what's your goal, what's
   the risk") produces better talking points from a 1.5B model. Possibly guided
   prompts inside a free chat.

4. **Does phase 2 need a talking points panel, or does it live in the existing
   recording UI?** Affects how much renderer work phase 2 is.

5. **Does retrieval need embeddings at all for v2.0?** With a person-keyed
   index, "give me the last 3 meetings with this email" is a filter, not a
   similarity search. Embeddings only start earning their place when the user
   asks open questions across all history. Starting without them is defensible
   and much cheaper.

6. **Sales or interviews?** The phases are the same shape, but "things to say"
   for a sales call and for an interview want different prompts and different
   defaults. Worth knowing which one the first version is tuned for.
