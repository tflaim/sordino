# Sordino runtime / end-to-end test report

Tester: runtime/E2E agent. Repo HEAD `349f5d8`. Browser: Playwright 1.56.1 driving Chromium 141.0.7390.37 (`/opt/pw-browsers/chromium`), new-headless, unpacked extension via `--load-extension`. Fake "blocked" hosts were mapped to a local Python server with `--host-resolver-rules` (reddit.com, www.reddit.com, youtube.com, example.org, ...). All builds were done in scratch copies; `/home/user/sordino` was not modified.

Scratch builds:
- `e2e-repo/` = HEAD 349f5d8, unmodified
- `e2e-pre/` = git worktree at 33f3638 (pre design sweep)
- `e2e-patched/` = HEAD with ONE local change: `import { CONFIRM_RESET_MS } from '../shared/types'` replaced by `const CONFIRM_RESET_MS = 8000` in `src/content/content.ts` (verified `grep -c '^import' dist/chrome/content.js` = 0)

Harness scripts: `$SCRATCH/e2e/*.mjs`. Screenshots: `$SCRATCH/reports/e2e-shots/`.

## What was actually exercised vs inferred

**Exercised in a real Chromium 141 with the unpacked extension (scripts in `$SCRATCH/e2e/`):**
- HEAD build on a blocked host: console/CDP errors captured, overlay absent (t1.mjs). Same harness on 33f3638: overlay present. Same harness on HEAD+1-line patch: overlay present.
- On the patched build: overlay render, bypass click and storage effects, configured duration (15 min), budget exhaustion, scaffolding two-tap and 8 s reset, realistic 1-min bypass expiry with toast timing, pause via the real `PAUSE_BLOCKING` message (as the popup sends it) and its broadcast, Go back in three history situations, flash-of-content with a streamed slow page (CDP screenshots), page-JS-keeps-running, Tab/Enter/Escape keyboard behavior, ARIA attributes, four hostile-CSS pages, main-world overlay removal and a body-replacing page, a non-blocked site (DOM untouched, SW message rate), `history.pushState` on a blocked host after bypass (no overlay, as expected for host-level bypass), custom-site validation through the real settings and popup inputs, SW stop/restart via CDP `ServiceWorker.stopAllWorkers`, and cold-start overlay timing.
- HEAD (unpatched) popup.html and settings.html, both tabs, five popup states, screenshotted. Popup/settings code is unaffected by F1.

**Set up by writing storage directly (not via UI):** `manualOverride:'on'` to force blocking (the sandbox clock was Fri 21:22, outside default Work hours 9-17), `bypassDurationMinutes`, `quickBypassesUsed`, `scaffoldingMode`, and the synthetic usage data for the Usage tab screenshot. The bypass itself was always triggered by clicking the overlay button. Pause was triggered by the real runtime message, not by clicking the popup's Pause dropdown.

**Not exercised / inferred:**
- **Firefox:** no Firefox binary is available. The F1 breakage there is inferred from identical `dist/firefox/content.js` bytes and classic-script semantics.
- **Real reddit/youtube DOM, autoplay media, and real network latency:** not tested (local fake pages only). The F4 flash duration on real sites is inferred from the mechanism. F2 assumes a framework could replace body children; I did not observe real Reddit doing it.
- **bfcache restore of a blocked page:** attempted, but Chromium under Playwright did not restore from bfcache (`bf_restoredFromBfcache:false`), so this is untested. The code only re-checks on `visibilitychange`/30 s, not on `pageshow`.
- **Real toolbar popup sizing:** popup.html was opened as a tab, not as the action popup.
- **Screen readers:** not run. A11y findings come from DOM/ARIA inspection and keyboard simulation.
- **Real web fonts:** blocked by the sandbox (see F12), so screenshots use fallback fonts.
- **Schedule-driven blocking (the "📅 Work hours • until 5:00 PM" card line):** not screenshotted. Only manual-override blocking was used.

## Findings

### F1. Content script fails to parse at HEAD — overlay never appears on any site
**Severity: Critical**

