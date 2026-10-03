# Sordino: Content Script and Blocking Overlay Audit

Scope: `src/content/content.ts` (889 lines, injected on `<all_urls>` at `document_start`), `src/shared/quotes.ts`, `src/shared/snarky-titles.ts`, `public/manifest.json`, `public/manifest.firefox.json`, `vite.config.ts`. The service worker (`src/background/service-worker.ts`) and storage layer (`src/shared/storage.ts`) are cited wherever the content script's behaviour depends on them. Design intent comes from `PRODUCT.md` and `DESIGN.md`. This was a read-only review at HEAD `349f5d8`.

## Verdict

The overlay does several things well. It builds its DOM imperatively, with no `innerHTML`. It honours `prefers-reduced-motion`. It uses real `<button>`s. The visual hierarchy (Go back promoted, bypass demoted) is sound. The plumbing underneath is not production-grade:

- **At HEAD the content script does not run at all**, because of a build problem.
- When it did run, it polled the service worker once a second from every tab on the web, and each poll caused a storage write.
- The overlay lives in the page DOM with no shadow root and no top layer. It does not stop media, it can be beaten by fullscreen, and it can be removed for good by the page.
- It has no dialog semantics or focus management.
- About half of the snarky titles break the brand's own "peer-not-parent" rule. Several of the "literate" quotes are misattributed.

---

## Critical

### 1. The content script ships as an ES module, so it throws a SyntaxError and never runs (both browsers)
**Severity:** Critical

**Evidence**
- `dist/chrome/content.js` begins with `import{C as K}from"./chunks/types-CrXLUOBJ.js";`.
- `vite.config.ts:118-136` has a single Rollup build with four `input` entries (popup, settings, content, background). Output is in the default `es` format, with `chunkFileNames: 'chunks/[name]-[hash].js'`.
- Rollup moves any module imported by two or more entries into a shared chunk. Each entry then reaches that chunk through a static `import`.
- Commit 372cc65 added `content.ts:3`: `import { CONFIRM_RESET_MS } from '../shared/types'`. `types.ts` is also imported by `settings/App.tsx:4`, `popup/App.tsx:5` and `service-worker.ts:4`, so it became a shared chunk.
- Before that commit, the build worked only by luck. `quotes.ts` and `snarky-titles.ts` each had one importer (content), so Rollup inlined them.
- Content scripts declared in `manifest.json:35-41` are classic scripts in Chrome and Firefox. Neither browser supports `"type":"module"` for manifest content scripts. A top-level `import` therefore causes `SyntaxError: Cannot use import statement outside a module`, and nothing in the file executes.
- `restructureExtension()` (`vite.config.ts:69-90`) copies `content.js` and `chunks/` to `dist/firefox`, so Firefox is broken too.
- Side note: `package.json` runs `BROWSER=firefox vite build`, but `vite.config.ts` never reads `BROWSER`, so both scripts produce identical output.

**Impact:** No overlay is shown on any site, so the product's core function is gone. The failure is silent: the popup still says "blocking active" and the badge is green. Users in the ADHD-primary persona will conclude that *they* failed, which is the exact story PRODUCT.md says Sordino exists to prevent.

**Fix options, most robust first:**

1. **Separate IIFE build for the content script (recommended).** Add `vite.content.config.ts` with:
   - `build.lib = { entry: 'src/content/content.ts', formats: ['iife'], name: 'SordinoContent', fileName: () => 'content.js' }`, or the equivalent `rollupOptions.output: { format: 'iife', inlineDynamicImports: true }`;
   - `emptyOutDir: false` and `outDir: 'dist/chrome'`.

   Run it as `vite build && vite build -c vite.content.config.ts`, then run the Firefox copy step after the second build. Move `restructureExtension` into a small Node post-build script so both builds have finished before it runs. Rollup cannot emit IIFE for multiple inputs, which is why a second build is needed. With this, any shared import is inlined and the problem cannot come back.
