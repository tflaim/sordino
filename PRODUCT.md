# Product

## Register

product

## Users

Three core personas, served together — the design must not optimize for one
at the expense of the others:

- **The self-aware quitter.** Knows they distract. Has tried Cold Turkey,
  Freedom, BlockSite and turned them off in frustration. Distrusts hard
  walls. Comes to Sordino because previous tools felt hostile. Job at the
  overlay: a pause and a reflective beat before deciding.
- **The ADHD / executive-function user.** Needs structure but lives an
  unpredictable life where rigid blocks read as punishment. Reassured by the
  bypass existing, by the budget being fair, by the absence of guilt copy.
  Job at the overlay: scaffolding for choice, not a verdict.
- **The ambient-mindfulness maker.** Less "I can't stop scrolling," more
  "I want a calmer browser." Wants a small piece of typography or a tiny
  meditation in the middle of a refresh-reflex. Job at the overlay: a beat
  of stillness before deciding.

All three converge on the same emotional moment: a soft friction that
respects their agency.

## Product Purpose

Sordino is a soft-blocking browser extension (Chrome + Firefox) that creates
psychological friction for distracting sites with bypass-able overlays —
"like a trumpet mute that softens without silencing."

It exists because hard blockers fail: users disable them or work around
them, then conclude they're "broken" themselves. Sordino's wager is that a
calm, bypass-able pause works better than a wall, because it converts a
reflex into a *decision*.

