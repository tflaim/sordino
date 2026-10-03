# Technical brief: the Sordino store interface (design it twice)

Repo: /home/user/sordino (READ-ONLY for you). Sordino is a soft-blocking browser extension (Chrome + Firefox MV3) being rebuilt as 2.0 under WXT. Write ONLY your own output file.

## Read first
- /home/user/sordino/.agents/skills/codebase-design/SKILL.md and DEEPENING.md: use the vocabulary exactly (module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality). Never "component/service/API/boundary".
- /home/user/sordino/GLOSSARY.md: domain names (Muted site, Category, Overlay, Schedule, Mute now, Pause, Back to schedule, Turn back, Bypass, Bypass wait, Bypass budget, Own line, Stillness, Usage, Mute count, First run). Name types and commands with these words. Never "block".
- /home/user/sordino/docs/plans/2026-10-03-overhaul-decisions.md: every behaviour decision, esp. 13–23 (muting model, overlay, Usage) and 34–42 (the store's settled constraints).
- /home/user/sordino/docs/adr/*.md.
- Current 1.x code for the shape of today's data and bugs: src/shared/types.ts, src/shared/storage.ts, src/shared/schedule.ts, src/background/service-worker.ts, src/content/content.ts. Evidence: /home/user/sordino/docs/reviews/2026-10-02/agent-reports/background.md.
- The candidate write-up: 00-deepening-candidates.md §1 (store) and §2–§5 (Muting decision, Bypass budget, Usage, Muted sites modules that sit behind or beside the store).

## The module
The **Sordino store**: the one writer of Sordino's persisted state, living in the background entrypoint.

Settled constraints (do not re-litigate):
- Single writer in background (34). Readers in any context read storage directly and subscribe; reads never write (35).
- Three storage keys, each versioned: `config`, `state`, `usage` (36).
- Domain commands only, each returning an outcome; no generic patch (37).
- Commands return effects (badge, alarms, notify tabs) applied by thin wiring (38).
- Migration: unversioned = v1; one migrate chain for storage and import; malformed import rejected untouched; export = config, Usage opt-in (39).
- Sender rules: extension pages may send any command; content scripts only Record mute / Turn back / Take bypass for the Muted site matching their own tab (40).
- Tests: Vitest at the store interface with in-memory storage adapter, direct-call transport, fixed clock (41).

## Dependencies (DEEPENING.md categories)
- `chrome.storage.local` + `storage.onChanged`: **ports & adapters** — production adapter + in-memory adapter (two adapters: a real seam).
- Command transport (`runtime.sendMessage` from popup/settings/content → background, with `sender`): **ports & adapters** — messaging adapter + direct-call adapter.
- Clock: injected.
- Badge, alarms, `tabs.sendMessage`: **true external** — expressed as returned effects, applied by wiring.
- Muting decision, Bypass budget, Usage, Muted sites: **in-process** pure modules the store delegates to (internal seams).

## Callers (who uses the interface)
- Popup (React): reads snapshot; sends Mute now/Pause/Back to schedule; shows outcomes.
- Settings + First run (React): edits Muted sites, Categories, Schedules, bypass options, Own line, Stillness; Start; export/import.
- Overlay session (content script, plain DOM, runs at document_start on every page): reads snapshot directly, decides locally; sends Record mute (once per navigation), Turn back, Take bypass.
- Background wiring: alarms (Mute now/Pause/bypass end), install/update (migration, First run), context menu "Mute this site", keyboard shortcut.
- Tests.

## Your output
Write to <letter>.md with:
1. **Interface**: TypeScript types and entry points, plus invariants, ordering constraints, error modes (what a caller must know).
2. **Usage examples**: the popup starting a 1-hour Pause; the overlay session at document_start deciding and then taking a Bypass; settings adding "Reddit.com/r/foo"; import of a v1 file; a test.
3. **What the implementation hides** behind the seam.
4. **Dependency strategy and adapters**.
5. **Trade-offs**: where leverage is high, where it's thin; what a 2.0 ticket author would find awkward.
Keep it under ~250 lines. Return to the caller a summary under 150 words.
