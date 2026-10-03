# Sordino: background layer audit

**Scope:** `src/background/service-worker.ts`, `src/shared/{schedule,storage,types,utils}.ts`, and how `src/content/content.ts`, `src/popup/App.tsx` and `src/settings/App.tsx` talk to them. The repo was not modified.

**How findings were checked:** each finding is tagged **[E]** (verified empirically) or **[R]** (verified by reading the code). The scratch test harness is in `scratchpad/sw-review/`:
- `stub.ts` is a chrome API stub with async storage and write counters.
- `test-sw.ts` and `test-sw2.ts` drive the real `service-worker.ts` through `runtime.onMessage`.
- `test-pure.ts` tests the schedule, domain and date functions under `TZ=America/New_York` and `TZ=Pacific/Kiritimati`.
- `build-HEAD/` and `build-372cc65p/` are clean `vite build`s of HEAD and of the commit before the regression.

**Bottom line:** the core ideas are reasonable:
- All listeners are registered synchronously at top level.
- The persistent state lives in `chrome.storage`.
- Day keys use local time, not UTC.
- Domain matching is suffix-safe.
- Stats are bounded per week.

The build is broken at HEAD, though. On top of that, the main state-update pattern has three problems: it writes on every read, it rewrites the whole settings object each time, and its mutex only covers one JS context. Together they cause lost updates, double-counting, and a storage write about once per second for each open tab.

---

## Critical

### C1. Since 372cc65 the built `content.js` cannot run, so nothing gets blocked — Critical — [E]
- **Evidence:** `content.ts:3` imports `CONFIRM_RESET_MS` from `../shared/types`. The service worker and the settings entry import that module too, so Rollup splits it into a shared chunk. Rollup then emits `import{C as K}from"./chunks/types-CrXLUOBJ.js"` as line 1 of `dist/chrome/content.js`. Manifest `content_scripts` are classic scripts, not modules (`public/manifest.json`, `content_scripts`).
  - Test: I compiled the output with `vm.Script` (classic script mode).
    - Clean build of HEAD: `SyntaxError: Cannot use import statement outside a module`.
    - Clean build of `372cc65^`: `content.js` starts with `const N=[...]` and compiles fine.
  - `vite.config.ts` copies the same `content.js` into `dist/firefox`, so both browsers are affected.
- **Impact:** the content script never runs, so there is no overlay, no bypass and no countdown on any site. The extension silently does nothing except show the badge. Any store upload built from 372cc65 (2026-05-24) or later ships a non-working blocker. The owner should check which commit the live Chrome Web Store and AMO builds came from.
- **Fix:** do one of the following:
  - inline the constant in `content.ts` (quickest);
  - build `content.ts` as its own IIFE/`inlineDynamicImports` build;
  - set `output.manualChunks` so nothing content imports gets shared.

  Also add a post-build check that fails when `content.js` matches `/^\s*import[\s{]/m`.

---

## High

### H1. Every message writes the whole settings object to storage; each open tab sends a message once per second — High — [E]
- **Evidence:**
  - `handleMessage` always calls `checkBypassReset()` (`service-worker.ts:266`). That calls `updateSettings` (`:170`), and `updateSettings` saves unconditionally, even when the updater changes nothing (`storage.ts:77-81`).
  - `content.ts:849-851` starts `setInterval(checkCountdowns, 1000)` on every tab that is not blocked, and nothing ever stops it except getting blocked. Each tick sends `GET_SETTINGS` (`content.ts:769`).
  - On top of that there are `GET_BLOCK_STATUS` every 30 s (`content.ts:874`) and the alarm write every minute (`service-worker.ts:459`).
  - Test T1: 10 × `GET_SETTINGS` produced **10** `storage.local.set` calls. Test T2: 6 × `GET_BLOCK_STATUS` produced 12 writes.
- **Impact:**
  - Write volume is about (visible tabs × 1/s) plus (hidden tabs × throttled rate; Chrome throttles hidden-tab timers to about 1/min after 5 min). Each write serialises the whole object, including the weekly stats.
  - Each write fires `storage.onChanged`, which makes an open popup or settings page re-run `mergeWithDefaults` and re-render React once per second (`storage.ts:98-100`).
  - The service worker never idles, which costs battery and CPU.
  - The constant writing widens the race window in H2.