2. **Use an extension-aware toolchain** (WXT, CRXJS, or `vite-plugin-web-extension`). These handle content-script bundling, manifest generation and per-browser builds, and remove the hand-rolled `restructureExtension` copy logic. It is a bigger change, but it is the long-term answer.
3. **Loader shim:** `content.js` does `import(chrome.runtime.getURL('content-main.js'))`. Rejected. It needs the chunks listed in `web_accessible_resources`, which makes the extension detectable (see #14). It adds an async hop at `document_start`, and Firefox handles dynamic `import()` in content scripts inconsistently.
4. **Inline the constant / avoid shared imports:** copy `8000` into `content.ts`, or move constants to a content-only module. Rejected as the main fix. The next shared import (for example, using `shouldBlock` from `schedule.ts`, which #2 recommends) breaks it again.

**Regression guard (do this whatever else you choose):** add a post-build assertion. For example, parse `dist/*/content.js` with `acorn` using `sourceType: 'script'`, or run `node -e` with a regex that rejects a top-level `import`/`export`. Fail the build if either appears. The repo has no tests (`package.json` has no test script), which is how this shipped.

---

## High

### 2. Every open tab polls the service worker every second, and every poll writes to storage
**Severity:** High

**Evidence (the full chain)**
- `content.ts:885-889`: everything waits for `DOMContentLoaded`, so `document_start` buys nothing.
- `content.ts:846-852`: on **every non-blocked page** (your bank, Google Docs, anything), `setInterval(checkCountdowns, 1000)` starts and is never cleared.
- `content.ts:769`: each tick sends `GET_SETTINGS`.
- `service-worker.ts:265-266`: `handleMessage` calls `checkBypassReset()` **unconditionally** for every message type.
- `service-worker.ts:170`: `checkBypassReset` always calls `updateSettings`.
- `storage.ts:77-81`: `updateSettings` always reads, then `saveSettings` (a full `storage.local.set`) even when nothing changed.
- `service-worker.ts:366-367`: the **entire settings object** goes back to the tab: block list, schedules, per-site daily and weekly stats.
- On top of that: `content.ts:874` polls `GET_BLOCK_STATUS` every 30 s on every tab (the same read+write path, plus a stats write), and the `visibilitychange` re-check at `content.ts:867`.

**Impact**
- With N tabs open, Sordino does roughly N × (2 storage reads + 1 storage write + 1 full structured clone) per second. Even if the browser skips writing unchanged values, the reads and clones remain.
- The MV3 service worker never reaches its idle timeout, so the MV3 lifecycle is defeated.
- `updateQueue` (`storage.ts:77`) runs all of these in sequence. A real `USE_BYPASS` click waits behind every tab's no-op write, so bypass latency grows with tab count.
- Every web page's isolated world receives the user's whole block list and stats every second. That is not a leak to the page, but it is wasteful.
- The cost falls on battery and CPU across the whole browser, which is at odds with an extension that wants to be quiet.

**Fix**
- Let the content script decide locally. Content scripts can call `chrome.storage.local.get` directly, and `shouldBlock`/`isScheduleActive` in `schedule.ts` are pure, so the script can match the hostname against the list itself. If the host is not on any list, return immediately: no listeners, no intervals, no DOM.
- Subscribe to `chrome.storage.onChanged` instead of polling.
- Set a single `setTimeout` for the next relevant moment: schedule start or end, bypass `expiresAt`, pause `pausedUntil`.
- Make `checkBypassReset` write only when the date has actually rolled over, and never on read-only messages.
- Stronger option: use `chrome.scripting.registerContentScripts` with `matches` built from the block list, and re-register when the list changes. The script then only exists on blockable hosts. This needs the `scripting` permission. The `<all_urls>` host permission already exists.
- On bundle cost: `content.js` is about 23 KB minified, of which quotes, titles and CSS are about 13 KB. Parse cost is negligible next to the polling. With a local early exit it would not matter either way.

### 3. The page paints and starts playing before the overlay appears
**Severity:** High

**Evidence:** `content.ts:885-889` defers `init()` to `DOMContentLoaded`. `checkAndBlock` then waits for a service-worker round trip (`content.ts:33`), which may include a cold start, plus a storage read and write in the worker. `showOverlay` also waits for `body` and `head` (`content.ts:621-624`). Nothing hides the page at `document_start`.

**Impact:** HTML streams and paints well before `DOMContentLoaded` on heavy pages such as Reddit, X and YouTube. Users see the feed, thumbnails and headlines for a fraction of a second up to several seconds. That is exactly the hook the product is meant to interrupt, and it means "a held breath" arrives after the reflex has already fired.

**Fix:** at `document_start`, check the hostname locally (see #2). If it might be blocked, add a hiding style straight away, for example `html{visibility:hidden}` via a `<style>` on `document.documentElement`, or mount the overlay host on `documentElement` before `body` exists. Then confirm against schedule and bypass state and either reveal the page or finish rendering the overlay. With `registerContentScripts` you can also register a `css` file that hides the page for blocked hosts with zero JavaScript latency.

### 4. Audio and video keep playing behind the "Muted" overlay
**Severity:** High

**Evidence:** `content.ts` has no `pause()`, `muted`, `play`-event or media handling anywhere. The overlay is a visual cover only (`content.ts:617-639`).

**Impact:** YouTube autoplays the video and its sound plays behind "🔇 Muted / For your own good". When a bypass expires mid-video, the overlay returns and the audio keeps going. For a product named after a mute, this is the most visible failure.

**Fix:** while the overlay is shown:
- `document.querySelectorAll('video,audio').forEach(m => { m.pause(); m.muted = true })`;
- add a **capturing** `document.addEventListener('play', e => e.target.pause(), true)` so later or autoplaying media are stopped too (the `play` event does not bubble but can be captured);
- remove the listener on bypass, without auto-resuming (let the user press play).

### 5. Fullscreen elements and later max-z-index elements sit above the overlay; the page stays keyboard-interactive behind it
**Severity:** High

**Evidence**
- The overlay is an ordinary `div` appended to `body` with `z-index: 2147483647` (`content.ts:361, 628`).
- A fullscreen element (`requestFullscreen`) is in the **top layer**, which always paints above any z-index.
- Any element appended later with the same max z-index (cookie banners, chat widgets) paints above the overlay because it comes later in DOM order.
- No `inert` is applied to the page, so Tab moves focus into invisible page content, and site keyboard shortcuts still work (YouTube `k`/`space`/`j`/`l`, X `j`/`k`).

**Impact:** if a bypass expires while a YouTube video is fullscreen, the overlay renders underneath and the user keeps watching. Keyboard users can operate the hidden page.

**Fix:** render the overlay in a `<dialog>` and call `showModal()`. That puts it in the top layer (above fullscreen elements opened earlier), makes the rest of the document inert, traps focus, and gives `aria-modal` semantics in one step. Also call `document.exitFullscreen?.()` before showing. Override the dialog's UA `::backdrop`, `max-width` and `max-height`, and ignore `cancel` (Esc) if you don't want Esc to dismiss it.

### 6. The overlay can be removed by the page and then never returns (stale `overlayElement`); orphaned scripts fail open
**Severity:** High

**Evidence**
- `content.ts:618`: `if (overlayElement) return` does not check `overlayElement.isConnected`.
- If anything removes `#sordino-overlay` (a framework re-rendering `body`, `document.body.innerHTML = …`, an anti-overlay script, the user's element picker), the module variable stays non-null. Every later `checkAndBlock` (30 s poll, visibility change, `SETTINGS_UPDATE`) calls `showOverlay`, which returns immediately. The page stays unblocked until a full navigation.
- There is no `MutationObserver` to re-attach the overlay.
- Related: after an extension update or reload, scripts already running in open tabs are orphaned. `chrome.runtime.sendMessage` throws. `checkBlockStatus` catches the error and resolves `{isBlocked:false}` (`content.ts:45-47`), so the next 30 s poll calls `removeOverlay()` (`content.ts:847`) and **every blocked tab un-blocks itself**. Meanwhile `checkCountdowns` logs `Sordino: Error checking countdowns` to every page's console once a second, forever (`content.ts:827-829`).

**Impact:** blocking silently disappears on some sites, and after every update.

**Fix:**
- Use `if (overlayElement?.isConnected) return; overlayElement = null`.
- Mount on `document.documentElement`, inside a closed shadow root (#11), and watch `documentElement` with a cheap `childList` `MutationObserver` that re-appends the host only while blocked.
- Detect an orphaned context (`!chrome.runtime?.id`) and tear down all intervals and listeners instead of failing open.

### 7. A page script can click the bypass button and spend the user's bypass budget
**Severity:** High (security / integrity)

**Evidence:** the bypass handler at `content.ts:306` and the Go back handler at `content.ts:246` never check `event.isTrusted`. The buttons sit in the page DOM with stable IDs (`#sordino-bypass`, `content.ts:259`). Page JavaScript can run `document.getElementById('sordino-bypass').click()` (twice in scaffolding mode) and the content-script listener fires, sending `USE_BYPASS`.

**Impact:** any blocked site can unblock itself and use up the user's daily bypasses, deliberately or through generic auto-click scripts.

**Fix:** `if (!e.isTrusted) return` in both handlers. A closed shadow root (#11) also hides the elements from `getElementById`.

### 8. On short viewports or at high zoom, Go back and Bypass are clipped and unreachable
**Severity:** High (it breaks Principle 1 and WCAG 1.4.10)

**Evidence:** `.sordino-container { height:100%; overflow:hidden; align-items:center }` (`content.ts:382-391`). Content height is roughly: logo, title at 2.5rem, subtitle, quote with `min-height:140px`, card, two buttons. That is about 650-700 CSS px before margins. At 200% zoom on a 1366×768 laptop the viewport is about 384 CSS px tall, and because the content is centred with overflow hidden, both the top and the bottom (the buttons) are cut off. The same happens on phones in landscape with Firefox Android.

**Impact:** the "visible escape route" that PRODUCT.md:89-92 calls *the thesis* disappears for low-vision users who zoom.

**Fix:** use `overflow-y:auto; overscroll-behavior:contain` on the scroll container, `min-height:100%` instead of a fixed height, and `margin:auto` centring so tall content scrolls instead of clipping. That also stops wheel events from scrolling the page behind the overlay (see #12).

---

## Medium

### 9. Bypass expiry and schedule start depend on the 30 s poll, so the "5 seconds" toast can be up to 30 s early
**Severity:** Medium

**Evidence**
- The alarm handler (`service-worker.ts:452-485`) updates state every minute but never calls `broadcastSettingsUpdate()`.
- `USE_BYPASS` (`service-worker.ts:322-364`) does not broadcast either, so other tabs on the same site keep a stale overlay.
- The content script only re-checks on its 30 s interval (`content.ts:874`) or on a visibility change.
- `checkCountdowns` shows "Bypass ending: 5 seconds" (`content.ts:778-799`) but never calls `checkAndBlock()` when `remaining <= 0`.
- `isChecking` (`content.ts:833`) drops a `SETTINGS_UPDATE` that arrives mid-check, so state stays stale until the next poll.
- `showOverlay` never refreshes an existing overlay (`content.ts:618`), so bypass counts and the reason stay stale while it is up.

**Impact:**
- Tabs left open when a schedule starts block within 0-30 s. That is acceptable.
- Bypass expiry is announced by a "5 seconds" urgent toast, then nothing happens for up to 30 s. The toast is wrong, and the product's tone depends on it being trustworthy.
- In Chrome, timers in background tabs are throttled (heavily after 5 minutes hidden), so hidden tabs catch up only on `visibilitychange`.

**Fix:** set one `setTimeout(checkAndBlock, expiresAt - Date.now())` when a bypass or pause is active, plus `storage.onChanged` (#2). Alternatively, in the service worker, create a `chrome.alarms` alarm at `expiresAt` and at the next schedule boundary, and broadcast when it fires. Queue a re-check rather than dropping it when `isChecking` is set. Update the overlay in place when status changes.

### 10. "Go back" leads back into the same blocked site, or does nothing
**Severity:** Medium

**Evidence:** `content.ts:248-251` uses `history.length > 1 ? history.back() : location.href = 'about:newtab'`.
- (a) On single-page-app sites (YouTube, Reddit, X), earlier history entries are usually pushState entries on the *same host*. `history.back()` lands on another page of the blocked site, the overlay stays up, and the button looks broken. Common case: the bypass expires after browsing a few videos.
- (b) A link opened in a new tab has `history.length === 1`. Web content generally cannot navigate to `about:newtab`: Chrome turns it into `about:blank#blocked`, and Firefox refuses privileged about: pages. So this is likely a dead button. **The runtime agent should confirm.**

**Impact:** the "win path" action, which DESIGN.md §5.11 promotes to the primary button, is unreliable exactly where it matters.

**Fix:** move navigation to the service worker. The content script sends `LEAVE_SITE`. The worker uses `sender.tab.id` and either `chrome.tabs.goBack` past entries on the same host or `chrome.tabs.update(tabId, {url: 'chrome://newtab/'})` (Firefox: `about:newtab` is allowed from extensions), or closes the tab. None of this needs an extra permission. A simpler partial fix: only use `history.back()` when `document.referrer` has a different host.

### 11. No shadow DOM: CSS bleeds in both directions; the `rem` "reset" comment is wrong
**Severity:** Medium

**Evidence**
- `content.ts:363`: `font-size: 16px !important; /* Reset rem baseline - isolates from site CSS */`. This is incorrect. `rem` always resolves against `<html>`, not the nearest ancestor, so every `rem` in the overlay (`content.ts:411-599`) scales with the site's root font size. On sites using the common `html{font-size:62.5%}` idiom, the bypass caption (`0.75rem`, `content.ts:597`) renders at about 7.5 px and the quote at 15 px. The fixed px value also ignores the user's preferred default font size.
- Properties the overlay never sets come from the host's rules. Examples: `button { text-transform; letter-spacing; box-shadow; min-width; line-height }`, `img { max-width; filter }`, `p { … }`, `*{ box-sizing }`, and host `* { font-family … !important }`. The `!important` on every overlay rule helps but cannot cover properties that aren't declared.
- Outbound bleed: `document.body.style.overflow = 'hidden'` and then `= ''` (`content.ts:631, 645`) **erases whatever inline overflow the site had**. Scroll-lock libraries and modals use exactly that, so the site breaks after a bypass. The overlay also does not lock scrolling when `<html>` is the scroller (`html{overflow-y:scroll}`); see #12.
- Global `<style>` elements with IDs are injected into `<head>` (`content.ts:345-614, 719-738`). On pages with a strict `style-src` CSP (no `'unsafe-inline'`), injected `<style>` elements may be blocked depending on browser version and world. That should be verified; it is an uncertainty, not a confirmed bug.

**Fix:** mount a host element on `documentElement` with `attachShadow({mode:'closed'})`, and give the host `all: initial` plus `font-size: medium`. Inside the shadow root, size in `em` (or `px`), not `rem`. Deliver styles through a constructable stylesheet (`adoptedStyleSheets`) or an extension CSS file. Save and restore the previous `body` and `documentElement` overflow values instead of clearing them. A closed shadow root also helps #6, #7 and #15.

### 12. The page scrolls behind the overlay (infinite feeds keep loading)
**Severity:** Medium

**Evidence:** the overlay is not scrollable (`overflow:hidden`, `content.ts:390`). Wheel and touch scrolling over a non-scrollable fixed element chains to the document. `body{overflow:hidden}` does not stop viewport scrolling when the site sets `overflow` on `<html>`.

**Impact:** feeds on Reddit and X keep fetching and rendering behind the overlay, which wastes CPU and network. After a bypass, the user lands somewhere else in the feed.

**Fix:** make the overlay its own scroll container with `overscroll-behavior: contain` (#8). `showModal()` plus `inert` also blocks scroll chaining in practice.

### 13. Countdown toasts appear on every page of the web, are not dismissible, block clicks, and read as an alarm
**Severity:** Medium

**Evidence**
- The pause countdown (`content.ts:809-826`) is **not limited to blocked sites**. "Blocking resumes: 1 minute / 30 seconds / 10 seconds / 5 seconds" toasts appear on whatever page is visible: online banking, a Google Doc mid-sentence.
- The toast is a page-DOM `div` fixed at the bottom right (`content.ts:690-740`) without `pointer-events:none`. It covers chat widgets and "Send" buttons for 2.5-15 s, with no close control.
- It has no `role="status"`/`aria-live`, so screen-reader users never hear the warnings.
- Two amber "urgent" toasts in the last 10 s, one of which persists 15 s (`content.ts:747`), are the alarm PRODUCT.md:62 says the overlay is not. The `colors` map defines identical palettes for `bypass` and `pause` (`content.ts:675-686`).
- The pause icon `▶` ("play") for "blocking resumes" means the opposite of what is happening.

**Fix:**
- Limit pause toasts to hosts that are actually blockable.
- Show at most one quiet, `pointer-events:none` toast (for example at 60 s) inside the shadow root, with `role="status"`.
- Let the overlay's own return be the final signal.
- Drop the 10 s and 5 s urgent toasts, or make them opt-in.

### 14. `web_accessible_resources` plus `getURL` in the page DOM exposes a Firefox per-install UUID to every blocked site
**Severity:** Medium (privacy)

**Evidence**
- `manifest.json:42-47` and `manifest.firefox.json:48-53` expose `icons/logo.png` to `<all_urls>`.
- `content.ts:157` sets `img.src = chrome.runtime.getURL('icons/logo.png')` on an element in the page DOM.
- In Firefox, `moz-extension://<UUID>/` is a **random per-install UUID**. Any blocked site's scripts can read `#sordino-overlay img.src` and get a stable, cross-site identifier for this user.
- In Chrome, the extension ID is fixed, so every site can detect that Sordino is installed by fetching `chrome-extension://<id>/icons/logo.png`. No `use_dynamic_url` is set.

**Impact:** this conflicts with PRIVACY.md's "Everything stays on your device" and with Principle 5 ("Privacy as posture").

**Fix:** inline the 6 KB logo as a `data:` URI or inline SVG, the same way `snarky-titles.ts` already handles its icons. Then delete `web_accessible_resources` entirely.

### 15. The overlay's text (schedule names, bypass counts) is readable by the blocked site's scripts
**Severity:** Medium (privacy)

**Evidence:** the reason line (`content.ts:233-237`) renders the user's own schedule names, such as "Work hours • until 5:00 PM" or something more personal, plus "N quick bypasses left today", in the page DOM. Any script on reddit.com or youtube.com can read and report it.

**Fix:** a closed shadow root (#11) makes this markedly harder. It is not a hard guarantee against a determined page, but it removes casual scraping.

### 16. Google Fonts are loaded from the extension pages, contradicting PRIVACY.md (cross-cutting)
**Severity:** Medium (privacy-claim violation)

**Evidence:** `src/index.css:1` has `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond…&family=DM+Sans…')`, and it is present in the built output `dist/chrome/assets/index-RmmAC4nA.css` (confirmed). Every popup or settings open contacts Google, sending IP and user-agent. PRIVACY.md says "No external API calls", "No third-party services", and "Sordino does not collect, transmit, or share any of your data".

The **overlay itself** correctly uses system fonts (`content.ts:351, 362, 429`). That causes the opposite drift: DESIGN.md §3 and §5.11 specify Cormorant Garamond and DM Sans on the overlay, but the overlay renders Georgia and the system sans. DESIGN.md's Display role is 1.75rem, while the overlay title is `2.5rem` (`content.ts:444`).

**Fix:** self-host the two font families as `woff2` in the extension. This is allowed by the existing CSP. In the overlay, load them via `@font-face` from `chrome.runtime.getURL` only if they are made web-accessible (but see #14). Otherwise, accept Georgia on the overlay and update DESIGN.md to say so.

### 17. Accessibility: no dialog semantics, no focus management, low-contrast caption, unmet PRODUCT.md spec
**Severity:** Medium (High for keyboard and screen-reader users)

**Evidence**
- There is no `role="dialog"`, `aria-modal`, or `aria-labelledby`/`aria-describedby` on `#sordino-overlay` (`content.ts:141-142`). Focus is never moved into the overlay, and no element is focused on show. Tab order starts in the hidden page (#5). Screen readers read the underlying Reddit feed, and the overlay is just trailing content in `body`. Nothing is announced when the overlay appears or returns.
- There is no `:focus-visible` style in the overlay CSS (`content.ts:539-600`). Hosts with `button:focus{outline:none}`, which is common, remove the focus ring entirely. DESIGN.md §6 says "Do show the focus ring on every interactive element."
- Contrast: `#8a7a66` on the centre of the gradient (`#2d2620`) is **3.59:1**. That fails AA (4.5:1) for the 12 px caption "N quick bypasses left today" / "Resets at midnight" (`content.ts:597-598`). `#9a8b7a` on `#2d2620` is exactly 4.50:1, which is borderline for the 14 px quote author and reason line. The cream and gold text pass (11:1, 6.5:1).
- `alt="Sordino"` on the logo next to the text "Sordino" (`content.ts:158-164`) is read as "Sordino Sordino"; use `alt=""`. Emoji are read aloud: "🔇" as "muted speaker", "📅" as "calendar". `𝄐` reads as an unknown symbol.
- The overlay has no `lang="en"`, so on a Japanese or German page the English copy is read with the page's voice.
- The quote auto-rotates every 11 s (`content.ts:638`) with no pause control (WCAG 2.2.2). It is also ambient motion, which DESIGN.md's No-Ambient-Decoration rule discourages even when reduced motion is not set.
- PRODUCT.md:131-133 requires the primary action to announce as "Bypass for 5 minutes, you have N of 3 remaining today". This is not implemented: the count `<p>` is not linked with `aria-describedby`.
- Scaffolding-mode arming changes the button text to "Tap again to bypass" (`content.ts:313`) with no live announcement, and says "Tap" on desktop. PRODUCT.md:163-169 documents "Confirm bypass" for 6 s, but the code uses "Tap again to bypass" for 8 s (`CONFIRM_RESET_MS`, `types.ts:6`). That is doc drift.
- Good: both actions are native `<button type="button">`, so Enter and Space work. Reduced motion is gated for the overlay, quote and toast (`content.ts:100-107, 602-612, 731-735, 751-753`).

**Fix:** `<dialog>` + `showModal()` (#5) with `aria-labelledby` pointing at the title and `aria-describedby` pointing at the card. Focus "Go back" on open. Add a `:focus-visible` outline of 2 px brass at 50%, as in DESIGN.md. Raise the caption to at least `#a39482`. Set `lang="en"`. Use `alt=""` on decorative images and `aria-hidden` on emoji. Stop rotation, or rotate only on show. Add an `aria-live="polite"` region for the arming state.

### 18. Copy voice: about half the snarky titles are parent or authority voice, with lockdown vocabulary
**Severity:** Medium (brand)

**Evidence:** `snarky-titles.ts:17-58` measured against PRODUCT.md:55-58, 104-107 ("never moralizes… no threats… The product reports state; the user makes the decision") and the Cold Turkey anti-reference ("lockdown vocabulary").

- **Parent or moralizing:** "For your own good" (`:19`). "Musicians stop here. So do you." (`:20`). "Your productivity, if you stay here" (`:26`, a threat). "Slowing down... your procrastination" (`:30`, labels the user). "Skip to the ending. The ending is work." (`:27`).
- **Commands:** "go do your work" (`:32`). "Quickly now, back to work" (`:34`). "Majestically... close this tab" (`:37`). "Very, very quietly... leave" (`:29`). "Getting quieter until you're gone" (`:31`). "A tempo, back to work" (`:52`). "Stick to the score" (`:46`).
- **Authority, "no" and alarm:** "Sforzando NO — That's a sudden, loud NO" (`:28`, the opposite of a held breath). "The conductor says no", "The pit orchestra says no", "The arrangement says no", "Improvisation denied", "♭ Flat out no", "Wrong key, wrong time", "Dissonance detected", "Con fuoco: Fire to focus." The last one is also meaningless.
- **On-brand, keep:** "Fermata" (but see glyph below), "Rest measure", "TACET", "G.P. — Very grand. Very paused.", "Fine.", "Take five", "Cadence interrupted", "Resolution pending...", "Not on the program", "Not in the setlist", "Andante — Walk away. At a moderate pace." (wry), "D.S. al Focus", "Da capo al focus" (minus the "go do your work" subtitle).
- **Literacy slips:**
  - "TACET — Latin for 'be quiet and focus'": tacet means "it is silent".
  - `𝄐` (U+1D110) is in the Musical Symbols block, which Georgia and most system fonts lack. It renders as a **tofu box** in `sordino-qe-screenshots/13-overlay-blocking-screen.png`. That screenshot is the pre-sweep baseline, but the title string is unchanged (`snarky-titles.ts:18`). The other two symbols are already SVG.
  - `WHOLE_REST_SVG` (`:12`) draws two stacked blocks, which is not a whole rest. A whole rest is a small filled rectangle hanging from a staff line.
- **Overlay strings:**
  - "`{site} is blocked`" (`content.ts:222`) and "Manual block active" (`schedule.ts:133`) use the hard-blocker register. "Muted" or "`{site}` is muted until 5:00 PM" fits the brand.
  - "Using bypass..." uses three periods instead of an ellipsis.
  - Quotes are wrapped in straight ASCII `"` (`content.ts:104, 120, 206`); a literate brand should use “ ”.
  - The other overlay copy ("Bypass for N min", "N quick bypasses left today", "Resets at midnight") is neutral and good.

**Fix:** cut the list to the roughly 15 on-brand entries and make every subtitle *report state* or *gloss the term*, never instruct. Example: "Fermata — a held note. This one's held until 5:00." Replace `𝄐` with an SVG.

### 19. Quotes: several misattributions, a duplicate, and wellness or self-help register
**Severity:** Medium (brand: "Literate", PRODUCT.md:51-54)

**Evidence** (`quotes.ts`)

| Line | Quote | Finding |
|---|---|---|
| 3-4 | "The successful warrior is the average man, with laser-like focus." Bruce Lee | No primary source surfaced. It appears only on quote aggregators (AZQuotes, QuoteFancy, social posts), not in Lee's writings or interviews. Treat as **unverified**. Ironic, because PRODUCT.md uses it as its example of the *right* Bruce Lee quote. |
| 11-12 | "It is during our darkest moments that we must focus to see the light." Aristotle | **Misattributed.** Aggregators that give a source credit **Aristotle Onassis**, the 20th-century shipping magnate (BrainyQuote, Goodreads). It is not the philosopher. It is also melodramatic for a distraction prompt. |
| 50-51 | "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment." Buddha | **Fake Buddha quote.** It traces to a 1934 Japanese compendium (*The Teaching of Buddha*) that distorts Dhammapada 348, which reads "let go of the past, let go of the future, let go of the present". FakeBuddhaQuotes catalogues it. It is also "be present" voice (see below). |
| 83-84 | "The shorter way to do many things is to do only one thing at a time." Mozart | **Misattributed.** The usual source is "The shortest way to do many things is to do only one thing at once", credited to Richard Cecil (18th-century clergyman) and popularised by Samuel Smiles' *Self-Help* (1859). |
| 55-56 and 71-72 | "Your focus determines your reality." Qui-Gon Jinn / "Always remember, your focus determines your reality." George Lucas | **The same line twice** (*The Phantom Menace*), credited two different ways. |
| 7-8 | Alexander Graham Bell | Verified: Orison Swett Marden, *How They Succeeded* (1901). Keep. |
| 35-36, 47-48, 87-88, 95-96 | Twain (*A Connecticut Yankee*), William James (*Principles of Psychology*), Simone Weil, Anne Lamott | Well sourced. These are the literate core. |
| 91-92 | "Be where you are, not where you think you should be." Unknown | The "be present" wellness voice that PRODUCT.md:183-186 and 212 ban outright. |
| 27-28, 63-64 | Ziglar "We all have twenty-four hour days", Robbins "so few of us achieve what we truly want…" | Moralizing and lecturing. Together with Tracy, Ferriss, Robbins ×2 and Oprah, this is motivational-poster register, not "quiet, literate". |

Sources: [BrainyQuote, Aristotle Onassis](https://www.brainyquote.com/quotes/aristotle_onassis_119068), [Goodreads, Onassis](https://www.goodreads.com/quotes/672740-it-s-during-our-darkest-moments-that-we-must-focus-to), [FakeBuddhaQuotes](https://fakebuddhaquotes.com/do-not-dwell-in-the-past-do-not-dream-of-the-future/), [QuotesLyfe, Smiles/Cecil](https://www.quoteslyfe.com/quote/The-shortest-way-to-do-many-things-1041058), [Wikiquote, Alexander Graham Bell](https://en.wikiquote.org/wiki/Alexander_Graham_Bell), [AZQuotes, Bruce Lee](https://www.azquotes.com/quote/462365). Wikiquote and FakeBuddhaQuotes pages could not be fetched directly from this environment because the egress proxy blocked them. The verdicts are based on search-result summaries.

**Fix:** remove or correct the misattributions (credit Onassis or drop the line, credit Cecil, drop the Buddha quote, dedupe Qui-Gon). Then cut the self-help entries. A smaller, sourced set of 10-12 quotes fits "One literary signifier per surface is enough" better than 25.

---

## Low

### 20. Iframes, about:blank, file://, PDFs and XML
**Severity:** Low

- No `all_frames` (`manifest.json:35-41`) means top frame only. That is the right choice: no cost in ad iframes. Consequence: a blocked site embedded elsewhere (a YouTube embed on a blog) is not blocked. That is probably intended; document it.
- `chrome://`, the Web Store and `about:` pages are not injectable, which is fine. `file://` needs the user's "Allow access to file URLs" toggle, which is fine.
- The Chrome PDF viewer does not run content scripts, so a PDF on a blocked host is not overlaid. This is Low.
- XML and SVG documents and framesets: `showOverlay` has no `body` and registers a `DOMContentLoaded` listener after that event has already fired (`content.ts:621-623`). A new dead listener is added on every 30 s poll, which is a small leak. Add `if (!(document instanceof HTMLDocument)) return` at the top.

### 21. Dead code and false safety
**Severity:** Low

- `ensureTextOnly` (`content.ts:24-28`) is a no-op. A textContent round trip returns the same string, so it is decorative "defense in depth" that misleads reviewers. The real protection, `textContent`/`createTextNode`, is already used everywhere, and that part is correct. There is no `innerHTML` and no `window.postMessage` listener; the only inbound channel is `chrome.runtime.onMessage` (`content.ts:877`).
- `getRandomQuote` (`quotes.ts:104-107`) is unused.
- `MessageType` variants `BLOCK_STATUS`, `BYPASS_RESULT` and `RECORD_BLOCK` (`types.ts:320-325`) are never sent. `SETTINGS_UPDATE` is typed with a `settings` payload but is broadcast without one (`service-worker.ts:12`).
- `BYPASS_DURATION_MS` is imported but unused (`service-worker.ts:4`).
- `.sordino-icon { color }` on an `<img>` does nothing (`content.ts:425`).
- `bypassCountdownInterval` also drives the pause countdown, so the name is wrong.
- `THRESHOLDS` is re-allocated every second (`content.ts:778`).
- The service worker's `onMessage` does not validate `sender` (`service-worker.ts:260`). That is acceptable while the only senders are extension contexts, but worth a `sender.id === chrome.runtime.id` check.

### 22. Structure and maintainability
**Severity:** Low

- The 889 lines are about 260 lines of CSS template string (`content.ts:352-613`) plus 50 lines of inline toast CSS (`content.ts:692-737`), with imperative DOM building around them. That is not a giant `innerHTML` template, which is good for safety, but it is one file with module-level mutable state and three independent timers (30 s, 1 s, 11 s) that never get torn down together.
- Host-matching logic is duplicated three times with slight differences: `content.ts:73-79` and `789`, `service-worker.ts:95-124` (`isUrlBlocked`), and `service-worker.ts:230-252` (`hasBypass`, `getSiteFromUrl`).
- Suggested split:
  - `content/overlay.css` (imported as a string or adopted stylesheet);
  - `content/overlay.ts` (render/update/teardown, shadow root, `<dialog>`);
  - `content/guard.ts` (media pause, fullscreen exit, re-attach observer);
  - `content/main.ts` (local decide, storage subscription, timers);
  - `shared/match.ts`, used by both the content script and the service worker.
- Add unit tests for `shared/match.ts` and `schedule.ts`, plus the build assertion from #1.

### 23. Smaller overlay details
**Severity:** Low

- `timeRemaining` comes from `getActiveSchedule` even when the block reason is "Manual block active" (`service-worker.ts:309-315`), so a manual block can show "until 5:00 PM" from an unrelated schedule.
- `width:100vw; height:100vh` (`content.ts:359-360`) together with `top/right/bottom/left:0` is redundant. On mobile `100vh` overshoots behind the URL bar. Prefer `inset:0` alone.
- `backdrop-filter: blur(8px)` on the card (`content.ts:513`) blurs only the overlay gradient behind it, which costs GPU and is visually a no-op. DESIGN.md grandfathers it, but it can go.
- The quote container's `min-height:140px` plus a 2.5rem title makes the stack taller than it needs to be, which feeds #8.

---

## Suggested order of work
1. **#1:** fix the build with a separate IIFE build and add the no-`import` assertion. Nothing else matters until this ships.
2. **#2 + #3:** decide locally at `document_start` and remove the 1 s and 30 s polling. This fixes performance and the flash of content together.
3. **#5 + #11 + #17:** one refactor. Move to a closed shadow root with `<dialog>.showModal()` and `em` sizing, add focus management and ARIA, and add the `isTrusted` checks (#7).
4. **#4, #6, #8, #9, #10:** media pause, re-attach, scrollable layout, expiry timers, and a service-worker-driven Go back.
5. **#14, #16:** privacy fixes (inline the logo and drop WAR; self-host the fonts).
6. **#18, #19:** copy pass.
