# Roots: Screen Time Control — block-moment teardown for Sordino 2.0

Researched 2026-10-03. Subject: Roots (getroots.app, iOS App Store id6446800962, help centre intercom.help/roots), by Get Roots, Inc. (founder Clint Jarvis). iOS-only; Android is listed as "working on it" [S28].

## 0. Method and evidence labels (read first)

- **No claim in this report is "confirmed".** The egress proxy blocked every primary source: apps.apple.com, itunes.apple.com, intercom.help, getroots.app / www.getroots.app, techcrunch.com, 9to5mac.com, nesslabs.com, appshunter.io and justuseapp.com all returned EGRESS_BLOCKED (appadvice.com did not resolve). Everything below comes from WebSearch result summaries of those pages.
- Labels used:
  - **search-summary [Sn]**: the claim appears in a search-engine summary of the source page. It is probably accurate but not verbatim, and it may be paraphrased or merged with other pages.
  - **unverified**: my inference, or a claim that conflicts with another source.
  - (**confirmed** would mean "I read the page itself". Nothing qualifies.)
- **I have not sourced any shield copy, button labels, colours or typefaces.** Where the brief asks for them, this report says "not sourced" rather than guessing.

---

## 1. The block moment

### 1a. The shield (block screen) itself

| Aspect | Finding | Label |
|---|---|---|
| Unblock control on the shield | **None.** "When you use any type of 'Blocking', you need to actively open the Roots app each time you want to temporarily unblock." Roots presents this as a feature, not a limitation: "This small bit of friction is designed to break the autopilot habit… it creates a crucial pause where you can ask yourself: 'Do I really need this right now?'" | search-summary [S1] |
| Where unblocking happens | In the Roots app: a notification dot appears on the **Blocking** tab, and you "tap the 'Unblock' button from the card where it is being blocked". If that fails, use **Help → Reload Blocking**. | search-summary [S2] |
| Shield styles (user-chosen) | Three "App Blocking Screens", set under Roots → Blocking → Settings → Customize Block Screen: **Minimalist** ("a gentle and friendly nudge to put down your phone"), **Scroll Replacements** ("display your personalized Scroll Replacements"), **Aggressive** ("snap yourself out of the scroll with an aggressive message"). | search-summary [S3][S4] |
| Exact title, body copy, illustration and button labels | **Not sourced.** No search result quoted the text of the Minimalist or Aggressive screens. | — |
| Paywall | "Custom app icons and block screens" are listed as paid-subscription features. | search-summary [S5] |
| Voice | Roots's own descriptions span "gentle and friendly" to "aggressive". The voice is a user setting, not one brand voice. | search-summary [S3]; the interpretation is unverified |

**Why there is no button (inference, unverified):** Apple's Screen Time shield gives third-party apps very limited control, so Roots has turned that constraint into an argument for friction. As a result, Roots offers **almost no evidence about in-place gate layout.** Its friction comes from switching to another app plus an optional "speed bump", not from how the shield is arranged.

### 1b. The unblock flow (inside the Roots app)

| Aspect | Finding | Label |
|---|---|---|
| Unblock length | Set per block, not chosen at the gate: options are **5, 10 or 15 minutes**. "Normal" mode on On-Demand blocks unblocks "for 5 minutes at a time". | search-summary [S6][S7][S8] |
| Unblocks per day | Set per block. The help centre's examples use **1, 2 or 2–3 unblocks per day**, each lasting 5 minutes. | search-summary [S6][S9] |
| "Speed bumps" (optional friction before an unblock) | **Breathe to unblock:** a guided inhale/exhale "before the app is unlocked". **Meditate to unblock:** "close your eyes, breathe, follow a guided practice… then you can unblock the app (if you still want to)". **Listen to nature:** "60 seconds of calming nature sounds", six tracks by sound recordist Nick McMahan. **Pet a dog to unblock:** "camera-powered, privacy-safe"; you have to detect a dog and pet it. Roots calls these "a growing collection of 'Speed Bumps' — intentional moments of friction". | search-summary [S10][S11][S12][S13][S14] |
| Typed intent or reason prompt | **No sourced evidence** of typed intent or a reason prompt. | — |
| End of an unblocked window | **Live Activities** show "when apps will be blocked again". When the window ends, the app is blocked again. No sourced detail exists on any warning toast. | search-summary [S15] |
| Going over the daily unblock allowance | "If you unblock apps after you've reached your set number of unblocks, you will lose your Streak." In Normal mode this suggests extra unblocks remain possible but cost the streak. Monk Mode prevents them. | search-summary [S16]; the Normal-mode reading is unverified |
| Emergency routes | **Emergency Unblock** (for multi-day needs, under Help → Emergency Unblock). **Pause** (unblocks everything, for "just a day" or for editing Monk Mode blocks). As a last resort, revoke Screen Time permission in iOS Settings, which can lose history. Pauses and Emergency Unblocks are "meant to be used sparingly; refilling them too often can reduce their effectiveness". Since v2.11.1 a user can ask support to **permanently disable Emergency Unblock refills**. | search-summary [S17][S18][S19] |

---

## 2. Limit types, strictness and protecting settings

