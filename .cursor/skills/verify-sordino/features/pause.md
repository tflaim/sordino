# Pause

Pause suspends all muting for a chosen duration. While paused, muted sites load
without the overlay; the popup status reflects the pause end time.

## Sub-features

- `pause-start` starts Pause for 1 hour from the popup.
- `pause-status` shows popup copy like `Paused until …`.
- `pause-site-clear` leaves a muted Social host without `#sordino-overlay`.

## How to get to it (user POV)

- Open the toolbar popup → under **Pause**, choose **1 hour** (or 15 min /
  Rest of today).
- Optionally choose **Back to schedule** later to end the pause early.

## Driving it with control-sordino

Preconditions:

- Session launched with default `--map-host www.reddit.com`.
- `control-sordino doctor` reports `"ok": true`.

- **Open popup.** Run `popup open` and `popup dismiss-tip`.
- **Start Pause.** Run
  `node .cursor/skills/verify-sordino/scripts/control-sordino.mjs popup click --role button --name '^Pause for 1 hour'`.
  Then `popup wait-text --pattern '^Paused until'`.
- **Visit muted site.** Run `site open` then
  `site eval --expr 'document.getElementById("sordino-overlay") === null'`.
  Result must be `true` (no overlay while paused).
- **Proof.** `screenshot --page site --path pause/site-clear.png` and
  `screenshot --page popup --path pause/popup.png` plus
  `aria --page popup --path pause/popup.aria.txt` showing Paused status.
- **Restore (optional).** `popup click --role button --name 'Back to schedule'`
  so later features are not stranded in a Pause.

## Gotchas

- Pause wins over schedules and over a prior Mute now (most recent mode wins).
  If you need the overlay again, end Pause or start Mute now explicitly.
- Do not confuse Pause (no overlay) with a failed Mute now recipe.
