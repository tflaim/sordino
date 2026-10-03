# Sordino — experience, build-quality & competitive review

**Date:** 2026-10-02 · **Reviewed at:** `349f5d8` (HEAD of `main`) · **Method:** 8 parallel review agents + hands-on verification

> **TL;DR**
>
> 1. **The overlay is dead at HEAD.** The May design sweep (`372cc65`) made the content script import a shared constant; Vite split it into a chunk; `content.js` now starts with an ES `import` and throws `SyntaxError: Cannot use import statement outside a module` on every page. Nothing gets blocked, in Chrome or Firefox. Verified in real Chromium. **Users are almost certainly not affected yet** — the store listings appear to serve v1.0.0 (January), which works — but the next release would ship a blocker that blocks nothing. *Confirm against the build you actually uploaded* (`dist/` is gitignored and built locally).
> 2. **The product idea and the visual design are good; the plumbing is not production-grade.** Every non-blocked tab on the web messages the service worker once a second and each message rewrites all settings to storage, which causes lost settings edits (reproduced 14/50 trials). Users who tap "Start Blocking" or "Pause → until I turn it back on" can never return to their schedule. Uppercase custom domains silently never match. The privacy promise ("Nothing leaves your browser") is false — popup/settings load Google Fonts. Stats can't be the "mirror" PRODUCT.md promises (counts inflate on 30s re-checks, reset per session, only the current week is kept).
> 3. **There is no safety net.** No tests, no lint, no CI, no typecheck in the build (`tsc` is currently red), a made-up Vite option, an ignored `BROWSER=firefox` flag, and a Firefox package that ships 26 stale bundles. A 30-line Playwright smoke test would have caught #1.
> 4. **Competitively, Sordino's position is real but its mechanism is incomplete.** The research (one sec / PNAS 2023, HabitLab, Lyngs) says the *dismiss option* is the strongest ingredient — Sordino already leads with "Go back" — and that *static messages/quotes alone don't reduce use*. The best-supported mechanism Sordino lacks is a **short wait before Bypass becomes active**, followed by **path-level rules / feed softening** (block YouTube Shorts and the home grid, not all of YouTube). Fully local + account-free + Chrome & Firefox + bypass budget + schedules is a combination no competitor reviewed offers, and it is worth more in 2026 as AI blockers start reading tabs.

---

## 1. How this review was done

| Agent | Scope | Report |
|---|---|---|
| Runtime / E2E | Loaded the real extension in Chromium 141 via Playwright with local fake reddit/youtube hosts; built HEAD, `33f3638`, and a one-line-patched HEAD; exercised overlay, bypass, pause, go-back, SPA nav, hostile page CSS, SW restart; screenshotted current UI | [runtime-e2e.md](agent-reports/runtime-e2e.md) |
| Background | `service-worker.ts`, `schedule.ts`, `storage.ts`, `types.ts`; simulated races & pure functions with `tsx` | [background.md](agent-reports/background.md) |
| Content / overlay | `content.ts` (889 lines, `<all_urls>`, `document_start`), copy & quote attributions | [content-overlay.md](agent-reports/content-overlay.md) |
| Popup & settings UI | React components, a11y (computed contrast), copy vs PRODUCT.md/DESIGN.md | [ui.md](agent-reports/ui.md) |
| Build / release / store | Built HEAD, `33f3638`, `27a43a5` in worktrees; downloaded v1.0.0 release zips; manifests; deps | [build-release.md](agent-reports/build-release.md) |
| Mindful competitors | one sec, ScreenZen, Opal, Clearspace, Intention, Intently, Mindful Browsing, Pause, Unhook, NFE, Jomo, AI blockers, Brick | [competitors-mindful.md](agent-reports/competitors-mindful.md) |
| Mainstream blockers | LeechBlock NG (source read, v1.8), StayFocusd, BlockSite, Freedom, Cold Turkey, Forest, Screen Time, Rize | [competitors-mainstream.md](agent-reports/competitors-mainstream.md) |
| User voice | Store reviews, Reddit/HN, research on habituation & ADHD | [user-voice.md](agent-reports/user-voice.md) |

**Exercised for real:** Chromium build at HEAD and pre-sweep; overlay render, bypass budget/count, two-tap confirm, pause + toasts, go-back, hostile CSS, overlay removal, slow-streamed pages, SW stop mid-bypass, popup/settings screenshots, custom-site input. **Not exercised:** Firefox (no binary in the sandbox — `dist/firefox/content.js` has the identical `import`, so it is almost certainly broken the same way), real Reddit/YouTube pages and media, screen readers, schedule-driven (vs. forced) blocking.

