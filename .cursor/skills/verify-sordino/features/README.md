# Sordino verification map

This directory is the maintained source for verifying user-facing Sordino
behavior. Read this index before driving the extension, then use the matching
feature file as the recipe.

## Baseline preconditions

- Build Chrome output: `npm run build:chrome` → `.output/chrome-mv3/`.
- Launch with `control-sordino launch` and export `SORDINO_VERIFY_DIR` from its
  stdout. Default `--map-host www.reddit.com` serves a local fake page.
- Run `control-sordino doctor` and require `"ok": true`, a Sordino
  `manifestName`, and an `extensionId`.
- Never drive a Chromium profile that was not started by this verification run.
- Fresh profiles show the first-run tip in the popup; dismiss with
  `popup dismiss-tip` (or the `Got it` button) before asserting chrome below it.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position.
  Overlay exceptions (`#sordino-overlay`, `#sordino-bypass`) are stable product
  IDs already used by `tests/e2e`.
- Treat every command as literal. Keep quoted names and flags unchanged.
- Run all actions through `node .cursor/skills/verify-sordino/scripts/control-sordino.mjs`.
- After mutating muting state, restore with **Back to schedule** when the
  feature file says so. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes a screenshot with Sordino identity visible; add an ARIA
  snapshot for popup/options.
- Mutation proof includes a second read-only view (popup status text and/or
  `sw-eval` alarm / overlay presence).
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the
user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-sordino` starts with `Preconditions:` and uses
   labeled bullets that pair each user action with an exact command and
   observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable
handles, required state, commands, and observable proof.

## Features

- [Mute now overlay](./mute-now-overlay.md) — start Mute now from the popup and
  see the overlay on a muted site.
- [Overlay bypass](./overlay-bypass.md) — take a timed bypass from the overlay
  and confirm the site is usable again.
- [Pause](./pause.md) — pause muting from the popup so muted sites stay clear.
- [Open settings](./open-settings.md) — open the options page from the popup
  gear and confirm Settings / Usage.
- [Add custom site](./add-custom-site.md) — add a domain from the popup and see
  it under Custom Sites in settings.
