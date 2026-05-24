---
name: Sordino
description: Soft-blocking browser extension with bypass-able overlays.
colors:
  background: "#1c1917"
  foreground: "#eae2d7"
  card: "#28231f"
  card-foreground: "#eae2d7"
  primary: "#cca766"
  primary-foreground: "#1c1917"
  secondary: "#3b312b"
  secondary-foreground: "#eae2d7"
  muted: "#463e39"
  muted-foreground: "#93806c"
  accent: "#cca766"
  accent-foreground: "#1c1917"
  destructive: "#ce3030"
  destructive-foreground: "#ffffff"
  border: "#4c4033"
  input: "#4c4033"
  ring: "#cca766"
  overlay-bg-1: "#1a1612"
  overlay-bg-2: "#2d2620"
  overlay-bg-3: "#1f1a16"
  overlay-gold: "#cda468"
  overlay-gold-deep: "#b8935d"
  overlay-cream: "#e8dcc8"
  overlay-muted: "#9a8b7a"
  overlay-deep-muted: "#6b5d4d"
typography:
  display-family: "'Cormorant Garamond', Georgia, serif"
  body-family: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif"
  display:
    fontFamily: "{typography.display-family}"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.02em"
  headline:
    fontFamily: "{typography.display-family}"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.3
  title:
    fontFamily: "{typography.body-family}"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "{typography.body-family}"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "{typography.body-family}"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.xl}"
    padding: "0.625rem 1rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "0.625rem 1rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.75rem"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1.125rem"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.xl}"
    padding: "0.625rem 1rem"
  icon-button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.sm}"
    padding: "0.25rem"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  input:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 0.75rem"
  toggle-on:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
    width: "2.75rem"
    height: "1.5rem"
  toggle-off:
    backgroundColor: "{colors.secondary}"
    rounded: "{rounded.full}"
    width: "2.75rem"
    height: "1.5rem"
  checkbox-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.sm}"
    width: "1.25rem"
    height: "1.25rem"
  checkbox-off:
    backgroundColor: "transparent"
    rounded: "{rounded.sm}"
    width: "1.25rem"
    height: "1.25rem"
  day-button-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    width: "2rem"
    height: "2rem"
  day-button-off:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.full}"
    width: "2rem"
    height: "2rem"
  stepper-button:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    width: "2rem"
    height: "2rem"
---

# Design System: Sordino

## 1. Overview

**Creative North Star: "The Quiet Instrument"**

Sordino is a soft-blocking browser extension. Its interface should feel like
a precision tool that lives in the corner of the browser: a brass tuning
fork, a restored mechanical metronome. Surfaces are warm and matte. The
accent is reserved for the action that matters; the data point worth
reading. Decoration must justify itself.

The system explicitly rejects the saturated aesthetics that productivity
extensions fall into: the navy-and-gold fintech default, the gradient-pastel
wellness app, and the italic-pull-quote-plus-small-caps editorial-newsletter
cliché. Sordino borrows palette warmth from editorial design and pacing
from meditation tools without inheriting their syntax.

This system serves three users in priority order: primary the ADHD /
executive-function user, secondary the self-aware quitter, tertiary the
ambient-mindfulness maker. The visual character serves the primary
persona's needs first: predictable layouts, plain-text states, scaffolding
before delight. When a design choice trades orientation for minimalism, it
defaults to orientation.

**Key Characteristics:**

- Warm dark base, brass accent at 10% of surface or less
- Display serif (Cormorant Garamond) only at 24px and above
- Sans body (DM Sans) carries everything functional
- Flat surfaces; depth conveyed by tonal background steps, not shadow
- Motion gated by `prefers-reduced-motion` without exception
- Generous radius (0.75rem) on tactile primitives
- No icons-as-decoration; every icon names a behavior

## 2. Colors

The system palette is a warm-dark ramp from near-black through walnut
shadow to a brass accent and a cream foreground. Every neutral carries
warm chroma (hue 24–38° in HSL). Cool grays and chroma-zero neutrals are
absent by design.

