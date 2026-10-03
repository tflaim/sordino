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
