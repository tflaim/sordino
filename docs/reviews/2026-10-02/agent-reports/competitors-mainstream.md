# Sordino vs. mainstream blockers: what they can do

Research date: 2026-10-02. Scope: mainstream blockers and the blocking features built into platforms. Mindful-friction tools (one sec, Intention, ScreenZen and similar) are out of scope here. They come up only where they affect the differentiation claims.

## Method and how much to trust each claim

**WebFetch was blocked by the egress proxy** for every domain tried: proginosko.com, chromewebstore.google.com, addons.mozilla.org, extpose.com and wikipedia.org. As a result:

- **[SRC]** means I confirmed it from primary source code. This applies to LeechBlock NG, which I cloned (`github.com/proginosko/LeechBlockNG` HEAD at 27 Sep 2026, v1.8, and `LeechBlockNG-chrome` v1.7.3). I read `manifest.json`, `options.html`, `VERSIONS.md` and the lockdown, override and stats pages. It also applies to Sordino's own source.
- **[R: URL]** means a search engine reported it with that URL as the source. I read the search summary, not the page. Treat these as likely but not checked directly. **Spot-check before quoting externally.**
- **[U]** means unverified, sources conflict, or it comes from my background knowledge.

Store numbers come mostly from chrome-stats.com snapshots shown in search results, so they lag by weeks.

## Sordino baseline (from source)

Checked against `src/shared/types.ts`, `src/shared/schedule.ts`, `src/background/service-worker.ts`, `src/content/content.ts` and the manifests. All **[SRC]**:

- **Matching:** hostname equality or `endsWith('.'+site)`, with `www.` stripped. It has no path, keyword, wildcard, regex or exception rules, and no allowlist mode.
- **Lists:** 3 category presets: Social (8 sites, on), Video (6, on) and News (5, off). Categories can be toggled and individual sites disabled within them. Custom domains are supported.
- **Schedules:** 4 templates (Work hours 9–17 Mon–Fri, Extended, Evenings, Always on) plus custom ones. Each has a day set and a start/end time. Overnight spans are handled correctly: the morning part of a span counts against the previous day.
- **Escape hatches:** a daily bypass budget, by default 3 bypasses of 5 minutes. The count is configurable from 1 to 10 and the length from 1 to 30 minutes. One "emergency refresh" of the budget is allowed per day. Pause options are 15 minutes, 1 hour or until tomorrow, plus a manual on/off override. `scaffoldingMode` is an opt-in second-click confirm.
- **Bypass scope:** only one site can be bypassed at a time, because there is a single `activeBypass` object.
- **Overlay:** a content script at `document_start` waits for DOMContentLoaded, asks the service worker for status, then injects a full-page overlay with a "Go back" primary action. That causes **two technical issues**:
  - The page can render briefly before the overlay appears. There is a DOMContentLoaded wait plus an async message round trip.
  - Media under the overlay is never paused or muted (no `pause()` or mute calls), so autoplaying video or audio can keep playing.
- **Toasts and badge:** countdown toasts appear before a bypass or pause expires, and the toolbar badge shows state.
- **Stats:** daily and current-week counts of blocks and bypasses, overall and per site. **History resets each Monday.** There is no time-on-site tracking.
- **Not present:** incognito or private-window detection; Firefox does not run extensions in private windows by default **[U]**. Also no import/export, keyboard shortcuts, context-menu "add site", sync, accounts or network calls.
- **Platform:** MV3 on Chrome and Firefox (Firefox ≥140). Chrome permissions are `storage`, `activeTab`, `alarms` and `<all_urls>`. No DNR.
- **Distribution:** the Chrome Web Store listing is "in review", so there are no ratings yet. The AMO listing is live.

---

## 1. Competitor profiles

### 1.1 LeechBlock NG (James Anderson, MPL-2.0, free, donations)

This is the most capable free blocker and the closest open-source peer. All items are **[SRC]** from options.html and VERSIONS.md unless marked.

**Blocking granularity**
- Each **block set** has its own name, sites, times and method. The number of sets is configurable.
- Site syntax: `*` and `**` wildcards, `+` for exceptions (allowlist entries), `>` for referrer conditions and `~` for keywords.
- Separate **regular expressions** for blocking URLs, allowing URLs and matching keywords, with a "Generate From Site List" button.
- "Treat keywords as allow-conditions" and "Treat referrers as allow-conditions" options.
- "Check for keywords only in page title" (1.6.9) and regex keywords (1.7.2).
- "Block all subdomains (not just www)" and "Ignore fragment (hash part)".
- "Load list of sites from URL" pulls a remote blocklist.
- "Block only first accessed page of block set", "Block pages in only active or only inactive tabs", and "Block pages in both / only non-private / only private tabs".

**Time modes**
- Time periods, a time limit of "N minutes in every [5 minutes … 3 months]", or both. The two combine with OR or AND.
- "Roll over unused time" and "Offset time limit period by N hours".
- Time counting can be limited to the active tab, or to tabs playing audio. Time on exception sites can also be counted (1.8).
- "Ignore jumps in time spent" handles sleep.
- "Always block sites for at least N minutes" (1.7.2).

**How it blocks**
- Shows the Default page, **Delaying page** (a countdown of N seconds, optionally auto-loading the page or cancelling if the tab loses focus), Password page, Blank page, or any custom URL as a **redirect-to-productive-site** target.
- Or it applies a **filter instead of blocking**: blur 1–32px, fade 80/90/100%, grayscale, invert, sepia, or custom CSS. A "Mute tab with filter" option goes with it.
- Or it closes the tab.
- "Allow access to sites for only N minutes after delaying/password page is used".
- "Enter a custom message for the blocking page", which is shown as **"A message from yourself"** (delayed.html).
- Custom CSS for the blocking and delaying pages, and themes (Default, Light, Spruce).

**Lockdown** (lockdown.html): immediately block the chosen block sets for N hours and minutes. It can be cancelled from the options page unless options are locked.

**Temporary override** (override.html)
- "Allow blocking to be suspended for N minute(s)" and **"Allow no more than N override(s) every [period]"**. This is an override budget, conceptually close to Sordino's bypass budget.
- Can require a password, a random 32, 64 or 128-character code, or a predefined code.
- Per-set opt-in, and can be allowed during lockdown.

