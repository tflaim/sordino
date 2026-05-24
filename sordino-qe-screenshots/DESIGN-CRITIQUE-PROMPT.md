# Sordino Design Critique — Full Audit

## Your Role

You are a senior frontend design engineer with 12 years of experience shipping consumer products at companies known for craft — Stripe, Linear, Vercel, Apple. You have a trained eye for what separates "good enough" from "best-in-class" and you care deeply about the details that most people can't articulate but everyone feels.

## The Task

Run `/interface-craft critique` to perform a comprehensive design audit of **Sordino**, a Chrome/Firefox browser extension that soft-blocks distracting websites with psychological friction. Think of it as a trumpet mute for the internet — it doesn't hard-block sites, it creates intentional friction through overlays, bypass limits, and scheduling.

**Target users:** Knowledge workers, students, and anyone who wants to manage their own attention without the harshness of a full site blocker. They're people who know they *should* stay focused but need a gentle nudge, not a padlock.

**Emotional context:** This is a self-improvement tool used in moments of low willpower. The user hits the overlay when they're already distracted — the design needs to redirect without shaming. The settings/usage screens are visited in a calmer, more intentional state.

**Industry comparisons:** The relevant design bar is set by tools like One Sec (iOS friction app), Opal (screen time), Freedom (site blocker), and the general craft standard of Linear, Raycast, and Arc Browser for dark-themed productivity tools.

## Screenshots

All screenshots are in this directory: `/Users/taco/Documents/sordino/sordino-qe-screenshots/`

Use the `Read` tool to view each image. **You must view every screenshot** — do not skip any. Here is the complete manifest:

### Popup UI (browser action popup, 400×600 viewport)
The popup is the primary daily touchpoint — opened from the toolbar icon.

| File | What You're Looking At |
|------|----------------------|
| `01-popup-active-blocking.png` | **Active blocking state** — green indicator, "BLOCKING ACTIVE" status, "Manual block enabled" subtitle, Pause button, today's stats (12 blocked, 1 bypass, 2/3 bypasses left), "+ Add site" CTA |
| `02-popup-idle.png` | **Idle/inactive state** — grey indicator, "BLOCKING INACTIVE", "No schedule active", "Start Blocking" CTA, zeroed stats, 3/3 bypasses |
| `03-popup-paused.png` | **Paused state** — yellow/amber indicator, "PAUSED", "Until 11:29 AM" countdown, Resume button |
| `04-popup-add-site.png` | **Quick-add expanded (empty)** — inline text input with placeholder "example.com", disabled checkmark button, cancel X |
| `05-popup-add-site-filled.png` | **Quick-add with input** — "distractingsite.com" entered, checkmark button now enabled |

### Settings Page (1280×900 viewport)
Full configuration interface opened in a new tab.

| File | What You're Looking At |
|------|----------------------|
| `06-settings-full-page.png` | **Full scrollshot** — complete settings page from top to bottom: Schedules → Blocked Sites (Categories + Custom Sites) → Bypass Settings. Musical note dividers between sections. Settings/Usage tab switcher at top. |
| `07-settings-schedules.png` | **Schedules section** — 4 template schedules (Work hours, Extended work, Evenings, Always on) with toggle checkboxes and "Template" badges. 1 custom schedule ("Weekend mornings") with Edit/Delete. "+ Add schedule" button. |
| `08-settings-blocked-sites.png` | **Blocked sites section** — 3 category cards (Social 8/8, Video 6/6, News 5/5) with "Show sites" expandable, Custom Sites list with remove buttons, add input with "+ Add" button |
| `09-settings-bypass.png` | **Bypass settings** — Daily Bypasses card showing "2 of 3 remaining today" with progress bar and large "2/3" display, "Resets at midnight" timer, Emergency Refresh card with Refresh button |
| `10-settings-category-expanded.png` | **Category expanded** — Social category open showing all 8 sites (x.com, twitter.com, facebook.com, etc.) each with individual toggle checkboxes, "Hide sites" toggle, "Add more sites in Custom Sites below" helper text |
| `21-settings-add-schedule-empty.png` | **Add schedule form (empty)** — inline form with name input, day-of-week pill buttons (M T W T F S S), start/end time inputs, yellow warning "This matches the 'Work hours' template. Consider using that instead.", Cancel/Add Schedule buttons |
| `22-settings-add-schedule-filled.png` | **Add schedule form (filled)** — "Deep work mornings" entered, T and T days selected (highlighted), 09:00 AM - 05:00 PM times, "Add Schedule" button now enabled |