**Evidence caveat for the competitive sections:** the sandbox's egress proxy blocked page fetches for store listings, Reddit, AMO and most vendor sites. Claims come from search-result summaries and are labelled in the agent reports; LeechBlock NG was verified from its source. Spot-check any number before quoting it externally (two prices conflict: Cold Turkey Pro $39 vs $45).

---

## 2. Release status: shipped vs. HEAD

| | Overlay works? | Evidence |
|---|---|---|
| v1.0.0 release zips (tag → `f8aa93c`, 2026-01-07) | ✅ | Built & loaded; AMO listing last updated 2026-01-07, size matches the v1.0.0 Firefox zip |
| `33f3638` (2026-02-22, pre-sweep) | ✅ | Built & loaded, no console errors |
| `372cc65` → HEAD `349f5d8` (2026-05-24) | ❌ | `SyntaxError: Cannot use import statement outside a module` — [screenshot](screenshots/01-HEAD-reddit.png) |

- Chrome Web Store: no live listing found; README still says "In Review" with a generic store link.
- AMO: listing exists, 0 reviews / 0 ratings.
- **Owner action:** the AMO date/size match came from a search summary, and `dist/` is built locally, so confirm which commit the uploaded AMO (and any pending Chrome Web Store) package was built from. If it was built after 2026-05-24, it is broken.
- **Conclusion:** almost certainly a landmine, not an incident. Do not cut a release from HEAD until §3 C1 is fixed and a smoke test guards it.

Root cause, precisely: `vite.config.ts:118-136` builds popup, settings, content and background as **one** Rollup build in `es` format. Any module imported by two or more entries becomes a shared chunk. Before May, `content.ts` only imported `quotes.ts` and `snarky-titles.ts`, each with a single importer, so `content.js` was self-contained *by luck*. `content.ts:3` (`import { CONFIRM_RESET_MS } from '../shared/types'`) broke the luck.

---

## 3. Is it built properly?

**Verdict:** The architecture is a reasonable shape for an MV3 extension — listeners are registered synchronously at top level, no critical state lives in SW memory (verified by stopping the SW mid-bypass), daily reset uses the local date and survives the browser being closed over midnight, overnight schedules handle day-of-week correctly, domain matching is safe against `notreddit.com` / `reddit.com.evil.com`, stats storage is bounded, web pages can't message the SW, and the overlay is built with DOM APIs rather than `innerHTML`. What's missing is everything that keeps a vibe-coded project from regressing: a build that can't emit broken content scripts, a typecheck that gates the build, tests on the scheduling/matching logic, and a single, race-free state-update path.

### Critical

| # | Finding | Evidence | Impact |
|---|---|---|---|
| C1 | **Content script never executes** (Chrome + Firefox) | `content.ts:3`, `vite.config.ts:118-136`; runtime console error; [screenshot](screenshots/01-HEAD-reddit.png) | Nothing is blocked. The product does nothing. |
| C2 | **Manual override is a one-way door.** "Start Blocking" sets `manualOverride:'on'`, "Pause → Until I turn it back on" sets `'off'`; no code path ever sends `null` ("follow schedule") | `popup/App.tsx:95-104`, `service-worker.ts:369-381`, `schedule.ts:131-136` | After one tap the user is blocked 24/7 or never blocked again; settings still says "Turn on a schedule below to start", which does nothing. |

### High