- **Fix:**
  - Have `checkBypassReset` return early, with no write, when `lastResetDate === today`.
  - Make `updateSettings` skip the save when the updater returns the same reference.
  - Poll for countdowns only while a bypass or pause is active, or schedule a single `setTimeout` to `expiresAt` from the content script.

### H2. The `updateSettings` lock only works within one JS context; popup and settings writes get overwritten — High — [E]
- **Evidence:**
  - `updateQueue` is a module-level `let` (`storage.ts:6`), so the service worker, popup and settings page each have their own copy.
  - The settings page and popup call `updateSettings` directly (`settings/App.tsx:34`, `popup/App.tsx:124,357`) and then save the whole object.
  - Test T13: the popup-context `updateSettings` added a custom site while the service worker handled one `GET_SETTINGS`. With 2 ms of simulated storage latency, **14 of 50** custom-site additions were lost.
- **Impact:** H1 has the service worker rewriting the object about once per second, so edits made in settings can silently disappear. That covers sites, schedules, bypass limits and toggles. Users will see edits that "don't stick" now and then.
- **Fix:**
  - Route every write through the service worker with message types like `UPDATE_SETTINGS` / `ADD_SITE`, so there is one serialising owner.
  - Alternatively, split storage into keys such as `config`, `bypassState` and `stats`, so the hot stats path never rewrites user config.

### H3. Check-then-act races in `USE_BYPASS` and `EMERGENCY_REFRESH_BYPASSES` let the budget be overspent — Medium — [E]

*Medium rather than High:* it is a real correctness bug with a visible `-1` glitch, but under the soft-block philosophy the product cost of one extra bypass is small.

- **Evidence:**
  - `USE_BYPASS` checks `remaining` against the snapshot from before the queue (`service-worker.ts:323-327`) and increments inside a separate updater (`:348`).
    - Test T3: with 1 bypass left, two concurrent `USE_BYPASS` calls both returned `success:true`, and `quickBypassesUsed` became **4/3**.
    - The UI then shows `-1`. `content.ts:282` only disables the button when the value is exactly `=== 0`, so with `-1` the overlay reads "-1 quick bypasses left today" and the button stays enabled.
  - `EMERGENCY_REFRESH_BYPASSES` has the same shape (`:411` vs `:416`). Test T6: two concurrent calls both succeeded, giving `emergencyRefreshesUsed: 2`.
- **Impact:** this needs two overlays clicked at almost the same moment, or a double-click on the settings button, so it is uncommon. Under the soft-block philosophy an extra bypass hardly matters. The negative counter is a visible glitch, though.
- **Fix:** do the `remaining <= 0` and `canEmergencyRefresh` checks inside the updater and return a flag. Clamp the display with `Math.max(0, …)` and change the content check to `remaining <= 0`.

---

## Medium

(H3 above is also Medium; it is grouped with H1 and H2 because it shares their root cause.)

### M1. Only one bypass can be active at a time; a new bypass replaces the previous one — Medium — [E]
- **Evidence:** `bypassState.activeBypass` is a single object (`types.ts:35`, written at `service-worker.ts:349`). Test T4: after bypassing reddit, reddit is unblocked. After then bypassing youtube, reddit is **blocked again**, 2 bypasses have been spent, and `activeBypass.site` is `youtube.com`. The spec (`docs/plans/01-06…:79-84`, README:24) says "3× 5-minute bypasses" and never says a bypass ends when you bypass something else.
- **Impact:** a user with two distracting tabs open pays for a bypass and loses it within 30 s or on the next tab focus. That reads as the extension "eating" a bypass, which works against PRODUCT.md's "the budget being fair".
- **Fix:** store `activeBypasses: Record<site, expiresAt>`, prune expired entries in the alarm, and have the content script check its own site.