The canonical source of truth is `src/index.css` as HSL custom properties.
The hex values in the YAML frontmatter are the true sRGB conversions of
those HSL values, accurate to within 1 sRGB unit. Earlier drafts of this
spec carried off-by-several-units approximations; those have been
corrected.

### Primary

- **Brass Glow** (`#cca766`, `hsl(38 50% 60%)`): The single system accent.
  Used on the primary action button, the active toggle, the active tab
  indicator, the focus ring at half opacity. It reads as warm-evening
  light. Its scarcity is enforced by the 10% rule below.

### Neutral

- **Stagewood** (`#1c1917`): The deepest surface. Page background on
  popup and settings, foreground color on brass buttons. Used at 100%
  opacity at the base layer; never tinted, lightened, or alpha-reduced
  in System surfaces.
- **Stagewood Lift** (`#28231f`): One step up. Resting card surfaces.
- **Walnut Shadow** (`#3b312b`): Secondary surface. Pill-button
  backgrounds, input fills, tab-strip rest state.
- **Smoked Walnut** (`#463e39`): Muted surface. Disabled fills,
  scrollbar thumbs.
- **Hairline Walnut** (`#4c4033`): Default border color. 1px stroke on
  cards and inputs.
- **Bone Cream** (`#eae2d7`): Default foreground. Body text, card
  content, headings. Contrast ratio against Stagewood is 12.4:1 (passes
  WCAG AA and AAA at every text size).
- **Dusk Linen** (`#93806c`): Muted-foreground. Captions, secondary
  text, the "Go back" link in its current implementation. Contrast
  against Stagewood is 4.7:1 (passes WCAG AA for normal text).

### State

- **Lacquer Red** (`#ce3030`): Destructive color. Delete-confirm states,
  validation errors. Never decorative; never an accent on hover for
  non-destructive actions.

### Overlay Palette (isolated)

The content-script overlay (`src/content/content.ts`) ships its own
hardcoded hex values rather than referencing the system palette. This is
sanctioned: content scripts inject CSS into arbitrary host pages, and
relying on the host's Tailwind theme (or any cascade) is not safe. The
overlay's CSS is self-contained and isolated.

- **Overlay BG Gradient** (`#1a1612` → `#2d2620` → `#1f1a16`): The
  three-stop linear-gradient background of `.sordino-container`. Slightly
  warmer and slightly darker than Stagewood. Scheduled for review during
  the upcoming critique sweep; may flatten to solid Stagewood with a
  small ambient warmth.
- **Overlay Gold** (`#cda468`): Hardcoded brass in the overlay. Within
  five sRGB units of the system Brass Glow (`#cca766`); reads identically.
  Should reconcile to the system gold when the overlay migrates to
  CSS-variable-based theming.
- **Overlay Gold Deep** (`#b8935d`): The second stop of the bypass-button
  linear-gradient. The gradient itself is scheduled for review under the
  No-Ambient-Decoration Rule; if it survives review, this token stays.
- **Overlay Cream** (`#e8dcc8`): The overlay's body-text color. Slightly
  warmer than Bone Cream. Reconcile during the migration.
- **Overlay Muted** (`#9a8b7a`) and **Overlay Deep-Muted** (`#6b5d4d`):
  Two tiers of muted text inside the overlay (quote author at the lighter
  tier, bypass-count and Go-back link at the deeper tier).

### Named Rules

**The 10% Brass Rule.** Brass Glow occupies no more than 10% of any
visible surface area. Measurement is informal but enforceable: if two
elements both want brass, one is wrong.

**The No-Cool-Neutral Rule.** Every neutral in the system has hue between
24° and 38° (HSL) and saturation at least 5%. Tokens named `gray-N`,
`slate-N`, `zinc-N`, `neutral-N` from Tailwind defaults are rejected on
sight in code review.

**The Stagewood-Is-Base Rule.** Stagewood (`#1c1917`) appears only at
100% opacity, only as the page floor. It is never tinted, never lightened
to "feel inviting," never alpha-reduced. Lower opacity variants of the
floor are explicitly prohibited; use Stagewood Lift or Walnut Shadow
instead. The overlay's deeper `#1a1612` base is an explicit carve-out and
the only one in the system.

