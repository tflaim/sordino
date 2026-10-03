# One background store writes; every other context only reads storage and sends domain commands

Sordino 1.x let the popup, settings page and background each read-modify-write one whole settings object, which lost edits, wrote on every read and left no schema version to migrate from. In 2.0 a single store in the background is the only writer: it runs domain commands one at a time (so a check-and-act such as taking the last unit of Bypass budget is atomic), stores three versioned keys (`config`, `state`, `usage`), and returns effects as desired state (badge, the full alarm set) that thin wiring applies — the store never calls browser APIs itself. Readers in every context read storage directly through a read-only port and subscribe to changes, so the overlay decides at page start without waking the background and reads never write; the read-only/read-write port split makes "only background writes" a compile-time rule. We compared four designs (minimal two-entry, flexible registry, per-surface clients, ports & adapters) and chose the ports & adapters shape with the flexible design's open data model (`MutedSite.rule`, `Schedule.appliesTo`). See `docs/plans/2026-10-03-store-design-it-twice/`.

## Consequences

- The store enforces the Bypass wait itself: showing the Overlay records when the offer was made, and a Bypass taken earlier than that plus the wait is refused.
- If an open tab loses its extension context (e.g. after an update), the Overlay fails closed: Turn back still works locally; Bypass asks the user to reload.
- Do not add a generic "update settings" command or let extension pages write storage directly; that recreates the 1.x lost-update bugs.
