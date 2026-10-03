# Sordino 2.0: deepening candidates

Exploration for `improve-codebase-architecture`, HEAD `92a99ab`, read-only. Vocabulary: `.agents/skills/codebase-design/SKILL.md` (module, interface, implementation, depth, seam, adapter, leverage, locality). Domain words: `GLOSSARY.md`. Identifiers such as `shouldBlock`, `isUrlBlocked` and `blockState` are quoted verbatim from 1.x; the prose uses mute language (decision 12).

Settled and not reopened here: WXT build (ADR-0001); a spent Bypass budget adds a 30 s Bypass wait and never removes the Bypass (ADR-0002); the Overlay is plain DOM in a closed shadow root, and only extension pages use React (ADR-0003). Candidates aim at the 2.0 behaviour in `docs/plans/2026-10-03-overhaul-decisions.md`, not at keeping 1.x quirks.

## Where the friction is

- **Hot spots** (commits touching each file): `settings/App.tsx` 12, `service-worker.ts` 11, `popup/App.tsx` 10, `content.ts` 10, `types.ts` 9. Any change to one concept touches four or five of these files at once. Examples:
  - `9e31291` touched 6 files.
  - `1fbc6ea` (per-site Usage, local time, emergency refresh) touched the background script, settings, storage and types.
  - `2e7159e` (pause keeps manual state) touched the background script, popup and types.
- **No locality.** The pure functions do exist (`schedule.ts`, `storage.ts`), but the bugs live in how they are *called*:
  - who writes the shared object;
  - when the date rolls over;
  - which caller counts a Mute;
  - which caller checks the Bypass budget.

  The callers each re-derive the same facts.
- **Untestable core.** All muting, Bypass and Usage logic sits as non-exported functions inside `service-worker.ts`, which registers chrome listeners on import (background.md, "Structure and testability"). There are no tests apart from the C1 guard and the overlay smoke test.

## How the candidates compose

The candidates are not one module cut seven ways. They have two shapes:

- **#1 Single-writer Sordino store.** The one writer (in background). It owns persistence, migration and the command seam. Every state change in 2.0 crosses it.
- **#2–#5: in-process modules behind the store.** #2 One Muting decision, #3 Bypass budget, #4 Usage, #5 Muted sites. They are pure, time-injected state derivations and transitions:
  - the store's commands delegate to them (an internal seam of the store, tested directly in-process);
  - readers (popup, settings, content) call #2 and #5 on a snapshot they read themselves.

  This gives readers everywhere and one writer.
- **#6 Overlay session** and **#7 Schedule editing** are the consumer-side modules that 2.0's rebuilt surfaces sit on.

---

## 1. Single-writer Sordino store (versioned, command-driven)

- **Strength:** Strong
- **Dependency category:** Ports & adapters, with two real seams that each have two adapters:
  - **Storage seam:** a `chrome.storage.local` adapter (production) and an in-memory adapter (tests, and possibly First run previews).
  - **Command transport seam:** a `runtime.sendMessage` adapter (popup, settings and content to background) and a direct-call adapter (tests, and background-internal callers such as alarms).

  Badge, `tabs.sendMessage` and `alarms` are true-external (mock category). The store *returns effects*, and thin wiring in the background entrypoint applies them.
- **Files:** `src/shared/storage.ts`, `src/shared/types.ts` (`SordinoSettings`, `DEFAULT_SETTINGS`, `MessageType`), `src/background/service-worker.ts` (`handleMessage`, `checkBypassReset`, alarm and `onInstalled`), `src/popup/App.tsx`, `src/settings/App.tsx`, `src/content/content.ts`.

**Problem:** Popup, settings and background each read-modify-write one whole `sordino_settings` object through a per-context mutex, so writes are lost, every read writes, and with no schema version 2.0 cannot migrate v1 users or import a settings file safely.

**Solution:** One store module in background owns the versioned Sordino state, accepts a small set of domain commands, migrates any stored or imported document to the current version, and lets every other context read a snapshot and subscribe.

**Wins**
- Lost-update races gone by construction
- Migration tested on v1 fixtures
- One seam for every 2.0 ticket
- In-memory adapter: fast, deterministic tests
- Writes only on real change

**Before structure** (nodes and edges; ⚠ marks a leak edge)
- **Node `storage.ts`** exports four functions:
  - `getSettings` (merges with defaults, `storage.ts:52-62`);
  - `saveSettings` (whole-object `set`, `:64-69`, ignores `lastError`);
  - `updateSettings(updater)` (module-level `updateQueue` mutex, `:6`, `:73-89`);
  - `subscribeToSettings` (`:91-106`, throws if `newValue` is undefined).

  `mergeWithDefaults` (`:21-50`) is the only "migration": arrays replace defaults wholesale (`:46`), and there is no version.