| Mechanism | Finding | Label |
|---|---|---|
| Four block types | **On-Demand** ("Block Now", one tap from Home), **Time Limit** (blocks after a set amount of use), **Downtime** (blocks during chosen hours), **All Day (Limited Unblocks)** (blocks immediately, with N unblocks). | search-summary [S9][S20] |
| Open-count limits ("Intentional Mode") | "Limit usage based on number of opens instead of time limits." Works with app limits, downtimes and on-demand blocking. The App Store description says "Block any app or website based on time limits or number of opens". | search-summary [S21][S22] |
| Strictness per block | **Normal** (5-minute unblocks are allowed) or **Monk Mode**. Roots's own founder-style guide uses Monk Mode for distracting apps, Normal for work apps, and a Normal-mode "Peaceful Mornings" downtime from 4am to 9am. | search-summary [S7][S23] |
| Monk Mode | "Doesn't let you unblock until tomorrow." No editing or deleting after the limit is hit, no logging out of Roots, no changing the phone's date or time. It is a paid feature. | search-summary [S22][S24][S25] |
| **Lock Editing** (protects against loosening settings) | "Any attempt to edit or delete any 'Blocks' triggers a **12-hour unlock timer**, preventing instant changes." It is a per-block toggle, framed as stopping you overriding your setup "in a moment of weakness". | search-summary [S26] |
| Leak around the locks | Roots's own help tells users who want to edit an active Monk Mode block to **use Pause to edit, then "Resume Blocking"**. In other words, a strict lock pushes people towards the general escape hatch. | search-summary [S27][S17] |
| Other protections | "App uninstall protection" and "Block adult content", both paid. | search-summary [S5][S34] |
| Reset | Daily ("until tomorrow"). No exact reset time was sourced. | search-summary [S22]; the time is not sourced |
| App Groups | Saved sets of apps and websites, reused across limits, downtimes and on-demand blocks. | search-summary [S23][S29] |
| Days off | **"Vacation days" (formerly "Pauses")** turn off all blocking for a day "without losing your streak". You earn **one for every 14 days of Streak**. The article's URL slug is `what-are-cheat-days`, so the feature has been renamed at least twice: cheat days → Pauses → Vacation days. | search-summary [S30][S34] |

**Unclear (flagged):** "Pause" in Roots seems to mean two things: a Pause button on the Blocking tab used for emergencies and edits [S17][S27], and the earned day-off that is now called Vacation days [S30]. The summaries do not settle whether these are the same thing.

---

## 3. Insights and feedback

| Mechanism | Finding | Label |
|---|---|---|
| **Balance Score** | Every day starts "In Balance" at **99** and moves up and down with screen time against goal, pickups against target, Digital Dopamine hits and breaks taken. The bands are **90+** very balanced, **80–89** in balance, **70–79** "may want to put down your phone", **≤69** "fallen out of balance". | search-summary [S31] |
| **Digital Dopamine** | Roots calls it "patent-pending" and "the first time Digital Dopamine has ever been quantified". It estimates "Dopamine Hits" from taps, swipes and notifications (~10 min of social media ≈ 300 hits). A third-party comparison describes per-app points: TikTok-type apps 5, news 2, Maps 0, against a "daily dopamine budget". | search-summary [S32][S33][S35] |
| Conflicting claim | A Product Hunt / Atlanta Magazine summary says dopamine is measured from "heart rate, sleep patterns, and exercise movement". This conflicts with the help centre. | unverified [S36] |
| Daily Intentions / Daily Goals | Total screen time per day, phone pickups per day, and "what you'd rather do instead of scrolling". At setup, defaults are set from the user's **current average usage**. | search-summary [S37][S38] |
| Streaks | Count the days in a row you stay within your blocks. Rewards are **special app icons** and earned Pauses/Vacation days. A streak breaks if you unblock past the allowed number. Exceeding your total screen-time goal does not break it. | search-summary [S16][S39] |
| Profile / trends | "How much your average screen time has decreased, how much time you've **unlocked** with Roots", plus daily, weekly and monthly trends. A "Before Roots" baseline can be edited. | search-summary [S23][S40] |
| Detox Challenges | Weekly 24-hour challenges "alongside friends and the Roots community". The first one covered all social media apps with **3 × 5-minute unblocks**. Public challenge pages exist (e.g. "Sunday social media detox", "Post-election week detox"). | search-summary [S21] |
| Weekly reports, Stats | Listed as paid features. | search-summary [S5] |

How these are presented visually: a "Balance Trees" visualisation of progress over time and "beautiful illustrations" around the daily score. The source is a secondary summary that may be paraphrasing App Store copy [S41], so no layout detail was sourced.

---

## 4. Onboarding and pricing

**Onboarding (search-summary [S41][S42][S38][S43]):**
- Asks how long you spend on your phone each day, then "what things you would like to do if you could free up more time" (e.g. reading, friends and family, exercise, relaxing).
- Uses the user's current average usage to pre-fill Daily Intentions.
- **Account creation is part of onboarding** ("complete the onboarding and account creation").
- The help centre's setup checklist is long and mostly about iOS plumbing: turn off "Share Across Devices", turn off Apple's own App Limits and Downtime, remove Screen Time permission from other apps, turn off Low Power Mode, and set up Always Allowed apps.
- No paywall placement was sourced. "Some users have reported issues with the paywall experience" is the only signal (search-summary [S44], vague).

**Pricing (sources conflict, so all three readings are reported):**
- Roots Plus costs **$9.99/month or $59.99/year**, with a **7-day free trial** and a student discount (search-summary [S45][S44][S22]).
- On the free tier, the sources disagree:
  - The help article "What extra features come with a paid subscription?" says "Roots is subscription-only… there's no free plan with limited features" [S5].
  - The help article "Do I need a free trial…?" says "Roots offers a free version of the app with a lot of awesome features" [S46].
  - The pricing-page summary lists a $0 free plan [S45].
- A **needs-based / discount programme** exists. One review mentions a reduced rate of **$2.99/month** (search-summary [S47][S48]).
- Paid-only features include Monk Mode, Lock Editing, Digital Dopamine, Balance Score, App Groups, Vacation days and custom block screens [S5].

---

## 5. Website blocking and private browsing

