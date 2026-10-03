# Sordino: what users say about website blockers

Date: 2026-10-02. Subject: Sordino v1.0.0 (soft-block extension, Chrome + Firefox).

## 0. Read this first: method and limits

- **Egress was restricted in this session.** WebFetch was blocked by policy for addons.mozilla.org, chromewebstore.google.com, reddit.com, news.ycombinator.com, hn.algolia.com, pnas.org, one-sec.app and every blog tried. GitHub issue APIs for third-party repos were not available either. I did not try to get around the blocks.
- **So all external evidence came through WebSearch result summaries.** Quotes marked **[snippet]** appeared in search-engine summaries of the linked page. They are short and probably verbatim, but I could not check them against the page. Treat them as "attributed, unverified." Before quoting any of them publicly, open the URL and confirm.
- **Reddit coverage is weak.** The search index returned almost no Reddit threads for r/nosurf, r/ADHD, r/productivity, r/digitalminimalism or r/getdisciplined. Reddit sentiment shows up only second-hand, through articles and reviews that summarize it. That is the largest gap in this report.
- **Research findings are stronger than store reviews here.** Peer-reviewed numbers (PNAS 2023, CHI 2024, CSCW 2018, CHI 2021, JMIR 2026, IJHCS 2022 with about 54k reviews analysed) were repeated consistently across several search summaries.
- **Sordino's own AMO listing** (search snippet): "no reviews yet, with a rating of 0 by 0 reviewers", v1.0.0, last updated around Jan 7, 2026 (the snippet's dates contradict each other) ([AMO](https://addons.mozilla.org/en-US/firefox/addon/sordino/)). No user count was surfaced. **Sordino has no user voice of its own yet.** Everything below comes from adjacent products.
- **Confidence labels:** **High** means several independent sources plus research. **Medium** means two or more sources, or one strong study. **Low** means a single, vendor or anecdotal source.

### Things I verified in Sordino's code (they matter for the mapping)

| Fact | Where |
|---|---|
| When the daily budget hits 0, the overlay's bypass button is **disabled** ("0 bypasses left / Resets at midnight"). The remaining escape routes are the popup Pause and Emergency refresh, which lives in Settings. | `src/content/content.ts:282-286` |
| There is **no wait time** before bypassing. The bypass takes effect on the first click. With `scaffoldingMode` (opt-in) it takes a second click within 8s. | `content.ts:304-330`, `types.ts:6` |
| Quotes rotate randomly on the overlay (content variety, not a change in interaction). | `content.ts:81-130` |
| **Pause ("15 min / 1 hr / Until tomorrow") has no friction and is not recorded in stats.** Bypasses and emergency refreshes are recorded. | `service-worker.ts:384-395`, `types.ts` (no pause stats) |
| Sites match by **domain only** (hostname or subdomain). There are no path rules. | `service-worker.ts:98-115` |
| Countdown toasts fire before a bypass or pause expires. | `content.ts:760-830` |
| Emergency refresh (one budget refill per day) exists but is only reachable from Settings. The README feature list does not mention it. | `settings/App.tsx:1043` |

---

## (a) Why people uninstall or disable blockers

### A1. Too strict: locked out of something they actually needed. **High**
- One Cold Turkey user locked Gmail so they could write, finished early, and then "was unable to submit work until the lock expired" (paraphrased by the review). Another reviewer was "completely locked out from using browsers entirely" and found it "a huge pain to uninstall". [snippet] ([TechRadar](https://www.techradar.com/reviews/cold-turkey), [Trustpilot](https://www.trustpilot.com/review/getcoldturkey.com))
- Research: "Overly severe restrictions ... often trigger psychological reactance and are regularly circumvented." [snippet] ([JMIR 2026](https://formative.jmir.org/2026/1/e85349)). Lyngs et al. analysed about 54k reviews. Users want support "sufficient to change behaviour without feeling too coercive." [snippet] ([IJHCS 2022 PDF](https://ulriklyngs.com/pdfs/2022-lyngs_et_al_goldilocks_support.pdf))
- An HN commenter: people "often turn off the friction if it's too much", while moderate delays of about 10s can work (paraphrase) ([HN](https://news.ycombinator.com/item?id=22320267)).

### A2. Too easy: "it doesn't actually stop me." **High**
- Lyngs 2022: blocking tools "were often criticised if they were too easy to override" [snippet] ([IJHCS](https://ulriklyngs.com/pdfs/2022-lyngs_et_al_goldilocks_support.pdf)).
- Freedom is "very easy to bypass by simply quitting the Freedom app", or by using private browsing (paraphrase) ([Cisdem](https://www.cisdem.com/resource/freedom-app-review.html), [Blok](https://www.blok.so/resources/freedom-app-review-does-blocking-websites-and-apps-actually-work)).
- StayFocusd's Nuclear Option can't be cancelled, but "doesn't prevent you from uninstalling the extension" [snippet] ([DigitalZen](https://www.digitalzen.app/blog/stayfocusd-alternative/), a vendor source).
- **This is the opposite complaint to A1, from the same population.** Lyngs calls it the "Goldilocks" problem. Sordino is betting on the middle of that range.

### A3. Hostile monetization: paywalls, upsells, nags. **High**
- BlockSite cut its free tier to a "6 site limit", and its "animated, dancing pop-ups" lead people to click through to the premium page by accident [snippet]. There are also double-charge and refund complaints ([AMO 1-star reviews](https://addons.mozilla.org/en-US/firefox/addon/blocksite/reviews/?score=1&page=3), [Trustpilot](https://www.trustpilot.com/review/blocksite.co)).
- one sec "frequently asks for a pro upgrade instead of providing the breathing exercise" [snippet] ([App Store reviews](https://apps.apple.com/us/app/one-sec-screen-time-focus/id1532875441?see-all=reviews)).
- Intention gets criticism for asking users for 5-star ratings ([chrome-stats](https://chrome-stats.com/d/intention/reviews)).

### A4. Intervention fatigue: annoying every single time. **Medium-High**
- one sec: the breathing exercise "can feel like an annoying formality by week four", and brief exits trigger it again [snippet] ([Blok](https://www.blok.so/resources/one-sec-app-review-does-adding-friction-actually-reduce-screen-time), [Slate](https://slate.com/life/2024/06/one-sec-app-smartphone-blocker-instagram-tiktok.html)).
- Lyngs 2020 (Facebook study): goal reminders worked, but "were often annoying" [snippet] ([arXiv](https://arxiv.org/abs/2001.04180)).
- Intention: "the side window can be annoying" [snippet] ([chrome-stats](https://chrome-stats.com/d/intention/reviews)).

### A5. Unreliable or leaky (stops working, incognito gaps, bugs). **Medium**
- A StayFocusd review from Sept 2026: basic blocking "stopped working", no way to add groups of sites, and no support response [snippet] ([chrome-stats](https://chrome-stats.com/d/laankejkbhbdhmipfmgcngdelahlfoji?hl=en)).
- Incognito: "The biggest problem ... they don't initially work when an Incognito Window is used" [snippet] ([TechLockdown](https://www.techlockdown.com/articles/chrome-extensions-for-website-blocking)).
- Unhook has fullscreen and transcript bugs ([AMO reviews](https://addons.mozilla.org/en-US/firefox/addon/youtube-recommended-videos/reviews/)).

### A6. Shame, guilt and streak mechanics. **Medium** (mostly ADHD-focused articles, not first-person reviews)
- Productivity apps "punish inconsistency with dead streaks and guilt-inducing gaps". For people with rejection sensitivity, a broken streak "can trigger a disproportionate shame response" [snippet] ([Xenith](https://xenith.life/articles/adhd-productivity-systems)).
- One first-person account describes an app with a tone of "passive-aggressive disappointment" ([Medium](https://medium.com/@raymond_44620/my-productivity-app-became-a-digital-shame-jar-heres-why-i-m-keeping-it-c823fde2af98)).

---

## (b) Top feature requests and the patterns people reward

| # | Request or pattern | Evidence | Conf. |
|---|---|---|---|
| B1 | **A time delay before access** (rather than a block or a message) | PNAS 2023: the "friction by time delay" cut consumption, while "the deliberation message was not effective" [snippet] ([PNAS](https://www.pnas.org/doi/full/10.1073/pnas.2213114120)). LeechBlock's "delay mode" gets recommended on HN ([HN](https://news.ycombinator.com/item?id=22320267)). | High |
| B2 | **Escalating or adaptive delay** that grows with each visit and decays when you stay away | DecayBlock (Show HN, 2025): the "timeout accumulates with each visit" and decays with a half-life. The author says it worked better than any other tool over several months ([HN](https://news.ycombinator.com/item?id=45329540)). | Low-Med (one maker's anecdote; good mechanism) |
| B3 | **State an intention, or commit to a time** | Intention: "the best method I've found ... while still allowing for human nature of needing short distractions" (600+ day user) [snippet] ([HN](https://news.ycombinator.com/item?id=22936742), [chrome-stats](https://chrome-stats.com/d/dladanhaondcgpahgiflodhckhoeohoe)). There is a crowd of similar tools (With Intention, Intentional, Mindlessly, Intentionality) ([GitHub](https://github.com/sanjeed5/intentional)). | Medium-High |
| B4 | **A reminder after unlocking** (re-prompt when the chosen time ends) | Mindful Browsing "reminds you 10 minutes later". Intention "pauses your browsing after your intended time limit" ([CWS](https://chromewebstore.google.com/detail/mindful-browsing/cciemibfcmeeiijeefebhojenhnpoibc)). | Medium |
| B5 | **Remove the feed, keep the site** (granular, path-level rules) | Unhook: "no longer fall down rabbit holes of recommended videos" [snippet]. News Feed Eradicator: "seamless and unobtrusive" [snippet] ([AMO NFE](https://addons.mozilla.org/en-US/firefox/addon/news-feed-eradicator/), [Unhook reviews](https://addons.mozilla.org/en-US/firefox/addon/youtube-recommended-videos/reviews/)). Lyngs 2020: removing the newsfeed reduced scrolling. | Medium |
| B6 | **Tamper resistance for settings** (password, retyping a random code) | LeechBlock's random-code access control is "to slow you down in moments of weakness" ([docs](https://www.proginosko.com/leechblock/documentation/)). | Medium |
| B7 | **Site groups and more customisation** | StayFocusd review asks for "groups of blocked sites". Intention reviewers "seek more customization options" ([chrome-stats](https://chrome-stats.com/d/intention/reviews)). | Low-Med |
| B8 | **Combine several patterns** (block plus goal reminder) | Tools that combine pattern types "tended to receive higher ratings" [snippet] ([Lyngs 2022](https://ulriklyngs.com/pdfs/2022-lyngs_et_al_goldilocks_support.pdf)). | Medium (correlational) |

---

## (c) What ADHD users need

| # | Need | Evidence | Conf. |
|---|---|---|---|
| C1 | **Bypass buttons get tapped on autopilot.** The override becomes part of the habit loop. | iOS "Ignore Limit": "if your thumb taps through the limit before you think — the limit has become part of the habit loop" [snippet] ([Fella](https://usefella.com/how-to-stop-ignoring-screen-time-limits/), [HabitDoom](https://habitdoom.com/blog/best-app-blocker-adhd)). | Medium (these are vendor blogs selling harder tools, so expect bias) |
| C2 | **Some say ADHD users need stronger guardrails, not more flexibility.** | "ADHD-friendly blockers need friction, not flexibility" [snippet] ([DigitalZen](https://www.digitalzen.app/blog/why-most-website-blockers-dont-work-for-adhd/), a vendor). This sits in tension with the shame and rigidity evidence below. | Low-Med |
| C3 | **Rigid blocks feel like punishment, and shame does not motivate.** Users want shame-free restarts. | "shame is not a productive ADHD motivator". The useful features are "low-friction entry, persistent reminders, and shame-free restarts" [snippet] ([Cognifocus](https://cognifocus.app/blog/best-app-blocker-adhd-android-2026.html), [Xenith](https://xenith.life/articles/adhd-productivity-systems), [ADDitude](https://www.additudemag.com/feeling-guilty-for-not-being-productive-adhd/)). | Medium |
| C4 | **Time blindness: "5 minutes" turns into 2 hours, people forget a timer is running, and locks expire unnoticed.** | "five minutes stretched into thirty, then morphed into two hours". "The biggest problem with timer apps is that people forget they exist" [snippet]. The suggested fix is staged alerts at 15, 10 and 5 minutes ([Simply Psychology](https://www.simplypsychology.com/articles/adhd-time-blindness-guide), [DigitalZen](https://www.digitalzen.app/blog/why-most-website-blockers-dont-work-for-adhd/)). | Medium |
| C5 | **Highly impulsive users respond better to an explicit, plain prompt than to subtle or novel friction.** | arXiv 2026 (n=104): for high-impulsivity participants, "the explicit baseline pop-up being most effective" compared with gradual visual or haptic friction [snippet] ([arXiv 2607.15818](https://arxiv.org/abs/2607.15818)). | Medium (one preprint, 7 days) |
| C6 | **Days vary, and readiness to change varies.** | 2026 JMIR: in-app behaviour, not self-report, predicted who would accept a stricter setting ([JMIR](https://formative.jmir.org/2026/1/e85349)). "Flexibility isn't always bad—the problem is flexibility at the wrong time" [snippet] ([therapy-with-ben](https://www.therapy-with-ben.co.uk/post/adhd-hyperfocus)). | Medium |
| C7 | **Hyperfocus and transitions:** people need help switching away without self-punishment. | Clinical blogs only ([therapy-with-ben](https://www.therapy-with-ben.co.uk/post/adhd-hyperfocus), [ADDitude](https://www.additudemag.com/understanding-adhd-hyperfocus/)). | Low |
| C8 | **Body doubling** is effective for ADHD (about 85% of 220 surveyed reported improvement). | ([ADDA](https://add.org/the-body-double/), [accountablo](https://www.accountablo.com/blog/body-doubling-apps)). It is outside a blocker's scope and conflicts with local-only (Principle 5). | Medium evidence, low relevance |

**The core ADHD tension.** C1 and C2 say flexible bypasses fail. A1, C3 and C6 say rigid blocks cause reactance, shame and uninstalls. No source resolves this. The research pattern (one sec, DecayBlock) points to a third option: **keep the escape but make it slow, and slower when it's being overused.** This lines up with Sordino's thesis better than either a wall or a free button.

---

## (d) Habituation: do soft overlays stop working on autopilot?

**Short answer: partly. Effects fade in the first 2 to 3 weeks, then level off at a real but lower level. Fixed prompts fade fastest. A time delay holds up better than a message.** Confidence: **High** for the existence of the decay, **Medium** for which countermeasures work.

### Evidence that it happens
- **one sec decay curve** (search snippet; the source paper is ambiguous, either PNAS 2023 or CHI 2024, so check which before citing externally): the relative reduction was **43% in week 1, 36% in week 2, 33% in week 3, then stable at 32-34% through week 6**.
- **CHI 2024, Haliburton et al.** (1,039 one sec users, about 13.4 weeks on average): frictions led to "more intentional app-openings over time". Users "take periodic breaks" and "quickly rebound" afterward [snippet] ([LMU PDF](https://www.medien.ifi.lmu.de/pubdb/publications/pub/haliburton2024chi/haliburton2024chi.pdf), [ACM](https://dl.acm.org/doi/10.1145/3613904.3642370)).
- **PNAS 2023, Grüning et al.** (280 users, 6 weeks): people closed the app on 36% of attempts. Open attempts were down 37% by week 6. Net openings fell 57%. The **delay worked, the deliberation message did not, and an explicit dismiss option had the strongest effect** [snippet] ([PNAS](https://www.pnas.org/doi/full/10.1073/pnas.2213114120)).
- **User and reviewer voice on one sec:** "It worked brilliantly for about 10 days. Then my brain learned to autopilot through the breathing prompt" [snippet] ([TimingApp roundup](https://timingapp.com/blog/best-distraction-blocker-mac/) / [browwwser](https://www.browwwser.com/resources/one-sec-app-review-2026/)). Another: "after two weeks, your brain has learned the ritual: pause, breathe, tap through" [snippet] ([Detox](https://detox.so/blog/one-sec-review)). Several of these are competitor marketing blogs. The "~2 weeks" timing matches the CHI curve.
- **arXiv 2026 "Can't Stop":** "the pop-up was initially effective but quickly lost impact". The gradual visual friction held subjective ratings longest [snippet] ([arXiv](https://arxiv.org/abs/2607.15818)).
- **CHI 2025 "Scrolling in the Deep":** users "become desensitized due to the lack of contextual relevance" [snippet] ([arXiv](https://arxiv.org/abs/2501.11814)).
- **CHI 2021, Kovacs "Not Now, Ask Later"** (8,000+ HabitLab users): users drift to easier interventions, and **more than half eventually keep the tool installed with no interventions**. 44% of those choosing "no intervention" asked to be prompted again next visit [snippet] ([arXiv](https://arxiv.org/pdf/2101.11743)). In Sordino terms, the risk is that **Pause → "Until tomorrow"** becomes the everyday path.

### What counters it (best evidence first)
| Mechanism | Evidence | Caveat |
|---|---|---|
| **Time delay before access** | PNAS component study; effect levels off around 33% after week 3 | Too long causes reactance (HN "turn it off if it's too much"). Around 10s gets cited as workable. |
| **Rotating intervention types** | CSCW 2018, Kovacs: rotation **increased effectiveness but also increased uninstalls**. A just-in-time explanation of the rotation **halved attrition** ([ACM](https://dl.acm.org/doi/10.1145/3274364)). | Novelty hurts trust unless it is explained |
| **Gradual or escalating friction** | "Can't Stop" visual gradual held longest. DecayBlock's growing timeout (anecdotal). | For highly impulsive users, a plain explicit prompt beat novel friction (C5) |
| **Stating a goal or intention, then a reminder** | Lyngs 2020: fewer and shorter visits, less time on site, but "often annoying" | Typing cost is a burden on bad days |
| **Prompts to reconfigure** | JMIR 2026: among those who accepted, interaction ratio went **29.7% → 58.5%** (DiD +36pp). 46% accepted. | Only helps users who are ready. Must keep autonomy. |
| **Breaks and re-entry** | CHI 2024: users rebound after breaks | Supports *not* punishing pauses |
| **Contextual relevance** | Scrolling in the Deep | Hard to do while staying local and quiet |
| **Changing the wording only** (Sordino's rotating quotes) | Indirect evidence that it's weak: PNAS found the deliberation message ineffective | Pleasant, but likely not what holds the effect up |

---

## (e) What people praise

| Praise | Evidence | Conf. |
|---|---|---|
| **Free, no upsell, a maintainer who cares** | NFE: "Absolute legend for making this, updating it and keeping it free" [snippet] ([AMO](https://addons.mozilla.org/en-US/firefox/addon/news-feed-eradicator/)). The inverse is the BlockSite and one sec paywall anger. | High |
| **Doesn't cut them off entirely; allows "human nature"** | Intention: "allowing for human nature of needing short distractions" [snippet]. NFE helps people regain control "without cutting themselves off entirely" | Medium-High |
| **Reliability and depth of configuration** | LeechBlock NG 4.8★ from about 2,000 reviews: "reliable", "highly customizable", "lightweight" ([AMO](https://addons.mozilla.org/en-US/firefox/addon/leechblock-ng/reviews/)) | High |
| **Unobtrusive; turns the site back into a tool** | Unhook: "freedom from the slavery of unnecessary information" [snippet]. NFE: "seamless and unobtrusive" | Medium |
| **A motivating quote in place of the feed** | NFE: "displays a motivational quote to help you regain focus" [snippet] | Medium (supports Sordino's quote surface, as atmosphere rather than as the active ingredient) |
| **Hard blockers praised for actually stopping people** | Cold Turkey "makes bypassing distractions nearly impossible" [snippet] ([Trustpilot](https://www.trustpilot.com/review/getcoldturkey.com)) | High, but this is a different segment from Sordino's |

---

## Mapping the clusters to Sordino

| Cluster | Sordino today | Verdict |
|---|---|---|
| A1 Too strict / lockouts | Bypass, pause and schedules exist. **But the overlay becomes a hard stop at 0 bypasses** (`content.ts:282`). That conflicts with Principle 1 ("every restriction must come with a visible escape route"). | **Partial** |
| A2 Too easy | 3-per-day budget, opt-in double-click. No delay. **Pause is free, unlimited and not counted.** Domain-level only. | **Partial (weak)** |
| A3 Monetization hostility | Free, MIT, no account, no upsell | **Addresses (strong differentiator)** |
| A4 Fatigue | The overlay only shows during schedules, and the bypass applies to that site for N minutes. No re-trigger concerns beyond that. | **Mostly addresses** |
| A5 Reliability / incognito | No stated incognito behaviour in onboarding. Unknown on SPA navigation. | **Not addressed / unknown** |
| A6 Shame / streaks | No streaks, no guilt copy (Principles 2 and 4) | **Addresses** |
| B1 Delay | None | **Not addressed** |
| B2 Escalation | None. The budget is flat, then drops off a cliff. | **Not addressed** |
| B3 Intention | None | **Not addressed** |
| B4 After-unlock reminder | Countdown toasts before a bypass or pause expires | **Addresses (partly; no elapsed-time readout)** |
| B5 Path-level rules | Domain only | **Not addressed** |
| B6 Tamper resistance | None (and arguably off-thesis) | **Not addressed (deliberately)** |
| C1/C2 Autopilot bypass | Opt-in second click; the button is ghost-weighted and "Go back" is promoted | **Partial** |
| C3 Shame-free | Yes | **Addresses** |
| C4 Time blindness | Countdown toasts | **Partial** |
| C5 Explicit prompt for impulsive users | Overlay is explicit and plain | **Addresses** |
| C6 Variable days | Emergency refresh (hidden in Settings), pause | **Partial** |
| D Habituation | Rotating quotes only (content rather than mechanism). No delay, escalation or reconfiguration prompt. | **Not addressed** |
| E Praise drivers | Free, local, quiet, quotes | **Addresses**, but there are 0 reviews to prove it |

---

## Ten ranked opportunities for Sordino

Brand-fit tags refer to PRODUCT.md. **FIT** means it fits as is. **FIT (care)** means it fits with constraints. **TENSION** means it pushes on a principle or a known tension. Ranking weighs strength of evidence, the primary ADHD persona, and effort.

1. **A short "fermata" hold before bypass becomes active (default about 5-8s, configurable, reduced-motion safe).** This is the best-supported active ingredient (PNAS delay vs. message; a decay curve that levels off around 33%). Sordino currently has *only* the ingredient PNAS found ineffective (a message). The escape stays visible, so Principle 1 holds. The name fits the music metaphor. Show a static numeric countdown, not a breathing animation (that would be wellness drift). **FIT.** Evidence: High.
2. **No hard stop at 0 bypasses. Make it slower instead.** After the budget runs out, offer a longer hold (for example 30s) instead of a disabled button. Fold Emergency refresh into this path rather than hiding it in Settings. This fixes a real gap between what PRODUCT.md promises and what the code does (Principle 1) and the Cold Turkey style lockout that drives uninstalls (A1, C6). Keep counting these as bypasses in Usage. **FIT** (it restores the stated thesis). Evidence: High for lockout-driven uninstalls; Medium for this specific remedy.
3. **Escalating hold within a day.** Each bypass of the same site lengthens the next hold, and it decays overnight (DecayBlock-style). This is Sordino's answer to both habituation and "too easy" (A2, D) without a wall. Report it as a plain number ("Hold: 12s"), never as a penalty. **FIT (care):** no "you've bypassed too much" copy (Principle 4). Evidence: Medium.
4. **Make Pause visible to the mirror and give it the same hold.** Record pauses (count and duration) in Usage as raw numbers. Apply the fermata hold to "Until tomorrow". Kovacs 2021 shows users quietly drift to "no intervention". Right now Pause is an uncounted, frictionless route around the whole budget. **FIT** (Mirror, not scoreboard). Evidence: Medium-High.
5. **An optional "What for?" line on bypass, shown back when the bypass expires.** Opt-in, like scaffolding mode. One short field, stored locally, never judged. Supported by Lyngs 2020 and the Intention/With Intention praise. Default off, because typing on bad days is a burden (A4). **FIT (care):** placeholder copy must not moralize. Evidence: Medium.
6. **Elapsed-time honesty at bypass expiry, for time blindness.** When a bypass ends, the overlay quietly shows raw time-on-site today ("reddit.com · 47 min today"). Toasts already warn before expiry; this adds the "it was not 5 minutes" fact. **FIT** if raw counts only, no derived "reclaimed hours" (Known Tensions). Evidence: Medium.
7. **Path-level rules and a feed-only mode** (for example allow `youtube.com/watch`, soft-block `/`, `/shorts`, `/feed`; allow `reddit.com/r/<work-sub>`). This addresses a top disable trigger (needing the site for work) and the strong praise for Unhook and NFE. **FIT.** Evidence: Medium. Effort: Medium-High.
8. **A periodic re-tune note, user-paced.** Every few weeks the Usage tab offers one quiet line, for example "Holds and budget were last changed 6 weeks ago. [Adjust]". No nag, dismiss forever with one click. JMIR 2026 (+36pp) and the levelling-off decay curve support it. **TENSION:** close to "nudging" (Principle 4, restraint). Keep it only in Usage, never in the overlay or a notification. Evidence: Medium.
9. **Private-window coverage stated plainly.** A popup status line ("Not active in private windows" plus a link to enable) and onboarding copy. This is the most common "leak" complaint for extensions, and it is cheap to fix. **FIT** ("a quiet status line"). Evidence: Medium.
10. **Rotate the overlay's mechanism (not just its quote), with a one-line explanation.** For example, alternate plain hold / hold plus "What for?" / plain prompt across visits. Kovacs 2018: rotation helps but raises uninstalls unless explained, which halves attrition. Keep the button position and keyboard order fixed for accessibility. Given C5 (impulsive users prefer a plain prompt), keep the plain version in the mix. **TENSION** (restraint; predictability for ADHD). Make it opt-in or a later phase. Evidence: Medium.

**Deliberately not recommended (off-brand or off-thesis):** password or random-code lock on settings (B6), uninstall prevention, streaks or "time reclaimed" (Principle 2), body-doubling or social accountability (Principle 5), randomising button position (accessibility and hostility).

**Housekeeping that falls out of this research:** Sordino has 0 AMO reviews. Praise in this category clusters on "free, kept up, unobtrusive". The listing should state "free, no account, no upsell, local only" up front. Avoid asking for ratings inside the product: Intention got criticised for that.

---

## Sources

Research
- PNAS 2023, Grüning et al., one sec: https://www.pnas.org/doi/full/10.1073/pnas.2213114120
- CHI 2024, Haliburton et al., longitudinal design frictions: https://www.medien.ifi.lmu.de/pubdb/publications/pub/haliburton2024chi/haliburton2024chi.pdf · https://dl.acm.org/doi/10.1145/3613904.3642370
- CSCW 2018, Kovacs et al., rotating interventions: https://dl.acm.org/doi/10.1145/3274364 · https://hci.stanford.edu/publications/2018/habitlab/habitlab-cscw18.pdf
- CHI 2021, Kovacs et al., "Not Now, Ask Later": https://arxiv.org/pdf/2101.11743
- IJHCS 2022, Lyngs et al., Goldilocks level of support: https://ulriklyngs.com/pdfs/2022-lyngs_et_al_goldilocks_support.pdf
- CHI 2020, Lyngs et al., Facebook interventions: https://arxiv.org/abs/2001.04180
- JMIR Formative 2026, nudge reconfiguration prompts: https://formative.jmir.org/2026/1/e85349 · https://pmc.ncbi.nlm.nih.gov/articles/PMC13123756/
- arXiv 2026, "Can't Stop" gradual interventions: https://arxiv.org/abs/2607.15818
- CHI 2025, "Scrolling in the Deep": https://arxiv.org/abs/2501.11814

Stores, reviews and listings (seen through search snippets only)
- Sordino AMO: https://addons.mozilla.org/en-US/firefox/addon/sordino/
- LeechBlock NG reviews: https://addons.mozilla.org/en-US/firefox/addon/leechblock-ng/reviews/ · docs https://www.proginosko.com/leechblock/documentation/
- BlockSite AMO 1-star: https://addons.mozilla.org/en-US/firefox/addon/blocksite/reviews/?score=1&page=3 · Trustpilot https://www.trustpilot.com/review/blocksite.co
- StayFocusd: https://chrome-stats.com/d/laankejkbhbdhmipfmgcngdelahlfoji?hl=en · https://www.digitalzen.app/blog/stayfocusd-alternative/
- Cold Turkey: https://www.techradar.com/reviews/cold-turkey · https://www.trustpilot.com/review/getcoldturkey.com
- Freedom: https://www.cisdem.com/resource/freedom-app-review.html · https://www.blok.so/resources/freedom-app-review-does-blocking-websites-and-apps-actually-work
- one sec App Store: https://apps.apple.com/us/app/one-sec-screen-time-focus/id1532875441?see-all=reviews · Slate https://slate.com/life/2024/06/one-sec-app-smartphone-blocker-instagram-tiktok.html · Detox https://detox.so/blog/one-sec-review · Blok https://www.blok.so/resources/one-sec-app-review-does-adding-friction-actually-reduce-screen-time · browwwser https://www.browwwser.com/resources/one-sec-app-review-2026/ · TimingApp https://timingapp.com/blog/best-distraction-blocker-mac/
- Intention: https://chrome-stats.com/d/intention/reviews · https://chrome-stats.com/d/dladanhaondcgpahgiflodhckhoeohoe · Intentional https://github.com/sanjeed5/intentional
- Mindful Browsing: https://chromewebstore.google.com/detail/mindful-browsing/cciemibfcmeeiijeefebhojenhnpoibc
- News Feed Eradicator: https://addons.mozilla.org/en-US/firefox/addon/news-feed-eradicator/
- Unhook: https://addons.mozilla.org/en-US/firefox/addon/youtube-recommended-videos/reviews/

Hacker News
- LeechBlock delay mode / friction tolerance: https://news.ycombinator.com/item?id=22320267
- DecayBlock Show HN: https://news.ycombinator.com/item?id=45329540
- Intention Show HN: https://news.ycombinator.com/item?id=22936742

ADHD and other secondary sources (several are vendor blogs, so bias is likely)
- https://www.digitalzen.app/blog/why-most-website-blockers-dont-work-for-adhd/
- https://habitdoom.com/blog/best-app-blocker-adhd
- https://usefella.com/how-to-stop-ignoring-screen-time-limits/
- https://xenith.life/articles/adhd-productivity-systems
- https://cognifocus.app/blog/best-app-blocker-adhd-android-2026.html
- https://www.additudemag.com/feeling-guilty-for-not-being-productive-adhd/
- https://www.simplypsychology.com/articles/adhd-time-blindness-guide
- https://www.therapy-with-ben.co.uk/post/adhd-hyperfocus
- https://add.org/the-body-double/
- https://www.techlockdown.com/articles/chrome-extensions-for-website-blocking
- https://medium.com/@raymond_44620/my-productivity-app-became-a-digital-shame-jar-heres-why-i-m-keeping-it-c823fde2af98