- **Node `service-worker.ts`:**
  - `handleMessage` → `checkBypassReset()` on *every* message (`:266`) → `updateSettings` (`:170`) → unconditional `saveSettings`.
  - `GET_BLOCK_STATUS` → second `updateSettings` (`:289-307`).
  - Alarm → `checkBypassReset` and then two more `updateSettings` calls (`:455-479`), writing `blockState.isBlocking` and `activeSchedule` that nobody reads.
- **Node `popup/App.tsx`:**
  - ⚠ direct `updateSettings` for `onboardingDismissed` (`:124`);
  - ⚠ direct `updateSettings` for Quick add site (`:357`);
  - `chrome.runtime.sendMessage` for override, pause, resume and clear (`:95-117`).
- **Node `settings/App.tsx`:**
  - ⚠ direct `updateSettings` for every schedule, category, site and Bypass setting edit (`:31-36`, `:109-211`);
  - ⚠ `setSettings(updated)` after the write, which can roll back a newer `onChanged` value.
- **Node `content.ts`:**
  - ⚠ `GET_SETTINGS` once per second per non-muted tab (`content.ts:849-851`, `:769`);
  - `GET_BLOCK_STATUS` every 30 s (`:874`). Each of these triggers a full write in background.
- **⚠ Leak:** `updateQueue` is per-context (`storage.ts:6`), so popup, settings and background each serialise only themselves (background.md H2: 14 of 50 site additions lost).
- **⚠ Leak:** UI writes never broadcast to tabs. Only background handlers call `broadcastSettingsUpdate` (`:380,393,406,440`), so tabs lag up to 30 s (M7).
- **Messaging:**
  - `MessageType` (`types.ts:212-224`) has dead members and untyped responses (`Promise<unknown>`, `:265`);
  - content redeclares the response shapes (`content.ts:5-12`, `:765-768`);
  - privileged commands have no `sender` check (L9).

**After structure**
- **Deepened module:** the Sordino store, in background.
- **What callers see:**
  - **Readers** (popup, settings, content, background) get a typed, already-migrated snapshot and a change subscription. These are read-only and safe in any context.
  - **Writers** send one of a small set of domain commands, for example:
    - Start First run;
    - Mute now for a duration;
    - Pause for a duration;
    - Back to schedule;
    - Take Bypass for a site;
    - Turn back;
    - Record a Mute;
    - add or remove a Muted site;
    - edit a Schedule;
    - set Bypass options;
    - import a settings file.

    A command returns its outcome, for example "bypass granted, wait N s" or "site already muted as reddit.com".
  - There is **no generic `update(updater)`**. That is today's shallow module behind a different seam.
- **Behind the seam:**
  - the storage adapter;
  - a serial command queue (single writer, so atomic check-and-act);
  - the version number and a `migrate(unknown) → current` chain, which is also used for import;
  - split keys (config, runtime state, Usage), so the hot Usage path never rewrites user config;
  - write-only-on-change;
  - day rollover applied lazily inside commands;
  - delegation to modules #2–#5 for the actual transitions.

  The store returns effects ("set badge", "arm alarm at T", "notify tabs") instead of calling chrome.*, so the background entrypoint stays thin wiring.
- **Command transport:** a typed request/response map shared by both ends. The production adapter validates the payload and the sender (privileged commands only from extension pages). The test adapter calls the store directly.
- **Tests at this interface** (in-memory storage adapter, fixed clock):
  - v1 snapshots from the git history (`9e31291`, `1fbc6ea`, `bbea644`, `372cc65`) migrate to the current version with sites, schedules and Usage intact;
  - concurrent "add Muted site" and "record Mute" commands both survive;
  - a read-only snapshot causes no write;
  - an export → import round-trip is identity;
  - an import of a malformed file is rejected without touching state.

**Suggested diagram pattern:** Mermaid flowchart, before and after. Before: three contexts each with a red ⚠ write edge into one `sordino_settings` box, plus a "1 Hz" edge from every tab. After: one store node with the storage seam (two adapters) and the command seam (two adapters), and readers drawn with dashed read edges.

**ADR conflict:** none. WXT background entrypoints host the store directly. The decision doc's open item ("state single-writer, storage keys") is answered here.

---

## 2. One Muting decision module

