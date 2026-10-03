# Sordino: Popup and Settings UI Review

Scope: `src/popup/App.tsx`, `src/settings/App.tsx`, `src/index.css`, `src/*/main.tsx`, `src/*/index.html`, `src/shared/*`, `public/manifest*.json`, plus the parts of `src/background/service-worker.ts` and `src/content/content.ts` that decide what the UI shows. Rubric: PRODUCT.md and DESIGN.md. Repo HEAD `349f5d8`. Read-only review.

Screenshot note: `sordino-qe-screenshots/` predates 372cc65. Since then the popup stat labels changed ("blocked" became "distractions caught"), the schedule and category checkboxes became `Toggle` switches, the glyph "pp ♪♫♪" divider became an inline SVG, and the status-pill halos were removed. Screenshot 08 still holds as evidence for the `h3` font bug (F-14), which the code hasn't changed. Screenshot 11 has seeded-looking data, so it only illustrates F-3.

Severity key: **Critical** = the product does the wrong thing, or the user can get stuck. **High** = trust, privacy, or accessibility failures that break the stated spec. **Medium** = correctness or UX debt the user will notice. **Low** = polish and hygiene.

---

## Top findings at a glance

| # | Finding | Severity |
|---|---|---|
| F-1 | Manual override is a one-way door: no UI path returns to schedule mode | Critical |
| F-2 | Uppercase custom domains are saved but never match; the popup add flow has no dedupe | High |
| F-3 | Two definitions of "block" on one screen; per-site counts inflate every 30 s | High |
| F-4 | Week rollover merges last Sunday into this week's Top Sites; there is no history past 7 days | High |
| F-5 | Google Fonts are fetched from extension pages, but the footer says "Nothing leaves your browser" | High |
| F-6 | Nothing opens on install: blocking starts silently and the only explanation is in the popup | High |
| F-7 | No `options_ui`/`options_page`; settings can only be reached through an unlabeled gear | High |
| F-8 | Toggles, checkboxes, day buttons, steppers, and icon buttons have no accessible name | High |
| F-9 | Collapsed category lists stay in the tab order and the accessibility tree | High |
| F-10 | Bypass budget goes negative and the progress bar then renders full | Medium |
| F-11 | Progress bar, red "0 left" card, and "Use wisely." break Principles 2 and 4 | Medium |

---

## 1. Architecture and state

### F-1 **Manual override is a one-way door: the UI never restores schedule-driven mode** — Critical
- **Evidence:**
  - `src/popup/App.tsx:95-98`: `handleToggle` sends `TOGGLE_MANUAL_OVERRIDE` with `'on'` ("Start Blocking").
  - `src/popup/App.tsx:100-104`: "Until I turn it back on" sends `'off'`.
  - `src/background/service-worker.ts:370-381` stores whatever it receives.
  - `src/shared/schedule.ts:132-137`: `'on'`/`'off'` take precedence over every schedule.
  - `grep` for `manualOverride`/`TOGGLE_MANUAL_OVERRIDE` turns up no caller that ever sends `null`. Neither the popup nor settings can get back to "follow schedule".
  - `RESUME_BLOCKING` (SW 397-407) deliberately keeps the override.
- **What happens:**
  - A new user opens the popup outside work hours, sees "Blocking inactive", and taps **Start Blocking**. They are now blocked 24/7, weekends included. Their schedules are ignored for good, and the status line says "Manual block enabled".
  - Their only way out is **Pause → Until I turn it back on**, which sets `'off'`. Now schedules are ignored for good the other way: nothing ever blocks again.
  - Meanwhile the settings `RightNowCallout` (`settings/App.tsx:384-386`) says "Not blocking. Turn on a schedule below to start". Turning on a schedule does nothing, because `'off'` wins.
- **Persona impact:**
  - ADHD user (primary): the product silently stops working or never stops. That is the opposite of predictable scaffolding.
  - Self-aware quitter: concludes "it's broken" and uninstalls, which is the exact failure mode PRODUCT.md:34-36 says Sordino exists to avoid.
- **Fix:**
  - Treat manual on/off as time-boxed or explicitly reversible. Show a "Back to schedule" action in the popup and the settings callout whenever `manualOverride !== null`, and have it send `state: null`.
  - Have "Start Blocking" offer durations ("for 1 hour", "until I stop") the same way Pause does.
  - Have the callout explain an `'off'` override ("Paused until you turn it back on") instead of telling the user to turn on a schedule.

### F-12 **Cross-context read-modify-write races; config and hot stats share one key** — Medium
- **Evidence:**
  - `src/shared/storage.ts:6` holds `updateQueue` at module level. That serializes writes only within one JS realm. The popup, the settings page, and the service worker each have their own queue.
  - Every `updateSettings` reads the whole `sordino_settings` object and writes it back (`storage.ts:77-81`).
  - The SW writes this same key on every `GET_BLOCK_STATUS` (SW 289-307). The content script sends one every 30 s per blocked tab (`content.ts:874`) and on every `visibilitychange` (`content.ts:867-871`). The SW also writes every minute from the alarm (SW 459-466).
  - The settings page writes the same key for every toggle, stepper click, and site add (`settings/App.tsx:31-36`).