### M2. A bypass runs up to 30 s past its expiry, and the countdown toast is wrong — Medium — [R]
- **Evidence:** `checkCountdowns` shows "Bypass ending: 5 seconds" (`content.ts:778-799`), but nothing re-blocks when `remaining <= 0` (`:801-803`). The overlay only comes back on the 30 s `checkAndBlock` poll (`:874`). Pause expiry works the same way. The badge only updates on the 1-minute alarm (`service-worker.ts:450`).
- **Impact:** a "5-minute" bypass actually lasts 5:00 to 5:30. The "5 seconds" warning is followed by up to 25 s of nothing happening, which is a small honesty gap for a product built around reporting state.
- **Fix:** in `checkCountdowns`, call `checkAndBlock()` once `remaining <= 0`, or set `setTimeout(checkAndBlock, expiresAt - Date.now() + 250)` when the bypass starts.

### M3. "Most Blocked" counts polls rather than blocks, so it disagrees with the Blocks chart — Medium — [E]
- **Evidence:** `siteStats[blockKey].blocks` goes up on every `GET_BLOCK_STATUS` (`service-worker.ts:289-297`), while `blocksTriggered` is deduplicated by `countedBlockUrls` (`:286,303`). Every 30 s poll, `visibilitychange` and `SETTINGS_UPDATE` broadcast on a tab sitting behind the overlay counts as a new block. Test T2: 6 checks gave `blocksTriggered: 1` and `siteStats['reddit.com'].blocks: 6`.
- **Impact:** a reddit tab left blocked for an hour adds about 120 "blocks". The Usage tab's per-site list (`settings/App.tsx:1268-1300`) then disagrees with the daily Blocks chart. That breaks "stats are evidence" (PRODUCT.md principle 2).
- **Fix:** increment `siteStats.blocks` only when `isFirstBlockForSite`, under the same condition as `blocksTriggered`. Better still, have the content script send an explicit `RECORD_BLOCK` once per overlay shown; that type already exists in the union and is unused.

### M4. Week rollover files the previous week's last day under the new week — Medium — [E]
- **Evidence:** `checkBypassReset` resets `weeklyStats` when the week changes (`service-worker.ts:180-187`), *then* appends `prevStats` and merges `prevStats.siteStats` into the new week (`:190-198`). Test T10 (clock set to Mon 2026-10-05, last reset Sun 10-04) gave a result where Sunday's 40 reddit blocks count toward the new week:
  ```
  {"weekStart":"2026-10-05","days":[{"date":"2026-10-04",...}],"siteStats":{"reddit.com":{"blocks":40,...}}}
  ```
- **Impact:** every Monday, "Most Blocked/Bypassed this week" includes Sunday's activity. The chart hides it, because it filters by date, but the site lists do not.
- **Fix:** only append and merge `prevStats` when `getWeekStart(new Date(prevStats.date))` equals the new `weekStart`. Otherwise drop it, or archive it into the old week before resetting.

### M5. Custom-site input is barely normalised: uppercase, port, query or IDN entries never match — Medium — [E]
- **Evidence:**
  - The normalizer `s.trim().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0]` is duplicated in `popup/App.tsx:354` and `settings/App.tsx:872`. It produces:

    | Input | Stored as |
    |---|---|
    | `"Reddit.com"` | `"Reddit.com"` |
    | `"HTTPS://reddit.com"` | `"HTTPS:"` |
    | `"reddit.com:443"` | kept as typed |
    | `"reddit.com?ref=1"` | kept as typed |
    | `"münchen.de"` | Unicode, not punycode |
    | `"*.reddit.com"` | kept as typed |

  - `isUrlBlocked` compares against `URL.hostname`, which is always lowercase and punycode (`service-worker.ts:98,113-116`). The test confirms `isUrlBlocked` returns false for `Example.com`, `foo.com:8080`, `bar.com?x=1` and `münchen.de`.
- **Impact:** the user adds a site, it appears in the list, and it is never blocked. There is no error message.
- **Fix:** normalise once in a shared `normalizeSite()`:
  ```ts
  new URL(/^[a-z]+:\/\//i.test(s) ? s : 'https://' + s).hostname.replace(/^www\./, '')
  ```
  This lowercases, converts to punycode and strips the port and query. Reject inputs that fail to parse.