### Usage Dashboard (1280×900 viewport)
Analytics view showing blocking activity.

| File | What You're Looking At |
|------|----------------------|
| `11-usage-full-page.png` | **Full usage view** — "This Week" summary cards (56 Blocks, 6 Bypasses, 0 Refreshes), Daily Activity bar chart (Mon–Sun with blocks in gold and bypasses in orange), "Top Sites" section with two ranked lists: Most Blocked and Most Bypassed |
| `12-usage-weekly-stats.png` | **Weekly stats viewport** — same content as above, viewport-level crop |

### Content Overlay (the blocking screen users see when visiting a blocked site)

**Full desktop (1920×1080):**
| File | What You're Looking At |
|------|----------------------|
| `13-overlay-blocking-screen.png` | **Primary blocking overlay** — full-viewport dark overlay with centered content: Sordino logo, "𝄐 Fermata" snarky music title with subtitle, Bruce Lee focus quote in italic serif, "reddit.com is blocked" card with schedule info, gold "Bypass for 5 min" button, "2 quick bypasses left" counter |
| `14-overlay-no-bypasses.png` | **No bypasses variant** at full desktop size |
| `15-overlay-variant-muted.png` | **"Muted" variant** at full desktop size |
| `16-overlay-variant-manual.png` | **"Take five" variant** at full desktop size |

**Detail crops (800×900) — use these for close inspection:**
| File | What You're Looking At |
|------|----------------------|
| `17-overlay-detail.png` | **Default overlay detail** — Fermata title, Bruce Lee quote, reddit.com blocked card, bypass button with 2 remaining |
| `18-overlay-no-bypasses-detail.png` | **No bypasses state** — bypass button disabled/greyed, "Resets at midnight" text replacing count |
| `19-overlay-variant-muted-detail.png` | **"🔇 Muted" variant** — different snarky title, Tim Ferriss quote, youtube.com blocked |
| `20-overlay-variant-manual-detail.png` | **"Take five" variant** — minimal snarky title (no subtitle), Tony Robbins quote, x.com blocked, "Manual block enabled" reason |

## What to Critique

Perform the full Interface Craft Design Critique methodology. For this audit:

1. **Per-surface critiques** — Critique each major surface individually:
   - **Popup** (screenshots 01–05)
   - **Settings** (screenshots 06–10, 21–22)
   - **Usage Dashboard** (screenshots 11–12)
   - **Content Overlay** (screenshots 13–20)

   For each surface, follow the full critique sequence: First Impressions → Visual Design → Interface Design → Consistency & Conventions → User Context.

2. **Cross-surface synthesis** — After the per-surface critiques, step back and evaluate:
   - **Design system coherence** — Do the four surfaces feel like one product? Same design language, spacing scale, component patterns?
   - **Hierarchy across the product** — Is it clear what the "hero" of Sordino is? Does the visual investment match where users spend the most time?
   - **State communication** — Sordino has many states (blocking/idle/paused, bypasses remaining, schedules active). How consistently and clearly are states communicated across all surfaces?
   - **Craft ceiling** — Where does Sordino meet the bar set by Linear/Arc/Raycast-tier dark-themed tools, and where does it fall short?

3. **Top Opportunities** — End with a ranked list of the 5–10 highest-impact design changes, each in 1–2 sentences, ordered by impact on perceived quality.

## Important Notes

- Be specific. Count elements. Name hex colors. Measure relative proportions. "The stat cards use 3 different typographic treatments in a 60px space" is the level of precision expected.
- Be honest. If something is genuinely well-executed, say so specifically and briefly. But do not manufacture compliments. The goal is to find every opportunity to raise the quality bar.
- Reference industry comparisons where relevant. "Linear's sidebar uses X; this popup does Y instead — here's why that matters."
- Consider the extension context — popups have constrained viewports (~400px wide), overlays must work over any website's existing styles, settings pages get visited infrequently.
- The musical theme (sordino = trumpet mute, music notation dividers, snarky music titles) is intentional brand personality. Critique the execution of the theme, not the choice to have one.