**The Overlay-May-Fork Rule.** Content-script overlays may ship a
hardcoded palette to avoid host-page cascade inheritance. New content
scripts that fork must document each forked token with intent and a
reconciliation plan. The system rejects forks that lack documentation.

## 3. Typography

**Display Font:** Cormorant Garamond, with Georgia as fallback.
**Body Font:** DM Sans, with the system sans stack as fallback.

The pairing is replaceable. The display-family and body-family tokens in
the YAML frontmatter exist precisely so that swapping the face is a
one-line edit. What is not replaceable is the discipline: a display serif
at display sizes, a workhorse sans for everything functional.

### Hierarchy

- **Display** (Cormorant, 500, 1.75rem, line-height 1.2, letter-spacing
  0.02em): The overlay's snarky title ("Fermata," "Muted," "Take Five")
  and the settings page wordmark. **Upright Cormorant** for both — the
  italic role on the overlay surface is owned by the pull-quote body
  (one italic, one upright display serif). Earlier drafts of this spec
  prescribed italic for the title; that line was revised after a
  critique pass found two simultaneous italics on the same surface read
  as editorial-newsletter cosplay.
- **Headline** (Cormorant, 500, 1.25rem, line-height 1.3): Section
  headings on the settings page ("Schedules," "Blocked Sites," "Bypass
  Settings"). Upright, no italic, no small-caps.
- **Title** (DM Sans, 500, 0.9375rem, line-height 1.4): Card titles,
  button labels, status-pill text. Sentence case.
- **Body** (DM Sans, 400, 0.875rem, line-height 1.5): Prose, time
  captions, status subtext. Cap any prose block at 65–75 characters per
  line; data and tabular content can run denser.
- **Label** (DM Sans, 500, 0.75rem, letter-spacing 0.08em, uppercase):
  Section landmarks ("TODAY," "CATEGORIES," "CUSTOM SITES"). Reserved
  for navigational structure, not decoration.

### Named Rules

**The 24px Cormorant Rule.** Cormorant Garamond is used at 24px (1.5rem)
and above only. Below 24px it loses serif detail and reads as low-resolution
serif rather than as the typeface's character. Buttons, captions, data, and
form labels are DM Sans, full stop.

**The Italic Budget Rule.** Italic Cormorant appears at most once per
surface. On functional surfaces (popup, settings), that means one italic
total. On literary surfaces (the block overlay), the one italic is
reserved for the pull-quote body; the display title and wordmark are
both upright Cormorant. Quote attribution lines are upright DM Sans, not
italic. Any second italic on any surface fails review.

**The Tracked-Label Rule.** Uppercase letter-spaced labels (0.08em
tracking) are used for navigational landmarks only. A maximum of two
per surface; a maximum of three across the entire popup or settings tab.
Count them in review.

## 4. Elevation

Sordino is flat. Depth comes from tonal background steps (Stagewood →
Stagewood Lift → Walnut Shadow → Smoked Walnut), not from shadow. The
system permits exactly two sanctioned shadow uses; everything else is
either scheduled for removal or requires explicit defense.

### Sanctioned shadows

- **Focus ring** (`box-shadow: 0 0 0 2px var(--color-ring) / 50%`, via
  Tailwind `focus:ring-2 focus:ring-primary/50`): Every interactive
  element's `:focus-visible` state. Brass at half opacity, sitting
  outside the element's border.
- **Tab rest** (`box-shadow: 0 1px 2px rgba(0,0,0,0.05)`, via Tailwind
  `shadow-sm`): Only on the active tab pill in settings. The hair of
  lift against the Walnut Shadow tab strip. The only persistent ambient
  shadow in the system.

### Scheduled for removal

The following ship in the current build and are scheduled for removal in
the upcoming critique sweep. They are not endorsed by this spec.

1. **Popup status-pill text-shadow halos.** Multi-color text-shadow
   glows on "BLOCKING ACTIVE," "PAUSED," "BYPASS ACTIVE" labels
   (`src/popup/App.tsx:172-178`). The dot, tint background, and label
   already triple-encode state; the halos are redundant.
2. **Overlay glow-pulse animation.** Six-second infinite radial-glow
   pulse behind the overlay content (`src/content/content.ts:363`).
3. **Overlay float animation.** Eight-second infinite translateY on
   `.sordino-content` (`src/content/content.ts:387`).
4. **Overlay bypass-button hover translateY.** `transform: translateY(-2px)`
   on hover (`src/content/content.ts:530`). Violates the
   no-layout-motion rule below.

### Conditionally sanctioned

- **Overlay bypass-button shadow** (`box-shadow: 0 4px 12px rgba(205,164,104,0.3)`,
  `content.ts:526`): A small ambient shadow on the overlay's primary CTA.
  Permitted as an exception because the overlay sits on a gradient
  background where pure flat reads as floating. If the overlay background
  flattens to solid Stagewood, this shadow should reconcile to flat.

### Named Rules

**The Tone-First Rule.** Depth between persistent surfaces comes from
background-color tonal steps, not from `box-shadow`. If two surfaces need
to feel distinct, give them different neutrals.

**The No-Layout-Motion Rule.** Transitions affect color, opacity, and
transform (with `transform-origin` set to a stable point) only. Width,
height, top, left, and translateY-as-decoration are not allowed. Reduced
motion is the floor; layout-affecting motion is the ceiling.

**The Reduced-Motion Rule.** Every motion in the system is gated behind
`@media (prefers-reduced-motion: reduce)` with a flat fallback. CI checks
should grep for `@keyframes`, `transition`, and `animation` declarations
outside that media query and fail any that lack a no-motion fallback.

**The No-Ambient-Decoration Rule.** Decorative `*infinite` keyframes
(glow pulses, ambient floats, breathing animations, parallax) are
prohibited. Keyframe animations are permitted only for entry transitions
(under 600ms) and state changes (loading spinners, focus indicators).

## 5. Components

### 5.1 Buttons

Buttons are pills with `0.75rem` radius (xl). Generous padding, thumb-sized
tap targets, transitions on color and opacity only.

- **Primary:** Brass Glow background, Stagewood text, no border. Padding
  `0.625rem 1rem` standard. Used for "Start Blocking," "Resume," "Add
  Schedule," "Refresh." Reserved for the action that matters most on a
  surface; never more than one Primary per viewport.
- **Secondary:** Walnut Shadow background, Bone Cream text (Overlay Cream
  on the overlay surface), no border (or 1px brass-tinted hairline border
  at low opacity when sitting on a dark gradient that would otherwise hide
  the edge). Used for "Pause," "Cancel," the overlay's promoted "← Go
  back" action, and any neutral action. Hover lifts to Smoked Walnut.
  Default padding `0.625rem 1rem`; promoted variants may enlarge to
  `0.8125rem 1.75rem` for tap-target weight on a high-stakes surface
  (the overlay Go-back is the canonical promoted example). On dark
  gradient backgrounds, prefer the Smoked Walnut fill (`#463e39`) over
  Walnut Shadow (`#3b312b`) so the silhouette stays visible across the
  gradient's full lightness range.
- **Ghost:** Transparent background, Dusk Linen text. Used for tertiary
  actions and inline links inside forms. Hover fills to Walnut Shadow at
  low opacity.
- **Outlined (overlay only):** Transparent background, Bone Cream text
  (Overlay Cream on the overlay surface), 1px brass-tinted border at 22%
  opacity, 0.5rem (lg) radius. Used for the overlay's demoted bypass
  action — present and clearly pressable, but clearly subordinate to the
  Secondary win-path button above it. Hover lifts the border to 45%
  opacity and fills the background to 6% brass tint. Disabled drops
  border to 10% opacity and text to a brighter muted (`#8a7a66`) so the
  button shape is still visible to the user even when they can't press
  it. Brass color in text is not used on this variant; putting brass on a
  demoted action would violate the 10% Brass Rule, so cream text only.
- **Destructive:** Lacquer Red background, Bone Cream text. Used only
  after a confirm step; not for casual delete affordances.
- **Icon Destructive:** Transparent background, Dusk Linen icon at rest;
  hovers to Lacquer Red icon over Lacquer Red 20% fill. Used on the
  custom-site remove (`x`) and schedule delete (trash) icon buttons.
- **Hover / Focus:** Background lifts by ~20% lightness via Tailwind
  `hover:bg-X/90`; focus shows the brass ring at half opacity outside
  the border. Transitions are 150ms ease-out on color and opacity, not
  on layout.
- **Disabled:** 30–50% opacity, no hover. Disabled primary stays brass
  at low opacity; never swaps to a different hue.

### 5.2 Cards

- **Corner Style:** 0.75rem radius (xl).
- **Background:** Stagewood Lift for resting cards in active contexts;
  Walnut Shadow at 30–50% opacity for "quiet" container patterns in
  lists (schedule cards, custom-site rows). The "quiet container"
  pattern is an ad-hoc Tailwind composition (`rounded-xl bg-secondary/30`)
  rather than a shared class; if a future codification consolidates it,
  it should be named `card-quiet`.
- **Border:** 1px Hairline Walnut on cards that need a visible edge.
  Borderless cards are preferred when they sit on a contrasting surface.
- **Internal Padding:** 1rem standard; 1.25rem for status cards with
  primary actions; 0.5rem to 0.75rem for compact rows.
- **No nested cards.** A card inside a card is wrong. Flatten with tone.

### 5.3 Inputs

- **Style:** Walnut Shadow background, 1px Hairline Walnut border,
  0.5rem radius (lg). DM Sans body weight, Dusk Linen placeholder.
- **Focus:** Brass ring at 50% opacity outside the border via
  `focus:ring-2`.
- **Error:** Border switches to Lacquer Red; error text appears below in
  Lacquer Red at body weight.
- **Time inputs** (`<input type="time">`) inherit the same shell. The
  browser-native picker icon is allowed; no custom replacement.

### 5.4 Toggle (functional on/off pattern)

The schedule and category enable/disable affordance.

- **Shape:** Pill, 2.75rem wide × 1.5rem tall, 9999px radius.
- **On:** Brass Glow track, Bone Cream knob translated right.
- **Off:** Walnut Shadow track, Bone Cream knob translated left.
- **Motion:** Knob translates 200ms ease-out; track-color transitions
  in the same window. Both gated by reduced-motion.

### 5.5 Checkbox (selection on/off pattern)

A second on/off primitive, used for per-site inclusion within a category.

- **Shape:** 1.25rem square, 0.25rem radius (sm), 2px border.
- **On:** Brass Glow fill, brass border, Stagewood checkmark.
- **Off:** Transparent fill, Dusk Linen border, hover lifts border to
  brass at 50%.

**Toggle-vs-Checkbox Rule.** Toggle is for *enabling* a feature
(schedule, category) where the user is choosing the system's behavior.
Checkbox is for *selecting* an item from a set (which sites within a
category, which days within a schedule). Don't swap them.

### 5.6 Day-of-Week Button

The schedule editor's day picker. A row of circular toggles.

- **Shape:** 2rem diameter circle.
- **Selected:** Brass Glow fill, Stagewood letter.
- **Unselected:** Walnut Shadow fill, Dusk Linen letter.
- **Letters:** Single uppercase character (M, T, W, T, F, S, S). Saturday
  and Sunday's repeated "S" / "T" is accepted as a convention.

### 5.7 Number Stepper

The bypass-budget and bypass-duration configurator.

- **Layout:** `[-]  N  [+]` with circular ± buttons flanking a tabular
  numeral.
- **Buttons:** 2rem diameter circles, Walnut Shadow fill, Bone Cream
  symbol. Disabled at min/max with 30% opacity.
- **Number:** DM Sans tabular-nums, title weight, 12-character min-width
  for stable alignment.

### 5.8 Dashed Edit Card

The schedule-add and schedule-edit affordance.

- **Border:** 1px dashed Brass Glow at 30% opacity.
- **Background:** Brass Glow at 5% opacity tint.
- **Padding:** 1rem.
- **Contains:** A name input, a day-button row, two time inputs, and
  a Cancel / Save button pair right-aligned.

The dashed border distinguishes "in-progress configuration" from
resting cards. It is the only sanctioned dashed border in the system.

### 5.9 Status Pill (signature)

The popup's central state indicator. Four states. The state-color
encoding pairs each label with a complementary dot color rather than
re-using the brand brass for every state (using brass for Active would
collapse the four colors to three and violate the 10% Brass Rule by
making brass a status code, not the brand accent).

- **Active:** Brass Glow tint background at 15% opacity, **green-500
  dot** with a 1.5s pulse (motion-safe gated), Brass Glow text label in
  uppercase tracked.
- **Paused:** Yellow (yellow-500) tint at 15% opacity, yellow dot
  (static, no pulse), yellow text label.
- **Bypass:** Orange (orange-500) tint at 15% opacity, orange Timer
  icon, orange text label.
- **Inactive:** Walnut Shadow at 50% opacity, Dusk Linen dot at 50%
  opacity, Dusk Linen text label.

The Active/Paused/Bypass states historically shipped with multi-color
text-shadow halos on the label and a box-shadow glow on the green dot;
both are now removed. The dot plus tint plus label triple-encode the
state without decoration.

### 5.10 Stats Readout (signature)

The popup's "Today" row and the Usage tab's summary cards. The data UI
of the system.

- **Layout:** Raw integer above, plain noun below, optional timeframe
  caption below that.
- **Number:** Cormorant Garamond at headline size (1.25rem) for the
  popup row; at 1.5rem for the Usage summary cards. Tabular numerals.
- **Noun:** DM Sans body, Dusk Linen color, lowercase. Grammatically
  matched to the count (1 distraction caught / N distractions caught).
- **Caption (optional):** DM Sans at label size, muted-foreground at
  70% opacity. "Resets at midnight." No achievement language.

**The Raw-Counts-Only Rule.** Stats display a raw integer and a plain
noun. No derived metrics ("4.2 hours reclaimed," "your worst day," "75%
improvement"), no week-over-week deltas, no percentage gains, no
comparisons. The user supplies the meaning; the system supplies the count.
This rule overrides product copy preferences.

### 5.11 Overlay Block Screen (signature)

The full-viewport block surface. Content centered, vertical stack.

- **Background:** Currently a three-stop linear gradient (Overlay BG
  tokens). Scheduled for review; may flatten to solid Stagewood with a
  subtle texture overlay.
- **Content stack:** logo + "Sordino" wordmark → display italic Cormorant
  title ("Fermata") → optional sans subtitle → italic Cormorant pull-quote
  with upright sans attribution → blocked-site card → **"← Go back"
  Secondary button (the promoted win-path action)** → small Outlined
  bypass button → bypass-count caption ("3 quick bypasses left today" /
  on disabled, "Resets at midnight"). The win-path is the visually
  primary action; the bypass is visible, pressable, and clearly
  subordinate — honoring Principle 1 (the bypass IS the thesis, but the
  win-path is the visually obvious option).
- **Texture overlay:** SVG fractal-noise at 3% opacity. Permitted as
  material warmth; conveys grain without motion.

### 5.12 Dual Bar Chart (Usage tab)

The Daily Activity readout.

- **Layout:** One column per day-of-week (Mon–Sun), each column
  containing two adjacent vertical bars (blocks left, bypasses right).
- **Width:** Minimum 16px per bar, 4px gap. The current implementation
  ships with thinner bars and is flagged for the critique sweep.
- **Color:** Blocks use Brass Glow; bypasses use orange-500. Today's
  column at 100% opacity; prior days at 60% opacity.
- **Labels:** Day abbreviation in DM Sans label size below; count value
  in DM Sans label size above each bar (only when the count is > 0).

### 5.13 Top Sites Row (Usage tab)

The Most Blocked / Most Bypassed lists.

- **Layout:** Two-column grid, each column a ranked list.
- **Row:** Rank number (Dusk Linen 60%), site name (Bone Cream body),
  count (Brass Glow for blocks; orange-500 for bypasses, body weight).
- **Background bar:** A subtle full-row tint (`bg-primary/10` or
  `bg-orange-500/10`) scaled to the proportion of the leader. The
  current 10% opacity is barely visible and is flagged for the
  critique sweep.

## 6. Do's and Don'ts

Concrete guardrails. Adversarial reviews cite these directly; a Don't
violated without explicit defense fails review.

### Do:

- **Do** use Brass Glow on 10% or less of any visible surface (The 10%
  Brass Rule).
- **Do** convey depth through tonal background steps, not shadow (The
  Tone-First Rule).
- **Do** verify every neutral has warm chroma. Reject `gray-N`,
  `slate-N`, `zinc-N`, `neutral-N` on sight.
- **Do** use Cormorant Garamond at 24px and above only (The 24px
  Cormorant Rule).
- **Do** gate every motion behind `prefers-reduced-motion` (The
  Reduced-Motion Rule).
- **Do** show the focus ring on every interactive element. State that
  can't be seen with the keyboard is broken state.
- **Do** orient the user in the first viewport of every surface. Current
  state, next action, and exit route must be visible in plain text (The
  Scaffolding-First Rule).
- **Do** show empty states as one plainspoken sentence ("Haven't needed
  one this week"). Muted zeros read as broken; a written sentence reads
  as an answer.
- **Do** show stats as raw integer + plain noun + optional timeframe
  (The Raw-Counts-Only Rule).

### Don't:

- **Don't** use `#000` or `#fff`. The floor is Stagewood (`#1c1917`);
  the ceiling is Bone Cream (`#eae2d7`).
- **Don't** use side-stripe borders (border-left or border-right greater
  than 1px as a colored accent). Use full borders, tints, or numbers as
  the affordance.
- **Don't** use gradient text (`background-clip: text` over a gradient).
  Solid color only.
- **Don't** add decorative `backdrop-filter` blurs. The overlay's
  existing `backdrop-filter: blur(8px)` on the blocked-site card is
  grandfathered; new uses are not.
- **Don't** add `*infinite` keyframes for decoration (The
  No-Ambient-Decoration Rule). Entry-fade and state-transition motion
  only.
- **Don't** animate `width`, `height`, `top`, `left`, or use translate
  as decoration (The No-Layout-Motion Rule). Animate color, opacity, and
  transform with stable origins only.
- **Don't** use display fonts in UI labels, buttons, captions, or data.
- **Don't** use radial gradients as ambient mood lighting on persistent
  surfaces. Radial gradients are permitted only as state-bound feedback
  or one-off illustration.
- **Don't** introduce breathing animations on any element. The lantern
  does not pulse. The overlay does not breathe.
- **Don't** introduce sunrise/sunset palette shifts or time-of-day color
  variants.
- **Don't** drift toward the hard-blocker / corporate-IT aesthetic (Cold
  Turkey, Freedom, BlockSite): red lockdown banners, "blocked by
  administrator" language, no escape route.
