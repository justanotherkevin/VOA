# Design Guide

Design tokens and rules for this app's UI, in the spirit of Apple's HIG:
reduction over decoration, a small number of values used consistently
rather than many values used once. Read this before adding or tweaking
sizing, spacing, radii, or typography in `src/renderer/`.

## The rule

**A new size must earn its place.** Before reaching for an arbitrary
Tailwind value (`text-[11.5px]`, `w-[23px]`, `rounded-[18px]`), check:

1. Does an existing token already serve this role? Use it, even if it's
   half a pixel off from what a design tool exported. Two elements that
   are _supposed_ to look equally important should be the same size —
   don't let a mockup's rounding error become a permanent third size.
2. Is this a genuinely new semantic role (not just a new value)? If yes,
   add a named token to `src/renderer/App.css`'s `@theme inline` block and
   use it everywhere that role appears — never a one-off bracket value.
3. Is this truly one-off (a single decorative flourish, not a role)? Only
   then is an arbitrary value acceptable, and it should be rare.

If you're about to add a 4th or 5th size to a scale that already has 3,
stop and ask whether two of the existing ones should just be merged.

## Type scale

Tailwind's own scale (`text-xs` = 12px, `text-sm` = 14px, etc.) covers
normal UI text — use it for anything that isn't compact chrome. Below
12px, this app defines exactly three roles, no more:

| Token          | Size | Role                                                                                                                                                                        |
| -------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text-compact` | 13px | Primary text in compact/dense UI (a pill's title, a HUD's headline)                                                                                                         |
| `text-detail`  | 11px | Supporting text at equal weight — subtitle, button label, badge. If two elements are both "secondary," they get the same size even if they're different _kinds_ of element. |
| `text-caption` | 10px | Tracked, uppercase micro-labels only (e.g. a waveform's "System"/"Mic" caption). Not for anything that reads as a sentence.                                                 |

These live in `src/renderer/App.css`'s `@theme inline` block. Origin
story: the notification pill originally had five sizes (12.5/11.5/11/
10.5/9px) — one per element, extracted from a design-tool export rather
than designed. They collapsed to these three because the button, badge,
and subtitle were never actually a different _role_ from each other, just
a different _element_.

## Spacing & sizing

Prefer Tailwind's default spacing scale (`gap-3`, `px-4`, `py-2.5`, etc.)
— it's already a consistent 4px-based grid; don't invent a parallel one.
Only add a named `--spacing-*` token when a value is reused across
components (e.g. `--spacing-icon-sm: 1.875rem` for the 30px status-icon
circle) or is load-bearing for a specific component's geometry (e.g. the
notification pill's `--spacing-notif-pill-min-width`).

## Radius

Tailwind's `rounded-lg`/`rounded-xl`/`rounded-2xl`/`rounded-full` cover
almost everything. A bespoke radius (like the notification pill's 20px —
between `2xl` and `3xl`, chosen so an 80px-tall shell reads as one
continuous curve rather than a rounded rectangle) gets a named
`--radius-*` token instead of a `rounded-[20px]` bracket value, so the
reasoning survives the next person who touches the file.

## Cross-process constants

Values a native `BrowserWindow` and its DOM content both depend on (e.g.
`src/lib/notification-dimensions.ts`'s window width/height) go in
`src/lib/` — the one location safe to import from both `src/main/` and
`src/renderer/` (see `src/lib/CLAUDE.md`). Tailwind theme tokens only
reach the renderer; don't try to make a CSS token double as a main-process
constant.

## What NOT to do

- Don't add a token "for consistency" that's only used once — that's the
  opposite of the goal. A token exists to prevent _future_ drift, not to
  decorate a single element.
- Don't round a real, load-bearing dimension (like the notification
  window's `NOTIFICATION_WIDTH`) into the type/spacing scale just because
  it's also a number — cross-process layout constants and visual-design
  tokens are different categories even when they happen to share a file.
- Don't silently widen a scale to fit a new mockup value. If a new design
  needs a size the scale doesn't have, that's worth a one-line flag to the
  user before adding a 4th type-scale step, not a quiet bracket value.