| # | Finding | Evidence | Impact |
|---|---|---|---|
| H1 | **1 Hz polling from every non-blocked tab on the web**, each message triggers `checkBypassReset` → full settings write; plus a 30s poll | `content.ts:849-851, 874`; `service-worker.ts:266`; `storage.ts:77-81` | SW never idles; battery/CPU across every open tab; popup/settings re-render every second. |
| H2 | **Lost settings edits.** `updateSettings` lock is per-JS-context; popup, settings and SW all read-modify-write one storage key | `storage.ts:6`; reproduced 14/50 trials | A user's settings change gets silently reverted by a background stats write. |
| H3 | **Blocked page paints before the overlay** — nothing runs until `DOMContentLoaded` + a SW round-trip | `content.ts:885`; [screenshot @800ms](screenshots/05-flash-t800ms.png) (~3s on a slow stream) | The feed you're trying to avoid flashes first — the exact trigger the product exists to interrupt. |
| H4 | **Audio/video keeps playing behind the overlay**; fullscreen video (top layer) covers it; page stays keyboard-interactive behind it | `content.ts` (no media handling, z-index overlay, no focus trap) | YouTube plays on behind "Muted". |
| H5 | **Overlay can vanish permanently** — `if (overlayElement) return` guard holds a detached node; scroll stays locked | `content.ts:618`; [screenshot](screenshots/07-body-replaced-overlay-gone.png) | Any SPA that re-renders `<body>` silently unblocks. After an extension update, open tabs unblock and log an error every second. |
| H6 | **No style isolation** (no shadow DOM, `rem` sizing) | Runtime: `html{font-size:40px}` pushes buttons off-screen; `button{display:none!important}` hides both; [screenshot](screenshots/06-aggressive.png) | On some sites the escape route ("Go back"/"Bypass") is unreachable — violates Principle 1. |
| H7 | **Custom domains silently never match** if typed with capitals, a port, a query string or non-ASCII; `HTTPS://x.com` stored as `HTTPS:`; popup allows duplicates (remove deletes all copies) | `popup:354`, `settings:872`; reproduced | A user adds `Reddit.com`, it says "added", nothing is ever blocked. |
| H8 | **Privacy claim is false**: Google Fonts loaded by popup & settings | `src/index.css:1` (in built CSS); footer "Nothing leaves your browser"; PRIVACY.md "no external calls" | Store-review and trust risk; trivial fix (self-host the two fonts). |
| H9 | **Stats can't be a mirror**: Most-Blocked increments on each 30s re-check of a blocked tab; total blocks are per-host-per-session; Sunday's per-site stats roll into Monday's week; nothing older than the current week is kept | `service-worker.ts:180-198, 285-304`; `content.ts:874` | PRODUCT.md's success criterion ("one month in… in dialogue with my own behavior") is structurally impossible. |
| H10 | **No first-run, no Options entry.** Defaults silently start blocking during work hours; no `options_ui` in either manifest; gear opens a new tab every time | `public/manifest*.json`; `service-worker.ts:488` | A new user meets the overlay before they've ever seen what Sordino is. |
| H11 | **Accessibility**: 27/39 settings controls unnamed (all 8 switches); no `aria-live` (PRODUCT.md requires it); overlay has no `role=dialog`/focus management; muted-text contrast 2.1–2.9:1, off-switch track 1.27:1 | `ui.md` §a11y; runtime F5/F15 | Fails WCAG AA broadly; ADHD and low-vision users are among the target personas. |
| H12 | **No tests, lint, CI; build doesn't typecheck** (`tsc` exits 2, red since `b5acf46` in Feb); `emptyDirBeforeWrite` isn't a Vite option; `BROWSER=firefox` is ignored so all three build scripts are identical; Firefox dist never emptied → v1.0.0 Firefox zip shipped **26 stale bundles** (3.58 MB vs 354 KB) and `CLAUDE.md` files leaked into the Chrome zip | `package.json`, `vite.config.ts:117`, build-release.md | Every regression ships silently. AMO source review can't reproduce the package. |

### Medium (selected — full lists in agent reports)

- **Exhausted budget = hard stop.** At 0 bypasses the button is disabled (`content.ts:282`) — contradicts PRODUCT.md Principle 1 ("every restriction comes with a visible escape route").
- **Bypass race**: two simultaneous `USE_BYPASS` calls both succeed → 4 of 3 used, UI shows "-1". Only one bypass active at a time: bypassing YouTube re-blocks Reddit while both are charged. Lowering the daily limit below today's usage renders negative remaining.
- **Bypass expiry lags ~30s**; with a bypass shorter than the poll window, no countdown toast appears at all. Badge hard-codes `'5m'` regardless of configured duration (`service-worker.ts:73`) — the only stale use of the dead `BYPASS_DURATION_MS`.
- **Page scripts can click Bypass** (no `isTrusted` check, `content.ts:306`) and spend the user's budget.
- **"Go back" is unreliable**: in a fresh tab it lands on `about:blank#blocked`; on SPAs `history.back()` stays on the blocked site.
- **Fingerprinting**: `icons/logo.png` is web-accessible to every site; in Firefox the URL contains a per-install UUID any blocked site can read.
- **Unneeded permissions**: `tabs` (Firefox) and `activeTab` (both) — code only reads `tab.id` and calls `tabs.create`. `<all_urls>` + universal `document_start` script is a store-review liability; the 1 Hz poll makes it a real cost.
- **Invalid schedules accepted**: start == end, cleared time renders "12:NaN AM", no days selected.
- **Pause has no friction and isn't counted** — "Until tomorrow" is the quiet path to "installed but no intervention" the research warns about.
- **Settings is one 1,382-line file** of ~15 components; schedule form duplicated (~170 lines); block-status logic implemented three times with different results.
- **Dependencies**: `class-variance-authority`, `autoprefixer` unused; `lucide-react`, `clsx`, `tailwind-merge` used at runtime but in `devDependencies`; BUILD.md says Node 18+, Vite 7 needs ≥20.19.