| Finding | Label |
|---|---|
| Website blocks apply in Safari, Chrome, Firefox "or any other browser" on the phone. | search-summary [S49] |
| To add a site you must **first visit it in Safari** so it appears in the picker, then search for it and select it. | search-summary [S49] |
| **Private Browsing in Safari is disabled by Apple on iOS 18 or earlier** when websites or Safari are blocked, or when "Block adult content" is on, because "otherwise it's not possible to track and limit usage". On **iOS 26** private browsing stays enabled because filtering now works with it. Roots's advice to private-browsing users: remove websites from blocking or update iOS. | search-summary [S49][S50] |
| Roots offers a YouTube Shorts-only block (a help article exists). The mechanism was not sourced. | search-summary [S51] |
| "A website I blocked is still accessible" is a dedicated troubleshooting article. | search-summary [S28] |

What matters for Sordino: on iOS ≤18, Roots's platform **removed** the private-window loophole on the user's behalf, and Roots then **explained** that in the help centre. Sordino cannot force private-window coverage (it depends on the user's per-extension browser setting). Decision #2/#24 (tell the user honestly at First run) is the closest equivalent that fits the brand.

---

## 6. Visual identity (thinly sourced)

- "Peaceful green mountain landscape illustration with the slogan 'scroll less live more'"; a nature theme; "Balance Trees" (search-summary [S41]).
- Taglines in circulation: "Scroll less, live more" (site v1 title and LinkedIn company name), "Escape the doomscroll and reclaim your life" (current site title) and "Set boundaries with your phone, and unlock more time" (App Store) (search-summary [S52][S22]).
- Users can switch the app icon to rewards earned through streaks [S39].
- **Not sourced:** palette values, typefaces, illustration style beyond the above, shield visuals, App Store screenshot captions.
- "Roots" as a metaphor (grounding, growth, trees) shows up in Balance Trees and the nature-sound speed bump [S11][S41]. The metaphor reading itself is unverified.

---

## 7. Reviews: what users say

The App Store shows **4.8★ from about 2.7K ratings** (search-summary [S53]). The search summaries surfaced only a few concrete reviews:

**Praise**
- "Roots has worked better for me than any other app blocker or screen time limiter." Reviewers credit **flexibility in strictness levels** and unblocking "based on time or number of unlocks" (search-summary [S53]).
- Strong edit locking; worth the subscription after about a year; responsive developers (search-summary [S53]).
- Reduces impulsive scrolling after more than a year of use (search-summary [S53]).
- On Monk Mode: "for my screen addiction I need the option eliminated that allows me to just enter a passcode to get more time" (search-summary [S54]).
- The needs-based price ($2.99/mo) is appreciated (search-summary [S48]).
- Pet-a-dog has "become a favorite" (marketing-sourced; search-summary [S14]).

**Complaints**
- **Blocked when they shouldn't be.** "Locked out of apps that I needed after only being awake for three minutes", with a time-out on a work app at 6:03 am. The developers acknowledged a bug that makes limits "block too early", offered lifetime premium, and the reviewer gave up on app-specific time limits (search-summary [S53][S54]). The help centre's top troubleshooting items match: "Why are apps blocked when they should NOT be?", "Why are my time limits kicking in too early?" (#1 cause: Share Across Devices) and "Why can't I see the Unblock button?" [S55][S56][S57].
- The app freezes when selecting apps to block; "frustrating when apps are locked unexpectedly" (search-summary [S53][S54]).
- Paywall experience issues, without detail (search-summary [S44]).

**Whether the friction "feels right"** has almost no direct evidence. No sourced review says the speed bumps are annoying or calming. The strongest negative signal is **false positives** (muting at the wrong time). Strictness itself is not criticised, and users who choose strictness praise it. Inference (unverified): for a soft blocker, **getting right *when* muting applies, and showing why on screen**, matters more to trust than fine-tuning friction.

---

## 8. Motion and delight

This section was added at the coordinator's request because a much heavier musical and animated overlay direction is being considered. The same labels apply. Again, nothing here is "confirmed": every fetch was blocked, including ncbi.nlm.nih.gov, jmir.org and whistleout.com. Labels marked **[int-Sx]** cite this session's earlier report `competitors-mindful.md` (its own source Sx), which also comes from search summaries.

### 8a. Roots: what moves, and whether the motion is the friction

| Surface | What is sourced | Label |
|---|---|---|
| Shield | Nothing about animation, transitions or haptics. The shield is a static Screen Time screen in one of three copy registers (§1a). | not sourced |
| Breathe to unblock | A guided "inhale, exhale, re-center", and only after that is the app unlocked. One search summary calls it an "animated breathing circle", but the shape and motion are **unverified**: no source describes them. | search-summary [S10]; the circle is unverified [S59] |
| Meditate to unblock | A short guided practice; you "close your eyes". This is audio-led, so motion is not the point. | search-summary [S12] |
| Listen to nature | **60 s of audio** (six field recordings by sound recordist Nick McMahan). Here **sound, not motion, carries the wait**: the length of the clip *is* the friction. | search-summary [S11] |
| Pet a dog | The camera detects a dog and the user pets it. The friction is a real-world action. Delight is the selling point ("extremely wholesome"). | search-summary [S13][S22] |
| Home and insights | "Balance Trees" let you "visualize your progress over time… keep your tree healthy". A refreshed Home tab added a **heat map** (v2.18, 2026-05-27). No sourced detail on whether the tree animates or grows on screen. | search-summary [S41][S60][S15] |
| End of unblock | A Live Activity shows when apps will be blocked again. It is a status display, not a celebration. | search-summary [S15] |
| Celebrations, confetti, haptics | **None sourced.** The rewards are static: special app icons and earned Vacation days [S39][S30]. | not sourced |
| Direction of travel | App Store notes reportedly mention "a major update with a **simpler design** and an all-new Stats tab… Pauses are becoming Vacation Days". A "Simple Mode under Me → App style" also surfaced, but it may belong to a different app. | search-summary [S60]; Simple Mode unverified |

**Reading (unverified):** Roots's delight comes from **content novelty** (a dog, named field recordings, guided meditation), not from motion design. Where an animation or sound exists, **it is the wait**: the breathing cycle or the 60 s clip has to finish before the unblock. The shield itself is not animated in any source. No sourced review describes Roots's speed bumps as calming *or* gimmicky over time. Only marketing claims that pet-a-dog "has become a favorite" [S14].

### 8b. Other apps where the animation is the mechanism

| App | Animated or sensory mechanism | What evidence and reviews say | Label |
|---|---|---|---|
| **one sec** | A breathing animation before the target app opens, with **vibration**; then "I don't want to open X" / "Continue". The default wait is about 6 s (3–60 s). | Reviewers describe it as "pretty immersive" at first, but "the breathing exercise that felt meaningful on day one can feel like an **annoying formality by week four**"; "a breath you've swiped past two hundred times is furniture"; "my brain learned to autopilot through the breathing prompt" after about 10 days. The field data fit this: closure rate fell from ~43% (week 1) to ~32–34% (weeks 3–6). The PNAS component experiment found **the dismiss option strongest, a time delay effective but not additive, and the deliberation message alone ineffective**. That points at the *wait*, not its visual form. | search-summary [S61][S62]; [int-S1][int-S2][int-S3] |
| **ScreenZen** | The **plain countdown** before the app opens, with escalating delays (5–60 s). Reviewers describe it as having "no breathing exercises or motivational prompts". | Users report turning back on ~40% of opens with 15 s delays. The delays still "start to feel routine after a few weeks". Reviewers call it "less calming" than one sec. **Habituation hits the plain timer too**, so animation is neither required for the effect nor protection against habituation. | search-summary [S63] |
| **Forest** | A seed grows into a tree during a focus session. Leaving the app **kills the tree**, and the dead tree stays in your forest. The animation *is* the commitment device (loss aversion). | Reviews: in weeks 1–2 "killing a tree feels bad"; by weeks 3–4 "one dead one barely registers and the guilt dissolves"; by month 2+ "Forest becomes just a timer app". A 2023 JMIR multimethod review rated Forest's evidence for reducing phone use as **weak** (one study, n=26), although it scored the highest user sentiment among focus apps. | search-summary [S64][S65] |
| **Opal** | Smooth animations, a "gem" reveal after subscribing, "Mindful Block Screens" with quotes and puns. | Praised: "animations are smooth… using the app feels intentional rather than clinical". Criticised: "answer a survey, here's a **pointless loading screen, another animation**"; and on Opal's own forum, a motion-sensitive user called the app-open animation "**jarring**". | search-summary [S66][S67] |
| **Calm / Headspace breathers** | Calm's "Breathe Bubble", with adjustable speed, timers and **haptics**. Headspace's breathing play button "expands and contracts like lungs" (reported as 4-2-6 timing). | Lab evidence on breathing *visualisations* (not friction): Chittaro & Sioni 2014 found that a visual guide produced deeper breathing and was preferred over audio-only. A 2021 JMIR Serious Games experiment found a **gameful** breathing visualisation **raised enjoyment (p=.001) but not perceived effectiveness (p=.50) or intention to engage (p=.44)**. | search-summary [S68][S69][S70][S71] |
| Research on intrusiveness | — | A **plain black screen** was rated highest for continued use because it felt least intrusive ("Seeing Your Mindless Face", n=84). For highly impulsive users, an **explicit pop-up** worked faster than gradual visual or haptic frictions, but felt more frustrating ("Can't Stop", n=104). | [int-S17][int-S15] |

### 8c. What this means for a heavier musical and animated overlay

1. **Delight is not the active ingredient.** The one source that tests the parts separately (the PNAS component experiment) finds the effect in the **visible way out, then the wait**. The message adds nothing measurable. Motion and sensory dressing raise enjoyment at best (JMIR 2021), and they habituate on the same 2–4 week curve as a plain timer (one sec, ScreenZen, Forest). An animated overlay may be more pleasant. No source suggests it will be more effective, or that it will slow habituation.
2. **If the animation becomes the wait, it is a breathing exercise in other clothes.** A musical phrase or fermata that "resolves" when the bypass opens does the same job as one sec's breath or Roots's 60 s nature clip. That is the pattern PRODUCT.md lists as wellness drift ("breathing animations", "any pulse animation framed as a calming gesture"). It also turns a 5 s number into a ritual that users report as "furniture" within weeks.
3. **Hard constraints from decisions already made** (they apply to any direction):
   - Under `prefers-reduced-motion`, the overlay must work fully with no motion. So the **plain "Bypass in N" number stays the source of truth**, and any animation can only repeat it, never replace it.
   - The animation can never be longer than the bypass wait (#17: 5 s default, 0–15 s; 0 = off means no gating animation at all) or the 30 s spent-budget wait (#18).
   - **Turn back stays instant** (#17), with no exit animation before leaving.
   - Opal's "jarring" open animation and motion-sensitive users are exactly what the reduced-motion hard requirement is for.
4. **No celebration of turning back.** Forest's and Roots's reward and loss visuals (a growing tree, a dying tree, app-icon rewards) conflict with Principle 2 and with "doesn't reward the resistance" (Principle 4).
5. **Sound has an extra platform hurdle** (unverified; check before prototyping). Browsers generally block audible autoplay without a user gesture on that page. An overlay that appears on navigation probably cannot rely on sound playing, so music would have to be opt-in and started by the user. Roots gets around this because the user deliberately starts a nature clip inside its own app.
6. **If the heavier direction goes ahead, the evidence-compatible version is narrow:** one motion, tied to state, on the element that is waiting. For example, the "Bypass in N" control fills or resolves over exactly N seconds, has a static equivalent under reduced motion, and has no ambient loop. This fits variant C's bottom action bar best: the waiting control is separate and the headline stays still. A and B would put motion next to the large Turn back button or on top of a blurred page that is already a decorative layer.

**Effect on decisions:** none change. These findings support #17/#18 (a plain-number wait) and the Known Tensions drift list. If the team still wants the heavier direction, treat it as **one prototype variant to test**, not a default. Judge it on whether it still reads as calm by week four, not on first-run delight.

---

## 9. Mechanism mapping: Roots → Sordino today → recommendation

Sordino's "today" column describes the 2.0 decisions (the decisions doc) where they exist, otherwise v1 behaviour.

| # | Roots mechanism | Sordino today / decided | Rec. | Why |
|---|---|---|---|---|
| 1 | Shield has no unblock button; you must open the Roots app | Bypass on the overlay itself, after a bypass wait (#17) | **SKIP** | Principle 1 says the escape route must be *visible*. Sending people to the popup would turn the overlay into a wall. Roots's own help centre has to defend this choice [S1], so Sordino's in-place bypass is a real point of difference. |
| 2 | Three block-screen registers (Minimalist / Scroll Replacements / Aggressive) | One voice: rotating peer titles plus a quote pool (#21) | **SKIP** the register picker and **Aggressive** | Aggressive is the "guilt copy" anti-reference. A style picker goes against Principle 3. "Minimalist = a gentle nudge that reports state" supports variant C (see §10). |
| 3 | **Scroll Replacements**: a list the user writes ("what I'd rather do") shown on the block screen | Nothing like it | **ADAPT (decision candidate)** | One optional line in the user's own words, entered in Settings (and optionally at First run), shown on the overlay *in place of* the quote. It is displayed only: not a gate, not typed at the gate (ADR-0002's rejection of typed challenges does not apply), not tracked, not scored. It is peer-not-parent because the words are the user's. Risk: wellness-drift copy in placeholders ("go for a walk"), so leave the field empty with a neutral label. **Would amend #21** ("titles + quotes, or the user's own line") and optionally #24. |
| 4 | Speed bumps: breathe / meditate / 60 s nature / pet a dog | Plain-number bypass wait, 5 s default, 0–15 s (#17); 30 s once the budget is spent (#18) | **SKIP** | Breathing and meditation are named drift signals in PRODUCT.md Known Tensions ("Breathing animations", "Take a moment"). Pet-a-dog needs the camera, which conflicts with Principle 5. Roots's 60 s nature track confirms that a fixed wait is an accepted pattern, so **#17/#18 stand unchanged**. |
| 5 | Unblock length set per block (5/10/15 min), not at the gate | Fixed, configurable bypass length (#20) | **ADOPT (already)** | Same model. Roots also does not ask at the gate, which supports #20. |
| 6 | Limited unblocks per day (examples 1–3 × 5 min); "Intentional Mode" open-count limits | Bypass budget, default 3 × 5 min, per-site timers (#19) | **ADOPT (already)** | Roots's examples land on the same defaults. Open-count limits work like the bypass budget. No change. |
| 7 | Going over the allowance costs the Streak (Normal) or is impossible (Monk) | Spent budget means a 30 s wait, counted honestly (ADR-0002) | **ADOPT ADR-0002 as-is** | Roots shows the two alternatives Sordino rejected: a gamified penalty and a hard stop. |
| 8 | **Monk Mode** (no unblock until tomorrow, no editing, no logout, no clock change) | None | **SKIP** | Hard-blocker anti-reference; Principle 1; #4 (passwords/lockdown out of scope). |
| 9 | **Lock Editing**: 12 h timer before editing or deleting a block | Settings changes are instant | **SKIP for 2.0** | #4 (lockdown out of scope). Roots's own workaround (Pause, then edit [S27]) shows that locks just push people to the escape hatch, and Sordino's Pause is already finite and counted (#14). *A softened version, if ever wanted:* the same plain-number bypass wait (e.g. 5 s) on "remove site" or "delete schedule" **only while that site is muted right now**, with no multi-hour timer. Not recommended now. |
| 10 | Emergency Unblock (multi-day), refills, opt-in permanent disabling of refills | Emergency refresh retired (ADR-0002); Pause up to rest of today (#14) | **SKIP**; note one need | The refill system goes with Monk-style strictness. Roots does show a real **multi-day "I'm travelling" need** (a dedicated article [S58] plus Vacation days). Sordino covers it today by turning schedules off. Log "dated Pause (finite, ends on a chosen date)" as a later question. It fits #13 (no indefinite states). **No change to #14 now.** |
| 11 | Vacation days / Pauses **earned** through streaks (1 per 14 days); renamed cheat days → Pauses → Vacation days | Pause is always available and counted (#14) | **SKIP** | Gamification anti-reference; Principle 2. The two renames are a useful cautionary example in favour of GLOSSARY discipline ("Pause", never "cheat"). |
| 12 | Streaks; app icons as rewards | None | **SKIP** | Principle 2; gamified-tracker anti-reference. |
| 13 | **Balance Score** (starts at 99, bands with advisory copy) | Raw counts only (#23) | **SKIP** | "Scoreboarding in mirror's clothing" (Known Tensions). The band copy "may want to put down your phone" is parent voice (Principle 4). |
| 14 | **Digital Dopamine** hits/points per app class | None | **SKIP** | A derived metric (#23). It would need interaction tracking, against Principle 5's spirit. The sources disagree on how it is even measured [S32] vs [S36]. |
| 15 | Daily Intentions / goals pre-filled from your usage | First run: defaults pre-selected, Start button (#24) | **SKIP** goals | Goals plus progress are a scoreboard. The useful part ("what you'd rather do") is covered by row 3. |
| 16 | "Time unlocked", "Before Roots" baseline, "screen time decreased" | Counts only (#23) | **SKIP** | Known Tensions specifically names "You've reclaimed 4.2 hours" as forbidden. |
| 17 | Detox Challenges with friends / community | None | **SKIP** | Gamification; Principle 5 forbids "your community"; #4 (no accounts). |
| 18 | Live Activity showing when apps re-block | Toolbar badge plus one "ending in 1 min" toast on the bypassed site (#22) | **ADOPT (already)** | Same job: make the end time visible without interrupting. Supports #22 as decided. |
| 19 | On-Demand "Block Now" (Normal / Monk) | Mute now with a chosen duration (#13) | **ADOPT (already)** | Same model without the Monk branch. |
| 20 | Time Limit blocks (block after N minutes of use) | Not planned (schedules only) | **SKIP for 2.0** | This needs time-on-site tracking, and Usage is counts-only (#23). The worst bug in Roots's reviews is limits "kicking in too early", which shows how fragile usage-based triggers are. |
| 21 | App Groups reused across block types | Categories (Social, Video, News) | **ADOPT (already)**; note for the future | When per-category schedules (#3, deferred) arrive, Roots's model of reusable groups with a per-block mode is the reference. |
| 22 | Website blocking; private browsing turned off by iOS ≤18 and explained in the help centre | Private-window honesty at First run (#2, #24) | **ADOPT (already)** | Same honesty, with no forcing. |
| 23 | Uninstall protection; adult-content block | None | **SKIP** | Lockdown (#4). |
| 24 | Account created during onboarding; subscription and paywall | No account; free | **SKIP** | Principle 5; #4. |
| 25 | "Do I really need this right now?" as the purpose of the friction | Overlay asks no question | **SKIP the question** | Principle 4 rules out "Are you sure…"-style copy. The overlay states facts and the user decides. |
| 26 | Animated or audio speed bump as the wait (breathing cycle, 60 s nature clip) | Plain "Bypass in N" number (#17) | **SKIP** as a gate; **ADAPT** only as a redundant fill on the waiting control | §8: the effect comes from the wait, not its form. Breathing animation is a named drift signal. Reduced motion must keep the number as the truth. |
| 27 | Balance Trees (a tree whose health reflects your score) | Usage raw counts | **SKIP** | A growth or decay metaphor tied to a score is a scoreboard (Principle 2). Forest's version habituates within weeks (§8b). |

---

## 10. Decisions this should change or inform

**Changes to propose (one):**
- **#21 Overlay words:** consider adding "or the user's own line" (row 3). This is the one Roots mechanism that adds something new and on-brand: the user's own words at the moment of choice, with no metric attached. It should be **opt-in, empty by default, one line, not a list**, entered in Settings and optionally offered at First run (#24, a small change). If adopted, every overlay variant needs one secondary text slot.

**Confirmed, no change:** #13, #14, #17, #18 / ADR-0002, #19, #20, #22, #23, #24, #2 (private windows), #4.

**Logged for later, no change now:** a dated Pause for multi-day absence (row 10); reusable groups when per-category schedules arrive (row 21).

### Effect on the overlay variant choice (A / B / C)

This is a nudge, not a verdict. **Roots cannot decide the layout**, because its shield has no in-place choice to lay out. What does carry over:

1. **State the end time and the reason.** Roots's highest-volume support topics are about being blocked "when they should NOT be" or "too early" [S55][S56], and its Live Activity exists to show when blocking resumes [S15]. A headline like **"reddit.com is muted until 17:00." (variant C)** answers "why am I seeing this, and for how long" in its first words. That helps users spot a wrong schedule themselves, which is the trust failure Roots's reviews show most. A and B can carry the same line, but C makes it the headline. **This leans towards C**, or towards making sure A/B put the site + "until HH:MM" in the first line.
2. **Room for the user's own line (if #21 changes).** C's single headline plus bottom action bar leaves a natural slot for a second line. B's card can hold it but competes with the blurred page. A's large Turn back dominates.
3. **Roots's "Minimalist" register** ("a gentle and friendly nudge") is the closest match to Sordino's voice, and it is the opposite of a decorated screen. That supports C's sparseness over B's blur, which is decoration that would have to earn its place under Principle 3.
4. **Strictness belongs in configuration, not layout.** Roots reviewers praise "flexibility in strictness levels" [S53]. For Sordino that means the configurable bypass wait (#17) and scaffoldingMode, which are the same in all variants. The visible "Bypass in N" countdown should look the same in whichever variant wins.
5. **Motion, if any, belongs on the waiting control** (§8c point 6). C's separate bottom action bar gives that control its own space, away from a still headline, which is another small reason to prefer C under a heavier animated direction.

---

## 11. Sources

All accessed 2026-10-03 through WebSearch result summaries only; direct fetches were blocked.

- S1. Why do I need to open the Roots app to unblock each time? https://intercom.help/roots/en/articles/12942310-why-do-i-need-to-open-the-roots-app-to-unblock-each-time
- S2. How do I unblock apps? https://intercom.help/roots/en/articles/10203206-how-do-i-unblock-apps
- S3. How do I customize my "Block Screen"? https://intercom.help/roots/en/articles/10290083-how-do-i-customize-my-block-screen
- S4. Introducing Custom App Block Screens. https://www.getroots.app/posts/introducing-custom-app-block-screens
- S5. What extra features come with a paid subscription? https://intercom.help/roots/en/articles/10823277-what-extra-features-come-with-a-paid-subscription
- S6. Help-centre summaries of unblock durations and counts (via search across intercom.help/roots, incl. "What are the different ways to block apps?" and "How do I get the most out of Roots?"). https://intercom.help/roots/en/articles/10733719-what-are-the-different-ways-to-block-apps
- S7. Introducing On-Demand Blocking. https://www.getroots.app/posts/introducing-on-demand-blocking
- S8. Major Roots Update: What's the Latest? https://www.getroots.app/posts/major-roots-update-whats-new
- S9. How do I get the most out of Roots? https://intercom.help/roots/en/articles/8937423-how-do-i-get-the-most-out-of-roots
- S10. Introducing: Breathing exercise to unblock. https://www.getroots.app/posts/introducing-breathing-exercise-to-unblock
- S11. Introducing: Listen to nature to unblock. https://www.getroots.app/posts/introducing-listen-to-nature-to-unblock-6y4kl
- S12. Introducing: Meditate to unblock. https://www.getroots.app/posts/introducing-meditate-to-unblock
- S13. Features: Pet a dog to unblock. https://www.getroots.app/features/pet-a-dog-to-unblock
- S14. Product Hunt: Pet a dog to use social media. https://www.producthunt.com/posts/pet-a-dog-to-use-social-media-by-roots
- S15. Live Activities for temporary unblocks (App Store listing summary). https://apps.apple.com/us/app/roots-screen-time-control/id6446800962
- S16. What are "Streaks"? https://intercom.help/roots/en/articles/10728700-what-are-streaks-how-do-streaks-work
- S17. How do I unblock in an emergency? https://intercom.help/roots/en/articles/10290109-how-do-i-unblock-in-an-emergency
- S18. How to stop "Emergency Unblock" refills. https://intercom.help/roots/en/articles/12146863-how-to-stop-emergency-unblock-refills
- S19. How do I unblock during an emergency in "Monk Mode"? https://intercom.help/roots/en/articles/11905029-how-do-i-unblock-during-an-emergency-in-monk-mode
- S20. What are the different ways to block apps? https://intercom.help/roots/en/articles/10733719-what-are-the-different-ways-to-block-apps
- S21. New: Intentional blocking and challenges. https://www.getroots.app/posts/introducing-intentional-blocking-and-detox-challenges ; Challenges index https://www.getroots.app/challenges
- S22. App Store listing (description, pricing). https://apps.apple.com/us/app/roots-screen-time-control/id6446800962
- S23. How I'm using the latest version of Roots. https://www.getroots.app/posts/how-im-using-the-latest-version-of-roots
- S24. What is "Monk Mode"? https://intercom.help/roots/en/articles/11130176-what-is-monk-mode
- S25. Monk Mode feature page. https://www.getroots.app/features/monk-mode ; 9to5Mac, "This app is like Screen Time on steroids" (2024-06-21) https://9to5mac.com/2024/06/21/this-app-is-like-screen-time-on-steroids/
- S26. What is "Lock Editing"? https://intercom.help/roots/en/articles/10766593-what-is-lock-editing
- S27. How do I edit an active block in "Monk Mode"? https://intercom.help/roots/en/articles/12135389-how-do-i-edit-an-active-block-in-monk-mode
- S28. Is Roots available on Android? https://intercom.help/roots/en/articles/10290138-is-roots-available-on-android ; A website I blocked is still accessible https://intercom.help/roots/en/articles/14193834-a-website-i-blocked-is-still-accessible
- S29. How to use App Groups. https://intercom.help/roots/en/articles/10290098-how-to-use-app-groups
- S30. What are "Vacation days"? (formerly "Pauses"; slug "what-are-cheat-days"). https://intercom.help/roots/en/articles/10290118-what-are-cheat-days ; also https://intercom.help/roots/en/articles/10290118-what-are-pauses
- S31. What is my "Balance Score"? https://intercom.help/roots/en/articles/8908462-what-is-my-balance-score
- S32. What is "Digital Dopamine"? https://intercom.help/roots/en/articles/9524490-what-is-digital-dopamine
- S33. Introducing Digital Dopamine Tracking. https://www.getroots.app/posts/introducing-digital-dopamine-tracking ; TechCrunch (2024-06-20) https://techcrunch.com/2024/06/20/roots-introduces-a-screen-time-app-for-tracking-digital-dopamine/
- S34. What is "App uninstall protection"? https://intercom.help/roots/en/articles/10774980-what-is-app-uninstall-protection
- S35. unhookd vs Roots (competitor blog; treat as biased). https://unhookd.app/blog/unhookd-vs-roots
- S36. Product Hunt launch / Atlanta Magazine. https://www.producthunt.com/products/roots-3?launch=roots-4 ; https://www.atlantamagazine.com/news-culture-articles/i-got-my-life-back-how-an-atlantans-app-is-helping-curb-phone-addiction/
- S37. What are "Daily Intentions"? https://intercom.help/roots/en/articles/10733623-what-are-daily-intentions
- S38. Ness Labs: Scroll Less and Live More with Clint Jarvis. https://nesslabs.com/roots-featured-tool
- S39. Streak rewards (special app icons), as for S16.
- S40. How do I change my "Before Roots" screen time? https://intercom.help/roots/en/articles/11130554-how-do-i-change-my-before-roots-screen-time
- S41. mwm.ai app profile and 9to5Mac (visuals, Balance Trees, onboarding questions). https://mwm.ai/apps/roots-screen-time-control/6446800962
- S42. Getting set up to use Roots. https://intercom.help/roots/en/articles/9774300-getting-set-up-to-use-roots
- S43. 9to5Mac onboarding description, as for S25.
- S44. Tekpon overview. https://tekpon.com/software/roots/reviews/
- S45. Roots pricing page. https://www.getroots.app/pricing
- S46. Do I need a free trial to use Roots, or is there a free version? https://intercom.help/roots/en/articles/8940519-do-i-need-a-free-trial-to-use-roots-or-is-there-a-free-version
- S47. New Needs-Based Subscription Program. https://www.getroots.app/posts/needs-based-subscription-program ; I can't afford the subscription https://intercom.help/roots/en/articles/11130111-i-can-t-afford-the-subscription-can-you-help
- S48. App Store review mentioning a $2.99/month needs-based rate, as for S53.
- S49. Can I block websites using Roots? https://intercom.help/roots/en/articles/10148398-can-i-block-websites-using-roots
- S50. Why is private browsing disabled in Safari? https://intercom.help/roots/en/articles/10139301-why-is-private-browsing-disabled-in-safari
- S51. How do I block "YouTube Shorts" without blocking all of YouTube? https://intercom.help/roots/en/articles/12226995-how-do-i-block-youtube-shorts-without-blocking-all-of-youtube
- S52. getroots.app home and v1 titles. https://www.getroots.app/ ; https://www.getroots.app/v1
- S53. App Store Ratings & Reviews. https://apps.apple.com/us/app/roots-screen-time-control/id6446800962?see-all=reviews&platform=iphone
- S54. Review aggregators (justuseapp, appshunter). https://justuseapp.com/en/app/6446800962/roots-screen-time-control/reviews ; https://appshunter.io/ios/app/roots-screen-time-control/id6446800962
- S55. Why are apps blocked when they should NOT be? https://intercom.help/roots/en/articles/10734715-why-are-apps-blocked-when-they-should-not-be
- S56. Why are my time limits kicking in too early? https://intercom.help/roots/en/articles/11873928-why-are-my-time-limits-kicking-in-too-early
- S57. Why can't I see the "Unblock" button? https://intercom.help/roots/en/articles/12973559-why-can-t-i-see-the-unblock-button
- S58. Can I turn off app blocking for a few days while traveling or on vacation? https://intercom.help/roots/en/articles/11104992-can-i-turn-off-app-blocking-for-a-few-days-while-traveling-or-on-vacation
- S59. Search summary describing Roots's "animated breathing circle" (App Store listing / getroots.app context; not verified). https://apps.apple.com/us/app/roots-screen-time-control/id6446800962
- S60. Roots App Store release notes (v2.18, 2026-05-27: heat map, Live Activities; "simpler design", Stats tab, Pauses → Vacation Days) and the features page (Balance Trees). https://apps.apple.com/us/app/roots-screen-time-control/id6446800962 ; https://www.getroots.app/features
- S61. WhistleOut, "One Sec App Review: Does Breathing Reduce Screen Time?" https://www.whistleout.com/CellPhones/Guides/one-sec-app-review ; ScreenBuddy, "One Sec App Review: Honest Take After 30 Days" https://www.screenbuddyapp.com/blog/one-sec-app-review ; getfinit, "one sec app review (2026)" https://getfinit.com/blog/one-sec-review (several are competitor-authored)
- S62. Blok, "One sec app review: does adding friction actually reduce screen time?" https://www.blok.so/resources/one-sec-app-review-does-adding-friction-actually-reduce-screen-time ; quotes on autopilot via `user-voice.md` (TimingApp / browwwser / Detox snippets)
- S63. ScreenZen reviews: WhistleOut https://www.whistleout.com/CellPhones/Apps/screenzen-app-review ; unhookd https://unhookd.app/blog/screenzen-worth-it-review ; getfaithlock comparison https://www.getfaithlock.com/resources/screenzen-vs-one-sec (competitor-authored)
- S64. Forest reviews: Screen Time Index https://screentimeindex.com/posts/forest-app-review/ ; Bustle https://www.bustle.com/wellness/forest-focus-screen-time-app-review ; goalsandprogress https://goalsandprogress.com/boost-your-focus-with-the-forest-app/
- S65. "Evaluating the Effectiveness of Apps Designed to Reduce Mobile Phone Use…", JMIR 2023;25:e42541. https://www.jmir.org/2023/1/e42541
- S66. Opal reviews: Headway https://makeheadway.com/blog/opal-app-review/ ; screensdesign UI breakdown https://screensdesign.com/showcase/opal-screen-time-control ; ScreenBuddy https://www.screenbuddyapp.com/blog/opal-app-review ; G2 https://www.g2.com/products/opal/reviews
- S67. Opal community forum, "App open animation is jarring". https://community.opalapp.com/t/app-open-animation-is-jarring/4939
- S68. Calm support, "Calm Breathing Exercises: How to Adjust Speed, Timers & Haptics". https://support.calm.com/hc/en-us/articles/360000069973
- S69. "Headspace: Designing for Calm" (design write-up). https://blakecrosley.com/guides/design/headspace
- S70. Chittaro & Sioni, "Evaluating mobile apps for breathing training: The effectiveness of visualization", Computers in Human Behavior 40 (2014). https://www.sciencedirect.com/science/article/abs/pii/S0747563214004233
- S71. "The Impact of a Gameful Breathing Training Visualization on Intrinsic Experiential Value, Perceived Effectiveness, and Engagement Intentions", JMIR Serious Games 2021;9(3):e22803. https://games.jmir.org/2021/3/e22803/
