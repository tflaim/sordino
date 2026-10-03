# Sordino: friction-first and mindful competitor research

Date: 2026-10-02. Scope: tools that add friction or prompt reflection rather than (or as well as) hard-blocking. Sordino's baseline is taken from the repo (`README.md`, `PRODUCT.md`, `src/shared/types.ts`, `src/content/content.ts`, `src/background/service-worker.ts`), not from its roadmap.

---

## 0. Method and limitations (read this first)

- **WebFetch was blocked by the network egress proxy for every domain tried** (pnas.org, lmu.de, arxiv.org, mcml.ai, one-sec.app, chromewebstore.google.com, getfinit.com). The only live source was **WebSearch**, which returns a search-engine summary of the result pages. No primary page was opened directly.
- Evidence labels used in this report:
  - **[S#]**: confirmed via a WebSearch result snippet attributed to source # in the Sources list. This is the strongest tier available here. It is not the same as reading the primary page.
  - **[S#, vendor]**: the snippet came from the vendor itself or from a *competing* app's blog (blok.so, getfinit.com, screenbuddyapp.com, habitdoom.com, liveintently.app, unhookd.app, lockpact.app, screentimeindex.com and similar are all competitors writing about competitors). Treat as marketing.
  - **[M]**: from memory or unverified.
  - **[R]**: confirmed from the Sordino repo source code.
- Where snippets conflicted (for example, whether ScreenZen is entirely free in 2026), both claims are given.
- **Attribution caveat:** WebSearch returns one blended summary across all result URLs, not a per-URL quote. Mapping a claim to a specific source number is therefore a best inference about the likely source, not a verification on that page. Cases where the inference is weak are marked "attribution inferred."

---

## 1. Sordino baseline (what it actually does today)

All items below are [R].

| Area | Current behavior |
|---|---|
| Interception | Full-page overlay on matched sites during an active schedule or manual "on" state. |
| Matching | **Hostname only**, with subdomain suffix match (`hostname === site \|\| endsWith('.'+site)`). No path, wildcard or keyword rules. |
| Overlay content | Rotating music-themed title and subtitle, a rotating quote, the site name with the schedule reason and end time, a **primary "Go back" button**, and a demoted "Bypass for N min" ghost button with an "N quick bypasses left today" caption. |
| Delay | **None.** Bypass is clickable immediately. The only added friction is the opt-in `scaffoldingMode` second-click confirm (8 s window). |
| Bypass budget | `maxBypasses` 1–10 (default 3) × `bypassDurationMinutes` 1–30 (default 5), global across all sites, resetting at local midnight. An "emergency refresh" of the budget is available once per day. |
| Re-intervention | When a bypass or pause expires, the overlay returns. Countdown toasts warn before expiry. |
| Schedules | Templates (work hours, extended, evenings, always-on) plus custom schedules, including overnight spans. |
| Pause | 15 min, 1 hour, until tomorrow, or manual override. |
| Lists | Social, Video and News presets (News off by default) plus custom domains, with per-site toggles inside a category. |
| Stats | Daily and weekly: blocks triggered (unique sites per day), bypasses used, per-site blocks and bypasses, and emergency refreshes per week. **No time-on-site, no "turned back" (Go back) count, no attempt count shown on the overlay.** |
| Platforms | Chrome (MV3) and Firefox. Desktop only. |
| Privacy | Local storage only, no network calls, no account. |
| Price | Free (Buy Me a Coffee). |

---

## 2. Evidence: which friction mechanisms actually reduce use

This section bears directly on Sordino's core wager. Sources are numbered in Section 7.

### 2.1 one sec field study (PNAS, Feb 2023): Grüning, Riedel, Lorenz-Spreen [S1][S2]
- **Field study:** 280 participants over 6 weeks. Target-app openings fell **57%** after six weeks. On average **36%** of attempts ended with the user closing the app after the one sec interruption. Attempts themselves fell **37%** relative to week 1 [S1].
- The closure rate fell from about **43% in week 1 to about 32–34% in weeks 3–6**, which suggests partial habituation to the prompt itself [S3, secondary review; attribution inferred, as the snippet did not name its source].
- **Component experiment (same paper):** a preregistered online experiment with 500 participants tested the app's three ingredients separately, using consumption of real viral clips as the outcome [S2]:
  - **The option to dismiss had the strongest effect** on lowering consumption.
  - A **time delay** was also effective, but **did not add** to the effect of the dismiss option.
  - The **deliberation message alone was not effective**.
- Conflict of interest: the founder of one sec (Riedel) is a co-author [S1].

**What this means for Sordino:**
- Sordino's most effective ingredient is already the primary action. "Go back" is the dismiss option.
- The quotes and titles work like a deliberation message. The evidence says they are **not** what reduces use. Their value is brand and ambient calm. Do not market them as the mechanism.
- Sordino has **no time delay**. In the field study the delay reduced openings. In the online experiment it added nothing once a dismiss option was present. That makes the delay the best-supported mechanism Sordino lacks, but the expected gain is smaller than "57%" suggests.

### 2.2 one sec longitudinal study (CHI 2024): Haliburton et al. [S4][S5]
- 1,039 one sec users, average 13.4 weeks, plus a survey of 249 users. Short frictions reduced open attempts and **increased the share of intentional opens over time**.
- **Users take periodic breaks from interventions and rebound quickly to overuse when they come back.**
- For Sordino, this means pause controls are used as breaks. A quiet, factual "paused since…" status, already partly present, matters more than adding stricter pauses.

### 2.3 Reflective prompts versus static messages
- **"A Comparison of Deliberation Messages…" (2025):** a one-week field study [S6]. Overall usage duration did not differ between groups. Within groups, **reflective questions** and a **time picker (the user sets the session length)** reduced absent-minded use. **Factual messages did not.**
- **Lyngs et al., CHI 2020, Facebook:** 58 students over 6 weeks [S7][S8].
  - **Goal reminders** (asking for an intention) reduced daily time and visits. They were also "often annoying."
  - **Newsfeed removal** shortened visits (mean 1m12s down to 56s) and reduced passive use. It caused some fear of missing out.
  - The authors judged newsfeed removal **more consistently effective** than goal reminders.
- **Lyngs et al., CHI 2019:** a review of 367 digital self-control tools [S9]. 52 used reminders such as quotes, 58 asked for explicit goals, and 15 compared behavior against those goals.

### 2.4 Feed and recommendation removal
- **Lukoff et al., CHI 2021, and SwitchTube (2023, DOI 10.1145/3544548.3580703; venue [M])** [S10]. Users named recommendations and autoplay as the mechanisms that most reduced their sense of control. A Focus Mode that hid recommendations and disabled autoplay improved agency, satisfaction and goal alignment (46 users, in the wild).
- Together with [S7], this is solid evidence for "soften the site, don't block it."

### 2.5 Habituation and attrition
- **HabitLab, CSCW 2018:** 1,654 users [S11]. **Rotating** intervention types increased effectiveness, **and also increased uninstalls**. A short just-in-time notice explaining the rotation cut that attrition roughly in half.
- **HabitLab, "Not Now, Ask Later" (CHI 2021):** 8,000+ users [S12].
  - Users drift toward easier settings over time, while expecting to tighten them again "soon."
  - Prompting at 25% frequency produced significantly less dropout than prompting 100% of the time.
- **Meta-analysis (Roffarello & De Russis, TOCHI 2023):** 7 studies, 255 participants [S13]. Pooled **g ≈ 0.47** (small-to-medium) reduction in time on distracting sources. **No evidence of long-term habit formation.**
- **JMIR Formative, April 2026** [S14]. 46% of users accepted a **nudge-reconfiguration prompt** when their engagement had decayed. Among those who accepted, the nudge interaction ratio rose from 29.7% to 58.5%. The authors argue for adaptive, autonomy-preserving designs.

### 2.6 Timing and modality of in-session interventions
- **"Can't Stop" (arXiv, July 2026):** 104 participants, 7 days [S15]. For **highly impulsive** participants, an **explicit pop-up** worked best and was faster than gradual visual or haptic frictions. The trade-off: the fastest-acting interventions also felt the most frustrating.
  - This is relevant to Sordino's ADHD-primary persona. It supports a clear overlay over subtle degradation.
- **"Scrolling in the Deep" (CHI 2025):** 72 participants [S16]. Context changed how well the intervention worked. Being at home with low mood slowed disengagement. Sleepiness lowered reactance.
- **"Seeing Your Mindless Face" (2026, DOI 10.1145/3772363.3798907; venue [M]; lab study, n=84)** [S17]. Self-related cues interrupted scrolling. A **plain black screen** was rated highest for continued use because it felt least intrusive.

### 2.7 LLM-based interventions
- **MindShift (2024, DOI 10.1145/3613904.3642790; venue [M]):** 25 participants over 5 weeks [S18]. LLM-personalized persuasion reduced app openings by **12.1–14.4%** and raised intervention acceptance by 17.8–22.5% over the baseline.
- **INA / "State Your Intention to Steer Your Attention" (2025–26, DOI 10.1145/3772318.3791404; venue [M]):** 22 participants over 3 weeks [S19]. An LLM checked on-screen activity against the user's stated intention and reduced off-task behavior.
- Both studies are small. Both send screen or context data to a model.

### 2.8 Summary of evidence for Sordino's wager

| Mechanism | Evidence strength | Sordino today |
|---|---|---|
| Visible option to dismiss or turn back | **Strongest** (PNAS component experiment) | ✓ "Go back" is primary |
| Short enforced delay | Good in the field; not additive to dismiss in the lab | ✗ |
| Static message or quote | **Not effective** on its own | ✓ (brand value only) |
| Reflective question or self-set duration | Moderate (2025 field study, Lyngs 2020); can annoy | ✗ |
| Feed or recommendation removal | Good (Lyngs 2020, SwitchTube) | ✗ |
| Rotating interventions | More effective, but more uninstalls unless explained | Partial (copy rotates; mechanism does not) |
| Lower prompt frequency | Less dropout (HabitLab, 25% vs 100%) | Partial (schedules; bypass windows) |
| Long-term habit change from any digital self-control tool | **Not shown** | n/a |

---

## 3. Competitor profiles

### 3.1 one sec (iOS, Android, macOS, browser extension)
- **Mechanism.** A breathing exercise before the target app or site opens, then a choice: "I don't want to open X" or "Continue" [S20][S21].
  - Default delay is 6 s, adjustable from 3 s to 60 s, with a customizable phrase on the desktop extension [S20].
  - After "Continue," it shows **how many times you tried to open the app in the past 24 hours** [S21].
  - Other intervention types (Pro): 4-7-8 breathing, a "mirror" intervention, rotating the phone, typing random text, reflective prompts, and intention and emotion check-ins with a journal [S22, secondary].
  - "Doomscroll emergency brake" / "don't get lost" re-interrupts long sessions [S22, secondary].
  - Also offers strict block sessions, scheduled full blocks and adult-content blocking [S22].
- **Platforms.** Extension for Chrome, Safari, Firefox, Edge, Opera, Brave and Arc [S20]. The free browser extension includes Re-Intervention, Blocking and customizable interventions [S23, vendor]. The macOS app carries the Safari extension [S23].
- **Pricing.** Free tier allows **1 app**. Pro is about $2.99/month or about $19.99/year, plus lifetime and family plans (exact figures vary by store and region) [S22, secondary].
- **Account and privacy.** iCloud sync arrived in 6.0 [S24, vendor]. Whether an account is required is unknown [M]. A US patent titled "Method and computing device for intervening access to a target media service" surfaced in one sec searches [S21]. The assignee was not shown in the snippet, so ownership is [M].
- **Recent changes.** one sec 6.0 shipped alongside iOS 27 (2026), with a one-tap setup in place of the 10-step Shortcuts automation [S24, vendor].
  - Also new in 6.0: multiple simultaneous block sessions, pause and resume of block sessions, **custom intentions with emojis and history**, per-app configuration, and iCloud sync.
- **Notable UX detail.** It never locks you out by default. The decision screen is binary and neutral in tone.

### 3.2 ScreenZen (iOS, Android, plus a Chrome extension)
- **Mechanism.** The app starts loading, then a pause screen asks you to wait out a delay, set an intention, or confirm [S25].
  - **The wait escalates with each open**, for example 10 s on the 1st open, 30 s on the 5th and 60 s on the 10th [S26].
  - **Opens-per-day limits with minutes per open** (for example, 4 opens × 5 min). This is effectively the same model as Sordino's bypass budget, but set **per app** [S26].
  - Also offers cooldowns between sessions, scheduled blocks and per-app daily limits [S25].
  - Example copy: "Is this a good time?" and "Do you really want to use 3 mins now, or save it for later?" [S25].
- **Data shown.** How often the pause changed your mind. Time is tracked only on the selected distracting apps [S26].
- **Web.** On mobile, website blocking uses Accessibility permissions and is reported as inconsistent [S26].
  - **"ScreenZen: Minimal Social Media" Chrome extension** (v0.1.2, August 2026) hides feeds, Shorts, Reels, Explore and trends on 7 sites, while keeping search, messages and profiles working. It is Chrome only [S27, competitor-authored].
- **Pricing.** Long described as fully free and donation-funded [S25]. One 2026 source says the Chrome extension sits under a "single Pro subscription" [S27]. **Conflicting; unresolved.**
- **Recent.** Feed-hiding Chrome extension (2026).

### 3.3 Opal (iOS, macOS, Android; Chrome extension deprecated)
- **Mechanism.** Mainly blocking: scheduled or on-demand sessions. "Deep Focus" cannot be ended early, alongside Normal and Timeout levels [S28, secondary].
- **Gamification.** Gems, streaks, focus score and a leaderboard [S28].
- **Pricing.** Pro is $19.99/month or $99.99/year, with a $399 lifetime option and a limited free tier [S28].
- **Web.** The Chrome extension is marked "deprecated; use the Mac app" on Opal's forum [S29].
- **Recent (Android).** v4.6.0 (30 July 2026) added an "Open Opal" button on the block screen. v4.12.0 (18 September 2026) added one-tap focus sessions through a floating pill and an always-allowed list of essential apps [S30, vendor].
- **Fit.** Mostly the "gamified" and "hard-blocker" anti-references.

### 3.4 Clearspace (iOS, Android, Chrome extension; YC W23)
- **Mechanism.**
  - A forced pause before opening.
  - **Session budgets** from 1 to 10 minutes per session.
  - **Physical challenges** (pushups counted by the motion sensor, squats, steps, jump rope, deep breath) that earn extra time [S31][S32].
  - Accountability partners [S31].
- **Chrome extension.** Pause-before-open, session management on YouTube, Reddit, LinkedIn, Twitter and Facebook, social feed blocking and reader mode [S31][S33].
- **Pricing.** Free tier allows 1 app. Premium is $6.99/month or $44.99/year, family $79.99/year, free for students [S31, competitor-authored].
- **Recent.** iOS 2.6.6–2.6.9 (August–November 2025) changed challenges and added iOS 26 support [S33].
- **Critique noted by reviewers.** The user can loosen their own budget whenever the pause gets annoying [S33]. Sordino shares this.

### 3.5 Intention: "Stop Mindless Browsing" (getintention.com; Chrome and Firefox)
- **Mechanism.** On a distracting site, you **commit to a time limit to unlock it**. A timer appears on the toolbar icon. When time runs out, the session ends and a **reflection prompt** asks how you would like to spend your time [S34][S35].
- **Reach.** About 7k users, rated about 4.95. Free. The developer declares no data collection [S35].
- **Fit.** The closest existing analogue to Sordino's bypass, but **self-chosen per visit** instead of a fixed duration.

### 3.6 Intently (liveintently.app; Android plus a Chrome extension; iOS in development)
- **Mechanism.** A full-screen intervention before every open, using a **message the user wrote** (a question, a goal or a breathing prompt). Custom message per app [S36, vendor].
- **Includes.** Usage analytics and **streaks** [S36].
- **Privacy and price.** Fully offline with zero data collection. Entirely free [S36].

### 3.7 Mindful Browsing (Steven Skoczen; Chrome and Firefox; open source)
- **Mechanism.**
  - Asks whether you want to visit, and shows a landscape photograph plus **a list of things you said you'd rather do**.
  - If you continue, it **reminds you 10 minutes later** [S37][S38].
  - It tracks nothing [S37]. v2.0.1 was updated 22 April 2026 [S39].
- **Separate extension.** "Mindful Browsing – Your Gentle Digital Companion" uses three breaths, reflection points and eight break suggestions [S39].

### 3.8 Pause by Freedom (Chrome, Firefox, Edge, Opera)
- **Mechanism.** A calm green screen with a **configurable pause (default 5 s)**. Then you can proceed, stay on the screen or close the tab. It ships with 50 preloaded distracting sites [S40][S41].
- **Privacy and price.** Data stays on the device. Free [S40]. Documentation was updated in August 2025, so it is still maintained [S41].
- **Fit.** The closest "pure delay" competitor. It has no budget, schedule or stats, as far as the snippets show.

### 3.9 Unhook (YouTube; Chrome, Firefox, Firefox Android)
- **Mechanism.** Removes YouTube elements:
  - home feed, Shorts, related videos, comments, end screens and autoplay
  - trending, notification counts, live chat and more [S42]
- **Reach and price.** About 1M users and v1.6.9 (March 2026) [S42]. Free with no account. Possibly an optional Pro tier for extras [S43, conflicting].
- **Design choice.** **Deliberately no lock or commitment mode**, and no time tracking [S43].

### 3.10 News Feed Eradicator (Chrome, Firefox, Firefox Android; open source)
- **Mechanism.** Replaces algorithmic feeds on Facebook, X, LinkedIn and others with a **quote**, with custom quotes supported. Search, messaging and posting still work [S44].
- **Recent.** v3.0.5, 16 July 2026 [S44].
- **Fit.** Same quote idea as Sordino, applied to the feed instead of the whole page.

### 3.11 DF Tube and similar YouTube feed removers
- **Mechanism.** Hides Shorts, recommendations, the homepage grid, comments and autoplay [S45].
- **Recent.** DF Tube v1.21.2 (May 2026). Several forks exist because the original broke under MV3 [S45].
- **"Minimal"-branded feed remover:** not found via search; not covered.
- Related: **LeechBlock NG** offers a "delaying" countdown page, wildcards, exceptions and **keyword** rules [S46]. **Blockodile** blocks Shorts while leaving youtube.com usable [S46].

### 3.12 Jomo (iPhone, iPad, Mac)
- **Mechanism.** An intention prompt with **reason chips** ("Boredom," "FOMO," "Habit"), then a **3-second pause**. Users choose their friction. Has a strict mode [S47, competitor-authored].
- **Claim.** About 1h39m per day reduction across the latest 100k users [S47, vendor claim, no methodology].
- **Recent.** Updated August 2026 [S47].

### 3.13 Intention, AI edition (MaybeItsSoftware; Chrome; new in 2026)
- **Mechanism.** A blocklisted site opens a **short chat with an LLM coach**. A "real reason" grants timed access through a structured `grant_access` tool call. If you're drifting, the coach helps you close the tab [S48][S49].
- **Privacy and price.** **Bring your own key** (Anthropic, OpenAI, Gemini or Groq). No account, no developer server, data kept in local extension storage [S49]. Note that the conversation still goes to the chosen LLM provider.
- **Recent.** v0.13.0, 22 July 2026 [S49].

### 3.14 Focus AI (Chrome and Chromium browsers, Firefox)
- **Mechanism.** You type your task in plain English. During a session the extension **reads every tab's content** and blocks pages judged off-task [S50][S51].
- **Other features.** Pomodoro sessions and **anti-tamper**. Marketed as "the website blocker you can't turn off" [S51].
- **Pricing.** 3 free sessions, then $9.99/month [S51].
- **Recent.** Updated 27 September 2026 [S50].
- Related AI blockers: Locked In and Focal [S50].

### 3.15 Hardware: Brick, Unpluq, Bloom
- **Mechanism.** NFC puck or tag that is physically tapped to lock and unlock app groups. **Phone only**; no desktop website coverage [S52][S53].
- **Pricing.**
  - Brick: $59 one-time [S52].
  - Unpluq: tag plus subscription, with alternative unlock barriers (shake the phone, tap a sequence) [S53]. Claims 1h22m per day saved [S53, vendor].
- **Relevance.** Low for a browser extension. Its only transferable idea is "make the unlock a physical or deliberate act," which Sordino's scaffolding confirm already gestures at.

---

## 4. Gap matrix

✓ = has it, ◐ = partial or limited, ✗ = no, ? = not confirmed by search. Cells for Sordino are [R]; for competitors they follow Section 3 sources.

Column key:

| Abbreviation | Product |
|---|---|
| 1s | one sec |
| SZ | ScreenZen |
| Op | Opal |
| CS | Clearspace |
| Int | Intention (getintention) |
| Ily | Intently |
| MB | Mindful Browsing |
| FP | Freedom Pause |
| UH | Unhook |
| NFE | News Feed Eradicator |
| Jo | Jomo |
| AI-I | Intention AI (BYOK) |
| FAI | Focus AI |
| Br | Brick |
| **So** | **Sordino** |

| Mechanism / feature | 1s | SZ | Op | CS | Int | Ily | MB | FP | UH | NFE | Jo | AI-I | FAI | Br | **So** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Interstitial before site/app (bypassable) | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | **✓** |
| Explicit dismiss / "go back" choice | ✓ | ✓ | ? | ✓ | ? | ✓ | ✓ | ✓ | – | – | ? | ✓ | ✗ | – | **✓** |
| Enforced wait before continuing | ✓ | ✓ | ? | ✓ | ✗ | ? | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | **✗** |
| Breathing exercise | ✓ | ? | ✗ | ✓ | ✗ | ◐ | ✗ | ✗ | ✗ | ✗ | ? | ✗ | ✗ | ✗ | **✗** |
| Escalating delay by open count | ? | ✓ | ✗ | ? | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ? | ✗ | ✗ | ✗ | **✗** |
| Intention / reason prompt | ✓ | ✓ | ✗ | ? | ◐ | ◐ | ◐ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | **✗** |
| User-written overlay message | ✓ | ? | ✗ | ? | ✗ | ✓ | ◐ | ✗ | ✗ | ✓ | ? | ✗ | ✗ | ✗ | **✗** |
| Self-chosen session length per visit | ? | ◐ | ✗ | ◐ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ? | ✓ | ✗ | ✗ | **✗** (fixed N min) |
| Opens/day × minutes budget | ? | ✓ | ✗ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ? | ✗ | ✗ | ✗ | **✓** (global) |
| Per-site limits or budgets | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | **✗** |
| Cooldown between sessions | ? | ✓ | ? | ? | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ? | ✗ | ✗ | ✗ | **✗** |
| Re-intervention after N min in session | ✓ | ✓ | ? | ✓ | ✓ | ? | ✓ | ✗ | ✗ | ✗ | ? | ✓ | – | ✗ | **✓** (bypass expiry plus toasts) |
| Schedules | ✓ | ✓ | ✓ | ✓ | ✗ | ? | ✗ | ✗ | ✗ | ✗ | ✓ | ? | ✓ | ✓ | **✓** |
| Pause / snooze whole tool | ✓ | ? | ✓ | ? | ✗ | ? | ✗ | ✗ | ✗ | ✗ | ? | ? | ✗ | ✗ | **✓** |
| Path / subpage / keyword rules | ? | ✗ | ? | ? | ✗ | ✗ | ✗ | ✗ | ◐ | ◐ | ✗ | ? | – | ✗ | **✗** |
| Feed / recommendation removal | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | **✗** |
| Reflection or journal | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ◐ | ✗ | ✗ | ✗ | ◐ | ◐ | ✗ | ✗ | **✗** |
| AI intent check | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | **✗** |
| Attempt count shown at the gate | ✓ | ? | ✗ | ? | ✗ | ? | ✗ | ✗ | ✗ | ✗ | ? | ✗ | ✗ | ✗ | **✗** (stored, not shown) |
| "Turned back" / closed-after-pause stat | ✓ | ✓ | ✗ | ? | ✗ | ? | ✗ | ✗ | ✗ | ✗ | ? | ✗ | ✗ | ✗ | **✗** |
| Time-on-site tracking | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ? | ✗ | **✗** |
| Hard / strict lock mode | ✓ | ✓ | ✓ | ? | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | **✗** (by design) |
| Physical or effort challenge | ◐ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | **✗** |
| Gamification (streaks, gems, scores) | ? | ✗ | ✓ | ◐ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ? | ✗ | ✗ | ✗ | **✗** (by design) |
| Social / accountability partners | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✗** (by design) |
| Mobile app | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ◐ | ◐ | ✓ | ✗ | ✗ | ✓ | **✗** |
| Cross-device sync | ✓ | ? | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ? | ✓ | **✗** |
| Firefox | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | – | **✓** |
| No account required | ? | ? | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ? | ✓ | ? | ? | **✓** |
| Fully local (no network) | ? | ? | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ? | ✗ (LLM) | ✗ | ✗ | **✓** |
| Free (fully) | ✗ (1 app) | ✓/? | ✗ | ✗ (1 app) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ◐ (free; BYOK API cost) | ✗ | ✗ ($59) | **✓** |

Sordino's distinctive combination: the only tool in this set that is **(a) a fully local, account-free browser extension, (b) on both Chrome and Firefox, (c) with a fair daily bypass budget plus schedules plus pause, and (d) with an explicit anti-gamification and anti-lock stance.** Freedom Pause, Mindful Browsing and Intention are the nearest, but each lacks budget, schedule and stats together.

---

## 5. Things competitors do that Sordino doesn't (ranked)

Ranking weighs (1) evidence of effect, (2) fit with the ADHD-primary persona, and (3) cost. Tags:
- **FITS BRAND**: do it.
- **FITS WITH CARE**: do it only under the stated constraints.
- **VIOLATES BRAND**: skip on principle.

**1. Short enforced wait before Bypass becomes clickable** (one sec, Freedom Pause, ScreenZen, Jomo, Clearspace). **FITS BRAND.**
- **Evidence:** the time delay is the best-supported mechanism Sordino lacks. It reduced openings in the PNAS field study [S1][S2].
- **Design:**
  - "Go back" stays instantly available. Only Bypass waits about 3–5 s.
  - Show it as a plain countdown on the button label ("Bypass in 4"). Not a breathing animation, which `PRODUCT.md` lists as a wellness-drift signal.
  - Respect `prefers-reduced-motion`.
  - Make the length configurable from 0 to about 15 s.
- **Caveat:** the online component experiment found the delay added nothing beyond the dismiss option [S2]. Expect a modest gain, not 57%.
- **Owner decision:** whether the default is on, given Principle 4's "permitted not imposed" resolution.

**2. Feed-only / "soften the page" mode for selected sites** (Unhook, NFE, DF Tube, the ScreenZen Chrome extension, Clearspace). **FITS BRAND.** This is literally "softens without silencing."
- **Evidence:** Lyngs 2020 found newsfeed removal more consistently effective than goal reminders [S7]. SwitchTube improved agency [S10].
- **Scope and constraints:**
  - Start with the YouTube home grid and Shorts, the Reddit front page and the X timeline.
  - Fragile selector maintenance is the real cost.
  - Make it per-site and visible, and keep the quote idea that NFE has.

**3. Path / subpage rules** (LeechBlock wildcards and keywords, Blockodile's Shorts-only option). **FITS BRAND.**
- Sordino matches by hostname only [R]. The ADHD user often wants `youtube.com/shorts` and `reddit.com/r/all` gated but not a work-related YouTube tutorial.
- Path-prefix matching is a small change and a prerequisite for #2.

**4. "Turned back" count in Usage** (one sec's closed-versus-continued split, ScreenZen's "how often the pause changed your mind"). **FITS BRAND.**
- **Evidence:** dismissal is the strongest ingredient [S2]. Sordino records blocks and bypasses but not Go back clicks [R].
- Show it as a **raw count** ("Turned back: 7") next to blocks and bypasses.
- Do not show a percentage or "success rate." `PRODUCT.md` Known Tensions bans derived metrics.

**5. Self-chosen bypass length at the gate** (Intention's commit-to-a-time, ScreenZen's "3 mins now or save it for later?", the time picker in [S6]). **FITS WITH CARE.**
- **Evidence:** a time picker reduced absent-minded use [S6].
- **Design:**
  - Offer 2–3 options capped by the configured maximum (for example "2 / 5 / 10 min") in place of a single fixed button.
  - It must not add a step for users who just want the default. Pre-select the default.

**6. Optional one-tap intention / reason chips** (Jomo's "Boredom / FOMO / Habit," one sec intentions, Intently's custom messages). **FITS WITH CARE.**
- **Evidence:** reflective questions helped and static messages did not [S6]. Goal reminders worked but were "often annoying" [S7].
- **Constraints:**
  - Off by default. Never mandatory. Never judged.
  - Raw counts per reason, stored locally only.
  - No free-text journaling in the overlay; free text is heavier and drifts toward a journaling app.
  - A fit for the self-aware quitter. It could be noise for the ambient maker.

**7. Attempt count on the overlay** ("3rd visit to reddit.com today," one sec style). **FITS WITH CARE.**
- The data already exists in `siteStats.blocks` [R].
- Principle 4 bans threats and guilt, so the phrasing must be a flat report ("Visit 3 today") without adjectives.
- It could read as shaming for the ADHD user. Consider putting it behind a setting, or behind scaffolding mode.

**8. Escalating wait by visit count** (ScreenZen: 10 s, then 30 s, then 60 s). **FITS WITH CARE.**
- This is a strong scaffolding mechanism for the ADHD persona, but it risks reading as punishment ("rigid blocks read as punishment").
- If shipped, keep it opt-in, cap it low (for example 3 s, then 10 s, then 20 s), give it no copy, and leave "Go back" always instant.
- No independent evidence was found on escalation specifically [M].

**9. Per-site budgets** (ScreenZen per-app opens, Clearspace per-session budgets). **FITS WITH CARE.**
- Useful (for example, "YouTube gets 2 × 10 min, X gets 1 × 3 min").
- It adds settings density, so it pulls toward the "control panel" and generic-SaaS anti-reference. Use progressive disclosure: it should be an advanced option, not the default model.

**10. User-written overlay line** (Intently, one sec's custom phrase, NFE custom quotes, Mindful Browsing's "things I'd rather do"). **FITS WITH CARE.**
- **Evidence:** static messages are ineffective [S2]. No study was found on self-authored lines.
- Cheap to build. The brand risk is low if it replaces the quote rather than adding to it ("one literary signifier per surface").

**11. Explained rotation of intervention form.** **FITS WITH CARE.**
- **Evidence:** rotating interventions raised effectiveness, and attrition fell when the change was explained [S11].
- Sordino rotates copy only.
- Possible variation: occasionally swap the quote for a blank, quiet card. A plain black screen was the least intrusive in [S17].

**12. Reconfiguration nudge when the user is clearly ignoring the overlay** (JMIR 2026). **FITS WITH CARE.**
- For example, when the budget is exhausted daily for a week, show a quiet line in settings, never on the overlay: "Bypasses ran out every day this week. Budget is 3 × 5 min." Report the state with no recommendation.
- A 46% acceptance rate restored engagement [S14]. The risk is a parental tone.

**13. Time-on-site tracking.** **FITS WITH CARE.**
- Every major competitor shows minutes. Sordino shows counts only.
- Raw minutes during bypasses is a defensible mirror. "Time saved" or "reclaimed hours" is **VIOLATES**: Known Tensions explicitly bans "You've reclaimed 4.2 hours" style copy, and competitors' vendor "1h39m saved" claims are the pattern to avoid.

**14. Breathing exercise as the delay** (one sec, Clearspace "deep breath," Mindful Browsing Companion). **VIOLATES BRAND.**
- `PRODUCT.md` lists "breathing animations on the lantern or any element" as a wellness-drift signal.
- Use #1's plain countdown instead. The evidence supports the *delay*, not the breathing.

**15. Effort challenges** (pushups, squats, typing random text: Clearspace, one sec). **VIOLATES BRAND.**
- They turn the bypass into an earned reward. This is the gamified anti-reference and Principle 4's "doesn't reward the resistance."
- They also punish people with disabilities, which conflicts with the accessibility floor.

**16. Streaks, gems, focus score, leaderboards** (Opal, Intently streaks). **VIOLATES BRAND.**
- This is the gamified habit-tracker anti-reference and Principle 2 ("never use streak counters, badges").

**17. Accountability partners or social sharing** (Clearspace, Opal leaderboards). **VIOLATES BRAND.** Principle 5: "never suggest sharing, never reference your community."

**18. Hard or strict lock, anti-tamper, "can't quit early"** (Opal Deep Focus, Focus AI, one sec strict sessions, Brick). **VIOLATES BRAND.** This is the hard-blocker anti-reference and Principle 1 ("every restriction must come with a visible escape route").

**19. AI intent check** (Intention AI, Focus AI; research: MindShift, INA). **VIOLATES BRAND.**
- **Cloud or BYOK:** the page content or conversation leaves the machine, against Principle 5's "zero data leaves the machine — invariant."
- **Even on-device:** an AI judging whether your reason is "real" is a parent, not a peer. It contradicts "trusts the user to know what they're doing."
- The evidence is small-n (n = 22–25). MindShift reported 12–14% fewer openings [S18]. INA's effect size was not quantified in the snippet [S19].
- Revisit only if a fully on-device model is used purely to *suggest* (never gate). [M: browser-native on-device model availability not verified here.]

**20. Mobile apps, cross-device sync, accounts** (one sec, Opal, Clearspace, Jomo). **VIOLATES BRAND** in its account or cloud-sync form (Principle 5). A separate local-only mobile product would be a strategy question, not a feature gap.

**21. Hardware unlock** (Brick, Unpluq, Bloom). Out of scope (phone only). Treat it as **VIOLATES**: a key left in another room is a wall, not a mute.

---

## 6. Positioning takeaways

1. **Sordino's thesis is better supported than its feature list.** The strongest evidence-backed ingredient, a visible dismiss option, is Sordino's primary button. The weakest, a static message, is Sordino's visual centerpiece. Keep the quote for brand, and stop implying it is the mechanism.
2. **The one gap the evidence clearly supports is the delay.** Add it as a quiet countdown on Bypass only.
3. **"Soften, don't silence" points to feed removal and path rules, not more interstitials.** Unhook (about 1M users) and NFE show demand, and the research ([S7], [S10]) supports it. No competitor combines "soften the page" with a fair bypass budget in one local, free, two-browser extension.
4. **Watch habituation.** One sec's closure rate decays [S3], users drift to easier settings [S12], and rotation helps but costs uninstalls unless explained [S11]. Sordino's reset-at-midnight budget and pause controls fit how people actually take breaks [S4].
5. **AI intent checking is the 2025–26 newcomer trend** (Intention AI, Focus AI, INA). It conflicts with Sordino on both privacy and tone. That is a clean point of difference: "Nobody reads your tabs. Not even a model."

---

## 7. Sources

All were accessed through WebSearch result snippets on 2026-10-02. No page was fetched directly (egress blocked).

**Research**
1. Grüning, Riedel, Lorenz-Spreen. "Directing smartphone use through the self-nudge app one sec." PNAS 2023. https://www.pnas.org/doi/10.1073/pnas.2213114120
2. Same paper on PMC (component experiment: dismiss > delay; message ineffective). https://pmc.ncbi.nlm.nih.gov/articles/PMC9974409/
3. getfinit.com, "one sec app review (2026): the evidence, read fairly" (competitor-authored; closure-rate decay). https://getfinit.com/blog/one-sec-review
4. Haliburton et al. CHI 2024, longitudinal design frictions. https://www.medien.ifi.lmu.de/pubdb/publications/pub/haliburton2024chi/haliburton2024chi.pdf
5. MCML listing of the same paper. https://mcml.ai/publications/hgr+24/
6. "A Comparison of Deliberation Messages as Intervention Designs for Regretful Smartphone Usage." https://www.researchgate.net/publication/388315750
7. Lyngs et al. CHI 2020, "I Just Want to Hack Myself…" https://arxiv.org/abs/2001.04180
8. Same paper, ORA. https://ora.ox.ac.uk/objects/uuid:2dc271df-4863-45a9-946a-fd115341df3e
9. Lyngs et al. CHI 2019, "Self-Control in Cyberspace." https://arxiv.org/pdf/1902.00157
10. Lukoff et al. CHI 2021, YouTube sense of agency; SwitchTube CHI 2023. https://arxiv.org/pdf/2101.11778 and https://dl.acm.org/doi/10.1145/3544548.3580703
11. Kovacs et al. CSCW 2018, rotating interventions (HabitLab). https://hci.stanford.edu/publications/2018/habitlab/habitlab-cscw18.pdf
12. Kovacs, Wu, Bernstein. CHI 2021, "Not Now, Ask Later." https://arxiv.org/pdf/2101.11743
13. Roffarello & De Russis. TOCHI 2023, meta-analysis of digital self-control tools. https://dl.acm.org/doi/full/10.1145/3571810
14. Peña-Albert et al. JMIR Formative 2026, nudge reconfiguration prompts. https://doi.org/10.2196/85349
15. "Can't Stop…" arXiv 2607.15818 (2026). https://arxiv.org/abs/2607.15818
16. "Scrolling in the Deep" CHI 2025. https://dl.acm.org/doi/10.1145/3706598.3713187
17. "Seeing Your Mindless Face" (2026). https://arxiv.org/abs/2604.19424
18. MindShift (2024; venue [M]). https://arxiv.org/pdf/2309.16639
19. INA, "State Your Intention to Steer Your Attention" (venue [M]). https://arxiv.org/abs/2510.14513

**one sec**

20. one sec browser extension (XDA, riedel.wtf). https://www.xda-developers.com/one-sec-productivity-extension/ and https://one-sec.riedel.wtf/browser-extension
21. one sec FAQ and research; MakeUseOf review; one sec patent. https://one-sec.app/faq/ , https://www.makeuseof.com/app-interrupts-your-muscle-memory-in-the-best-possible-way/ , https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12468828
22. one sec Pro features and pricing (blok.so, Adapty paywall library, one sec tutorials). https://www.blok.so/resources/one-sec-app-review-does-adding-friction-actually-reduce-screen-time , https://adapty.io/paywall-library/one-sec-screen-time-focus/ , https://tutorials.one-sec.app/en/articles/3036418
23. one sec Safari and desktop help. https://tutorials.one-sec.app/en/articles/3035586 , https://tutorials.one-sec.app/en/articles/3036034
24. one sec blog (6.0 / iOS 27). https://one-sec.riedel.wtf/blog

**ScreenZen**

25. ScreenZen reviews (WhistleOut, habitdoom, MakeUseOf). https://www.whistleout.com/CellPhones/Apps/screenzen-app-review , https://habitdoom.com/blog/screenzen-alternative-iphone
26. ScreenZen App Store and Google Play listings, Diary of the Mind review. https://apps.apple.com/us/app/screenzen-screen-time-control/id1541027222 , https://play.google.com/store/apps/details?id=com.screenzen , https://diaryofthemind.com/screenzen-review-everything-you-need-to-know/
27. ScreenZen Chrome extension (Chrome Web Store; Screen Time Index). https://chromewebstore.google.com/detail/screenzen-minimal-social/ndnekhmaaopaliodekcfemgjflfjmkok , https://screentimeindex.com/posts/screenzen-for-chrome/

**Opal**

28. Opal reviews and pricing (Headway, Screen Buddy, blok.so). https://makeheadway.com/blog/opal-app-review/ , https://www.screenbuddyapp.com/blog/opal-app-review
29. Opal community: Chrome extension deprecated. https://community.opalapp.com/t/chrome-extension-depreciated-please-use-mac-app-instead/6271
30. Opal Android release notes (July and September 2026). https://community.opalapp.com/t/opal-android-release-notes-july-30/11069 , https://community.opalapp.com/t/android-release-notes-september-18/11233

**Clearspace**

31. Clearspace (lockpact review, App Store, Launch HN). https://lockpact.app/blog/clearspace-app-review/ , https://apps.apple.com/us/app/clearspace-reduce-screen-time/id1572515807 , https://news.ycombinator.com/item?id=35888644
32. Clearspace Chrome extension. https://chromewebstore.google.com/detail/clearspace/geebjpiagpchjgjdanomkgjhcjnahjfe
33. Clearspace 2025–26 updates and critique (search summary of the App Store page and lockpact). Same URLs as 31.

**Intention, Intently, Mindful Browsing, Freedom Pause**

34. Intention (getintention), Chrome Web Store. https://chromewebstore.google.com/detail/intention-stop-mindless-b/dladanhaondcgpahgiflodhckhoeohoe
35. Intention, Firefox add-on; GIGAZINE review. https://addons.mozilla.org/en-US/firefox/addon/intention/ , https://gigazine.net/gsc_news/en/20200423-intention-addon-chrome-firefox/
36. Intently. https://liveintently.app/
37. Mindful Browsing (GitHub, skoczen). https://github.com/skoczen/mindful-browsing
38. Mindful Browsing site. https://mindfulbrowsing.org/
39. Mindful Browsing, Chrome Web Store; "Gentle Digital Companion" listing. https://chromewebstore.google.com/detail/mindful-browsing/cciemibfcmeeiijeefebhojenhnpoibc , https://chromewebstore.google.com/detail/mindful-browsing-your-gen/nddndgnceehhfcbccakhdfokfpnaepnp
40. Freedom, "Introducing Pause." https://freedom.to/blog/introducing-pause-a-chrome-extension-for-intentional-browsing/
41. Freedom support, "How to use Pause." https://support.freedom.to/en/articles/3149199-how-to-use-pause

**Feed removers**

42. Unhook (Chrome Web Store; unhookextension.com). https://chromewebstore.google.com/detail/unhook-remove-youtube-rec/khncfooichmfjbepaaaebmommgaepoid , https://unhookextension.com/
43. Unhook vs CleanFeed (2026); chrome-stats. https://verybrightsky.github.io/cleanfeed/vs/unhook/ , https://chrome-stats.com/d/khncfooichmfjbepaaaebmommgaepoid
44. News Feed Eradicator (GitHub; AMO). https://github.com/jordwest/news-feed-eradicator , https://addons.mozilla.org/en-US/firefox/addon/news-feed-eradicator/
45. DF Tube listings. https://chromewebstore.google.com/detail/df-tube-distraction-free/mcigjliffjfjceioeeiolliiimglknji , https://addons.mozilla.org/en-US/firefox/addon/df-youtube/
46. LeechBlock NG; Blockodile. https://addons.mozilla.org/en-GB/firefox/addon/leechblock-ng/ , https://siteblocker.app/

**Newcomers and hardware**

47. Jomo (jomo.so; Screen Time Index; habitdoom). https://jomo.so/blog/why-time-limits-dont-work-and-what-to-do-instead-in-2026 , https://screentimeindex.com/posts/jomo-app-review/
48. Intention AI (GitHub: MaybeItsSoftware/intention). https://github.com/MaybeItsSoftware/intention
49. Intention AI, Chrome Web Store. https://chromewebstore.google.com/detail/intention/dbeapcoomlbnpljdnblmegniiacfoeop
50. Focus AI, Firefox and Chrome listings; Locked In; Focal. https://addons.mozilla.org/en-US/firefox/addon/focus-ai/ , https://chromewebstore.google.com/detail/locked-in-ai-powered-focu/okcihmoacpckcdkkkhodfddoooolgmoj
51. Focus AI site. https://www.getfocusai.com/
52. Brick review (Cybernews); Forbes. https://cybernews.com/reviews/brick-phone-blocker-review/ , https://www.forbes.com/sites/forbes-personal-shopper/article/brick-review/
53. Unpluq; Bloom. https://www.unpluq.com/ , https://apps.apple.com/es/app/id6736728158