**Evidence (exercised, HEAD build, manualOverride='on', visiting http://www.reddit.com/):**
```
[isolated world] Sordino - Soft Website Blocker for Focus origin=chrome-extension://emljlocmpoodmaplcjfjcbmpekgkcjce
[pageerror] Cannot use import statement outside a module
[cdp exception] "SyntaxError: Cannot use import statement outside a module" url=chrome-extension://emljlocmpoodmaplcjfjcbmpekgkcjce/content.js
overlay: false
```
`dist/chrome/content.js` (fresh HEAD build and the existing `/home/user/sordino/dist/chrome/content.js`) begins `import{C as K}from"./chunks/types-CrXLUOBJ.js";`. Same bytes are copied to `dist/firefox/content.js`.

**Regression pinned (exercised):** the 33f3638 build, same harness, same settings: `content.js` begins `const N=[{text:...` (no import), no exceptions, `overlay: true` — screenshot `e2e-shots/01-PRE-33f3638-reddit.png`. HEAD screenshot `e2e-shots/01-HEAD-reddit.png` shows the raw (fake) reddit page with no overlay. With the one-line local patch (`e2e-patched`), overlay renders again: `e2e-shots/01-PATCHED-reddit.png`.

**Root cause:** commit 372cc65 added `import { CONFIRM_RESET_MS } from '../shared/types'` (`src/content/content.ts:3`). `types.ts` is also imported by background/popup/settings, so Rollup hoists it into a shared chunk `chunks/types-*.js` and emits an ES `import` at the top of `content.js`. Manifest `content_scripts` (`public/manifest.json`, `public/manifest.firefox.json`) are classic scripts, so the file throws a SyntaxError before any code runs. Nothing in `vite.config.ts` prevents chunk-splitting of the `content` entry (no separate IIFE build / `inlineDynamicImports` / `manualChunks` guard), and there is no post-build assertion, so any future shared import into content.ts will silently reintroduce this.

**Firefox:** inferred, not run (`which firefox firefox-esr` finds nothing, and `/opt/pw-browsers` has only Chromium). Firefox content scripts are also classic scripts and `dist/firefox/content.js` contains the identical import line, so the same failure is expected.

**Why it matters:** the overlay is the product. At HEAD, Sordino installs, shows its popup/settings and badge as "active", but never blocks anything on any site, in either browser. Users would see a green "blocking" badge while reddit loads normally.

> **Regression vs pre-existing:** only F1 is a regression from the design sweep (372cc65). From a source grep of the 33f3638 worktree, F2 (`if (overlayElement) return`), F3 (rem units), F6 (30 s poll), F7 (`'5m'`), F8 (`about:newtab`), F10 (1 s poll) and F12 (Google Fonts) all predate it. F13's copy/visual items are mostly sweep-era UI.
>
> All findings below F1 were exercised on the `e2e-patched` build (HEAD + inlined constant), because HEAD itself cannot show an overlay. They describe HEAD behavior once F1 is fixed.

### F2. Overlay never comes back if the page removes it (e.g., framework re-render of `<body>`), and scroll stays locked
**Severity: High**

**Evidence (exercised):** `site/hydrate.html` on reddit.com replaces `document.body.innerHTML` 800 ms after `load` (what a client-side framework re-render or hydration fallback does). Sampled every 2 s for 40 s (two 30 s re-check ticks): `[[0,false],[2,false],...,[38,false]]`, so the overlay is never restored. Screenshot `e2e-shots/07-body-replaced-overlay-gone.png`. Separately, `document.getElementById('sordino-overlay').remove()` from the page's main world leaves the overlay gone (`overlayAfterMainWorldRemove: false`) and `body.style.overflow` stuck at `hidden`.

**Cause:** `showOverlay()` returns early when `overlayElement` is non-null (`src/content/content.ts:618`). The module variable still points at the detached node, so later `checkAndBlock()` calls (30 s interval, visibilitychange, SETTINGS_UPDATE) never re-insert it. Nothing checks `overlayElement.isConnected` and there is no MutationObserver guard. The overlay is also a plain light-DOM child of `<body>`, so it shares the page's DOM lifecycle.

**Why it matters:** Reddit and YouTube are heavy client-rendered apps. Any site script that rebuilds body children removes the soft block for the rest of that page's life, without the user ever choosing to bypass. The block counter still records it as a block. This is a different failure mode from a user choosing to bypass: the product silently does nothing.

### F3. Overlay styling is not isolated: a common root font-size pushes the bypass and "Go back" buttons off-screen; site `button`/`img` rules hide them
**Severity: High** (Medium if you judge the trigger CSS to be rare)

**Evidence (exercised, no shadow DOM, `shadowRoot: false`):**
- `* { font-size: 40px !important; color: red !important }` (the probe you asked for): colors survive, but every `rem` size scales 2.5x. `.sordino-content` measures 640x2346 px in an 800 px viewport, and `.sordino-go-back` sits at y=1215 and `#sordino-bypass` at y=1367, both outside the viewport inside an `overflow:hidden` container, so the mouse cannot reach them. `e2e-shots/06-agg-basic.png` shows only a giant wrapped quote.
- `html { font-size: 40px !important }` alone gives the same result (`06-agg-rem.png`).
- `html { font-size: 62.5% }`, a very common real-world pattern, shrinks everything: quote 15px, bypass-count caption 7.5px, go-back 87x29 px (`06-agg-small-rem.png`).
- `button { all: unset; display:none !important } img { display:none !important }` gives `goBackDisplay: none`, `bypassDisplay: none`, `logoDisplay: none` (`06-aggressive.png`). The user gets a quote with no escape route except closing the tab.

**Cause:** the overlay uses `rem` units throughout (`content.ts:345-613`). The comment on `#sordino-overlay { font-size: 16px }` ("Reset rem baseline - isolates from site CSS") is wrong, because `rem` resolves against `<html>`, not `#sordino-overlay`. Buttons never set `display`, so site rules win. A closed shadow root (or at least `em`/`px` units plus explicit `display`) would isolate it.

**Why it matters:** Principle 1 says every restriction must come with a visible escape route. On sites with large or `!important` root sizing the bypass is unreachable, which turns Sordino into the hard wall it is meant not to be. With 62.5% roots the caption becomes unreadable (WCAG).

### F4. Blocked content is visible until DOMContentLoaded (document_start does not prevent the flash)
**Severity: Medium**

**Evidence (exercised):** `/slow` on reddit.com streams the first `<h1>` and then stalls 3 s before finishing. CDP screenshots at 800/1800/2600 ms after commit show the page fully visible with `overlay:false, readyState:"loading"` (`e2e-shots/05-flash-t800ms.png`, `05-flash-t1800ms.png`, `05-flash-t2600ms.png`). The overlay was inserted at 3019 ms, while first-contentful-paint was at 24 ms. `04-flash-slow-1.5s.png` (taken mid fade-in) also shows the 0.4 s fade-in, during which the page shows through. On a fast local page, overlay insertion (29.3 ms) still came after FCP (28 ms): the page painted first even on localhost.

**Cause:** the script runs at `document_start` but `init()` waits for `DOMContentLoaded` (`content.ts:885-889`), then makes an async SW round-trip, and `showOverlay` waits for `document.body`. Nothing hides `<html>` early (for example a `visibility:hidden` style injected at document_start and lifted when the SW says "not blocked").

**Why it matters:** on slow networks or heavy pages (YouTube, Reddit), users see the feed or thumbnails, and sometimes hear autoplay, before the pause. That defeats the "reflex becomes a decision" moment.

### F5. Page keeps running behind the overlay (keyboard, media, scripts); keyboard focus starts behind it; no dialog semantics
**Severity: Medium** (accessibility and spec mismatch)

**Evidence (exercised, `busy.html` on reddit.com):**
- Page JS keeps running: title counter went from `busy 1` to `busy 4` over 3 s with the overlay up. Inferred: YouTube autoplay audio would keep playing under the overlay (no media pausing exists in the code).
- Focus on show: `BODY`. Tab sequence: `l1 [BEHIND overlay]`, `l2 [BEHIND overlay]`, `inp [BEHIND overlay]`, `sordino-go-back [in overlay]`, `sordino-bypass [in overlay]`, `BODY [BEHIND overlay]`. Keyboard users must tab through every hidden link on the page (hundreds on reddit) to reach the overlay.
- Typing into a hidden input works (`typedBehind: "typed behind overlay"`). Enter on a hidden link navigates (`http://www.reddit.com/other.html`). Escape does nothing (`overlayAfterEscape: true`). That is arguably fine for a soft block, but there is no documented keyboard path.
- `role`, `aria-modal`, and the bypass `aria-label` are all `null`, and siblings are not `inert`. PRODUCT.md says the primary action "announces as 'Bypass for 5 minutes, you have N of 3 remaining today'". Not implemented.
- Positive: once reached, the buttons work with keyboard. Focus ring is visible (`e2e-shots/04-keyboard-focus-goback.png`), and Enter on Bypass bypassed.

**Why it matters:** screen-reader and keyboard users (an explicit PRODUCT.md floor) land in the hidden page, not the pause. Background media undercuts the "beat of stillness".

### F6. Bypass/pause expiry lags up to ~30 s; the "5 seconds" toast is followed by ~25 s of continued access
**Severity: Low–Medium**

**Evidence (exercised, realistic 1-minute bypass, no storage tampering):** toasts `Bypass ending: 30 seconds` (29.2 s before expiry), `10 seconds` (9.4 s), `5 seconds` (4.5 s). The overlay returned **28.7 s after expiry** (`e2e-shots/03-toast-5s.png`, `03-reblocked.png`). Pause via the real `PAUSE_BLOCKING` message: the overlay dropped immediately (broadcast works), `Blocking resumes: 10 seconds` and `5 seconds` toasts appeared, and the overlay returned 7.8 s after pause end. In the first test, where expiry was set to 20 s after bypass, **no countdown toasts appeared at all** and re-block came 6.6 s late.

**Cause:** expiry is only noticed by the 30 s `setInterval(checkAndBlock)` (`content.ts:874`). The 1 s `checkCountdowns` loop knows the exact remaining time but never triggers a re-check at 0. After a bypass click, `removeOverlay()` is called directly (`content.ts:330`) without starting the countdown interval, so toasts only begin after the next 30 s tick. A bypass shorter than ~30 s of remaining time gets no warnings.

**Why it matters:** the copy promises "5 seconds" and then nothing happens for half a minute. This is small but erodes trust in the "fair budget" (ADHD persona). It also makes the 1-minute bypass setting effectively ~1.5 minutes.

### F7. Toolbar badge always says "5m" during a bypass, regardless of configured duration
**Severity: Low**

**Evidence (exercised):** with `bypassDurationMinutes: 15`, the overlay button correctly read `Bypass for 15 min` (`e2e-shots/02-overlay-15min.png`), the stored `activeBypass` was ~14.97 min out, but `chrome.action.getBadgeText({})` returned `"5m"`. With a 1-minute bypass, the badge also read `"5m"` and was still `"5m"` 28 s after expiry. **Cause:** hardcoded `text: '5m'` at `src/background/service-worker.ts` `updateBadge` case `'bypass'`. The badge is only recomputed on the 1-minute alarm or on messages.

### F8. "Go back" sends new-tab users to a blank `about:blank#blocked` page, and loops within the blocked site
**Severity: Medium** (it is the promoted primary action)

**Evidence (exercised):**
- Tab opened via `window.open(url,'_blank','noopener')` (equivalent to a middle-click or target=_blank link from another site): `history.length` = 1. Clicking Go back took the tab to **`about:blank#blocked`**, a white empty page (`e2e-shots/06-goback-newtab-noop.png`). Chrome refuses web-content navigation to `about:newtab` (`content.ts:251`). Firefox behavior was not tested.
- reddit.com → reddit.com/other.html (same blocked site): Go back returned to `http://www.reddit.com/`, which is the overlay again (`sameSiteGoBackOverlay: true`). The user has to press it repeatedly to get off the site.
- Normal case works: example.org → reddit.com → Go back landed on `http://example.org/other.html`.

**Why it matters:** the code comment calls Go back the "primary win-path action". The common "opened from a link in a new tab" case dumps users on a blank error page. `window.close()` (allowed for script-opened tabs) or an extension-hosted landing page would be better.

### F9. Exhausted-budget and scaffolding-mode states work as designed
**Severity: Info (pass)**

Exercised: after `quickBypassesUsed: 3`, the button read `0 bypasses left` (disabled) and the caption read `Resets at midnight` (`02-exhausted.png`). Scaffolding mode: the first click showed `Tap again to bypass` (`02-scaffold-armed.png`) and reverted to `Bypass for 15 min` after 8.8 s (CONFIRM_RESET_MS=8000 honored). A double click bypassed and consumed exactly 1 bypass. Bypass storage after a click: `quickBypassesUsed 1`, `activeBypass {site:"reddit.com"}`, `stats.blocksTriggered 1`, `bypassesUsed 1`, `siteStats.reddit.com {blocks:1,bypasses:1}`. All correct. Note: with 0 left there is no escape on the overlay except Go back (whose new-tab failure is F8), and the overlay does not mention the "emergency refresh".

### F10. Non-blocked sites: DOM untouched, but every unblocked tab polls the service worker once per second, forever
**Severity: Low** (performance and battery)

**Evidence (exercised):** on `example.org` (not in any category), no `#sordino-overlay`, no `#sordino-styles`, no `#sordino-toast-styles`, `body.style.overflow` untouched, no attributes on `<html>`. Good. But a listener counting messages in the SW recorded **11 `GET_SETTINGS` messages in 10 s** with one unblocked tab (example.org) open plus one tab showing the overlay, which does not poll. That is about 1 message/s from the single unblocked tab (0 storage change events). **Cause:** `checkAndBlock()` starts `setInterval(checkCountdowns, 1000)` whenever the page is not blocked (`content.ts:849-851`), and it is never stopped, even when there is no active bypass or pause. With 30 tabs open that is 30 messages/s, each running `checkBypassReset()`, which reads settings and then unconditionally rewrites the whole settings object via `updateSettings` → `chrome.storage.local.set` (`src/shared/storage.ts` `updateSettings`; Chrome suppresses `onChanged` for identical values, hence 0 observed change events), which keeps the MV3 service worker permanently awake.

### F11. Custom-site input does almost no validation; mixed-case entries are stored but never match; the popup allows duplicates
**Severity: Medium**

**Evidence (exercised, settings "Custom sites" input and popup "Add site"):**

| Input | Settings stores | Popup stores |
|---|---|---|
| `https://www.Example.org/r/foo` / `https://www.Reddit.com/r/foo` | `Example.org` (no error) | `Reddit.com` |
| `localhost` | `localhost` | n/a |
| `not a site!!` / `garbage input !!` | `not a site!!` | `garbage input !!` |
| `foo.test:8080` | `foo.test:8080` (port kept, can never match a hostname) | n/a |
| `reddit.com` (already in Social category) | accepted silently | n/a |
| `example.org` then `EXAMPLE.ORG` | both stored (case-sensitive dedupe) | n/a |
| `foo.test` twice | n/a | **stored twice** (popup has no dedupe at all) |
| `<img src=x onerror=alert(1)>` | stored as text (rendered escaped by React, so no XSS, but junk) | n/a |
| whitespace | "Please enter a site" | ignored, input stays open |

Functional check: with `customSites: ['Example.org']`, visiting http://example.org/ gave **overlay: false**. With `['example.org']` it gave **overlay: true**. So a user who pastes a URL with a capital letter (common from address bars and docs) gets a site that looks blocked in settings but never is. **Cause:** `AddSiteInput.handleAdd` (`src/settings/App.tsx:872`) and `QuickAddSite.handleAdd` (`src/popup/App.tsx:~352`) strip scheme, `www.` and path but never lowercase, strip the port, or validate host syntax. `isUrlBlocked` compares against the lowercased `URL.hostname`. Screenshots: `09-settings-custom-sites.png`, `09-popup-after-adds.png`.

### F12. Extension pages fetch Google Fonts, contradicting "Nothing leaves your browser"
**Severity: Medium** (privacy posture; pre-existing since 8b9e44c, not from the sweep)

**Evidence (exercised):** a `request`/`requestfailed` listener on popup.html and settings.html recorded exactly one non-extension request, `https://fonts.googleapis.com/css2?family=Cormorant+Garamond...&family=DM+Sans...` → `net::ERR_CERT_AUTHORITY_INVALID` (this sandbox intercepts TLS). It comes from `src/index.css:1` `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond...&family=DM+Sans...')`, which is bundled into `dist/chrome/assets/index-*.css`. The settings footer says "Stored on this device. Nothing leaves your browser." PRIVACY.md and README say "No external API calls". PRODUCT.md calls zero data leaving the machine "invariant". Every popup or settings open sends the user's IP and User-Agent to Google (and then to fonts.gstatic.com for the font files). Bundling the woff2 files locally fixes this. Side effect for this report: **all popup/settings screenshots render with fallback fonts**, not Cormorant/DM Sans.

### F13. Popup and settings UI observations at HEAD (current-UI screenshots)
**Severity: Low** (each)

Screenshots: `08-popup-default-firstrun.png`, `08-popup-active.png`, `08-popup-paused.png`, `08-popup-bypass-active.png`, `08-popup-inactive-schedule-off-hours.png`, `08-settings-settings-tab.png`, `08-settings-usage-tab-empty.png`, `08-settings-usage-tab-data.png`, `08-settings-narrow-420.png` (no horizontal overflow at 420 px).
- **Misleading status copy:** with "Work hours" enabled but outside hours (Fri 21:22 local), the settings banner says "Not blocking. Turn on a schedule below to start" (`src/settings/App.tsx:385`), and the popup says "BLOCKING INACTIVE / No schedule active" with a big "Start Blocking" CTA. A schedule *is* on. It is just not in its window, and nothing says when it next starts.
- **Red "0/3 bypasses remaining" card in the popup** (`highlight` → `text-destructive`/`bg-destructive/10`, `src/popup/App.tsx:305,331-335`, see `08-popup-inactive-schedule-off-hours.png`). This is the "aggressive red / threat" pattern PRODUCT.md names as an anti-reference (Principle 4). The overlay itself handles the same state calmly.
- **Orphaned period in first-run tip:** "...Schedules live in Settings" wraps with the trailing "." alone on its own line (`08-popup-default-firstrun.png`; `src/popup/App.tsx:158-165`, a `.` text node after a `<button>`).
- **Inverted hierarchy in schedule and settings rows:** the row title ("Work hours", "Daily bypass limit") renders visibly smaller than its secondary line ("Weekdays • 9:00 AM - 5:00 PM") in `08-settings-settings-tab.png`. Verify with real fonts.
- **Usage chart:** today's (Fri) bars sit ~10 px higher than the other days' baseline, because the "today" dot under the label shortens that column (`08-settings-usage-tab-data.png`).
- **Emergency refresh copy:** "Once per day, available at midnight." is shown next to an enabled Refresh button, which reads as "not available now".

### F15. Settings controls have no accessible names (8 of 8 switches, 19 icon buttons)
**Severity: Medium** (accessibility floor in PRODUCT.md)

**Evidence (exercised):** a Playwright accessibility-tree snapshot of settings.html at HEAD found 39 switch/checkbox/button nodes. **27 have an empty accessible name**: all 8 `role="switch"` toggles (schedules, categories, scaffolding mode) and 19 buttons (per-site checkboxes, the stepper "−/+" announce as glyphs only, plus expand/remove icons). Source: the toggle component sets `role="switch"`/`aria-checked` (`src/settings/App.tsx:401-402`) but no `aria-label`/`aria-labelledby`. The only `aria-label` in the file is "Remove schedule" (`:589`). A screen-reader user hears "switch, on" eight times with no idea which schedule or category it controls (WCAG 4.1.2 Name, Role, Value).

### F14. Service worker restart: state survives; behavior unchanged
**Severity: Info (pass)**

**Exercised:** during an active 1-minute bypass, `ServiceWorker.stopAllWorkers` via CDP from an extension page session. Worker status went `running → stopping → stopped` (2.4 s), then auto-restarted when the next content-script message arrived (`30.0s v0 running`). `bypassState` was identical before and after the stop (`quickBypassesUsed:1`, same `activeBypass.expiresAt`), and `storage.session.countedBlockUrls` was readable. After expiry the overlay returned 28.7 s late (same F6 lag as without a restart), and `activeBypass` was cleared to `null` with `quickBypassesUsed` still 1. Cold start: with the SW stopped and no other tabs, loading reddit.com gave overlay insertion at 36 ms vs FCP at 28 ms (local server). The SW wake cost was negligible here, but the page still paints before the overlay. All state lives in `chrome.storage`, so no in-memory state is lost. The `updateQueue` mutex is per-SW-instance, which is fine.