- **What happens:**
  - A settings write and an SW stats write that overlap within one storage round-trip lose one of the two updates. Either a just-added custom site or toggle silently reverts, or a block or bypass count disappears.
  - Each SW write also fires `storage.onChanged` in every open popup or settings page. That re-renders the whole tree (`settings/App.tsx:25-29`), at least every 30 s while any tab sits on an overlay.
- **Persona impact:** ADHD user: "I turned that off, why is it back on?" erodes trust in the instrument.
- **Fix:**
  - Split storage into keys: `config` (written by the UI), `runtime` (block, pause, and bypass state, written by the SW), and `stats` (SW-only).
  - Better still, route all UI writes through SW messages so there is a single writer.
  - Use `chrome.storage.local.set` with narrow keys so writes don't clobber each other.

### F-13 **Status logic is duplicated in three places and they disagree** — Medium
- **Evidence:**
  - Popup status derivation: `popup/App.tsx:59-90`. It puts bypass first, then paused, then manual.
  - Settings `RightNowCallout`: `settings/App.tsx:367-386`. It ignores active bypasses, and an `'off'` override renders as "Not blocking. Turn on a schedule".
  - Badge: `service-worker.ts:80-92`.
  - The popup's "N sites across M categories" (`popup/App.tsx:217-222`) counts custom sites in N but not in M.
- **Impact:** All personas see the popup and settings describe the same moment differently.
- **Fix:** Add one shared `deriveStatus(settings, now)` in `src/shared/` that returns `{state, label, subtext, nextAction}`. Have the popup, the callout, and the badge all use it.

### F-15 **The 1382-line settings file holds 15 components, with a large duplicated form** — Medium
- **Evidence:**
  - `settings/App.tsx` is decomposed into function components (App, Footer, MusicalDivider, RightNowCallout, Toggle, ScheduleCard, AddScheduleButton, CategoryCard, AddSiteInput, NumberStepper, BypassSettings, BypassBudget, WeeklyStatsChart, TopSitesDisplay), but they all live in one file. There are no shared primitives (Button, Card, Field).
  - The schedule editor is copied almost verbatim: edit mode at `:457-539` and add mode at `:661-746`. That's about 170 lines, including the day picker and time fields.
  - Domain normalization is copied between `popup/App.tsx:354` and `settings/App.tsx:872`.
  - Dead code: `contentRef` (`:774`, `:827`) is never read. `motion-safe:animate-in motion-safe:fade-in` (`:459`) are tailwindcss-animate classes. That plugin isn't installed, and the built CSS has 0 matches, so they do nothing.
- **Impact:** Each copy can drift independently, and they already have (F-2, F-17).
- **Fix:**
  - Split into `settings/sections/{Schedules,Sites,Bypass,Usage}.tsx` plus `components/{Toggle,Stepper,DayPicker,ScheduleForm,Field}.tsx`.
  - Move `normalizeDomain`, `validateSchedule`, and `deriveStatus` into `src/shared/` and unit-test them.

### F-16 **Error handling and loading states** — Medium
- **Evidence:**
  - `getSettings`/`saveSettings` (`storage.ts:52-69`) never check `chrome.runtime.lastError`, so quota or IO failures resolve silently.
  - `updateSettings` swallows errors and returns re-read settings (`:82-86`). The UI then calls `setSettings` with the old state, and the user gets no feedback at all.
  - The popup's `chrome.runtime.sendMessage` calls (`popup/App.tsx:95-117`) aren't wrapped. A rejection becomes an unhandled promise and the button simply does nothing.
  - `subscribeToSettings` passes `newValue` straight to `mergeWithDefaults` (`storage.ts:100`). If the key is removed (cleared storage, "Remove data"), `newValue` is `undefined` and `inferOnboardingDismissed` throws on `stored.onboardingDismissed` (`:13`).
  - Initial load race: `getSettings().then(setSettings)` runs alongside the subscription (`popup:28-32`, `settings:25-29`). A slower `get` can overwrite a newer `onChanged` value.
  - The settings wrapper (`settings:31-36`) calls `setSettings(updated)` after the write. That can roll back a newer SW write that `onChanged` already delivered. Rely on `onChanged` only.
  - The loading state is a fixed `h-[420px]` box (`popup:53`) that then resizes to the content height, so the popup visibly jumps on every open.
  - The `setTimeout` in `handleEmergencyRefresh` (`settings:1060`) is never cleared.
- **Fix:**
  - Make storage functions reject on `lastError`.
  - Show an inline "Couldn't save. Try again" in the affected section.
  - Guard `newValue` before merging.
  - Render a skeleton with the final popup dimensions instead of the fixed-height box.

