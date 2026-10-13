# Mute now overlay

Mute now starts finite muting outside the schedule. While it is running, a muted
site shows Sordino's overlay instead of the page content.

## Sub-features

- `mute-now-start` starts Mute now for 1 hour from the popup.
- `mute-now-status` shows popup copy like `Muting until … · Mute now`.
- `mute-now-alarm` schedules the `muting-change` end alarm.
- `mute-now-overlay` attaches `#sordino-overlay` on a default Social host.

## How to get to it (user POV)

- Open the toolbar popup → under **Mute now**, choose **1 hour**.
- With Mute now running, navigate to a muted Social site (e.g. reddit.com).

## Driving it with control-sordino

Preconditions:

- Session launched with default `--map-host www.reddit.com`.
- `control-sordino doctor` reports `"ok": true`.
- Muting is not already forced by an unrelated leftover mode (fresh profile).

- **Open popup.** Run `node .cursor/skills/verify-sordino/scripts/control-sordino.mjs popup open`. Heading `Sordino` is visible.
- **Dismiss tip.** Run `node .cursor/skills/verify-sordino/scripts/control-sordino.mjs popup dismiss-tip`. First-run card is gone or was already dismissed.
- **Start Mute now.** Run `node .cursor/skills/verify-sordino/scripts/control-sordino.mjs popup click --role button --name '^Mute now for 1 hour'`. Then `… popup wait-text --pattern '^Muting until .* · Mute now$'`. Status shows Mute now.
- **Confirm alarm.** Run `node .cursor/skills/verify-sordino/scripts/control-sordino.mjs sw-eval --expr 'chrome.alarms.get("muting-change")'`. Result has a `scheduledTime`.
- **Visit muted site.** Run `node .cursor/skills/verify-sordino/scripts/control-sordino.mjs site open` then `… site wait --selector '#sordino-overlay'`. Overlay is attached.
- **Proof.** Run `… screenshot --page site --path mute-now-overlay/overlay.png` and `… screenshot --page popup --path mute-now-overlay/popup.png` plus `… aria --page popup --path mute-now-overlay/popup.aria.txt`. Artifacts show Sordino overlay on the fake reddit page and Mute now status in the popup.

## Gotchas

- Outside Work hours, schedules alone will not mute — Mute now (or another
  active schedule) is required. This recipe always starts Mute now.
- Headless-shell cannot load extensions; use Playwright's full Chromium channel
  (the helper default) or `CHROMIUM_PATH` to a full build.
- Host mapping only covers the host passed to launch. Visiting the real network
  host bypasses the fake server and may hang offline.
- Overlay proof is `#sordino-overlay` attached, not merely `http://www.reddit.com/` loading.