- **Strength:** Strong
- **Dependency category:** In-process (pure; state snapshot plus injected `now`)
- **Files:** `src/shared/schedule.ts`, `src/background/service-worker.ts:80-92` (`getBadgeState`), `:309-319` (Overlay reason and end time), `src/popup/App.tsx:59-90` (status), `src/settings/App.tsx:367-386` (`RightNowCallout`), `src/content/content.ts:233-237` (reason line).

**Problem:** Whether muting is in effect, why and until when is decided in three places with three different precedence orders, and none covers 2.0's precedence (finite Mute now, Pause, most recent action wins, a Schedule never overriding a Pause).

**Solution:** One Muting decision module takes the state and `now` and returns whether muting is in effect, its source (Schedule, Mute now, Pause or none), its honest end time and the next moment the answer can change, for popup, settings, badge, Overlay and timers alike.

**Wins**
- Precedence decided in one place
- Popup, settings, badge agree
- "Next change" replaces polling
- Pure: table-driven tests, any TZ
- Fixes overlapping-schedule end time

**Before structure**
- **Node `schedule.ts`:**
  - `isScheduleActive` (`:39-78`), with an end-exclusive range (`:36`), so the "Always on" 23:59 gap occurs (L1);
  - `getActiveSchedule` returns the *first* match (`:81`), so overlapping schedules report the wrong end (L2);
  - `getTimeRemainingInSchedule` is computed and then ignored;
  - `formatEndTime`;
  - `shouldBlock` (`:119-150`), whose order is: pause, then manual `'on'`/`'off'`, then schedules.
