---
name: verify-sordino
description: >-
  Drive the Sordino browser extension (Chrome MV3 overlay, popup, and settings)
  in a disposable Chromium profile via Playwright. Use when proving user-facing
  muting behavior, overlays, Mute now/Pause, bypass, or settings — not for unit
  tests alone.
---

# Verify Sordino

Sordino is a Manifest V3 browser extension. The primary user surface is Chromium
with the built extension loaded: toolbar **popup**, **settings** (options page),
and the **overlay** injected on muted sites. There is no standalone web server.

Use this skill to launch an isolated instance, doctor it, drive a mapped feature
the way a user would, capture evidence, and clean up. Read
`features/README.md` before driving; follow the matching feature file.

## Launch

From the repo root, with dependencies installed:

```bash
npm install
npm run build:chrome
# once per machine — uses the Playwright version pinned in package.json (currently
# 1.56.1). Do NOT run bare `npx playwright install` (that can pull a newer CLI):
node .cursor/skills/verify-sordino/scripts/install-chromium.mjs
```

`install-chromium.mjs` runs the local `node_modules/playwright` CLI and fails
after 4 minutes (`SORDINO_PLAYWRIGHT_INSTALL_TIMEOUT_MS` to override) if the
install stalls — on macOS this has hung for ~9 minutes while writing
`Assets.car`. On timeout it prints a **manual-unzip workaround**: dry-run the
pinned CLI for URLs/paths, `curl` the zip, `unzip` into the cache dir, `touch
INSTALLATION_COMPLETE`, then re-run the helper.

Start a disposable session (maps `www.reddit.com` to a local fake page by default —
that host is in the Social category, so it mutes while muting is in effect):

```bash
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs launch --run-id demo
# Copy and run the `export` field from launch's JSON stdout, e.g.
#   "export": "export SORDINO_VERIFY_DIR=/var/folders/.../sordino-verify-demo"
# On macOS the directory is under $TMPDIR, not necessarily /tmp. Do not hardcode
# /tmp/sordino-verify-demo.
```

Launch stdout is a JSON object that includes `"ready": true` and the `export`
line when the session is usable. The daemon also writes `"event":"ready"` to
`$SORDINO_VERIFY_DIR/daemon.log` and `ready.json` — that string is **not** on
launch stdout. Also require `session.json` to contain an `extensionId`, and
`control-sordino doctor` to return `"ok": true` with that same id. A listening
port alone is not enough — the service worker must answer.

Teardown (keeps evidence; see Cleanup):

```bash
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs cleanup
```

Env:

| Variable | Role |
|----------|------|
| `SORDINO_VERIFY_DIR` | Session dir set by launch; required for later commands |
| `CHROMIUM_PATH` | Optional full Chromium binary (not headless-shell) |
| `HEADED=1` | Show the browser window |
| `SORDINO_PLAYWRIGHT_INSTALL_TIMEOUT_MS` | Install helper timeout (default 240000) |

Isolation: each launch gets its own Chromium user-data dir and HTTP port. Never
drive a profile you did not start. Do not load the unpacked extension into the
user's everyday browser for verification.

## Doctor

```bash
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs doctor
```

Require `"ok": true`, a non-null `extensionId`, `manifestName` containing
`Sordino`, `dist` pointing at `.output/chrome-mv3`, and `artifactsDir` under
`.cursor/skills/verify-sordino/artifacts/<run-id>/`. If anything looks off, run
doctor before retrying drive steps.

## Drive

Harness: `control-sordino` (Playwright persistent context + extension load,
same approach as `tests/e2e/harness.mjs`). Prefer role + accessible name from
the feature map. Stable handles already in the product:

| Surface | Handle |
|---------|--------|
| Popup title | `getByRole('heading', { name: 'Sordino' })` |
| Mute now 1h | `getByRole('button', { name: /^Mute now for 1 hour/ })` |
| Pause 1h | `getByRole('button', { name: /^Pause for 1 hour/ })` |
| Back to schedule | `getByRole('button', { name: /Back to schedule/ })` |
| Settings gear | `button:has(svg.lucide-settings)` (no aria-label yet) |
| Overlay root | `#sordino-overlay` |
| Bypass | `#sordino-bypass` / text `/^Bypass for/` |
| Go back | `.sordino-go-back` / text `/Go back/` |
| Options tabs | buttons named `Settings` and `Usage` |

Example — open popup and start Mute now for 1 hour:

```bash
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs popup open
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs popup dismiss-tip
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs popup click --role button --name '^Mute now for 1 hour'
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs popup wait-text --pattern '^Muting until .* · Mute now$'
```

Do not seed muting by writing `chrome.storage` or calling store commands from
eval. Mute now, Pause, Bypass, and settings changes must go through the UI.

## Evidence

Artifacts live in `.cursor/skills/verify-sordino/artifacts/<run-id>/` and
**survive** cleanup. Proof standards:

- Exercise the real user path (popup / overlay / options), not internal setters.
- Capture the action and the resulting state (e.g. Mute now click **and**
  overlay present), not only the final screen.
- Verify side effects the product exposes: `muting-change` alarm via
  `sw-eval`, overlay attachment, status copy in the popup.
- Screenshot must show Sordino chrome (logo/heading or overlay title "Sordino").
- Pair screenshots with an ARIA snapshot when the page has an accessibility tree
  (popup/options). Overlay is plain DOM in a closed shadow path in places —
  prefer `#sordino-overlay` presence plus screenshot.

```bash
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs screenshot --page site --path mute-now-overlay/overlay.png
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs aria --page popup --path mute-now-overlay/popup.aria.txt
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs sw-eval --expr 'chrome.alarms.get("muting-change")'
```

## Cleanup

```bash
node .cursor/skills/verify-sordino/scripts/control-sordino.mjs cleanup
```

Stops the daemon started by this run, closes Chromium, deletes the throwaway
profile and `SORDINO_VERIFY_DIR`. Does **not** delete
`.cursor/skills/verify-sordino/artifacts/<run-id>/`. Never kill by process name
(`pkill chromium`); only cleanup (or the daemon's own `/cleanup`) should stop
what launch started.

After cleanup, confirm evidence still exists under the artifacts path printed at
launch.

## Helpers

| Script | Invocation |
|--------|------------|
| Install Chromium (pinned) | `node .cursor/skills/verify-sordino/scripts/install-chromium.mjs` |
| CLI | `node .cursor/skills/verify-sordino/scripts/control-sordino.mjs <command>` |
| Daemon | started only by `launch`; do not run by hand |

`control-sordino.mjs --help` prints the full command list. Repo smoke tests
(`npm run test:smoke`) remain the CI gate; this skill is for agent-driven
end-to-end proof against the real UI.

## Feature map

See [features/README.md](features/README.md).

## Known gaps

- **Firefox is not covered.** Launch and the smoke harness load the Chrome MV3
  build (`.output/chrome-mv3`) into Chromium. There is no Firefox / `web-ext`
  verification path in this skill yet — prove Chrome behavior only, or extend
  the harness before claiming Firefox.