### M6. The badge always shows `5m`, whatever the bypass duration — Medium (Low severity, but this is the TS6133 question) — [E]
- **Evidence:** `updateBadge('bypass')` hard-codes `'5m'` (`service-worker.ts:73`). Test T7: with `bypassDurationMinutes=30` the bypass correctly lasts 30.00 min but the badge reads `"5m"`.
- **About the `tsc` error:** `BYPASS_DURATION_MS` (`types.ts:5`, imported at `service-worker.ts:4`) is a dead import, which is exactly what TS6133 reports. Every *functional* path uses `settings.bypassDurationMinutes ?? 5`: expiry at `:351`, overlay text at `:317`, settings UI at `settings/App.tsx:957`. So the configurable duration is wired correctly, and the stale value that remains is the badge string. The badge is also static rather than a countdown.
- **Why nobody noticed:** `npm run build` is just `vite build`, which does not type-check, even though the plan says "verify each task with `npm run build` (TypeScript compilation catches type errors)" (`docs/plans/02-22…-plan.md:7`).
- **Fix:** drop the import and the constant. Use `${settings.bypassDurationMinutes}m`, or better, the minutes remaining, refreshed on the alarm. Add `tsc --noEmit &&` to the `build` script.

### M7. Settings and popup edits are not broadcast, so open tabs take up to 30 s to react — Medium — [R]
- **Evidence:** only the service-worker message handlers call `broadcastSettingsUpdate()` (`service-worker.ts:380,393,406,440`). Site, schedule and category edits go straight to storage from the UI (H2), so tabs only pick them up on the 30 s poll (`content.ts:874`). Removing a site leaves its overlay up for up to 30 s, and adding a site leaves already-open tabs unblocked for up to 30 s.
- **Impact:** after an edit in settings, open tabs keep the old behaviour for up to 30 s, which feels like the change didn't take.
- **Fix:** have content scripts listen to `chrome.storage.onChanged` directly and drop the broadcast, or route writes through the service worker as in H2.

### M8. No schema version; stored arrays replace the defaults entirely — Medium — [R]
- **Evidence:**
  - `mergeWithDefaults` (`storage.ts:21-50`) correctly handles *new scalar fields*: top-level spread plus nested spreads for `blockState`, `bypassState`, `stats` and `weeklyStats`. I checked the git history (`9e31291`, `1fbc6ea`, `bbea644`, `372cc65`): `maxBypasses`, `bypassDurationMinutes`, `scaffoldingMode`, `siteStats` and `emergencyRefreshesUsed` all get defaults, and `onboardingDismissed` gets a reasonable inference heuristic. So existing users do **not** get `undefined` for the fields added so far, and the defensive `?? 5` / `?? MAX_QUICK_BYPASSES` throughout is redundant.
  - However, `categories: stored.categories ?? DEFAULT` (`storage.ts:46`) means new default categories or sites added in future releases never reach existing users. There is also no `schemaVersion`, so no real migration (rename, reshape) is possible.
  - `mergeWithDefaults(changes[KEY].newValue)` (`storage.ts:100`) throws a `TypeError` if the key is removed, because `newValue` is undefined.
  - `saveSettings` ignores `chrome.runtime.lastError` (`storage.ts:67`), so quota or IO errors are swallowed and `updateSettings` reports success.
- **Impact:** there is no breakage today. The risk is to future releases: new default sites never appear for existing users, any field rename or reshape has no migration path, and storage write failures go unseen.
- **Fix:** add `schemaVersion` and a `migrate(stored)` chain run once from `onInstalled` (`reason==='update'`). Merge default categories by `id`. Guard `newValue == null`. Reject on `lastError`.

---

## Low

### L1. The "Always on" template leaves an unblocked minute every day — Low — [E]
- **Evidence:** "Always on" is `00:00–23:59` (`types.ts:154-155`) and the end time is exclusive (`schedule.ts:36`). Test: active at Fri 23:58:59 → `true`; at 23:59:00 and 23:59:59 → `false`; at Sat 00:00 → `true`. The overlay also says "until 11:59 PM".
- **Related:** `start === end` (for example `09:00–09:00`) is never active, not 24 h, and there is no validation for it. A malformed time (`""`) evaluates to `NaN` and fails silently.
- **Fix:** add an `allDay` flag, or treat `endTime === startTime` and `endTime === '24:00'` as a full day. Validate `HH:MM` on save.