- **Don't** drift toward the gamified habit-tracker aesthetic (Habitica,
  Streaks, Duolingo): badges, streaks, levels, mascots, bright primaries.
- **Don't** drift toward generic productivity SaaS (Notion / Linear /
  Asana hybrid): navy dashboards, illustration empty states,
  dashboard-card-grid IA.
- **Don't** drift toward the wellness-app aesthetic in warm-brown coat
  (Headspace, Calm, Oak): breathing animations, "take a moment"
  microcopy, sunrise palette shifts, soft radial gradients framed as
  serenity.
- **Don't** drift toward the editorial-newsletter aesthetic (Substack,
  Ghost, indie magazine): centered serif pull-quote plus small-caps tag
  plus hairline gold rule plus italic epigraph. One literary signifier
  per surface is enough; two is cosplay.
- **Don't** write copy in meditation-app voice ("breathe deep, let go"),
  SaaS-onboarding voice ("Welcome! Let's get you set up"), or
  literary-thoughtful-bro voice ("a held breath," "a small thing" as
  copy not concept).
- **Don't** introduce derived insight metrics. No "time reclaimed," no
  "your worst day," no week-over-week deltas. Raw counts only.
- **Don't** use em dashes in UI copy or in this design spec. The only
  sanctioned em dash in the running product is `— Author` in quote
  attribution lines.