- **Node `service-worker.ts`:**
  - `getBadgeState` (`:80-92`) re-orders: bypass first, then pause, then `shouldBlock`.
  - `GET_BLOCK_STATUS` (`:309-319`) calls `getActiveSchedule` *again* and attaches "until 5 PM" even when the reason is the manual override (content-overlay.md #23).
- **Node `popup/App.tsx:59-90`:** ⚠ a third derivation, ordered bypass, pause, manual on, manual off, then `shouldBlock && activeSchedule`. It has its own strings.
- **Node `settings/App.tsx:367-386`:** ⚠ a fourth derivation. It ignores Bypass, and manual `'off'` renders as "Turn on a schedule below", which is wrong (ui.md F-1, F-13).
- **Node `content.ts`:** renders `reason` and `timeRemaining` strings built in background (`:233-237`). It has no notion of when things change, so it polls (#6).
- **Edges:**
  - popup, settings and background each import `shouldBlock`, `getActiveSchedule` and `formatEndTime` and recombine them differently. ⚠ The logic is duplicated across three callers.
  - No caller knows the next transition time, which is why `content.ts` polls at 1 s and 30 s and background runs a 1-minute alarm.

**After structure**
- **Deepened module:** Muting decision (`src/shared/muting.ts` or similar).
- **What callers see:** a single question, "what is muting doing at `now`?", whose answer covers:
  - in effect, yes or no;
  - the source (Schedule by name, Mute now, Pause, or nothing);
  - when it ends, merged across overlapping or contiguous schedules, with all-day Schedules supported;
  - the next change time.

  Optionally, a URL-scoped variant answers "should the Overlay show on this page?" by consulting Muted sites (#5) and active Bypasses (#3) as internal seams.
- **Behind the seam:**
  - Schedule evaluation (overnight spans, day of week, all-day);
  - precedence between Mute now and Pause (most recent wins, both finite);
  - "a schedule starting does not override a Pause";
  - "Back to schedule" semantics.

  Copy and formatting stay with each surface. The module returns facts, not sentences, so popup and settings can word things differently but never *disagree*.
- **Tests at this interface:** a table of (state, now, TZ) → answer cases:
  - overnight Schedules across the Sunday–Monday change;
  - Pause started during a Schedule;
  - Mute now started during a Pause;
  - a Schedule beginning mid-Pause;
  - overlapping Schedules' end time;
  - the next-change time at each transition;
  - DST days under `TZ=America/New_York` and `Pacific/Kiritimati`.

  The old tests on `isScheduleActive` would be replaced by these, not kept alongside.

**Suggested diagram pattern:** call-graph collapse. Four fan-in clusters (popup status, settings callout, badge, Overlay reason), each with its own arrows into `shouldBlock`, `getActiveSchedule` and `formatEndTime`, collapse into one arrow per caller into one Muting decision node.

**ADR conflict:** none. Note that `manualOverride: 'on' | 'off' | null` (`types.ts:27`) is retired by decisions 13–15 and must not be modelled.

---

## 3. One Bypass budget module (per-site Bypasses, Bypass wait, spent-budget friction)

- **Strength:** Strong
- **Dependency category:** In-process (pure transitions over Bypass state plus `now`), executed inside the store's single writer (#1), so check-and-spend is atomic.
- **Files:** `src/background/service-worker.ts:229-242` (`hasBypass`), `:322-364` (`USE_BYPASS`), `:410-429` (emergency refresh), `:200-207` (reset clears the Bypass), `src/shared/types.ts:32-40` (`BypassState`), `src/content/content.ts:268-286`, `:292-340`, `:786-804`, `src/popup/App.tsx:92-93`, `:301-307`, `src/settings/App.tsx:1012-1060`.

**Problem:** Bypass logic is spread across five files, so the budget can be overspent, one Bypass evicts another, midnight kills a live Bypass, `remaining` goes negative, and the Overlay hard-stops at zero against ADR-0002.

**Solution:** One Bypass budget module owns per-site Bypasses, the daily Bypass budget, the normal and spent (30 s) Bypass wait and day reset, and answers "what may this Overlay offer" and "take a Bypass for this site" atomically inside the single writer.

**Wins**
- Budget can't go negative
- Per-site timers, no eviction
- ADR-0002 encoded once
- Overlay asks, never computes
- Day reset spares live Bypasses

**Before structure**
- **Node `service-worker.ts`:**
  - ⚠ `USE_BYPASS` reads `remaining` from the pre-queue snapshot (`:323-327`) and increments in a *separate* updater (`:348`), which is a race;
  - it writes a single `activeBypass` (`:349`), keyed by raw hostname (`:329`) rather than the matched Muted site (L3);
  - it accepts any site (L4);
  - `hasBypass` (`:230-242`) re-does suffix matching;
  - `checkBypassReset` sets `activeBypass: null` at midnight (`:206`);
  - emergency refresh (`:410-429`) has the same check-outside-write race.
- **Node `content.ts`:**
  - ⚠ computes the "N quick bypasses left" label (`:268-270`) and the Bypass button state;
  - ⚠ `remaining === 0` disables the button (`:282-286`), a hard stop that conflicts with ADR-0002;
  - ⚠ the scaffolding confirm (`:292-316`) is a separate friction mechanism;
  - ⚠ re-matches the Bypass site against the page host (`:788-789`).
- **Node `popup/App.tsx:92-93`:** ⚠ `maxBypasses - quickBypassesUsed` with no clamp, shows "-2/1", and the red highlight only fires at `=== 0` (`:305`).
- **Node `settings/App.tsx:1017-1025`:**
  - ⚠ the same subtraction again;
  - ⚠ `canRefresh` duplicates background `canEmergencyRefresh` (`:136-140`);
  - the progress bar renders full at a negative width (F-10).
- **Edge:** the Bypass duration comes from `settings.bypassDurationMinutes`, but the badge hard-codes `'5m'` (`:73`) (M6).

**After structure**
- **Deepened module:** Bypass budget.
- **What callers see:**
  - **Offer.** Given state, a Muted site and `now`, it returns what the Overlay may offer:
    - the Bypass wait in seconds (configured 0–15, or 30 once the budget is spent);
    - the Bypass length;
    - the remaining count, clamped;
    - whether the budget is spent.
  - **Take.** A transition that grants a per-site Bypass, starting its timer, spending one from the budget and recording the Bypass for Usage (#4). It is honest when spent and refuses sites that are not muted.
  - **Lookup.** "Is this Muted site bypassed until T?" for the Muting decision (#2) and the badge.
- **Behind the seam:**
  - Bypass state is a map of Muted site to expiry;
  - expiry pruning;
  - budget rollover at local midnight without ending live Bypasses;
  - wait selection per ADR-0002.

  Emergency refresh and the `quickBypassesUsed`-at-zero hard stop disappear.
- **Tests at this interface:**
  - two Bypasses on different sites coexist;
  - a third Bypass when the budget is spent is granted with a 30 s wait and counted;
  - concurrent takes when one Bypass is left do not overspend (via the store with the in-memory adapter);
  - a 23:58 Bypass survives midnight;
  - `old.reddit.com` and `www.reddit.com` share one Bypass because both match `reddit.com`.

**Suggested diagram pattern:** mass diagram. The before picture is five small boxes (background, content, popup, settings, types), each holding a sliver of Bypass logic. The after picture is one tall Bypass budget box with a thin interface strip (offer / take / lookup) on top.

**ADR conflict:**
- `content.ts:282-286` (button disabled at 0) and the emergency refresh path (`service-worker.ts:410-429`, `settings/App.tsx:1021-1060`) contradict **ADR-0002**. The rebuilt module must keep the Bypass available after the 30 s wait, and emergency refresh is retired.
- Scaffolding mode's second-click confirm is superseded by the Bypass wait (decision 17). Confirm before carrying it over.

---

## 4. One Usage module (Mute count, Turn backs, Bypasses, Pauses; 12 weeks)

- **Strength:** Strong
- **Dependency category:** In-process (pure record and read functions over a daily-totals document plus injected `now`), persisted by the store (#1).
- **Files:** `src/background/service-worker.ts:22-49` (session dedup), `:142-159` (`mergeSiteStats`), `:161-227` (`checkBypassReset` rollover), `:284-307` (counting in `GET_BLOCK_STATUS`), `:334-358`, `src/shared/types.ts:42-65`, `:160-172` (`getLocalDateString`, `getWeekStart`), `src/settings/App.tsx:1125-1168` (`WeeklyStatsChart`), `:1266-1300` (`TopSitesDisplay`), `src/popup/App.tsx:290-307`.

**Problem:** The Mute count is a side effect of status polling with two conflicting definitions (per-site counts every poll, the total is deduplicated in session storage), the week rollover misfiles Sunday, and history ends after 7 days while 2.0 wants 12 weeks of raw daily counts including Turn backs and Pauses.

**Solution:** One Usage module records each event (Mute once per navigation, Turn back, Bypass, Pause) exactly once into local-time daily totals kept for 12 weeks, and answers today, week and per-Muted-site reads for the popup and the Usage tab.

**Wins**
- One definition of Mute count
- Counting leaves the polling path
- 12-week history, bounded size
- Readers stop re-merging totals
- Rollover bugs testable under TZ

**Before structure**
- **Node `service-worker.ts` `GET_BLOCK_STATUS`** (`:284-307`):
  - ⚠ counting is a side effect of a *status query*;
  - `siteStats[host].blocks++` on every poll, `visibilitychange` and broadcast;
  - `blocksTriggered` is deduplicated via `chrome.storage.session` (`:25-49`), outside the queue (L5), cleared on browser restart and after any Bypass (`:332`).
- **Node `checkBypassReset`** (`:161-227`):
  - archives `stats` into `weeklyStats` after resetting the week, which misfiles Sunday (M4);
  - truncates to 7 days (`:194`);
  - is coupled to the Bypass reset in one updater.
- **Node `types.ts`:**
  - `getLocalDateString` relies on `toLocaleDateString('en-CA')` (`:160-162`), a locale-data dependency (L6);
  - a private `getWeekStart` (`:165`) is duplicated in background (`:127`).
- **Node `settings/App.tsx`:**
  - ⚠ `WeeklyStatsChart` rebuilds the week and splices "today" from `stats` (`:1129-1168`), keying `isToday` off `settings.stats.date`, not the real date;
  - ⚠ `TopSitesDisplay` re-implements `mergeSiteStats` (`:1268-1293`).
- **Node `popup/App.tsx:290-307`:** reads `stats.blocksTriggered` raw ("distractions caught").
- **Missing edge:** the content script never reports "the Overlay was shown for this navigation" or "Turn back". The unused `RECORD_BLOCK` message (`types.ts:219`) shows the intent was there.

**After structure**
- **Deepened module:** Usage.
- **What callers see:**
  - **Record.** Takes one event (Mute, Turn back, Bypass, Pause) for a Muted site at `now`. The content script sends "Mute" once when the Overlay is first shown for a navigation, as a command to the store (#1); background records Bypass and Pause as part of those commands.
  - **Read.** Answers today's counts, a week's daily totals (Monday start, local days, empty days shown as zero) and per-site totals over a range. All four counts are raw, with no rates.
- **Behind the seam:**
  - date keys built from local date parts;
  - a ring of up to 12 weeks of daily records;
  - per-site daily counts keyed by the matched Muted site (#5), not the raw host;
  - pruning;
  - rollover that cannot misfile across weeks, because days are keyed absolutely and weeks are derived on read.
- **Tests at this interface:**
  - the same navigation recorded via repeated status reads counts once (in the content-side test via #6, plus a store-level test);
  - Sunday activity appears only in last week;
  - 13 weeks of events keep only 12;
  - a day under `TZ=Pacific/Kiritimati` keys to its local date;
  - per-site totals equal the sum of daily totals.

**Suggested diagram pattern:** cross-section. A horizontal slice through popup, settings, background and storage shows where Usage knowledge sits today (dedup in session storage, counting in the status handler, merging in two UI files). An after slice shows one Usage band, with record above it and read below.

**ADR conflict:** none. Glossary: "Usage", never "stats", in the rebuilt code and copy. The "Refreshes" counter goes with emergency refresh (ADR-0002).

---

## 5. One Muted sites module (normalize what the user types; match a page to a Muted site)

- **Strength:** Strong, on locality and invariants rather than raw depth. Deletion test: deleting `normalizeSite` + `match` would scatter the logic back into 7 places, which is its claim. The module is small by line count; its value is that normalization and matching are guaranteed to agree, and that the *matched Muted site* becomes the identity used by Bypass (#3) and Usage (#4).
- **Dependency category:** In-process (pure)
- **Files:** `src/background/service-worker.ts:95-124` (`isUrlBlocked`), `:230-252` (`hasBypass`, `getSiteFromUrl`), `src/content/content.ts:73-79`, `:788-789`, `src/popup/App.tsx:354`, `src/settings/App.tsx:867-887`, `src/shared/types.ts:17-23`, `:81-122`.

**Problem:** A weak input regex copied into two add flows lets `Reddit.com` be saved yet never Muted, hostname cleanup and suffix matching are copied four more times, and Bypass and Usage are keyed by raw hostname so `old.reddit.com` and `www.reddit.com` diverge.

**Solution:** One Muted sites module turns any typed or pasted input into a canonical Muted site (or refuses it with a reason) and matches a page URL to the Muted site it falls under, which then keys Bypass and Usage.

**Wins**
- Typed sites always match
- Seven copies become one
- Muted site identity keys Bypass, Usage
- Right-click "Mute this site" reuses it
- Pure, exhaustive edge-case tests

**Before structure**
- **Normalize (input):**
  - ⚠ `popup/App.tsx:354` and ⚠ `settings/App.tsx:872` use the identical regex `trim → strip https?:// → strip www. → split('/')[0]`;
  - settings dedupes case-sensitively (`:879`); popup does not dedupe at all.
- **Match (page):**
  - `isUrlBlocked` (`service-worker.ts:95-124`) applies `hostname.replace(/^www\./,'')` and suffix-matches against Category sites minus `disabledSites`, then against custom sites;
  - ⚠ `hasBypass` (`:236-238`) and `getSiteFromUrl` (`:245-252`) repeat the hostname cleanup;
  - ⚠ `content.ts:75` and `:789` repeat the cleanup and suffix match.
- **Leak:** the matched Muted site is discarded (it returns `boolean`). Callers re-derive a key from the raw host (`getBlockKey`, `:255`), so identity differs between Bypass, Usage and matching.
- **Missing:** no trailing-dot handling (L7) and no IDN/punycode handling. A site already present in a Category can be added again as a custom site.

**After structure**
- **Deepened module:** Muted sites.
- **What callers see:**
  - **Parse.** Turns user input into a canonical Muted site or a reason it was refused. It is used by the settings add flow, the popup add flow, right-click "Mute this site" (decision 2) and import (#1).
  - **Match.** Given a URL and the current Muted site list (Categories with per-site toggles, plus the user's own sites), returns the matching Muted site or none.
- **Behind the seam:**
  - URL parsing;
  - lowercasing and punycode;
  - stripping `www.`, port, query, path and the trailing dot;
  - suffix-safe matching;
  - Category vs custom precedence;
  - duplicate detection across Categories.

  The store's "add Muted site" command (#1) calls Parse, so a bad entry can never be persisted. The Muting decision (#2) calls Match as an internal seam.
- **Tests at this interface:**
  - the full M5 table (`Reddit.com`, `HTTPS://reddit.com`, `reddit.com:443`, `?ref=1`, `münchen.de`, `*.reddit.com`);
  - background.md's negative controls (`notreddit.com`, `reddit.com.evil.com`, `evil.com/reddit.com`);
  - `old.` and `www.` both match `reddit.com`;
  - a site disabled inside a Category does not match.

**Suggested diagram pattern:** Mermaid flowchart with seven ⚠-marked duplicate nodes (two Parse copies, five Match copies) converging on one Muted sites node with two exits (Parse, Match), and arrows onward to Bypass budget and Usage carrying "matched Muted site".

**ADR conflict:** none. Path rules are deferred (decision 3), so the interface should not promise them, but Match returning a Muted site object leaves room for them.

---

## 6. Overlay session in the content script (decide locally, react to change, render once)

- **Strength:** Worth exploring
- **Dependency category:** Local-substitutable, with caveats:
  - state source: the store's read-only snapshot plus `storage.onChanged` (#1), with an in-memory adapter for tests;
  - decision logic: in-process, via #2, #3 and #5;
  - DOM: happy-dom or jsdom is **not** a faithful stand-in for a closed shadow root plus `<dialog>.showModal()`, fullscreen stacking and `inert`. The second adapter for the rendering seam is the existing Playwright smoke test (`tests/e2e/overlay.smoke.mjs`). Tests at the interface therefore cover the session's decisions (what to show, when to re-check, what to record) in-process, and the real-browser smoke test covers rendering.
- **Files:** `src/content/content.ts` (889 lines: state `:14-20`, messaging `:30-71`, DOM build `:135-343`, CSS `:345-614`, show/remove `:617-658`, toast `:663-760`, countdowns `:763-830`, `checkAndBlock` `:832-859`, init `:862-889`).

**Problem:** The content script asks background for everything by polling (1 s on every page of the web, 30 s for status), so it misses Bypass expiry until the next poll, fails open when the extension context is orphaned, and lets the page paint before the Overlay appears.

**Solution:** One Overlay session module per tab decides locally at `document_start` from the snapshot (#2, #3, #5), shows, updates or removes one Overlay, arms a single timer at the next change, re-decides on `storage.onChanged`, and sends Mute and Turn back to the store as commands.

**Wins**
- No polling on unrelated pages
- Bypass ends on time
- Mute recorded once per navigation
- Rendering isolated behind one seam
- Orphaned context fails safely

**Before structure**
- **Module state:** `content.ts:14-20` holds seven module-level variables (`overlayElement`, `isChecking`, three timers, two notification sets).
- **Edges to background:**
  - ⚠ `checkBlockStatus` → `GET_BLOCK_STATUS` (`:33`), which *counts a Mute as a side effect* in background (#4);
  - ⚠ `checkCountdowns` → `GET_SETTINGS` each second (`:769`), which pulls the whole settings object, Usage included;
  - `useBypass` → `USE_BYPASS` (`:56`).
- **Timers:**
  - `setInterval(checkAndBlock, 30000)` (`:874`);
  - `setInterval(checkCountdowns, 1000)` (`:850`) on every non-muted page, never cleared;
  - quote rotation every 11 s (`:638`).

  None of them is derived from when state actually changes.
- **Duplicated logic:**
  - ⚠ Bypass site matching (`:788-789`);
  - ⚠ the Bypass budget label and zero-state (`:268-286`);
  - ⚠ countdown thresholds for both Bypass and Pause (`:778-826`). Decision 22 removes the Pause toasts.
- **DOM:**
  - `showOverlay` checks `if (overlayElement) return` without `isConnected` (`:618`), so the Overlay never returns after a page removes it;
  - it appends to `body`, with no shadow root;
  - Turn back uses `history.back()` / `about:newtab` (`:248-251`).
- **Fail-open:** messaging errors resolve as "not muted" (`:39-47`), so after an extension update every muted tab un-mutes on the next poll.

**After structure**
- **Deepened module:** Overlay session, the content entrypoint's brain.
- **What callers see:** the WXT content entrypoint starts one session for the page. The interface covers:
  - the page URL;
  - a state source (the snapshot plus change subscription);
  - a command sink (Mute, Take Bypass, Turn back);
  - a renderer;
  - a clock.

  The session owns the lifecycle.
- **Behind the seam:**
  - early exit for pages that aren't Muted sites;
  - one next-change timer, from #2 and #3;
  - re-decide on change;
  - Mute recorded once per navigation (SPA URL changes on the same Muted site are not new navigations; this needs a decision);
  - orphaned-context teardown.
- **Rendering:** a separate, deliberately small interface (show with a view model, update, remove, end-of-Bypass toast). It is implemented in plain DOM in a closed shadow root with `px` sizing (ADR-0003), with media pause, re-attach and `isTrusted` guards inside it.
- **Tests at this interface** (in-memory state source, fake clock, recording renderer):
  - a page that isn't a Muted site never subscribes or arms timers;
  - a Bypass expiring at T re-shows the Overlay at T;
  - a Mute is sent once per navigation despite repeated state changes;
  - a Pause starting removes the Overlay;
  - an orphaned context stops timers.

  Rendering correctness is covered by the Playwright smoke test.

**Suggested diagram pattern:** sequence diagram (Mermaid `sequenceDiagram`), before and after. Before: Tab → background at 1 Hz and every 30 s, background → storage write per call. After: Tab reads the snapshot once, sets one timer, wakes at T, and sends one Mute command.

**ADR conflict:** none, as long as no React enters the content script (ADR-0003). ADR-0001's `check:content` stays as the build guard.

---

## 7. Schedule editing: one Schedule module and one ScheduleForm

- **Strength:** Speculative (worth folding into the settings rebuild rather than its own ticket)
- **Dependency category:** In-process (validation and description are pure); the React form is a thin consumer.
- **Files:** `src/settings/App.tsx:417-603` (`ScheduleCard`, edit form `:457-539`), `:606-617` (`matchesTemplateSchedule`), `:619-758` (`AddScheduleButton`, add form `:661-746`), `src/shared/types.ts:124-157`, `:209` (`TEMPLATE_SCHEDULE_IDS`), `src/shared/schedule.ts:13-36`, `:111-117`.

**Problem:** The Schedule form is copied for edit and add (about 170 lines) with different checks, neither rejects zero days, `start == end` or a cleared time, so a Schedule can look on and never fire, and built-ins are locked as templates against decision 16.

**Solution:** One Schedule module validates a draft Schedule with reasons, describes it for display (including "ends next day" and a true all-day setting), and backs a single ScheduleForm React module used for both add and edit.

**Wins**
- No silent never-firing Schedules
- One form, one set of checks
- "Always on" truly all-day
- Built-ins become ordinary Schedules

**Before structure**
- **Node `ScheduleCard` edit mode** (`settings/App.tsx:457-539`): name input, day picker, two time inputs, Save with no validation (`:527-531`), and its own `formatDays` and `formatTime` (`:443-455`).
- **Node `AddScheduleButton`** (`:619-758`):
  - ⚠ duplicate name, day and time inputs (`:661-746`);
  - its own default draft repeated twice (`:622-629`, `:651-658`);
  - a name-only check (`:644`);
  - a "matches template" warning (`:606-641`) that relies on `TEMPLATE_SCHEDULE_IDS`.
- **Node `schedule.ts`:** `parseTime` (`:13-16`) has no validation, and `formatEndTime` (`:111-117`) is a third time formatter.
- **Node `types.ts`:**
  - "Always on" is `00:00–23:59` (`:154-155`), which leaves a one-minute gap with an end-exclusive range (L1);
  - `TEMPLATE_SCHEDULE_IDS` (`:209`) makes the built-ins uneditable and undeletable.
- **Edge:** validity is never re-checked on load or import, so a malformed Schedule from storage silently never fires.

**After structure**
- **Deepened module:** Schedule (validate and describe; evaluation stays inside Muting decision #2, which this module's types feed).
- **What callers see:**
  - "is this draft a valid Schedule, and if not why";
  - "describe this Schedule for display".

  The store's "edit Schedule" command (#1) validates through it, and so does import. ScheduleForm renders a draft and shows the reasons.
- **Behind the seam:**
  - `HH:MM` parsing;
  - all-day representation;
  - day ordering;
  - overnight detection;
  - duplicate-of-existing hints.
- **Tests at this interface:** zero days, `start == end`, an empty or cleared time and a blank name are each rejected with a reason; an overnight Schedule is described as ending the next day; the all-day Schedule is active at 23:59:30.

**Suggested diagram pattern:** mass diagram. Two equally large form blobs plus three small formatter blobs in the before picture; one Schedule box (with a small interface strip) plus one form in the after picture.

**ADR conflict:** none with the ADRs. `TEMPLATE_SCHEDULE_IDS` (`types.ts:209`) and the "matches template" warning conflict with **decision 16** (built-ins become ordinary, editable, deletable Schedules suggested at First run) and should not be carried over.

---

## Top recommendation

**Start with #1, the single-writer Sordino store, and slot #2 (One Muting decision) behind it as the first in-process module.** Under WXT with test-first tickets, the store's command and snapshot interface (in-memory storage adapter, direct-call command adapter) is the seam every state-changing 2.0 ticket crosses, so it must be agreed first; #2 follows because popup, settings, badge and the Overlay session all need it and it is pure.

### Evidence

Counting 2.0 tickets against seams:

| Ticket | Crosses the store's command and snapshot seam? |
|---|---|
| Mute now with a duration | yes |
| Pause | yes |
| Back to schedule | yes |
| Per-site Bypass | yes |
| Bypass wait | yes |
| Mute count, Turn backs, Pauses in Usage | yes |
| v1 migration | yes |
| Export/import | yes |
| Right-click "Mute this site" | yes |
| First run Start | yes |
| Status display (popup, badge, Overlay reason) | no: served by #2 alone |

The store also closes the largest bug family in one move:
- the lost-update races (H2, F-12);
- write-per-read (H1);
- the budget overspend (H3);
- the missing schema version (M8).