**Success looks like:** a user one month in opens the Usage tab and feels
*"I'm in dialogue with my own behavior."* Stats serve as a mirror, not a
scoreboard. They notice patterns ("Tuesdays are bad," "I bypassed reddit 5
times") without being shamed by them. They forget the product is there
between overlay moments. They do not feel watched, gamed, or graded.

## Brand Personality

**Quiet · literate · peer-not-parent.**

- **Quiet** — restraint is the identity. Animation, color, copy each must
  justify their presence. The default move is to remove, not add.
- **Literate** — confident in its references. Knows what a fermata is.
  Picks the Bruce Lee quote because it's the right Bruce Lee quote, not
  because quotes are a feature. Cormorant Garamond is used the way it was
  designed to be used.
- **Peer-not-parent** — talks to the user like a friend who's already been
  through it. Never moralizes, never celebrates, never threatens. Doesn't
  guilt the bypass; doesn't reward the resistance. Trusts the user to know
  what they're doing.

**Voice:** Plainspoken, warm, occasionally wry. Never preachy.
**Tone at the overlay:** A held breath, not an alarm.
**Tone in the popup:** A quiet status line, not a dashboard.
**Tone in settings:** A configured instrument, not a control panel.

## Anti-references

What Sordino must **not** look or feel like:

- **Hard-blocker / corporate-IT aesthetic** — Cold Turkey, Freedom,
  BlockSite. Aggressive red banners, lockdown vocabulary ("site blocked by
  administrator"), guilt copy, no escape route. Sordino is the explicit
  opposite of this. The bypass button is not a leak in the wall — it is the
  product.
- **Gamified habit-tracker aesthetic** — Habitica, Streaks, Duolingo.
  Bright primary colors, badges, streaks, level-ups, dopamine loops,
  mascots. Treats focus as a points game. Sordino tracks but never gamifies;
  stats are evidence, not score.
- **Generic productivity SaaS** — Notion / Linear / Asana hybrid: cards,
  dashboards, density, dark navy, illustration-style empty states.
  Functional but soulless. Sordino is product-register but has a point of
  view; this lane has no point of view.

(Wellness / meditation-app aesthetic is *not* on the anti-list — Sordino
is allowed to be warm and breathing-room-ish, just not gradient-pastel
soft-focus about it.)

## Design Principles

1. **Soft friction, never force.** Every restriction must come with a
   visible escape route. If the user cannot choose to bypass, we have built
   the wrong product. The bypass is not a compromise on the thesis — it is
   the thesis.

2. **Mirror, not scoreboard.** Stats exist to provoke noticing, not to
   reward or shame. Never use streak counters, badges, congratulatory
   language, or progress bars that imply "winning." A clean number is
   enough; the user supplies the meaning.

3. **Restraint as identity.** The brand voice is established by what is
   absent. Decoration, glow, ambient motion, and clever copy all must
   actively earn their place against the alternative of removing them.
   When in doubt, remove.

4. **Peer-not-parent in every word.** No moralizing ("Are you sure you
   want to bypass?"), no celebration ("Great job!"), no threats ("Only 1
   bypass left!"), no infantilizing ("Stay strong!"). The product reports
   state; the user makes the decision.

5. **Privacy as posture, not feature.** Zero data leaves the machine —
   this is invariant. It also shapes copy: never ask for an account, never
   suggest sharing, never reference "your community," never link to
   external dashboards. The browser is the product surface, full stop.

## Accessibility & Inclusion

**Floor: WCAG 2.1 AA, with `prefers-reduced-motion` respected as a hard
requirement on every motion design choice.**

- All text meets WCAG AA contrast (4.5:1 body, 3:1 large). Warm-on-warm
  combos that fall short get adjusted; chroma stays brand-correct via
  lightness shifts, not by swapping palette.
- Every motion (entry fade, glow if retained, future animations) is gated
  by `@media (prefers-reduced-motion: reduce)`. Adversarial reviews fail
  any change that introduces motion without this gate.
- Full keyboard navigation on popup and settings: every interactive
  element reachable via `Tab`, every state visible via `:focus-visible`,
  no focus traps in the pause dropdown or schedule editor.
- State is never encoded by color alone. The status pill uses a colored
  dot *plus* a text label *plus* (in active) a pulse — colorblind users
  read text and motion, not hue.
- Screen readers: status changes announced via `aria-live="polite"`;
  the block overlay's primary action announces as "Bypass for 5 minutes,
  you have N of 3 remaining today."

---

## Known Tensions

This document was reviewed by four adversarial agents (voice/AI-slop,
brand-drift, persona-conflict, anti-pattern blind-spot) before being
accepted as load-bearing. Not all findings were resolved. The unresolved
ones are logged here so future agents know they are deliberate punts, not
oversights.

### Primary persona is the ADHD / executive-function user

Despite the "all three converge" framing in the Users section, the operative
primary persona for product decisions is **the ADHD / executive-function
user**. The self-aware quitter is secondary; the ambient-mindfulness maker
is tertiary.

Implication: design decisions that trade scaffolding for minimalism
default to scaffolding. Decisions that trade structure for ambient calm
default to structure. The maker tolerates the Usage tab and the bypass
budget; they do not drive their design.

### Principle 4 conflict resolved via Scaffolding Mode

Principle 4 ("Peer-not-parent in every word") explicitly forbids "Are you
sure you want to bypass?" as moralizing. The ADHD-primary persona,
however, benefits specifically from that kind of bypass-confirm friction.

**Resolved (2026):** the design ships a `scaffoldingMode` opt-in toggle
in Settings > Bypass Settings. When enabled, the overlay bypass button
requires a second-click confirm ("Confirm bypass" appears for 6 seconds
after the first click; second click commits, otherwise reverts). Default
is off — the friction is permitted but not imposed, satisfying Principle 4
for users who don't want it and serving the ADHD-primary persona for
users who do.

Do not silently revert this to a forced default on. The whole point of
the resolution is that the user chooses.

### Wellness-app drift is the doc's blind spot

The Anti-references section explicitly exempts wellness/meditation-app
aesthetic from the anti-list. Three of four adversaries flagged this as
backwards: the warm palette, lantern logo, "held breath" language, and
mindfulness-maker persona all create a gravitational pull *toward*
Headspace/Calm/Oak. The exemption stands for now, but reviewers should
treat any of the following as drift signals:

- Breathing animations on the lantern or any element
- Soft radial gradients behind quotes or stats
- "Take a moment" / "be present" / "let go" microcopy
- Sunrise or sunset palette shifts
- Any pulse animation framed as a calming gesture

If those appear, the wellness-drift critique was right and this exemption
should be revoked.

### Editorial-newsletter aesthetic is the saturated lane

The current visual register (Cormorant Garamond + warm dark + italic
pull-quote + small-caps tag + hairline gold rule) is the dominant
aesthetic of 2024-26 Substack/Ghost/indie-magazine surfaces. It reads as
"premium and literary" because LLMs and designers reach for it when given
the brief "thoughtful product."

The doc does not anti-reference it because the current design has earned
the lane through specific choices (the music metaphor, the lantern, the
restraint). But any *new* element that compounds the editorial register —
a serif drop cap, a small-caps section label, an italic epigraph in
settings — should be challenged. One literary signifier per surface is
enough; two is cosplay.

### Voice anti-references are not enumerated

The Brand Personality section describes the right voice but does not name
the failure modes. Future copy work should reject:

- Meditation-app voice: "breathe deep," "let go," "be present"
- SaaS onboarding voice: "Welcome!", "Let's get you set up", "You're all
  set!"
- Literary-thoughtful-bro voice: em-dash sighs, "a small thing," "a held
  breath" as copy not concept

This document itself runs hot on the third category (see below).

### The doc's own voice is on probation

The voice/AI-slop adversary found this document uses em dashes as
connective tissue, deploys "X, not Y" negation-correction eight or more
times, lands on a middle-dot brand-deck slogan ("Quiet · literate ·
peer-not-parent"), and twice self-congratulates with "it is the thesis."
By the standards Principle 3 ("Restraint as identity") sets for the
product, the document's own voice would fail review.

This is an accepted tradeoff at commit time, not a hidden flaw. Future
revisions of PRODUCT.md itself should scrub this voice. Until then, copy
generated for the actual product should not pattern-match the document's
rhetorical reflexes.

### Principles ban symptoms, not diseases

- Principle 2 ("Mirror, not scoreboard") forbids streaks and badges, but
  does not forbid *insight copy* — "You've reclaimed 4.2 hours this week,"
  "Your worst day is Tuesday." That is scoreboarding in mirror's clothing.
  Until Principle 2 is sharpened, reviewers should reject derived metrics
  in stats UI; show raw counts only.
- Principle 3 ("Restraint as identity") never audits the current product
  against itself. The popup status-pill text-shadow glows and the overlay
  float/glow animations are decoration that the principle would forbid.
  They are on probation until explicitly removed or explicitly defended.

### Typography is not load-bearing

The Brand Personality section says "Cormorant Garamond is used the way it
was designed to be used." Read this as a discipline rule, not a brand
lock-in: display serif at display sizes only, never under 24px, never for
UI labels. The specific face is replaceable; the discipline is not.
