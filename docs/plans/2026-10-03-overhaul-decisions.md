# Sordino 2.0 overhaul: decisions from grilling (2026-10-03)

Source for `/to-spec`. Terms follow `GLOSSARY.md`; hard-to-reverse choices are in `docs/adr/`. Evidence behind most of these is in `docs/reviews/2026-10-02/`.

## Scope

1. **Overhaul = same soul, new body.** PRODUCT.md stays canon. DESIGN.md's visual language (warm palette, Cormorant Garamond, music motif) is kept but revised where it broke the spec; every surface is rebuilt (overlay, popup, settings, Usage, new First run). Prototypes may push one or two variants beyond current DESIGN.md.
2. **New behaviours in 2.0:** bypass wait; Usage counts turn-backs and pauses; private-window honesty; settings export/import; right-click "Mute this site"; keyboard shortcut to open the popup.
3. **Deferred to a follow-up release:** path rules within a site, "soften the page" (feed hiding), per-category schedules.
4. **Out of scope:** Safari (README "Coming soon" removed); accounts/sync; passwords/lockdown; gamification; AI intent checks.
5. **Release:** no 1.1 — everything ships as 2.0. Store users stay on the working v1.0.0 until then.
6. **Browsers:** Chrome and Firefox (Edge may list the Chrome build).

## Foundation

7. **Build with WXT** (ADR-0001). C1 is fixed by construction; `check:content` and the overlay smoke test remain as guards.
8. **Popup / settings / First run:** React 19 + Tailwind v4, rebuilt as small components; unused deps dropped.
9. **Overlay:** plain DOM in a closed shadow root, `px`-sized, no framework (ADR-0003).
10. **v1 users are migrated** via a versioned storage schema; no silent reset.
11. **Safety net early:** GitHub Actions (typecheck, lint, unit tests, build, content-script check, smoke test, `web-ext lint`) and a pre-commit hook (Prettier on staged, typecheck, tests).

## Language

12. **"Mute", never "block"** — in UI copy, glossary and code.

## Muting model

13. **Mute now** lasts for a duration chosen when starting it (mirrors Pause). No indefinite manual states; Back to schedule is always one tap away.
14. **Pause** durations: 15 min, 1 hour, rest of today (ends at local midnight, labelled honestly). No bypass wait on Pause; every Pause counted in Usage; popup states "Paused until HH:MM".
15. **Precedence:** most recent action wins between Mute now and Pause; when either ends, back to schedules; a schedule starting does not override a Pause.
16. **Schedules** apply to all muted sites (global). The four built-in schedules become ordinary, editable, deletable schedules suggested at First run; "Always on" is a true all-day setting.

## At the overlay

17. **Bypass wait:** on by default, 5 s, configurable 0–15 s (0 = off), shown as a plain number on the button. Turn back is always instant.
18. **Spent bypass budget:** bypass still available after a fixed 30 s wait, counted honestly; emergency refresh retired (ADR-0002).
19. **Bypasses are per site**, each with its own timer; each consumes one unit of budget.
20. **Bypass length** stays fixed and configurable (not picked at the gate).
21. **Overlay words:** ~12 rewritten peer-voice titles plus a short pool of quotes with attributions verified against primary sources.
22. **Toasts:** none for Pause; one quiet, dismissible "ending in 1 min" toast only on the site whose bypass is ending. Toolbar badge carries the rest.

## Usage

23. Raw counts only: mute count (once per navigation), turn-backs, bypasses, pauses. No rates, percentages or "success". Twelve weeks of daily totals, local time, Monday-start weeks.

## First run & theming

24. **First run:** welcome page on install with defaults pre-selected and private-window coverage stated; nothing is muted until the user presses Start.
25. **Theme:** warm light theme for popup, settings and First run following `prefers-color-scheme`; the overlay stays dark.

## Motion & music (grilling round 4)

26. **Motion as the mechanism** (Q29 A): musical motion lives only in the four events — mute going in, bypass wait (centrepiece), bypass lifting, turn back. Premium personality; restraint elsewhere. PRODUCT.md Principle 3 amended accordingly.
27. **Bypass wait motion is prototyped** (Q30): three gestures — Fermata (held note swells and decays), Metronome (N slow beats), Measure (a bar of rests filling) — each with the 30 s spent-budget version and a reduced-motion fallback where the plain number is the source of truth.
28. **The literal mute** (Q31): page audio/video fades down over ~0.8 s as the overlay arrives, then pauses; fades back up when a bypass is taken.
29. **Habituation** (Q32 C): a small rotating repertoire of motifs (like titles), explained once; plus a Sordino **Stillness** setting, independent of the OS reduced-motion setting.
30. **Animation skills installed** (Q33): LottieFiles motion-design and delphi-ai animate, symlinked. House rule: overlay motion is CSS/WAAPI only; Framer Motion at most in extension pages.
31. **Own line** (Q34, from the Roots teardown): an opt-in line the user writes ("Practice the Bach") that replaces the quote on the overlay. Empty by default, never tracked.
32. **Overlay layout leans C** (headline sentence + bottom action bar), per the Roots review finding that "blocked at the wrong time" is the top complaint; motion study built on C.
33. **Architecture first pick:** #1 Single-writer Sordino store, with #2 Muting decision behind it (`/improve-codebase-architecture`, 2026-10-03).

## Still open (answered by later skills, not grilling)

- Visual direction for each surface → `/prototype` (UI branch), both themes.
- Module shape of the rebuilt code (state single-writer, storage keys, matching, scheduling) → `/improve-codebase-architecture`, then `/codebase-design`.