- **Don't** nest cards. A card inside a card is always wrong.

---

## Known Tensions

This document was rewritten in response to four adversarial reviews
(voice/AI-slop, brand-drift, persona-conflict, anti-pattern blind-spot,
plus a token-coverage cross-check against shipping code). The rewrite
addresses the factual errors directly. The remaining items below are
unresolved decisions logged so future reviewers know they are deliberate.

### `rounded.xl` is a Tailwind preset, not a project token

The YAML frontmatter declares `rounded.xl: 0.75rem` because the codebase
uses `rounded-xl` in 38+ places. But `src/index.css` declares only
`--radius-lg`, `--radius-md`, `--radius-sm`; the `xl` value resolves
through Tailwind's built-in preset, not through the project's `@theme`
block. Two ways to reconcile (do not pick yet, log for later):

1. Add `--radius-xl: 0.75rem` to `@theme` in `src/index.css` and adopt
   the value as a project token explicitly.
2. Migrate all `rounded-xl` uses to `rounded-lg` (project-owned) and
   delete `rounded.xl` from this spec.

The latter is the smaller spec change and the larger code change. Until
this is resolved, treat `rounded.xl` as a known dependency on Tailwind's
preset behavior.

### Status Pill state colors are out-of-system Tailwind tokens

Active uses `green-500` (`#22c55e`), Paused uses `yellow-500` (`#eab308`),
and Bypass uses `orange-500` (`#f97316`). None are in the system palette;
all are Tailwind defaults. They are out-of-system state colors used
because the system doesn't ship dedicated success/warning/info tokens
that read as state codes. Two reconciliations possible:

