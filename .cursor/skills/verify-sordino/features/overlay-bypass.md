# Overlay bypass

From the overlay on a muted site, the user can take a timed bypass. The overlay
clears for that site until the bypass ends; the popup can show bypass status.

## Sub-features

- `bypass-offer` shows `#sordino-bypass` with remaining quick bypasses.
- `bypass-take` removes the overlay after a successful bypass click.
- `bypass-budget` decrements today's remaining count visible under the button.

## How to get to it (user POV)

- While muting is in effect, open a muted site and use the overlay.
- Choose **Bypass for N min** on the overlay (default N is 5).

## Driving it with control-sordino

Preconditions:

- Complete [Mute now overlay](./mute-now-overlay.md) so `#sordino-overlay` is
  present on the mapped host (or repeat those steps here).
- Bypass budget is not spent (`0 bypasses left` must not be showing). Fresh
  profiles start with the default budget.

- **Read offer.** With the site page open and overlay attached, the control
  `#sordino-bypass` shows text matching `Bypass for` and a count like
  `N quick bypasses left today`.
- **Take bypass.** Run
  `node .cursor/skills/verify-sordino/scripts/control-sordino.mjs site click --selector '#sordino-bypass'`.
  Then
  `… site wait --selector '#sordino-overlay' --state detached`
  and
  `… site eval --expr 'document.getElementById("sordino-overlay") === null'`.
  Result is `true`; page heading `fake www.reddit.com` remains.
- **Confirm popup.** Run `popup open` then `popup wait-text --pattern 'Bypass active'`.
  Optional: `screenshot --page popup --path overlay-bypass/popup.png`.
- **Proof.** Save `screenshot --page site --path overlay-bypass/site-after.png`
  showing the fake site without the overlay, and record bypass budget text from
  the popup Today strip.

## Gotchas

- If **scaffolding mode** is on in Bypass Settings, the first click only arms
  `Tap again to bypass`; a second click commits. Default fresh profiles leave
  scaffolding off.
- When the daily budget is spent, the button may read `0 bypasses left` and
  refuse a normal quick bypass — report budget exhaustion in Gotchas of the run
  rather than weakening the journey.
- Do not clear bypass via storage; use **End bypass** in the popup if you need
  to restore overlay state for a second attempt.