### F-17 **Time-dependent UI is not re-evaluated on a clock** — Low
- **Evidence:** The popup status (`:59-90`) and `RightNowCallout` (`:367`) compute against `Date.now()` at render time. They only refresh when storage changes. They happen to refresh at schedule boundaries only because the SW alarm flips `blockState.isBlocking` (SW 459-466).
- **Impact:** This is coupled to an SW side effect. If the alarm changes, the settings page shows stale state.
- **Fix:** Use a `useNow(60_000)` hook in components that render time-relative state.

---

## 2. Input validation

### F-2 **Custom-domain normalization is weak; uppercase entries silently never block** — High
- **Evidence:**
  - Popup `QuickAddSite`, `popup/App.tsx:354-360`: it only strips `https?://` and lowercase `www.`, then splits on `/`. It does not lowercase. It does not strip `?`, `#`, `:port`, `user@`, or `*.`. It has no duplicate check and no validity check, and it gives no success feedback after adding.
  - Settings `AddSiteInput`, `settings/App.tsx:871-887`: same normalization, and its duplicate check is case-sensitive.
  - Matching (`service-worker.ts:113-117`) compares against `URL.hostname`, which is always lowercase. So `Reddit.com`, `WWW.reddit.com`, `reddit.com?ref=x`, and `localhost:3000` are saved but never match anything.
  - A space inside the input (`red dit.com`) or a bare word (`reddit`) is accepted.
  - The popup allows duplicates, and then the settings list renders `key={site}` (`settings:187`), giving duplicate React keys. Removing one entry filters by value (`:195`) and removes every copy.
  - Adding a site that is already in a category (or disabled inside one) is accepted with no hint.
- **Persona impact:**
  - Self-aware quitter: pastes a URL from the address bar, and nothing happens on the site.
  - ADHD user: gets no confirmation in the popup that the add worked.
- **Fix:**
  - Add one shared `normalizeDomain(input)`. Try `new URL(input.includes('://') ? input : 'https://' + input)`, take `hostname.toLowerCase()`, strip `www.`, and require a dot plus a valid label regex.
  - Reject duplicates across custom sites and category sites.
  - Show the normalized value before saving ("Will block reddit.com and its subdomains").
  - Show a one-line confirmation in the popup ("reddit.com added").

### F-18 **Schedule editor accepts schedules that can never fire** — Medium
- **Evidence:**
  - start == end: `isTimeInRange` returns `cur >= s && cur < s`, which is always false (`schedule.ts:31-36`). The UI accepts it (`settings:498-513`, `:701-716`) and shows the schedule as on.
  - Cleared time input: Chrome lets you clear `<input type=time>`, and `onChange` then yields `''`. `parseTime('')` gives NaN, so the schedule never fires, and `formatTime` renders "12:NaN AM" (`settings:450-455`).
  - Zero days: Save and Add aren't blocked. `formatDays([])` returns `''`, so the card reads "• 9:00 AM - 5:00 PM".
  - Empty name on edit: the Save button (`:527-531`) has no check. Only Add checks the name (`:644`).
  - Days are stored in click order, so the label can read "Fri, Mon".
  - Overnight ranges work in the logic (`schedule.ts:55-75`), but the UI gives no "(next day)" hint.
  - The "Always on" template is 00:00–23:59 with an exclusive end (`types.ts:154-155`), so blocking lapses for one minute every night.
- **Persona impact:** ADHD user: a schedule that looks on but never fires is the worst kind of silent failure.
- **Fix:**
  - Add a shared `validateSchedule` that requires ≥1 day, non-empty start and end, start ≠ end, and a non-empty trimmed name. Disable Save and show the reason inline.
  - Sort days by week order.
  - Show "ends 6:00 AM next day" for overnight ranges.
  - Model "Always on" as a flag, or make the end inclusive.

### F-10 **Bypass bounds: UI-only clamps, so the budget can go negative and the meter renders full** — Medium
- **Evidence:**
  - The steppers clamp to 1–10 and 1–30 (`settings:969-990`), which is good: no 0 or negative values from the UI. Nothing re-validates on read, though (`storage.ts:21-50`).
  - Lowering the daily limit below today's usage (used 3, set to 1) gives `bypassesRemaining = -2`, both in the popup (`popup:93`) and in settings (`settings:1019`).
  - The popup then shows "-2/1". Its red highlight checks only `=== 0` (`popup:305`), so it doesn't fire, and `parseInt` picks the plural label.
  - The settings bar style is `width: -200%`. That is invalid CSS, so the browser drops it, the width falls back to `auto`, and **the bar renders 100% full** (`settings:1080-1083`).
  - The stepper value has no live region and no label association, so screen readers don't hear changes.
- **Fix:**
  - Clamp `remaining = max(0, max - used)` in one shared helper.
  - Clamp `maxBypasses` and `bypassDurationMinutes` in `mergeWithDefaults`.
  - Consider not letting the limit drop below today's usage, or explain that the new limit applies tomorrow.

---

## 3. Accessibility (rubric: PRODUCT.md:114-133, WCAG 2.1 AA)