1. Add `success`, `warning`, and `info` tokens to the palette
   (warm-tinted green, yellow, and orange that match the system's chroma
   profile while preserving the state-code legibility).
2. Accept that out-of-system state colors are part of the system, and
   document them as such.

The Components section above documents the current shipping values;
future state-color additions should pick path 1. Green-500's relative
coolness against the warm palette is the most visible mismatch and
should be the first to migrate.

### Glow-Pulse, Float, and Halos are documented as scheduled-for-removal, not banned

The Elevation §4 list explicitly schedules four decorative motion/glow
elements for removal in the upcoming critique sweep:
`sordino-glow-pulse`, `sordino-float`, the popup text-shadow halos, and
the overlay bypass-button hover-translateY. The Do's-and-Don'ts list also
adds hard "Don't add infinite keyframes for decoration" rules. The
combination means: existing elements are grandfathered until the
critique sweep removes them; new additions are blocked. If the critique
sweep does not happen, this spec lies. Schedule the removal explicitly.

### ADHD-Scaffolding-First Rule is added but its enforcement is implicit

The Do's-list includes a "Scaffolding-First Rule" that requires current
state, next action, and exit route in the first viewport of every
surface. The rule is not paired with a measurable test. A future
addition could be: a checklist run during review that names which
element on each surface carries state, action, and exit. For now the
rule is principle-form and depends on adversarial review to enforce.

### The doc's own prose voice still leans toward "considered" copy

The AI-slop adversary flagged the original draft for 18 voice failures
(em dashes, "earns its place," "calibrated for," negation-correction
reflex). This rewrite scrubbed most of them. Some likely remain. Future
revisions of this spec should re-run the AI-slop check. The voice scrub
is not done.

### The Overlay Palette is sanctioned but not reconciled with the system

The Overlay BG gradient, Overlay Gold, Overlay Cream, and the two
Overlay Muted tiers are documented as an isolated exception. They drift
slightly from the system tokens. The drift is small enough to read as
identical, but a future pass should migrate the overlay's CSS to use
CSS variables that resolve from the host extension's theme, eliminating
the fork.

### `card-quiet` was removed from the frontmatter

An earlier draft declared `card-quiet` as a frontmatter component
variant. It does not exist in the codebase as a shared class; it was
spec invention. This rewrite removes the frontmatter entry and instead
describes the "quiet container" pattern in §5.2 as an ad-hoc Tailwind
composition awaiting codification.