### L2. Overlapping schedules show the wrong end time — Low — [E]
- **Evidence:** `getActiveSchedule` returns the *first* match (`schedule.ts:81`). With Work hours (9–17) and Extended work (8–18) both on, at 10:00 the overlay says "Work hours, until 5:00 PM", but blocking continues until 6 PM.
- **Fix:** among the active schedules, report the latest effective end time, merging contiguous ones.

### L3. Bypass scope depends on which subdomain was bypassed — Low — [E]
- **Evidence:** `activeBypass.site` is the full hostname without `www.` (`service-worker.ts:329`). A bypass on `reddit.com` covers `old.reddit.com`, but a bypass on `old.reddit.com` does **not** cover `www.reddit.com` (test T5 and `hasBypass` check). Stats are also split per subdomain (`getBlockKey`, `:255`).
- **Fix:** key bypasses and stats by the matched *rule* (the blocked-list entry), not the raw hostname. `isUrlBlocked` should return the matching entry.

### L4. `USE_BYPASS` accepts any site — Low — [E]
- **Evidence:** test T9: `USE_BYPASS` for `example.org`, which is not on any list, returns success and spends a bypass. The site comes from the content script's `location.href`, so in practice it is the current page.
- **Fix:** before spending a bypass, check `isUrlBlocked(site) && shouldBlock(settings)` first.

### L5. Two tabs blocked at once on the same site count twice — Low — [E]
- **Evidence:** `hasCountedBlock` and `addCountedBlock` run outside any lock (`service-worker.ts:286-287`, and `storage.session` read-modify-write at `:30-40`). Test T12: two concurrent first blocks on reddit gave `blocksTriggered: 2` (expected 1).
- **Related:** `countedBlockUrls` lives in `storage.session` and is cleared when the browser restarts, so the same site counts again after a restart on the same day (`:22-24`).
- **Fix:** move the dedup set into the queued updater, as `stats.countedSites` reset daily.