### F-8 **Interactive controls without accessible names or states** — High
- **Evidence:**
  - `Toggle` (`settings:398-415`) has `role="switch"` and `aria-checked`, which is good. It has no `aria-label` or `aria-labelledby`, so all 8+ switches (`:552`, `:797`, `:1002`) announce as "switch, on" with no name.
  - Per-site checkbox (`settings:842-852`): a plain `<button>` with no `role="checkbox"`, no `aria-checked`, and no name.
  - Day buttons (`:473-490`, `:677-694`): the names are "M", "T", "W", "T", "F", "S", "S", which is ambiguous, and they have no `aria-pressed`. Full names already exist in `DAYS[].label` and go unused.
  - Stepper −/+ (`:931-947`): named by glyphs "−" and "+", with no `aria-label` and no link to "Daily bypass limit". Changes aren't announced.
  - Custom-site remove ✕ (`:191-201`): no name.
  - Popup settings gear (`popup:138-143`): an icon-only button with no name.
  - Popup Check and ✕ buttons (`:381-395`) rely on `title` only.
  - Quick-add input (`popup:369-380`), schedule name inputs (`settings:460-466`, `:664-671`), and custom-site input (`:892-902`): placeholder only, no label.
  - Time inputs are captioned by a `<p>`, not a `<label htmlFor>` (`:497`, `:506`, `:700`, `:709`).
  - Tabs (`settings:61-86`): no `role=tablist/tab/tabpanel` and no `aria-selected`.
  - "Show sites" (`:805-816`): no `aria-expanded` or `aria-controls`.
  - Pause menu (`popup:230-259`): no `aria-expanded`/`aria-haspopup`, no Escape, no click-outside close, and no focus move into the menu.
  - Popup logo `alt="Sordino"` next to an `h1` "Sordino" makes screen readers say the name twice; use `alt=""`.
- **Missing spec requirements:**
  - PRODUCT.md:131 says "status changes announced via `aria-live="polite"`". No `aria-live` exists anywhere in the popup or settings.
  - The `AddSiteInput` error (`:911`) and refresh result (`:1115`) aren't live and aren't tied to the input with `aria-describedby`/`aria-invalid`.
- **Persona impact:** Screen-reader and keyboard users across all personas. This also fails the spec's own "full keyboard navigation, no focus traps" floor.
- **Fix:**
  - Give `Toggle`, `Checkbox`, `DayButton`, and `Stepper` a required `label` prop.
  - Use native `<input type=checkbox>` for per-site selection.
  - Add `<label>`s to every input.
  - Add tab roles to the tab strip.
  - Wrap the popup status and settings callout in `aria-live="polite"`.
  - Rebuild the pause menu as a disclosure with Escape handling and focus return.

### F-9 **Collapsed category lists stay focusable and readable by screen readers** — High
- **Evidence:** `settings/App.tsx:820-862` collapses the list with `grid-rows-[0fr]` plus `overflow-hidden`. The checkboxes inside stay in the tab order and the accessibility tree. Disabled categories start collapsed (`:773`), so Tab moves through about 5 invisible checkboxes per collapsed category. Toggling one invisibly changes which sites are blocked.
- **Impact:** Keyboard users lose focus off-screen and can change settings they can't see. That breaks DESIGN.md's rule that state which can't be seen with the keyboard is broken state.
- **Fix:** When collapsed, add the `inert` attribute (or `hidden`) to the inner container, and pair it with `aria-expanded` on the trigger.

### F-19 **Muted-text and non-text contrast failures** — High
Computed from the `index.css` HSL tokens, alpha-composited over Stagewood (`hsl(24 10% 10%)`) or the `bg-secondary/30` card.

| Usage | Example | Ratio | AA needs |
|---|---|---|---|
| `text-muted-foreground` on page | most captions | 4.59 | 4.5 (passes, barely; DESIGN.md says 4.7) |
| muted on `bg-secondary/30` card | schedule subtitles `settings:555` | 4.22 | 4.5 (fails) |
| muted on `bg-secondary/50` | popup StatCard labels `popup:339` | 3.96 | 4.5 (fails) |
| muted placeholder on `bg-secondary` input | `popup:378`, `settings:901` | 3.31 | 4.5 (fails; placeholder is the only label) |
| `muted-foreground/70` | footer `settings:258`, popup site-count `popup:215`, "Resets at midnight" `popup:341` (10px) | 2.92 (2.45 on the active card) | fails |
| `muted-foreground/60` | "Template" tag `:598`, rank numbers `:1337` | 2.48 | fails |
| `muted-foreground/50` | privacy line `:303` | 2.10 | fails |
| muted on the active status card (`bg-primary/15`) | popup subtext `:213` | 3.49 | fails |
| Disabled schedule/category cards `opacity-60` (`:547`, `:792`) | subtitle text | 2.48 | fails (these are toggleable content, not inactive UI) |
| `text-destructive` | validation error `:911`, popup "0/3" `:335` | 3.43 / 2.75 on the tinted card | fails |
| Toggle-off track `bg-secondary` vs card (WCAG 1.4.11 non-text) | `:406` | 1.27 | 3.0 (fails; the "off" state is effectively invisible) |

