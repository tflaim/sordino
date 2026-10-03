# Sordino — agent notes

## Agent skills

### Issue tracker

Issues, specs and tickets live in GitHub Issues on `tflaim/sordino` (`gh` locally, GitHub MCP tools in cloud sessions). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.

## House rules

- **Overlay motion is CSS and the Web Animations API only.** No animation runtime (Framer Motion, Lottie, GSAP, Motion) in the content script — it runs on page load of every muted site (ADR-0003). Framer Motion is allowed at most in extension pages (popup, settings, First run).
- **Every motion has a reduced-motion and Stillness fallback** in which the plain number/text remains the source of truth (PRODUCT.md Principle 3, decisions 26–29).
- **Language:** use `GLOSSARY.md` terms in code and copy — "mute", never "block".

## Git conventions

- **`main`** is the trunk. 2.0 lands here ticket by ticket and ships as a tag (`v2.0.0`); nothing is released from an untagged commit.
- **Ticket branches:** `<type>/<issue>-<slug>`, cut from `main`, one per GitHub issue.
  - `type` is one of `feat`, `fix`, `refactor`, `chore`, `docs`, `test`.
  - `issue` is the GitHub issue number; `slug` is 2–4 lowercase, hyphenated words.
  - Examples: `chore/2-wxt-foundation`, `feat/3-sordino-store`, `feat/5-overlay-rebuild`, `fix/21-bypass-expiry`.
- **Prototypes:** `prototype/<name>` (throwaway, never merged; see the `prototype` skill).
- **Commits:** Conventional Commits with a scope from the glossary — `feat(store): add Pause with durations`, `fix(overlay): re-attach after body replace`.
- **Pull requests:** one per ticket into `main`; title in the same Conventional Commits form with the issue number (`feat(store): Sordino store and muting model (#3)`); body says `Closes #<issue>`; squash-merge.
- **Never** use auto-generated session names (e.g. `claude/<random-words>`) for branches that get pushed.