### L6. Midnight reset relies on lazy triggers; a bypass started at 23:58 is killed at midnight — Low — [R]
- **What works:** day keys use the *local* date (`getLocalDateString`, `types.ts:160-162`). The test confirms this: Fri 23:30 New York gives `2026-10-02`, while `toISOString` gives `2026-10-03`, so the UTC trap was avoided. If the browser is closed over midnight, the reset still happens on the first message or alarm (`service-worker.ts:168`), which is correct. DST is handled: day-of-week and minute-of-day use local `getHours/getDay`, and `setDate` arithmetic in `getWeekStart` passed tests on month boundaries and the US DST-end Sunday.
- **Weaknesses:**
  1. `toLocaleDateString('en-CA')` is locale data, not a format contract. CLDR/ICU changes have flipped en-CA to `M/D/YYYY` in some runtimes before; see [tc39/ecma402#891](https://github.com/tc39/ecma402/issues/891), [nodejs/node#51090](https://github.com/nodejs/node/issues/51090) and [sveltejs/kit#9629](https://github.com/sveltejs/kit/issues/9629). Equality checks would still work, but the stats chart matches `days[].date` against freshly computed keys, so a mid-week format flip would empty the chart.
  2. Any date *change*, including moving the clock backwards, triggers a full reset and a fresh budget. That is an accepted soft-block escape hatch.
  3. The reset clears `activeBypass` (`:206`), so a bypass started at 23:58 ends at 00:00.
  4. Until the first message or alarm after midnight, the popup reads yesterday's counters straight from storage. In practice the alarm fixes this within 1 minute.
- **Fix:** build the date key from `getFullYear()`, `getMonth()+1` and `getDate()` padded with `padStart`. Do not clear an unexpired `activeBypass` on reset.

### L7. Trailing-dot hostnames slip past the block — Low — [E]
- **Evidence:** `https://reddit.com./` has hostname `reddit.com.`, and `isUrlBlocked` returns `false`. The negative controls behave correctly:
  - `notreddit.com`, `reddit.com.evil.com`, `evil.com/reddit.com` and `reddit.com%2eevil.com` → `false`;
  - `REDDIT.COM`, `reddit.com:8443`, `user:pw@reddit.com` and `m.`/`old.`/`www2.` subdomains → `true`.

  So suffix matching is sound. Related domains such as `youtu.be` and `youtube-nocookie.com` aren't on the list, which is a content choice, not a bug.
- **Impact:** someone has to type the dot deliberately, so in a soft blocker this is an escape hatch rather than a leak.
- **Fix:** add `.replace(/\.$/, '')` to the hostname normalisation.

### L8. Alarm and lifecycle details — Low — [R]
- **Evidence and what's good:**
  - All listeners (`onMessage`, `onAlarm`, `onInstalled`) are registered synchronously at top level (`service-worker.ts:260,452,488`). That's correct.
  - The only in-memory service-worker state is `updateQueue` (`storage.ts:6`), which is harmless to lose. There are no service-worker timers, and `storage.session` is used correctly for `countedBlockUrls`.
- **Problems:**
  - `chrome.alarms.create('checkSchedule', …)` runs on every service-worker start (`:450`), which re-arms the alarm and pushes the next tick back.
  - The alarm writes `blockState.isBlocking` and `blockState.activeSchedule` every minute (`:459-466`), but nothing in `src/` ever reads them.
  - `handleMessage(...).then(sendResponse)` has no `.catch` (`:261`). If it throws, the port closes and the content script falls back to *not blocked*. Failing open is the right call for a soft blocker, but it should log.
  - There is no `onStartup` listener; the IIFE at `:508` covers the badge.
- **Impact:** small. The minute tick drifts, there is one needless write per minute, and errors are silent.
- **Fix:** guard the alarm with `if (!(await chrome.alarms.get('checkSchedule')))`, or create it in `onInstalled`/`onStartup`. Remove the dead `isBlocking`/`activeSchedule` writes. Add `.catch(e => sendResponse({error:String(e)}))`.

### L9. Messaging: no forgery risk, but messages are not validated — Low — [R]
- **Evidence:**
  - Neither manifest declares `externally_connectable`, and only `runtime.onMessage` is used, never `onMessageExternal`. Web pages therefore can't send to the service worker, and other extensions can't reach this handler.
  - Content scripts run in an isolated world, so page JS can't call `chrome.runtime`.
  - The page *can* delete `#sordino-overlay` from the DOM. That falls in the same category as DevTools or disabling the extension: an intended soft-block escape, not a leak.
  - Messages are cast to `MessageType` with no runtime validation and no `sender` check. For example, `TOGGLE_MANUAL_OVERRIDE` or `PAUSE_BLOCKING` could be sent by a content script, and `until` isn't checked to be a number. Any content-script compromise is already game-over, so the risk is small.
  - `broadcastSettingsUpdate` correctly ignores errors from tabs that have no content script (`:12`).
  - The Firefox manifest still requests `tabs`, which Chrome dropped in dd7d9cb. `tabs.query({})` doesn't need it.
- **Impact:** no practical exploit. It is hardening and hygiene: a payload with the wrong shape (for example a string `until`) would corrupt state instead of being rejected.
- **Fix:** validate with a small type guard per message type. For the privileged types (`TOGGLE_MANUAL_OVERRIDE`, `PAUSE_BLOCKING`, `EMERGENCY_REFRESH_BYPASSES`, `CLEAR_BYPASS`), require `sender.url?.startsWith(chrome.runtime.getURL(''))`, so only the popup and settings page can send them and content scripts can't. A `sender.id` check is a no-op for `onMessage`. Drop the `tabs` permission in Firefox.

### L10. Storage growth is bounded — positive, Low — [R]
- `weeklyStats.days` is capped at 7 with `.slice(-7)` (`:194`), and `siteStats` is reset weekly. `stats` is per day, and `countedBlockUrls` lives in `storage.session` and is cleared daily.
- Nothing grows without limit. The worst case is one `siteStats` key per distinct blocked hostname per week, which is tiny compared with `storage.local`'s 10 MB.
- The only real cost is the write *frequency* described in H1.
- **Impact:** none; this is noted as a strength.

## Circumvention: escape hatch vs leak

- **Intended escape hatches** (acceptable under PRODUCT.md principle 1, "the bypass is the thesis"):
  - changing the system clock or date, which gives a fresh budget (L6);
  - typing a trailing-dot hostname (L7);
  - deleting `#sordino-overlay` with DevTools or page JS (L9);
  - disabling the extension;
  - the slightly-over-budget race (H3).

  None of these needs fixing beyond the one-line tweaks noted.
- **Accidental leaks:**
  - **C1:** nothing is blocked at all.
  - **M5:** user-added sites typed with capitals, a port, a query or IDN silently never match.
  - **M1:** a bypass is lost when another site is bypassed. This is the reverse direction: the user is under-served, not leaked through.

  These are real bugs, not philosophy.

---

## Code quality

- **Duplication:**
  - `getWeekStart` exists twice (`types.ts:165` private and `service-worker.ts:127`).
  - The hostname normalisation (`.replace(/^www\./,'')`) appears 4 times: `service-worker.ts:98,237,248` and `content.ts:75`.
  - Site-suffix matching is copied in `isUrlBlocked`, `hasBypass` and `content.ts:789`.
  - `mergeSiteStats` is reimplemented in `settings/App.tsx:1268`.
  - The site-input normalizer is duplicated in the popup and settings (M5).
  - `canEmergencyRefresh` is duplicated in `settings/App.tsx:1021`.
- **Dead code:**
  - `BYPASS_DURATION_MS` is unused.
  - The `MessageType` members `BLOCK_STATUS`, `BYPASS_RESULT` and `RECORD_BLOCK` are never sent. `SETTINGS_UPDATE` is typed with a `settings` payload that is never sent (`types.ts:212-224`).
  - `blockState.isBlocking` and `blockState.activeSchedule` are written but never read.
  - `getTimeRemainingInSchedule` is computed in `shouldBlock` but the service worker ignores it in favour of `formatEndTime`.
  - `src/shared/utils.ts` (`cn`) is UI-only and misfiled under `shared`.
- **Typing:**
  - There is no `any` in the scope, but responses are untyped (`Promise<unknown>`, `service-worker.ts:265`).
  - Content redeclares the response shapes by hand (`content.ts:5-12,765-768`).
  - A `ResponseFor<M>` map shared by both sides would catch drift like the `SETTINGS_UPDATE` payload mismatch.
  - `DEFAULT_SETTINGS` is a shared mutable object returned by reference from `getSettings()` (`storage.ts:59`), and its date fields are frozen at module load.
- **Structure and testability:**
  - All business logic (`isUrlBlocked`, `hasBypass`, the reset/archive updater, the stats updaters) is non-exported inside the side-effectful service-worker module. That module registers chrome listeners on import, so it can't be imported in a test without a stub. I had to append an `export {}` to a copy to test it.
  - Fix: move the pure logic to `src/shared/{domains,bypass,stats}.ts` and keep `service-worker.ts` as thin wiring.
- **Tooling:** there are no tests and no `tsc` in `build`, which is how C1 and M6 shipped. The fix is to add `vitest`, `"typecheck": "tsc --noEmit -p ."`, and the post-build `content.js` import check from C1.

## The 5 most valuable pure functions to unit-test first

1. **`isScheduleActive` / `shouldBlock`** (`schedule.ts`): overnight spans across day-of-week boundaries, end-exclusive edges, the 23:59 gap, `start==end`, pause vs manual override precedence. The test cases are in `test-pure.ts`.
2. **`isUrlBlocked`**, after extracting it plus a shared `normalizeSite`: suffix safety, `www`, case, port, trailing dot, IDN, `disabledSites`.
3. **The `checkBypassReset` updater**, extracted as `rolloverDay(settings, now)`: same day is a no-op, next day, a multi-day gap, and the week boundary (M4).
4. **`mergeWithDefaults`** (`storage.ts`): old schema snapshots from each commit in the git history, `undefined` input, and the `onboardingDismissed` inference.
5. **`getLocalDateString` + `getWeekStart`**: run under several `TZ` values: Sunday, Monday, month and year boundaries, and DST days.

Items 2 and 3 can only be tested after the logic is pulled out of `service-worker.ts`, which is itself the structural finding above.