- **Impact:** Low-vision users of every persona. PRODUCT.md:119 makes AA a floor.
- **Fix:**
  - Raise `--color-muted-foreground` to about `hsl(30 15% 58%)`, which reaches about 5.6:1 on the page and about 4.8:1 on cards.
  - Ban `/50`–`/70` alpha on text.
  - Give the off toggle a 1px `border-muted-foreground` outline.
  - Lighten `--color-destructive` for text use, to about `hsl(0 70% 62%)`.
  - Stop dimming whole cards for off state. Dim only the toggle and leave the text at full color.

### F-14 **Global `h1–h6 { font-family: Cormorant }` makes the 14px uppercase labels serif** — Medium
- **Evidence:** `src/index.css:57-59` applies Cormorant to every heading. `settings/App.tsx:151` and `:180` render "Categories" and "Custom Sites" as `h3 text-sm uppercase`, so they come out in 14px Cormorant small caps (screenshot `08-settings-blocked-sites.png`). Section `h2`s are `text-xl` (20px, `:98`, `:147`, `:220`, `:228`). The popup `h1` wordmark is `text-lg` (18px, `popup:136`). StatCard numerals are `font-serif text-xl` (20px, `popup:334`).
- **Rule:** DESIGN.md §3 sets "The 24px Cormorant Rule… form labels are DM Sans, full stop" and says the Label role is DM Sans. (DESIGN.md's own Headline token is 1.25rem, which contradicts its 24px rule. Resolve that in the spec.)
- **Fix:**
  - Drop the global heading font rule and apply `font-serif` only where it's intentional.
  - Make the `h3` labels `font-sans text-xs tracking-[0.08em]`.
  - Either raise the wordmark and section headings to 24px or amend the rule.

### F-20 **Motion: transitions aren't gated and include layout motion; no `color-scheme`** — Medium
- **Evidence:** Only `animate-pulse` and `animate-spin` are `motion-safe:` gated. These run regardless of `prefers-reduced-motion`:
  - The `Toggle` knob translate (`:410`).
  - The chevron rotate (`:812`).
  - The `grid-template-rows` height animation (`:822`). That is layout motion, which DESIGN.md §4's No-Layout-Motion Rule forbids.
  - `transition-all duration-300` on the bypass bar width (`:1081`), also layout.
  - Tab `transition-all` (`:65`).
- **Also:** The pulsing green dot on "Blocking active" (`popup:196`) is an infinite ambient pulse, which PRODUCT.md:187 lists as a wellness-drift signal ("Any pulse animation framed as a calming gesture"). DESIGN.md §5.9 explicitly sanctions it, so the spec contradicts itself here.
- **Theming:** `:root` has no `color-scheme: dark` (it's absent from the built CSS), so native time pickers, scrollbars outside `::-webkit-scrollbar` (Firefox), and form controls render with light-scheme UA styling.
- **Dark and light mode:** The product is dark-only by design, which is acceptable as a brand choice. There is no `prefers-color-scheme` handling, so say "dark only" explicitly in the store listing.
- **Fix:**
  - Add a global `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { transition-duration: 0s !important; animation: none !important } }`.
  - Replace the grid-rows and width transitions with opacity or `transform: scaleX` with `origin-left`.
  - Add `:root { color-scheme: dark }`.

### F-21 **Heading structure and landmarks** — Low
- **Evidence:**
  - There is no `<main>`/`<nav>`. Each tab panel is just a set of `<section>`s.
  - The tab content swaps without moving focus or announcing anything.
  - The settings page `<title>` stays "Sordino Settings" on the Usage tab, and the tab isn't deep-linkable through a hash (`settings:23`).
  - Popup "TODAY" is a `<p>`, not a heading.
- **Fix:**
  - Add `<main>`.
  - Sync `activeTab` with `location.hash`, so the popup can link straight to `#usage`.
  - Update `document.title` per tab.

---

## 4. Usage tab: mirror or scoreboard?

### F-3 **Two definitions of "block" on one screen; per-site counts inflate while the overlay sits open** — High
- **Evidence:**
  - The total `stats.blocksTriggered` (popup "distractions caught", Usage "Blocks") counts once per hostname per `chrome.storage.session` lifetime (SW 285-304). It resets on browser restart (it's session storage) and after any bypass (`removeCountedBlock`, SW 332). So the number depends on how often the browser restarts, not on behavior.
  - The per-site `siteStats[host].blocks` (Usage "Most Blocked") increments on every `GET_BLOCK_STATUS` (SW 289-297). The content script sends one on load, on every `visibilitychange`, and every 30 s while blocked (`content.ts:866-874`). One reddit tab left on the overlay for an hour adds about 120 "blocks" to reddit.
  - The pre-sweep screenshot (`11-usage-full-page.png`) illustrates the mismatch: "56 Blocks" this week, but the Most Blocked list sums to 78.
- **Persona impact:**
  - Self-aware quitter (who wants evidence): the numbers contradict each other, and the mirror reads as a funhouse mirror.
  - Ambient-mindfulness maker: "noticing patterns" requires believable counts. PRODUCT.md:39-43 sets that as the success metric.
- **Fix:**
  - Define a block as "an overlay shown for a new navigation to a blocked site" and count it once, in the content script, when `showOverlay` first renders for a page load. Don't count it in the polling path.
  - Use one counter for both the total and per-site.
  - Document the definition in "How Sordino works".

### F-4 **Week rollover contaminates Top Sites; the Usage tab has no memory past this week** — High
- **Evidence:**
  - `checkBypassReset` (SW 174-198) first resets `weeklyStats` for the new week, then appends the previous day (Sunday) to `days` and merges Sunday's `siteStats` into the new week. The chart filters by date, so Sunday drops out there, but Top Sites (`settings:1266-1293`) shows last Sunday's sites as "this week".
  - All history is discarded every Monday. On Monday morning the tab is empty apart from that contamination.
  - Days with no activity aren't archived (SW 190), which is fine, but the browser being closed and activity being zero look the same.
- **Persona impact:** PRODUCT.md:39 says "a user one month in opens the Usage tab and feels 'I'm in dialogue with my own behavior'". With seven days of rolling memory, that can't happen. "Tuesdays are bad" requires several Tuesdays.
- **Fix:**
  - Keep a per-day log (date → per-site blocks and bypasses) for 8–12 weeks. That's a few KB.
  - Render "This week" and "Last 4 weeks" as raw counts, which is allowed under the Raw-Counts-Only rule.
  - Do the week reset after archiving into the correct week bucket.

### F-11 **Scoreboard and threat patterns that break Principles 2 and 4** — Medium
- **Evidence:**
  - The bypass budget **progress bar** (`settings:1079-1084`). PRODUCT.md:95-96 says, word for word: "Never use … progress bars that imply 'winning.'" A draining fuel gauge is a scoreboard.
  - The popup "0/3 bypasses remaining" card turns **Lacquer Red** (`popup:331-336`). That's a threat signal ("Only 1 bypass left!" is the listed anti-example, PRODUCT.md:105-106). It also breaks DESIGN.md §2, which reserves red for "Delete-confirm states, validation errors."
  - "Bypasses refreshed! Use wisely." (`settings:1052`): celebration plus moralizing in one string.
  - The Usage tab puts brass on the Blocks numeral (`:1181`), the legend (`:1206`), the bars (`:1232`), the Top Sites counts (`:1340`), the budget numeral (`:1075`), the bar (`:1081`), and a Primary "Refresh" button (`:1107`). That breaks the 10% Brass Rule and "never more than one Primary per viewport".
  - The ranked "1. 2. 3." Most Blocked list with proportional bars reads like a leaderboard. DESIGN.md §5.13 sanctions it, but consider dropping the rank numerals.
- **Fix:**
  - Replace the bar with the plain sentence "2 of 3 left today. Resets at midnight."
  - Drop the red highlight and keep the zero state neutral.
  - Change the message to "Bypasses reset."
  - Demote Refresh to a Secondary button.
  - Use brass for exactly one datum per view.

### F-22 **Chart correctness and empty states** — Medium
- **Evidence:**
  - Future days are filtered out (`settings:1216`), so the x-axis grows through the week. On Monday a single `flex-1` column fills the whole card. DESIGN.md wants Mon–Sun columns.
  - A zero day draws nothing at all, with no baseline tick and no "0". DESIGN.md §6 says "Muted zeros read as broken; a written sentence reads as an answer."
  - An all-zero week shows "0 / 0 / 0" summary cards over an empty chart box with no sentence. Only Top Sites has an empty-state sentence (`:1309-1314`).
  - The chart has no text alternative, such as a visually hidden table or `aria-label` per column, and the counts appear only when > 0.
  - `isToday` keys off `settings.stats.date` (`:1143`), not the real date. If the settings page renders before the SW rolls over at midnight, "today" is yesterday's column.
  - The "Refreshes" summary card (`:1188-1193`) gives emergency refreshes the same weight as blocks and bypasses, so a crisis counter is promoted to a headline stat.
- **Fix:**
  - Always render 7 columns, with muted placeholders for future days and a 1px baseline for zero days.
  - Add a one-line empty state: "Nothing to show yet this week".
  - Add an sr-only `<table>`.
  - Move "Refreshes" into the budget section as a sentence.

---

## 5. Copy audit (brand voice: quiet, literate, peer-not-parent)

| String | Location | Problem | Suggested |
|---|---|---|---|
| "Bypasses refreshed! Use wisely." | `settings/App.tsx:1052` | Celebration plus moralizing (Principle 4) | "Bypasses reset." |
| "Emergency Refresh" / "Emergency refresh already used today" | `:1094`, `:1045` | Crisis and alarm vocabulary; quietly frames the user as failing | "Reset bypasses" / "Already reset today" |
| "Resets your daily bypass count. Once per day, available at midnight." | `:1097` | Contradicts itself when it's available now | "Resets today's count. Once a day." |
| "distraction caught" / "distractions caught" | `popup/App.tsx:293-294` | Policing, scoreboard framing (the user is the culprit) | "pause" / "pauses" or "times muted" |
| "Blocking active" / "Blocking inactive" / "Blocking disabled" / "Manual override" / "Manual block enabled" | `popup:65-85` | Control-panel / IT vocabulary; DESIGN.md wants "a quiet status line" | "Muting until 5:00 PM" / "Not muting right now" / "On until you stop it" |
| "Start Blocking", "Resume Blocking", "Add Schedule", "Daily Bypasses", "Emergency Refresh", "Most Blocked", "Daily Activity", "Bypass Settings", "Blocked Sites", "This Week", "Top Sites", "Bypass Budget" | `popup:269,279`; `settings:742,1070,1094,1321,1201,220,147,228,238,233` | Title Case breaks DESIGN.md §3's "Sentence case". Inconsistent with "Add schedule" (`:755`) and "Add site" | Sentence case everywhere |
| "Blocked Sites" / "Most Blocked" | `:147`, `:1321` | Hard-blocker lexicon (anti-reference: Cold Turkey/BlockSite) | "Muted sites" / "Most paused" |
| "Template schedules can be toggled on/off. Create custom schedules for full control." | `:100` | Generic SaaS help-text voice | Delete, or "Presets can't be edited. Add your own below." |
| "This matches the "X" template. Consider using that instead." | `:637` | Mildly parental | "Same as X, which is already in the list." |
| "Sordino blocks distracting sites softly. The overlay always offers a bypass; the bypass is the product." | `:262` | Copies PRODUCT.md's internal rhetoric into the UI. PRODUCT.md:230-232 says product copy must not do this | "Sordino puts a pause in front of sites you pick. You can always go through." |
| "Scaffolding mode" | `:997` | Internal persona jargon used as a user-facing label | "Confirm before bypassing" |
| "quick bypasses" vs "bypasses" | `popup:158` vs elsewhere | Inconsistent term | Pick one |
| "Please enter a site" | `:875` | Generic form copy | "Type a site, like reddit.com" |
| Musical SVG divider (one instance, between Schedules and Sites only) | `:143`, `:315-360` | A second literary signifier next to the serif headings and wordmark (PRODUCT.md:200-205 "two is cosplay"), and it isn't used consistently between sections | Remove, or use it once deliberately |
| Pulsing green dot | `popup:196` | PRODUCT.md:187 flags "any pulse animation" as wellness drift | Make it static |

Good copy worth keeping: the onboarding card (`popup:158`), "Until I turn it back on", the Top Sites empty state, and "Stored on this device…". That last one only works once F-5 is fixed.

---

## 6. Missing table stakes and platform integration

### F-6 **No first-run surface: blocking starts silently** — High
- **Evidence:**
  - `chrome.runtime.onInstalled` (SW 488-505) only updates state. It doesn't check `reason === 'install'` and doesn't open a tab.
  - The defaults turn on "Work hours" Mon–Fri 9–5 and the Social and Video categories (`types.ts:81-133`). Social includes `linkedin.com`, so a user who installs during work hours is blocked from YouTube and LinkedIn with no introduction.
  - The only explanation is the popup onboarding card (`popup:147-177`). In Chrome the toolbar icon is hidden behind the puzzle menu until the user pins it, so many users first meet Sordino through the overlay.
- **Persona impact:**
  - ADHD user: DESIGN.md's Scaffolding-First Rule ("current state, next action, exit route") is not met on day one.
  - Self-aware quitter: being blocked without consent is the "hostile tool" experience they came here to escape.
- **Fix:**
  - On `install`, open `settings.html#welcome`. It should state what's on now ("Muting Social and Video, weekdays 9–5"), offer one-tap edits, and include a "Pin Sordino to your toolbar" hint.
  - Consider defaulting all schedules off until the user confirms.
  - Reconsider LinkedIn as a default.

### F-7 **No `options_ui`; settings can only be reached through the unlabeled popup gear** — High
- **Evidence:**
  - Neither `public/manifest.json` nor `public/manifest.firefox.json` declares `options_ui` or `options_page`. Chrome's "Extension options" and Firefox's about:addons "Preferences" are both missing.
  - The popup opens settings with `chrome.tabs.create` (`popup:119-121`), which spawns a new tab each time. Several stale settings tabs pile up, which also makes F-12 more likely.
- **Fix:**
  - Add `"options_ui": { "page": "settings.html", "open_in_tab": true }` to both manifests.
  - Replace `tabs.create` with `chrome.runtime.openOptionsPage()`, which focuses an existing tab.
  - Label the gear.

### F-23 **Missing features users will expect** — Medium
- **Import/export:** None. A JSON download/upload in settings fits "privacy as posture" because the user owns the file.
- **Sync across devices:** Storage is `chrome.storage.local` only (`storage.ts:54,67`). `storage.sync` would carry config (not stats) between devices, but it sends data through the browser vendor's account. That conflicts with PRODUCT.md:109's "zero data leaves the machine" invariant. If you add it, make it opt-in with explicit copy. Otherwise, import/export is the answer.
- **Allowlist and path rules:** Matching is hostname plus subdomains only (SW 106, 115). You can't allow `youtube.com/watch?v=<tutorial>` or mute only `youtube.com/shorts` or `reddit.com/r/all`. These are common requests in this category.
- **Per-site or per-category schedules:** All enabled schedules apply to all enabled sites (`schedule.ts:124-150`). "News only in the evening" can't be expressed.
- **Category editing:** You can't add or remove sites inside a category, only disable them (`settings:829-855`). You can't create custom categories. Template schedules can't be edited or removed (`types.ts:209`), so three disabled templates permanently take up the top of the page.
- **Uninstall survey:** There's no `chrome.runtime.setUninstallURL`. Given the privacy posture, this is defensible. If you add one, make it a static page with no tracking.
- **Badge:** It shows a hard-coded `'5m'` (SW 73) whatever `bypassDurationMinutes` is set to.

---

## 7. Dependency and bundle hygiene

### F-24 **Runtime libraries are in devDependencies; some dependencies are unused** — Low
- **Evidence:**
  - `package.json` puts `lucide-react` (`popup:7`, `settings:7`), `clsx`, and `tailwind-merge` (`shared/utils.ts:1-2`) under `devDependencies`, but they ship in the bundle. This is harmless for Vite, but misleading for anyone auditing the runtime surface, as reviewers of the store submission do.
  - `class-variance-authority` is not imported anywhere.
  - `autoprefixer` is unused, since `postcss.config.js` lists only `@tailwindcss/postcss`.
  - `tailwind-merge` mostly does work `clsx` alone would cover. The `cn()` calls are conditional class lists without conflicting utilities.
- **Fix:** Move the runtime libraries to `dependencies`. Remove `class-variance-authority` and `autoprefixer`. Consider replacing `cn` with plain `clsx`.

### F-25 **Bundle weight for a 340px popup** — Low
- **Evidence:** `dist/chrome/chunks/index-*.js` is 222 KB minified (about 70 KB gzip): React 19 plus ReactDOM plus the shared libraries. On top of that come `popup.js` (11 KB) and the CSS (35 KB, 6.5 KB gzip). It all loads from local disk, so the real cost is parse and execute time, about 10–20 ms on mid-range hardware. That's noticeable but not severe.
- **Bigger cold-open costs:**
  - The Google Fonts `@import` (F-5) blocks popup rendering on a network round-trip.
  - The full-viewport `feTurbulence` SVG texture layers at 2% opacity (`popup:130`, `settings:49`) cost paint time and are close to invisible. Principle 3 says "when in doubt, remove".
- **Fix:**
  - Bundle the fonts locally with `@fontsource/*` (also fixes F-5).
  - Remove the noise overlays.
  - Optionally alias `react`/`react-dom` to `preact/compat` (about 10 KB), or keep React and accept the size.

### F-5 **Google Fonts are fetched from extension pages, but the UI says "Nothing leaves your browser"** — High
- **Evidence:**
  - `src/index.css:1` `@import url('https://fonts.googleapis.com/css2?...')`. It's present in the built `dist/chrome/assets/index-*.css`.
  - The CSP (`manifest.json:7`) restricts only `script-src`, so the request goes out every time the popup or settings opens.
  - That sends the user's IP address and the "this person uses Sordino, now" timing to Google, while the footer says "Stored on this device. Nothing leaves your browser." (`settings:303`).
  - PRODUCT.md:109-112: "Zero data leaves the machine, this is invariant."
  - Offline, the UI falls back to Georgia and system sans, so the brand typography is also unreliable.
- **Persona impact:** All personas. Privacy is a stated posture, and this is a factual misstatement in the UI.
- **Fix:**
  - Self-host the WOFF2 files (`@fontsource/cormorant-garamond`, `@fontsource/dm-sans`, subset to the weights actually used).
  - Add `style-src 'self'` and `font-src 'self'` to the CSP so this can't regress.

---

## Suggested order of work
1. F-1 (override state machine), F-2 (domain normalization), F-5 (self-host fonts).
2. F-3 and F-4 (one definition of a block, durable history), so the Usage tab can work as the mirror PRODUCT.md promises.
3. F-6 and F-7 (install surface, `options_ui`).
4. The accessibility pass (F-8, F-9, F-19, F-20), done mostly by extracting shared `Toggle`, `Checkbox`, `Stepper`, `DayPicker`, and `Field` primitives during the F-15 split.
5. F-12 (split storage keys, single writer).
6. Copy pass (section 5), then F-10, F-11, F-18, F-22, and hygiene.