### Low
Copy/visual nits (orphaned period in the first-run tip, today's chart bar off-baseline, `𝄐` renders as tofu on some systems), 11 MB of committed screenshots and AI planning docs as repo clutter, version stuck at `1.0.0` in three places, no changelog.

---

## 4. The experience, walked through against PRODUCT.md

The brief in PRODUCT.md is strong and specific: *quiet · literate · peer-not-parent*; three personas; a "held breath, not an alarm". The visual execution largely honors it — when the overlay works ([screenshot](screenshots/01-PATCHED-reddit.png)) it's calm, warm, typographically confident, with "Go back" visually primary and Bypass secondary. The popup ([screenshot](screenshots/08-popup-active.png)) and Usage tab ([screenshot](screenshots/08-settings-usage-tab-data.png)) look considered. Where the experience breaks is mostly where behavior and copy drift from the brief:

1. **Install.** Nothing opens. Defaults begin blocking YouTube/LinkedIn during work hours without telling anyone. The only explanation lives in the popup, which Chrome hides behind the puzzle menu. *The self-aware quitter, who distrusts tools that act on them, meets the overlay cold.*
2. **First overlay.** The page flashes first (H3), video keeps playing (H4). The title is drawn from 40 "snarky" titles — the content agent counts ~25 of them in parent/authority voice ("For your own good", "The conductor says no"), and the screenshot above shows "♯ Sharp decline — *Your productivity, if you stay here*", which is guilt copy the brand explicitly rejects. The quote is attributed to Tony Robbins; elsewhere the pool contains likely misattributions (the "Aristotle" quote is Aristotle *Onassis*; per search summaries — Wikiquote couldn't be opened from the sandbox — the "Mozart" line traces to Richard Cecil, the Buddha quote is listed as fake, and "laser-like focus" has no primary source for Bruce Lee; verify each before rewriting). For a brand whose identity is *literate*, a wrong attribution is a brand bug, not a content nit.
3. **Bypass.** Works and counts correctly; the opt-in two-tap "scaffolding mode" is a thoughtful touch. But when the budget hits zero, the bypass disables — a hard wall in a product whose thesis is "no walls". And there's no wait: the research says a short delay is the strongest missing ingredient (§5).
4. **Popup.** "Distractions caught" is surveillance/scoreboard vocabulary; the "0 left" card turns red — an alarm, not a held breath. Tapping "Start Blocking" traps you in manual mode forever (C2).
5. **Settings.** Well organized, but switches are unlabeled for assistive tech, muted text fails contrast, "Bypasses refreshed! Use wisely." is a parental line, and the budget uses a progress bar — PRODUCT.md Principle 2 rules out "progress bars that imply 'winning'"; "a clean number is enough".
6. **Usage, a month in.** It can't happen: only the current week exists, and the numbers inflate on re-checks (H9). PRODUCT.md's single success criterion is unreachable by construction.

---

## 5. What the competition does that Sordino doesn't

### 5.1 What the evidence says about Sordino's core wager

| Mechanism | Evidence | Sordino today |
|---|---|---|
| Visible option to dismiss / turn back | **Strongest** single ingredient (one sec component experiment, PNAS 2023, n=500) | ✅ "Go back" is primary — the right bet |
| Short enforced wait | Effective in the field (57% fewer opens over 6 weeks, n=280); not additive to dismiss in the lab | ❌ |
| Static message / quote | **Not effective on its own** | ✅ — brand value, not mechanism. Don't market it as the mechanism. |
| Reflective question / self-chosen session length | Moderate (2025 field study, Lyngs CHI 2020); can annoy | ❌ |
| Feed/recommendation removal | Good (Lyngs 2020, SwitchTube/Lukoff CHI 2021) | ❌ |
| Rotating interventions | More effective *and* more uninstalls unless explained (HabitLab, n=1,654) | Partial (copy rotates, mechanism doesn't) |
| Long-term habit change from any tool | Not shown (TOCHI 2023 meta-analysis, g≈0.47 short-term) | — |

Habituation is real (one sec close-rate ~43% → ~33% by week 3, then stable — attribution of that curve should be checked before citing), and users drift toward easier settings and take "breaks" that become permanent (HabitLab CHI 2021; Haliburton CHI 2024). Sordino's unfrictioned "Pause → until tomorrow" is that drift path.

Note: the two research agents read the one sec study slightly differently — one leads with "delay is the effective mechanism", the other with "dismiss is strongest; delay not additive in the lab". Both are right about different arms of the same paper; the synthesis is: **keep Go back primary (already strongest), add a short wait on Bypass (best-supported missing piece), and expect a modest gain, not 57%.**

### 5.2 Gaps, by brand fit

**Do it — fits the brand**

1. **A short wait before Bypass becomes active** (≈5–8s, configurable, a plain number on the button: "Bypass in 5"). Go back stays instant. Opt-in vs default is your judgment call under Principle 4 ("the user makes the decision").
2. **Never a dead end at zero budget**: replace the disabled button with a longer wait (e.g. 30s) and fold "Emergency refresh" into that path.
3. **Path-level rules and exceptions** (block `youtube.com/shorts` and the home grid, allow `/watch` or subscriptions; block `reddit.com` but allow `reddit.com/r/ProgrammingLanguages`). LeechBlock has had this for years; it's the prerequisite for #4.
4. **"Soften the page" mode** — hide feeds/Shorts/recommendations instead of covering the site (Unhook, News Feed Eradicator, ScreenZen's 2026 Chrome extension). The strongest evidence-backed mechanism Sordino lacks after the delay, and very on-brand ("softens without silencing").
5. **Pause media + hide synchronously** at `document_start` (fixes H3/H4; every serious competitor that uses interstitials does one or the other).
6. **Private/incognito honesty** — detect `extension.isAllowedIncognitoAccess()` and say plainly in the popup whether private windows are covered. Today one Ctrl-Shift-N is the escape and the user isn't told.
7. **Count "turned back" (Go back clicks) and pauses** in Usage, as raw counts. No percentages, no success rate.
8. **Export/import settings** (JSON). Cheap, expected, and the local-only answer to "I got a new laptop".
9. **Right-click "Mute this site"** and a keyboard shortcut.

**With care — fits if shaped to the brand**

- An escalating wait for repeat bypasses of the same site in a day (opt-in, capped low, shown as a number, never as a penalty).
- Letting the user pick the bypass length at the gate (2 / 5 / 10 min) instead of a fixed N.
- An optional one-line "What for?" or a user-written line shown on the overlay (Intently, one sec) — off by default.
- Per-site minute budgets that trigger the overlay (not a wall).
- A flat visit count on the overlay ("Visit 3 today"), raw time-on-site after a bypass.
- A quiet "retune" note when the budget is exhausted daily for a week (JMIR 2026: 46% accept reconfiguration prompts).
- Grayscale/blur as an alternative overlay style; allowlist ("block everything except") mode.

**Skip on principle (PRODUCT.md anti-references / principles)**

Breathing exercises (wellness drift), pushup/typing/math challenges, streaks/gems/focus scores (gamified), accountability partners (Principle 5), password locks / lockdown / uninstall protection (hard-blocker), AI intent checks that send tab content to a model (privacy + "parent, not peer"), accounts and cross-device sync, hardware keys, enterprise/family management.

### 5.3 What is genuinely Sordino's

- **No hard mode anywhere** — no password, lockdown or tamper protection. Even Freedom had to bolt "Session Break / Early Exit" onto Locked Mode in 2026; Screen Time's "Ignore for Today" shows the market wants an escape hatch.
- **The overlay sits on the page with "Go back" as the primary action**; every competitor reviewed swaps the page for a block screen.
- **Bypass budget counted in visits, not minutes**; opt-in two-tap confirm; raw counts only.
- **Free, fully local, no account, Chrome + Firefox** — only LeechBlock and Freedom's free "Limit" extension share the platform/price combo, and neither has Sordino's posture. StayFocusd (~700k users, published by Sensor Tower) advertises "Gen AI Analytics"; in May 2026 an independent researcher reported it ships remote-configurable AI-chat scraping infrastructure (server-side gated, not enabled as of 2026-05-31) and collects AI-chat metadata ([amibeingpwned.com](https://amibeingpwned.com/blog/ai-chat-scraper-wall-of-shame), [Consumer Rights Wiki](https://consumerrights.wiki/w/StayFocusd); from search summaries, not independently verified). That makes **"nobody reads your tabs"** a sharp, timely line — once H8 (Google Fonts) is fixed so it's true.

---

## 6. Prioritized next steps

### Now — before any release (≈1–2 days)

1. **Fix C1 robustly**: build `content.ts` as its own IIFE bundle (second Vite config / `build.lib` with `formats:['iife']`, `emptyOutDir:false`) — *not* by inlining the constant, which breaks again on the next shared import. Add a post-build assertion that `content.js` has no top-level `import`/`export`.
2. **Add the Playwright smoke test** (a working one exists in [build-release.md](agent-reports/build-release.md) — `smoke.mjs`): load `dist/chrome`, force blocking, visit a mapped host, assert overlay present + no console errors.
3. **Fix C2**: add a "Follow my schedule" action that sets `manualOverride: null`, and clear the override on schedule edits.
4. **Make the privacy claim true**: self-host Cormorant Garamond + DM Sans.
5. **Normalize custom domains** (lowercase, strip scheme/port/path/query, punycode, dedupe, reject junk) in one shared function used by popup and settings.
6. **Kill the 1 Hz poll**: drive countdowns from `bypassState`/`pausedUntil` locally + `storage.onChanged`; make `checkBypassReset` write only when the date actually rolled over.
7. Make `npm run build` run `tsc --noEmit` first; fix the TS6133; replace `emptyDirBeforeWrite` with real per-browser clean builds.

### Next — foundation (≈1 week)

- **Consider migrating to WXT**: one manifest source for both browsers, content scripts bundled correctly by construction, clean per-browser output, AMO sources zip. Otherwise fix the custom Vite plugin (honor `BROWSER`, clean both dirs, stop copying `public/` wholesale).
- **Single writer for state**: all mutations go through SW messages; split storage into `settings` / `state` / `stats` keys so a stats write can't clobber a settings edit.
- **Vitest** on: `isScheduleActive`/`shouldBlock`, `isUrlBlocked` + domain normalizer, the day/week rollover in `checkBypassReset`, `mergeWithDefaults`, date-key helpers across time zones.
- **GitHub Actions**: install → typecheck → lint → test → build → content.js assertion → smoke → `web-ext lint`; tag-triggered release that produces both zips.
- **Overlay hardening**: shadow DOM (closed) with `px` sizing; `<dialog>.showModal()` to beat fullscreen and trap focus; re-attach on removal (MutationObserver on `documentElement`); `isTrusted` on Bypass; pause/mute media; synchronous hide at `document_start`; inline the logo and drop `web_accessible_resources`; drop `tabs`/`activeTab`.
- **Stats you can live with for a month**: count one block per navigation (not per re-check), keep ~8–12 weeks of daily rollups, key weeks by local week start.
- **Accessibility pass**: names on every control, `aria-live` status, `role=dialog` + focus to "Go back", contrast fixes, reduced-motion respected everywhere.
- **First run**: open a short welcome page on install that shows what's muted and when, with one-tap edits; add `options_ui`.

### Then — product (pick in this order)

1. Bypass wait (§5.2 #1) + no dead end at zero (#2).
2. Path rules (#3) → soften-the-page mode for YouTube/Reddit/X (#4).
3. Count "turned back" and pauses; frictioned "until tomorrow".
4. Private-window honesty, export/import, context menu.
5. A copy pass: rewrite the parental titles, fix or drop misattributed quotes (verify every attribution against a primary source), "distractions caught" → something mirror-like, remove the red "0 left" and the "Use wisely." line.

---

## Appendix

- Full agent reports: [`agent-reports/`](agent-reports/) — each finding has severity, `file:line` evidence, impact, and a suggested fix; reports label what was verified empirically vs by reading.
- Screenshots (current UI, captured from a real Chromium build): [`screenshots/`](screenshots/). Fonts in the popup/settings shots are fallbacks because the sandbox blocked the Google Fonts request. (Yes, §3 calls the 11 MB of older committed screenshots clutter; these 1.7 MB document the current state and can be dropped once acted on.) The agent reports reference additional screenshots and test scripts that lived in the reviewer's scratch space and are not committed.