**Locking and anti-tamper**
- Options can be protected by a password or a random 32, 64 or 128-character access code. "Display access code as image" and "Prevent pasting passwords from the clipboard" (1.8) make this harder to get around.
- Options can be blocked during set periods.
- Per set, you can prevent access to that set's options, to General options, and to about:addons, about:support, about:profiles and about:debugging while blocked. That covers the Firefox uninstall and debug routes.
- Escape hatches have been explicitly closed: "Closed some escape hatches" (1.6.8.2).

**Other features**
- Countdown timer overlay on the page with size and corner options, plus a badge timer and a warning message N seconds before a block.
- Stats page per block set: time since start, per week, per day, time left, rollover, and lockdown end.
- Export and import as text or JSON (optionally including passwords) and to or from `storage.sync`, with an auto-backup option. Sync is marked "experimental: use at your own risk".
- Keyboard shortcuts for options, stats, lockdown, override, cancel override, add sites, reset rollover and discard time (1.6.7).
- Context menu "Add Site/Page to Block Set". Simplified vs full options views (1.6.4).
- **Managed storage support** (1.7.3, Aug 2026) is the deployment path for enterprises and schools.

**Technical**
- MV3 on both browsers.
- Chrome uses a `service_worker`. Firefox uses `background.scripts`.
- Content script at `document_start` plus the `tabs` and `webNavigation` permissions. There are **0 references to declarativeNetRequest** in the Chrome background.js.
- Chrome manifest sets `"incognito": "split"`.
- `data_collection_permissions: none` on Firefox.
- AMO reviewers mention complaints about CPU use **[R: https://addons.mozilla.org/en-US/firefox/addon/leechblock-ng/]**.

**Reach**
- Chrome: 100,000 users and 4.88 from 1,514 ratings as of 16 Aug 2026 **[R: https://chrome-stats.com/d/blaaajhemilngeeffpbfkdjjoefldkok]**.
- Firefox: 112,877 users, 4.8 from 2,038 reviews, and the "Recommended" badge **[R: https://addons.mozilla.org/en-US/firefox/addon/leechblock-ng/]**.
- There is also an Android Firefox listing **[R: https://addons.mozilla.org/en-CA/android/addon/leechblock-ng/]**.

**Recent changes**
- v1.7 (Jun 2025): password page and custom pages.
- v1.7.1 (Sep 2025): active-tab-only blocking.
- v1.7.2 (Jan 2026): minimum block time, regex keywords, custom filter.
- v1.7.3 (Aug 2026): managed storage.
- v1.8 (27 Sep 2026): count time on exceptions and the no-paste option.

No AI features **[SRC]**.

### 1.2 StayFocusd (Sensor Tower, Chrome only)

- **Max Time Allowed:** a daily budget across the blocked list, plus a Daily Reset Time. Active Days and Active Hours set when it applies **[R: https://gist.github.com/jthegedus/5f9a874da8d5d1d996676446122360c1]**, **[R: https://www.techjunkie.com/stay-focused-chrome-extension-review/]**.
- **Granularity:** "Block entire sites, specific subdomains, specific paths, specific pages, or even in-page content (videos, images, forms, etc)". It also hides YouTube Shorts, comments and recommended videos **[R: https://chromewebstore.google.com/detail/stayfocusd-%E2%80%93-website-bloc/laankejkbhbdhmipfmgcngdelahlfoji]**.
- **Allowed Sites** work as exceptions. An allowlist mode blocks everything except the list **[R: https://www.techjunkie.com/stay-focused-chrome-extension-review/]**.
- **Nuclear Option:** block all sites, all except allowed, or only the blocked list, for N hours. It cannot be cancelled **[R: https://mindfultechwork.com/stayfocusd-nuclear-option/]**.
- **Require a Challenge:** you must type a long passage before changing settings **[R: https://gist.github.com/jthegedus/5f9a874da8d5d1d996676446122360c1]**.
- **"Gen AI Analytics":** tracks your use of AI chat platforms. Version 4.6.14 shipped 10 Sep 2026 **[R: CWS listing above]**.
- **2025–26 trust event:** Secure Annex (Dec 28 2025) and later reports (May 2026) named StayFocusd and StayFree as carrying "prompt poaching" infrastructure that captures AI-chat metadata **[R: https://consumerrights.wiki/w/StayFocusd]**. This is a live reputational problem for the category and a direct opening for a local-only product.
- **Reach and price:** about 700,000 users, 4.44 from 8,739 ratings as of 24 Jul 2026 **[R: https://chrome-stats.com/d/laankejkbhbdhmipfmgcngdelahlfoji]**. Free.
- **Firefox:** no official build. The AMO "StayFocused" is a different product **[R: https://addons.mozilla.org/en-US/firefox/addon/stayfocused/]**.

### 1.3 BlockSite (BlockSite LP, freemium)

- **Features:** blocklist by URL, keyword or **category** (Adult, Social, News, Sports, Shopping, Gambling; only Adult is free) **[R: https://blocksite.zendesk.com/hc/en-us/articles/360019467377-How-to-block-website-categories-Adult-Social-etc]**, **[R: https://www.cisdem.com/resource/blocksite-review.html]**.
- Schedules, password protection of settings and blocked pages, and a **Focus Mode** (Pomodoro, 25/5) **[R: https://chrome-stats.com/d/eiimnmioipafcokbfikbljfdeojpcgbh]**.
- **Site Redirect** to a URL you choose **[R: https://tooltivity.com/extensions/blocksite]**.
- Daily usage limits **[R: chrome-stats above]**.
- **Insights:** how often you tried to open blocked sites **[R: tooltivity above]**.
- **Sync to phone:** blocklist, keywords and password sync to the iOS and Android apps **[R: https://extpose.com/ext/eiimnmioipafcokbfikbljfdeojpcgbh]**. Requires an account.
- **Free tier** is limited to about 3 sites **[R: https://www.cisdem.com/resource/blocksite-review.html]**.
- **Premium price is inconsistent across sources [U]:**
  - $3.99/mo **[R: tooltivity]**
  - $10.99/mo, $6.99/mo over 6 months, or $47.88/yr **[R: https://adapty.io/paywall-library/blocksite/]**
  - $14.99/mo, $29.99/yr, or $49.99 lifetime on other sites.
- Reviews describe uninstalling it as "challenging" **[R: cisdem]**.
- **Reach:**
  - Chrome: 1,000,000 users, 4.45 from 32,112 ratings, v7.0.1, updated 29 Mar 2026 **[R: https://chrome-stats.com/d/eiimnmioipafcokbfikbljfdeojpcgbh]**.
  - Firefox: 32,182 users, 3.7 from 1,268 reviews, with a 311 one-star tail **[R: https://addons.mozilla.org/en-US/firefox/addon/blocksite/]**.
- **Technical:** I could not determine whether it uses DNR **[U]**. I found no AI features in 2025–26 **[U, no evidence found]**.

### 1.4 Freedom (Eighty Percent Solutions), plus its "Limit" extension

- **Platforms:** cross-device sessions on Mac, Windows, iOS, Android, ChromeOS and Linux **[R: https://zapier.com/blog/stay-focused-avoid-distractions/]**.
- **Sync:** a session started on one device applies to the others. Requires an account **[R: https://rtriv.io/en/blog/freedom-app-review]**.
- **Features:** recurring schedules, preset and custom blocklists, focus music.
- **Website Exceptions** support "block all except" with domain, subdomain or path entries, but no wildcard TLDs **[R: https://support.freedom.to/en/articles/2347720-mac-website-exceptions]**, **[R: https://freedom.to/blog/better-focus-on-studying-and-work/]**.
- **Locked Mode:** you cannot end a session or edit blocklists while it runs **[R: rtriv above]**.
  - **2026 change:** "Weekly Early Exit and Daily Session Break are now simple toggles in Locked Mode, with the option to permanently remove either one". The **Session Break** is a 5-minute break mid-session **[R: https://apps.apple.com/us/app/freedom-screen-time-control/id1269788228]**.
  - In other words, the strictest mainstream blocker added a **budgeted escape hatch** in 2026, which supports Sordino's thesis.
- **Extension architecture:** on Windows and Mac the extension only shows the "green screen" and **requires the desktop app**. It is standalone only on ChromeOS and Linux **[R: https://support.freedom.to/en/articles/1347519-freedom-browser-extension]**.
- **Pricing:** free tier (basic, limited sessions), $8.99/mo, $3.33/mo billed annually, or $199 lifetime **[R: rtriv above]**. A "Freedom for Families" product also exists **[R: https://support.freedom.to/en/articles/5266497-freedom-for-families]**.
- **Reach:** Chrome extension 50,000 users, 3.32 from 92 ratings, last updated Sep 2024 **[R: https://chrome-stats.com/d/abdkjmofmjelgafcdffaimhgdgpagmop]**.
- **Recent releases:** iOS 7.16 (Sep 2026), Mac 2.26 (Aug 2026, app restart during locked sessions), and no AI features found **[R: https://support.freedom.to/en/articles/7020249-freedom-for-mac-release-notes]**.

**Limit by Freedom (the closest mainstream analog to Sordino)**
- A free, separate extension. "All data stored locally… not sent to servers".
- Per-site **daily minute budget of 5–500 minutes**. "Gently notifies you that your time is almost up", then redirects to the green screen. Comes with 10 seeded sites.
- Available for Chrome, Firefox, Edge and Opera **[R: https://support.freedom.to/en/articles/3148951-how-to-use-limit]**, **[R: https://freedom.to/blog/introducing-limit-a-free-extension-for-limiting-distracting-sites/]**.
- 60,000 users, 4.6 from 785 ratings **[R: https://chrome-stats.com/d/blcdfhbibkkjpfdddnmnmhfgjlicebba]**.
- It has **no bypass**: when the time is gone, the site is blocked until tomorrow. Its "softness" comes from a quota, not from a choice at the moment of visiting.

### 1.5 Cold Turkey Blocker (desktop app with browser extensions)

- **Granularity:** `*` wildcards anywhere in the URL, so `*unicorn*` blocks any URL containing "unicorn". "All searches containing…" blocks search keywords. "The entire internet" (`*.*`) plus **Website Exceptions** gives an allowlist mode. YouTube channel allowlisting is supported. On Windows Pro it can block by window title **[R: https://getcoldturkey.com/support/user-guide/]**, **[R: https://getcoldturkey.com/support/how-to/allow-youtube-channel/]**.
- **Breaks:**
  - **Pomodoro breaks** turn the block on and off.
  - **Allowances** are a usage quota per rolling window, per scheduled block, or per day, week or month, with a custom refill time **[R: https://getcoldturkey.com/features/]**.
- **Locks:**
  - Timed lock.
  - "Random and custom text" lock, 1–5000 characters.
  - "Restart" lock, which requires a reboot to unlock.
  - Frozen Turkey locks the whole computer **[R: getcoldturkey.com/features]**.
  - Prevents uninstall during an active block **[R: https://www.techlockdown.com/articles/cold-turkey-blocker]**.
- **Incognito:** **requires** "Allow in incognito" to be turned on in each browser. The desktop app polices this **[R: https://getcoldturkey.com/support/extensions/chrome/]**.
- **Stats:** block counts and time on sites and apps **[R: getcoldturkey.com/features]**.
- **Price [U, conflicting]:** a one-time Pro purchase listed as $39 **[R: https://www.chronoid.app/blog/cold-turkey-vs-focusme]** and as $45 **[R: https://ascensionapp.ai/cold-turkey-blocker-review]**. Free tier is website blocking only. Windows and Mac only, with no mobile version.
- **Reach:**
  - Chrome extension: 200,000 users, 4.61 from 2,321 ratings as of 11 Aug 2026 **[R: https://chrome-stats.com/d/pganeibhckoanndahmnfggfoeofncnii]**.
  - Edge: 96,611 users, 4.70.
  - Reviews say it can be bypassed by killing the app with End Task **[R: same]**.

### 1.6 Forest (browser extension, Seekrtech)

- **Mechanic:** start a timer and a tree grows. Visiting a **blacklisted** site kills it. A **whitelist** mode is also available **[R: https://www.softpedia.com/get/Internet/Internet-Applications-Addons/Chrome-Extensions/Forest-for-Chrome.shtml]**, **[R: https://eduk8.me/forest-really-cool-chrome-extension-help-teachers-students-focus/]**.
- **Focus model:** gamified, session-based focus (coins, trees) that syncs with the mobile app. This is squarely the "gamified habit-tracker" anti-reference in PRODUCT.md.
- **Reach:** 800,000 users, 3.79 from 1,418 ratings. Recent sentiment is about 3.13, driven by sync and login failures **[R: https://chrome-stats.com/d/kjacjjdnoddnpbbcjilcajfhhbdhkpgk]**.

### 1.7 Pomodoro-style blockers (Strict Workflow and BlockSite Focus Mode)

- **Strict Workflow:** a 25-minute work block and a 5-minute break, preloaded with distracting domains. **The timer cannot be stopped and the list cannot be edited during work** **[R: https://github.com/professor-k/Strict-Pomodoro]**, **[R: https://ihaveapc.com/2018/04/strict-workflow-a-pomodoro-technique-based-chrome-extension-for-working-online-without-distractions/]**.
- **Strict Workflow's status [U]:** a fork lists MV3 migration as a to-do **[R: https://github.com/i207M/Pomodoro-Improved-Strict-Workflow]**. Chrome turned off MV2 in July 2025 (Chrome 138/139) and removed remaining MV2 listings on 31 Aug 2026 **[R: https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline]**, **[R: https://chromeunboxed.com/manifest-v2-is-officially-dead-as-the-chrome-web-store-permanently-purges-legacy-extensions/]**. The original Strict Workflow is therefore probably gone from Chrome.
- **Pattern across these tools:** a focus session is an **on-demand, time-boxed block** that starts with one click, as opposed to a weekly schedule.

### 1.8 RescueTime and Rize (trackers that also block)

- **RescueTime Focus Sessions:** blocks sites you have categorized as Personal or Distracting **and visited in the last 3 months**. Works through extensions for Chrome, Firefox, Edge, Safari, Arc and Brave. Account plus cloud tracking **[R: https://help.rescuetime.com/article/38-problems-with-focus-session-site-blocking]**.
  - This is **evidence-based blocklist building**: the blocklist is derived from tracked usage.
- **Rize Distraction Blocker:** steps in only after time on a distracting site passes a **threshold**. It can show as a pop-up or as a system notification. Can apply always, during breaks, during meetings or during focus sessions. Dismissed with **"Thanks for the reminder!"** **[R: https://docs.rize.io/distraction-blocker/configure-distraction-blocker]**, **[R: https://docs.rize.io/distraction-blocker/use-distraction-blocker]**.
  - This is a **soft, dismissable nudge**, which overlaps Sordino's thesis. Rize is cloud-based and AI time tracking.

### 1.9 Platform features

- **Apple Screen Time** (iOS and macOS):
  - Per-website daily limits, set the same for every day or per weekday **[R: https://support.apple.com/en-gb/guide/mac-help/mchl630bc02f/mac]**.
  - **When a limit is reached, the default is a soft block:** "One More Minute", "Remind Me in 15 Minutes" or "Ignore Limit for Today". This only becomes a hard block with **"Block at End of Limit"** plus a passcode **[R: https://www.techlockdown.com/articles/fix-ignore-limit-screen-time]**, **[R: https://discussions.apple.com/thread/255476329]**.
  - On Mac, only Safari is covered. Chrome needs a `chrome://flags` "Screen Time" toggle **[R: https://ask.metafilter.com/372496/Does-Screen-Time-web-page-limits-work-on-a-Mac-with-Chrome-or-Edge]**, **[R: https://www.techlockdown.com/articles/screen-time-not-working]**.
- **Android Digital Wellbeing:**
  - **Site timers** for Chrome only. Warns "5 minutes left on YouTube.com", then shows "Site paused… It'll start again tomorrow" **[R: https://support.google.com/android/answer/9346420]**, **[R: https://9to5google.com/2019/09/03/how-to-digital-wellbeing-android-10-focus-mode-site-timers/]**.
  - Samsung One UI hides per-site timers **[R: https://us.community.samsung.com/t5/Galaxy-S24/How-to-use-Google-s-digital-wellbeing-app-to-limit-time-for-a/m-p/3238782]**.
- **Chrome desktop:** no consumer blocker. The enterprise `URLBlocklist` and `URLAllowlist` policies support blocking everything except up to 1,000 exceptions **[R: https://support.google.com/chrome/a/answer/7532419]**.
- **Edge:** no browser-wide focus or block mode. Users rely on Immersive Reader or Windows Focus **[R: https://www.itechguides.com/how-to-enable-edges-focus-mode-for-distraction-free-work/]**, **[R: https://techcommunity.microsoft.com/discussions/edgeinsiderdiscussions/feature-ask-implement-distraction-control-feature-in-microsoft-edge/4388971]** (a feature request).

### 1.10 Trends for 2025–26

- **MV2 shutdown:** MV2 was turned off in stable Chrome in July 2025, and remaining MV2 listings were removed from the store on 31 Aug 2026 **[R: developer.chrome.com timeline]**. Old blockers that never moved to MV3 are dead on Chrome, which leaves room for maintained MV3 tools like Sordino.
- **DNR is not dominant in this category.** LeechBlock, the leading free blocker, is MV3 without DNR **[SRC]**. Blockers that redirect to a custom page can use DNR dynamic rules with `extensionPath` redirects, which needs `declarativeNetRequestWithHostAccess` **[R: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest]**.
- **Bypass budgets are spreading** in tools that used to be strict: Freedom's Early Exit and Session Break (2026), LeechBlock's override count per period, and Apple's "One More Minute".
- **AI:**
  - Mainstream tools have not adopted AI for blocking. StayFocusd's "Gen AI Analytics" is surveillance, not blocking.
  - A crop of small AI blockers judges pages against a stated task or asks you to argue with an LLM: Focus AI (local model), Intention (bring your own key), LLM Time Blocker **[R: https://chromewebstore.google.com/detail/intention/dbeapcoomlbnpljdnblmegniiacfoeop]**, **[R: https://chromewebstore.google.com/detail/focus-ai-website-blocker/ngboiiifeoioghodfglighnahefnjbib]**.
- **Privacy:** the Sensor Tower prompt-poaching reports put extension privacy in the news **[R: consumerrights.wiki]**.

---

## 2. Gap matrix

Key: ● = yes, ◐ = partial or paid-only, ○ = no, ? = unknown. Store figures are approximate.

| Capability | **Sordino** | LeechBlock NG | StayFocusd | BlockSite | Freedom (+Limit) | Cold Turkey | Forest ext | Screen Time / DW |
|---|---|---|---|---|---|---|---|---|
| Domain + subdomain | ● | ● | ● | ● | ● | ● | ● | ● |
| Path / page rules | ○ | ● | ● | ? | ● (exceptions) | ● (wildcard) | ? | ○ |
| Keyword (URL/title) | ○ | ● (+title, regex) | ? | ● | ○ | ● (+search terms) | ○ | ○ |
| Wildcard / regex | ○ | ● / ● | ? | ○ | ○ | ● / ○ | ○ | ○ |
| Exceptions inside a blocked domain | ○ | ● (`+`) | ● | ? | ● | ● | ○ | ○ |
| Allowlist ("block all except") | ○ | ● | ● | ? | ● | ● | ● | ◐ (Downtime) |
| Category presets | ● (3) | ○ | ○ | ◐ (6, paid) | ● | ● (import lists) | ○ | ◐ (adult) |
| Schedules (days × time) | ● (+overnight) | ● (multi-period) | ● | ● | ◐ (paid) | ◐ (paid) | ○ | ● (Downtime) |
| Minutes-per-day budget per site | ○ | ● (any period) | ● (shared pool) | ● | ● (Limit) | ◐ (allowances, paid) | ○ | ● |
| Visit/open-count limit | ○ (bypass count only) | ○ | ○ | ? | ○ | ○ | ○ | ○ |
| On-demand focus session / Pomodoro | ○ (manual "on" only) | ● (lockdown) | ● (nuclear) | ● | ● | ● (Pomodoro breaks) | ● | ○ |
| **Bypass / override in the moment** | ● (budgeted, timed) | ● (override N per period) | ○ | ○ | ◐ (Session Break 2026) | ◐ (allowance) | ○ | ● (default) |
| Delay or countdown page | ○ | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| Overlay in place (page context kept) | ● | ◐ (filters) | ○ (redirect) | ○ | ○ | ○ | ○ | ○ |
| Redirect to a productive URL | ○ | ● | ? | ● | ○ | ○ | ○ | ○ |
| Password / challenge lock | ○ (by design) | ● | ● | ◐ (paid) | ◐ (Locked Mode) | ● | ○ | ● (passcode) |
| Uninstall / tamper protection | ○ (by design) | ● (about:addons) | ● (nuclear) | ? | ● (desktop) | ● | ○ | ● |
| Incognito handling | ○ | ● (per-set private-tab rule) | ? | ? | ? | ● (required) | ? | n/a |
| Cross-device sync | ○ (by design) | ◐ (`storage.sync`, experimental) | ○ | ◐ (paid, account) | ● (account) | ○ | ● (account) | ● (iCloud/Google) |
| Import / export | ○ | ● (text, JSON, sync) | ? | ? | ? | ● | ? | ○ |
| Stats | ◐ (counts, this week) | ● (time per set) | ● (time + AI analytics) | ● (attempts) | ◐ | ● (time + counts) | ● (gamified) | ● (time) |
| Time-on-site tracking | ○ | ● | ● | ? | ● (Limit) | ● | ○ | ● |
| Warning before a block or expiry | ● (toasts) | ● (warning + timer) | ? | ? | ● (Limit) | ? | ○ | ● |
| Keyboard shortcuts / context-menu add | ○ / ○ | ● / ● | ? | ? | ? | ? | ? | n/a |
| Enterprise / managed config | ○ | ● (managed storage) | ○ | ? | ● (Families/Teams) | ○ | ○ | ● |
| Mobile | ○ | ◐ (Firefox Android) | ○ | ● (apps) | ● | ○ | ● (app) | ● |
| Chrome + Firefox | ● | ● | ○ (Chrome only) | ● | ◐ (Limit: yes) | ● | ● | n/a |
| Account required | ○ | ○ | ○ | ◐ (sync) | ● | ○ | ● (sync) | ● (OS) |
| Data leaves machine | **never** | only if sync is turned on | **yes (reported)** | yes (account) | yes (Freedom), no (Limit) | ? [U] | yes | yes |
| Price | free | free | free | freemium (~3 sites free) | free tier; $8.99/mo, $199 lifetime; Limit free | free; Pro $39–45 one-time [U] | free + app IAP | free (OS) |
| Chrome users / rating | in review | 100k / 4.88 | 700k / 4.44 | 1M / 4.45 | 50k / 3.32 (Limit 60k / 4.6) | 200k / 4.61 | 800k / 3.79 | n/a |

---

## 3. Capabilities Sordino lacks, ranked

Ranking is by the likely value to Sordino's primary persona (ADHD and executive function) multiplied by fit with the brand. Each item has a brand tag, the PRODUCT.md rule it turns on, and how hard it is to build in MV3.

**1. Incognito / private-window detection and instructions: FITS BRAND.**
- **Gap:** right now a single Ctrl-Shift-N silently gets around Sordino, because Chrome leaves extensions off in Incognito by default **[R: https://www.ghostery.com/blog/enable-extensions-in-incognito]**, and Firefox reportedly does the same in private windows **[U]**. Detection API: **[R: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/extension/isAllowedIncognitoAccess]**.
- **Why it fits:** Sordino does not need to *force* this. It only needs to *tell* the user, in plain words, that private windows aren't covered and how to change that. That is peer-not-parent, Principle 4.
- **Build:** `chrome.extension.isAllowedIncognitoAccess()` / `browser.extension.isAllowedIncognitoAccess()`, then a settings line and an optional popup note. *Easy.*

**2. Paths and exceptions inside a domain: FITS BRAND.**
- **Use cases:** block youtube.com but allow `youtube.com/feed/subscriptions` or a playlist. Block reddit.com but allow `reddit.com/r/programming`. Block `linkedin.com/feed` but not messages.
- LeechBlock (`+`), Freedom exceptions, StayFocusd paths and Cold Turkey wildcards all do this. It is the most common reason people outgrow domain-only blockers.
- **Why it fits:** finer targeting means less friction where it isn't wanted. That serves Principle 1 by reducing wrong blocks.
- **Build:**
  - Content script: compare `location.pathname` with a prefix or glob.
  - SPAs (YouTube, Reddit) need navigation detection: `navigation` API / `popstate` / `history` patching in the content script, or `webNavigation.onHistoryStateUpdated`, which needs the `webNavigation` permission.
  - *Moderate.*
  - Keep the syntax simple, with prefix paths and a `+` exception. Skip regex in the UI (see #10).

**3. Import / export of settings (JSON file): FITS BRAND.**
- **What it covers:** backup, moving to a new machine, and moving between Chrome and Firefox **without** sync. A local file is consistent with Principle 5. LeechBlock offers text and JSON.
- **Build:** a Blob download plus a file input, and version and schema checks. *Easy.*

**4. Quick add from the right-click menu and keyboard shortcut: FITS BRAND.**
- "Add this site to Sordino" from the context menu, plus a `commands` shortcut to toggle pause. LeechBlock has 8 shortcuts and a context menu.
- **Build:** the `contextMenus` permission (Firefox `menus`) and a `commands` manifest key. *Easy.*

**5. Pause or mute media under the overlay and reduce the flash: FITS BRAND (a technical fix, not a feature).**
- **Problem:**
  - Competitors that redirect (DNR or tabs) never render the page.
  - Sordino renders it, so YouTube can autoplay audio behind the overlay, and there is a visible flash before DOMContentLoaded plus the message round trip.
  - LeechBlock has "Mute tab with filter".
- **Fix, keeping the in-place overlay (which is a differentiator, see section 4):**
  - (a) Inject a `<style>` that hides `html` synchronously at `document_start` while status is pending. Base it on a cached block list in `storage.session` or a sync check of local data.
  - (b) Pause and mute `video`/`audio` elements while the overlay is shown, and/or use `chrome.tabs.update({muted:true})` from the service worker.
  - *Easy to moderate.*
- **Why not DNR:** a DNR redirect would remove the overlay-in-place experience and the bypass-in-context flow. Keep the content-script architecture.

**6. Per-site daily minute budget, as a *trigger* for the overlay, not a wall: FITS WITH CARE.**
- **Precedents:** StayFocusd, Limit, LeechBlock, Screen Time and Digital Wellbeing all have this. Screen Time's default (One More Minute / Ignore for Today) shows a soft version can work at scale.
- **Brand-safe version:** "the first N minutes on reddit each day are quiet; after that, the overlay appears". The bypass stays available (Principle 1). The UI shows remaining minutes as a plain number with no meter that drains (Principle 2).
- **Risk:** "limit" and "time's up" wording slides toward a parental tone.
- **Build:**
  - Count active-tab time across a service worker that can be killed: `tabs.onActivated`, `tabs.onUpdated`, `windows.onFocusChanged` and `idle.onStateChanged` timestamps persisted to `storage.session/local`.
  - Or use a content-script heartbeat while `document.visibilityState==='visible'`.
  - The `alarms` minimum interval is 30 seconds.
  - *Moderate to hard.* Getting sleep, idle and multiple windows right is the hard part; LeechBlock needed "ignore jumps" and "treat windows as focused" options.

**7. On-demand "quiet for N minutes" session (a focus session without a schedule): FITS WITH CARE.**
- **Gap:** Sordino has manual "on" and timed *pauses*, but no "block for the next 50 minutes" that ends by itself. Every Pomodoro-style tool and LeechBlock Lockdown has this.
- **Brand-safe version:** a one-click timed **manual on** that keeps bypass available. No lock, no tomatoes, no streaks.
- **Build:** reuse `manualOverride` with an `until` timestamp and an alarm. *Easy.*
- **Skip:** "Pomodoro" branding and a break cycle with a visible timer UI, since that runs into the gamification and SaaS anti-references.

**8. Raw time-on-site in Usage: FITS WITH CARE.**
- **Precedents:** every major competitor shows time spent.
- **Constraints:** Known Tensions says "show raw counts only" and "reject derived metrics". Raw minutes per site per day is a count, so it fits. "Hours reclaimed" and "worst day" are banned.
- **Build:** shares the tracker from #6. Store daily aggregates locally only.
- **Related gap:** stats reset each Monday. Keeping several weeks locally, so a user can notice "Tuesdays are bad" as PRODUCT.md's success criterion describes, is a smaller FITS BRAND fix.

**9. Delaying page / countdown before the bypass becomes active: FITS WITH CARE.**
- **Precedent:** LeechBlock's delaying page (N seconds, cancelled if the tab loses focus) is the best-known example of "friction, not force".
- **How Sordino could use it:** as an optional setting where the bypass button becomes active after N seconds. It is close to the existing `scaffoldingMode` and could become a second scaffolding option.
- **Risk:** the countdown must not read as punishment. No ticking animation, and respect `prefers-reduced-motion`.
- **Build:** *easy.*

**10. Keyword and title matching, and regex: FITS WITH CARE (keyword) / skip regex.**
- **What it does:** keyword-in-title catches distracting pages on domains you otherwise need. LeechBlock, BlockSite and Cold Turkey all have it.
- **Risks:**
  - False positives are a big deal for a product whose voice is "trust the user".
  - Regex conflicts with "a configured instrument, not a control panel".
- **Recommendation:** offer keywords only in an "advanced" disclosure, if at all.
- **Build:** content script checks `document.title` after it settles. *Moderate.*

**11. Filter instead of overlay (blur, grayscale, fade): FITS WITH CARE.**
- **Precedent:** LeechBlock's filters.
- **Why it might fit:** a "grayscale reddit" mode is about as soft as soft-blocking gets. It may suit the ambient-mindfulness maker.
- **Risks:**
  - Blur is decoration that Principle 3 would challenge.
  - The page stays usable, so there is no "decision moment".
  - Treat it as a separate per-category "how quiet" mode, not a replacement for the overlay.
- **Build:** inject CSS `filter`. *Easy.*

**12. "A message from yourself" on the overlay: FITS WITH CARE.**
- **Precedent:** LeechBlock's custom block-page message.
- **Why it might fit:** the user's own words instead of a curated quote are very peer-not-parent.
- **Risks:**
  - It competes with the music-themed titles and quotes.
  - Must be plain text only, using the existing `ensureTextOnly`.
- **Build:** *easy.*

**13. Allowlist mode ("everything except these"): FITS WITH CARE.**
- **Precedents:** LeechBlock, StayFocusd, Freedom, Cold Turkey, Forest and Chrome's enterprise policy all support it.
- **Fit:** it can serve the ADHD-primary persona in deep-work windows. As a soft block with bypass, it fits.
- **Risks:**
  - It needs a different mental model and set of defaults.
  - Overlaying every unlisted site would be noisy.
- **Build:** *moderate.* Matching inverts. Every browser page except internal and extension pages needs a check.

**14. Redirect to a productive site: FITS WITH CARE.**
- **Precedents:** BlockSite and LeechBlock.
- **Brand-safe version:** "Go back" already exists. An optional "Go to [your chosen page]" secondary action fits. Automatic redirect does not, because it takes the choice away (Principle 1).
- **Build:** *easy.*

**15. Remote or shared blocklists, category expansion and a "seed from history" step: FITS WITH CARE.**
- **Precedents:** LeechBlock can load a list from a URL. RescueTime seeds from tracked usage. BlockSite offers six categories.
- **Constraints:**
  - Loading from a URL breaks the "no external API calls" claim in the README, so skip it.
  - Adding categories locally (Shopping, Sports, Gaming) **fits**.
  - Seeding onboarding from local `history` (an optional permission, as LeechBlock does) **fits with care**: it is local, but asking for history access feels watched.
- **Build:** *easy* (categories) / *moderate* (history).

**16. Cross-device sync: VIOLATES BRAND.**
- **Rule:** Principle 5: "Zero data leaves the machine — this is invariant… never ask for an account".
- **Applies even to `chrome.storage.sync`,** which goes through Google's servers. File import/export (#3) is the compliant alternative.

**17. Password, typing challenge or access code to change settings: VIOLATES BRAND.**
- **Precedents:** LeechBlock, StayFocusd, BlockSite and Cold Turkey.
- **Rule:** Principle 1, "Every restriction must come with a visible escape route", and the Cold Turkey/Freedom/BlockSite anti-reference.
- **Note:** `scaffoldingMode` already covers the legitimate "slow me down" need as an opt-in.

**18. Lockdown / Nuclear Option / Locked Mode / uninstall protection / Frozen Turkey: VIOLATES BRAND.**
- **Rule:** Principle 1, "If the user cannot choose to bypass, we have built the wrong product".
- **Also impractical:** an MV3 extension cannot block its own uninstall without OS-level help or enterprise policy.

**19. Gamified focus (Forest trees, coins, streaks) and Pomodoro tomato UI: VIOLATES BRAND.**
- **Rule:** the gamified habit-tracker anti-reference and Principle 2.

**20. AI page classification or "argue with an LLM": VIOLATES BRAND (cloud) / out of scope (local).**
- **Cloud versions:** break Principle 5.
- **Local versions:** "convince the AI" is a gate, against Principle 1. Judging pages against a task is high-effort and not needed for the thesis.
- **Revisit** only if on-device browser models such as Chrome's built-in Prompt API mature, and only for suggesting sites, never for gatekeeping.

**21. Enterprise / managed-storage deployment and family plans: VIOLATES BRAND (posture).**
- **Rule:** being managed by someone else is the "site blocked by administrator" register Sordino rejects. Being peer-not-parent rules out a parent console.
- **Build cost if ever wanted:** managed storage is technically cheap (`storage.managed` plus a schema).

**22. Mobile apps: out of scope.**
- Firefox for Android could run the existing MV3 extension, a cheap reach win worth testing **[U]**. Safari is already marked "Coming Soon" in the README.

---

## 4. What Sordino does that none of these do

The idea of a bypass-able soft block is **not unique** on its own terms. Screen Time's default flow, LeechBlock's override budget and delaying page, Rize's dismissable nudge and Freedom's 2026 Session Break all offer an escape hatch. These points do hold up:

1. **The bypass budget is the whole enforcement model, and there is no hard mode anywhere.**
   - Every mainstream competitor treats soft escape hatches as exceptions inside a lockable system: LeechBlock overrides can require 128-character codes, Freedom's breaks sit inside Locked Mode, and Screen Time's escape disappears with a passcode.
   - Sordino has no password, no lockdown, no nuclear option and no tamper protection. That is a positioning claim none of them can make.
2. **The overlay is shown in place, with the page context kept and "Go back" as the main action.**
   - The competitors replace the page by redirecting to a block or green screen, or close the tab.
   - LeechBlock's filters are the only other in-place treatment, and they are filters, not a decision moment.
3. **A daily count budget of timed bypasses, with an adjustable count, an adjustable length, and one emergency refresh per day.**
   - LeechBlock's "N overrides per period" is the nearest match, but it is global, password-gateable and buried in General options.
   - No one else offers bypasses as a first-class, visible daily allowance counted in visits, not minutes.
4. **Opt-in scaffolding (a second-click confirm).**
   - Friction the user can turn on, off by default. Competitors' friction (challenges, delays) is framed as something the user should impose on themselves to resist temptation.
5. **Countdown toasts before a bypass or pause expires.**
   - The return to blocking is announced in the page.
   - LeechBlock warns N seconds before a time-limit block and has an on-page countdown **[SRC]**. Whether either fires when an *override* expires is **[U]**.
   - Limit and Digital Wellbeing warn before a *quota* runs out, not before a bypass ends.
6. **Stats show only raw block and bypass counts by design.**
   - There is no time scoreboard and no "insights", which runs against StayFocusd's Gen AI analytics and BlockSite's insights upsell.
7. **The combination: free, local-only with no account and no network calls, Chrome and Firefox, category presets, schedules with correct overnight spans, and a soft model.**
   - LeechBlock is also free, local and on both browsers, but it is a power tool with a hard-blocking core.
   - Limit is free and local but quota-only, with no bypass and no schedules.
   - Since StayFocusd's 2025–26 privacy reports, "zero data leaves the machine" is a stronger differentiator than it was a year ago.

**Note for honesty:** mindful-friction tools outside this scope (one sec, Intention, ScreenZen, and Freedom's own Limit for local-only) overlap points 1–4 to different degrees and should be checked in the companion report before calling any of these "unique".

---

## Sources (all accessed via search 2026-10-02 unless marked [SRC])

- [SRC] https://github.com/proginosko/LeechBlockNG (HEAD 2026-09-27, v1.8) and https://github.com/proginosko/LeechBlockNG-chrome (v1.7.3)
- [SRC] Sordino repo `/home/user/sordino` (types.ts, schedule.ts, service-worker.ts, content.ts, manifests)
- https://chrome-stats.com/d/blaaajhemilngeeffpbfkdjjoefldkok
- https://addons.mozilla.org/en-US/firefox/addon/leechblock-ng/
- https://chromewebstore.google.com/detail/stayfocusd-%E2%80%93-website-bloc/laankejkbhbdhmipfmgcngdelahlfoji
- https://chrome-stats.com/d/laankejkbhbdhmipfmgcngdelahlfoji
- https://gist.github.com/jthegedus/5f9a874da8d5d1d996676446122360c1
- https://www.techjunkie.com/stay-focused-chrome-extension-review/
- https://mindfultechwork.com/stayfocusd-nuclear-option/
- https://consumerrights.wiki/w/StayFocusd
- https://addons.mozilla.org/en-US/firefox/addon/stayfocused/
- https://chrome-stats.com/d/eiimnmioipafcokbfikbljfdeojpcgbh
- https://extpose.com/ext/eiimnmioipafcokbfikbljfdeojpcgbh
- https://tooltivity.com/extensions/blocksite
- https://www.cisdem.com/resource/blocksite-review.html
- https://blocksite.zendesk.com/hc/en-us/articles/360019467377-How-to-block-website-categories-Adult-Social-etc
- https://adapty.io/paywall-library/blocksite/
- https://addons.mozilla.org/en-US/firefox/addon/blocksite/
- https://zapier.com/blog/stay-focused-avoid-distractions/
- https://rtriv.io/en/blog/freedom-app-review
- https://apps.apple.com/us/app/freedom-screen-time-control/id1269788228
- https://support.freedom.to/en/articles/1347519-freedom-browser-extension
- https://support.freedom.to/en/articles/2347720-mac-website-exceptions
- https://freedom.to/blog/better-focus-on-studying-and-work/
- https://support.freedom.to/en/articles/5266497-freedom-for-families
- https://support.freedom.to/en/articles/7020249-freedom-for-mac-release-notes
- https://chrome-stats.com/d/abdkjmofmjelgafcdffaimhgdgpagmop
- https://support.freedom.to/en/articles/3148951-how-to-use-limit
- https://freedom.to/blog/introducing-limit-a-free-extension-for-limiting-distracting-sites/
- https://chrome-stats.com/d/blcdfhbibkkjpfdddnmnmhfgjlicebba
- https://getcoldturkey.com/support/user-guide/
- https://getcoldturkey.com/features/
- https://getcoldturkey.com/support/extensions/chrome/
- https://getcoldturkey.com/support/how-to/allow-youtube-channel/
- https://www.techlockdown.com/articles/cold-turkey-blocker
- https://www.chronoid.app/blog/cold-turkey-vs-focusme
- https://ascensionapp.ai/cold-turkey-blocker-review
- https://chrome-stats.com/d/pganeibhckoanndahmnfggfoeofncnii
- https://chrome-stats.com/d/kjacjjdnoddnpbbcjilcajfhhbdhkpgk
- https://www.softpedia.com/get/Internet/Internet-Applications-Addons/Chrome-Extensions/Forest-for-Chrome.shtml
- https://eduk8.me/forest-really-cool-chrome-extension-help-teachers-students-focus/
- https://github.com/professor-k/Strict-Pomodoro
- https://github.com/i207M/Pomodoro-Improved-Strict-Workflow
- https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline
- https://chromeunboxed.com/manifest-v2-is-officially-dead-as-the-chrome-web-store-permanently-purges-legacy-extensions/
- https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- https://help.rescuetime.com/article/38-problems-with-focus-session-site-blocking
- https://docs.rize.io/distraction-blocker/configure-distraction-blocker
- https://docs.rize.io/distraction-blocker/use-distraction-blocker
- https://support.apple.com/en-gb/guide/mac-help/mchl630bc02f/mac
- https://www.techlockdown.com/articles/fix-ignore-limit-screen-time
- https://discussions.apple.com/thread/255476329
- https://ask.metafilter.com/372496/Does-Screen-Time-web-page-limits-work-on-a-Mac-with-Chrome-or-Edge
- https://support.google.com/android/answer/9346420
- https://9to5google.com/2019/09/03/how-to-digital-wellbeing-android-10-focus-mode-site-timers/
- https://support.google.com/chrome/a/answer/7532419
- https://www.itechguides.com/how-to-enable-edges-focus-mode-for-distraction-free-work/
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/extension/isAllowedIncognitoAccess
- https://www.ghostery.com/blog/enable-extensions-in-incognito
- https://ihaveapc.com/2018/04/strict-workflow-a-pomodoro-technique-based-chrome-extension-for-working-online-without-distractions/
- https://us.community.samsung.com/t5/Galaxy-S24/How-to-use-Google-s-digital-wellbeing-app-to-limit-time-for-a/m-p/3238782
- https://techcommunity.microsoft.com/discussions/edgeinsiderdiscussions/feature-ask-implement-distraction-control-feature-in-microsoft-edge/4388971
- https://www.techlockdown.com/articles/screen-time-not-working
- https://chromewebstore.google.com/detail/intention/dbeapcoomlbnpljdnblmegniiacfoeop
- https://chromewebstore.google.com/detail/focus-ai-website-blocker/ngboiiifeoioghodfglighnahefnjbib
