# Sordino

**Soft-block distracting websites with psychological friction, not force.**

Like a trumpet mute that softens without silencing, Sordino creates gentle resistance to distraction rather than hard blocks you'll just disable.

![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-blue?logo=googlechrome)
![Firefox](https://img.shields.io/badge/Firefox-Supported-orange?logo=firefox)
![License](https://img.shields.io/badge/License-MIT-green)

## Philosophy

Hard blocks don't work. You'll just turn them off when the urge hits. Sordino takes a different approach:

- **Psychological friction** — A beautiful overlay with rotating quotes makes you pause and reflect
- **Limited bypasses** — 3 quick bypasses per day (5 min each) creates scarcity that makes you think twice
- **Schedule-aware** — Block during work hours, free on evenings/weekends
- **Personality** — Music-themed messages with wit, not guilt ("Fermata — That's music for 'you just got paused'")

The goal isn't to cage you. It's to create a moment of mindfulness before you mindlessly scroll.

## Features

### Core Blocking
- **Soft blocking** — Bypass-able overlays, not hard blocks
- **Schedule-based** — Define custom schedules (supports overnight spans like 10 PM - 6 AM)
- **Daily bypass budget** — 3× 5-minute bypasses, resets at midnight
- **Manual controls** — Override schedules, pause for 15 min/1 hour/until tomorrow

### The Block Screen
- **Music-themed titles** — 40+ jazz/classical-themed messages with explanations for non-musicians
- **Rotating quotes** — Curated focus/productivity quotes that cycle every 5 seconds
- **Beautiful design** — Animated glow effects, floating motion, subtle texture overlay
- **Countdown notifications** — Toast alerts at 1 min, 30s, 10s, 5s before bypass/pause ends

### Site Management
- **Category presets** — Social, Video, and News pre-configured and toggleable
- **Custom sites** — Add any domain you want to block
- **Quick-add** — Add sites directly from the popup dashboard

### Statistics
- **Daily stats** — Blocks triggered, bypasses used
- **Per-site tracking** — See which sites you're hitting most
- **Weekly rollups** — Day-by-day breakdown of your blocking week

### Privacy
- **100% local** — No external API calls, no analytics, no tracking
- **Your data stays yours** — All settings in `chrome.storage.local`

## Installation

### Chrome

1. Download or clone this repository
2. Run `npm install && npm run build`
3. Open `chrome://extensions`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked**
6. Select the `dist/chrome` folder

### Firefox / Zen

1. Download or clone this repository
2. Run `npm install && npm run build`
3. Open `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on**
5. Select `dist/firefox/manifest.json`

> **Note**: Temporary add-ons are removed when the browser closes. For permanent installation, the extension needs to be signed by Mozilla or installed in Firefox Developer Edition with `xpinstall.signatures.required` set to `false`.

## Usage

### Popup Dashboard
- See current blocking status and active schedule
- View daily stats (blocks triggered, bypasses used, bypasses remaining)
- Pause blocking temporarily (15 min, 1 hour, until tomorrow)
- Resume blocking early from pause or bypass
- Quick-add sites to block list

### Settings Page
- Manage schedules (add, edit, delete custom schedules)
- Toggle site categories (Social, Video, News)
- Add/remove custom blocked sites
- Manual override toggle

### Block Screen
When you visit a blocked site during an active schedule, you'll see:
- The Sordino logo with a random music-themed title
- A rotating motivational quote (changes every 5s)
- Which site is blocked and why
- A bypass button (if you have bypasses remaining)

## Default Configuration

### Blocked Sites

| Category | Sites |
|----------|-------|
| Social | x.com, twitter.com, facebook.com, instagram.com, reddit.com, linkedin.com, threads.net, tiktok.com |
| Video | youtube.com, netflix.com, twitch.tv, hulu.com, disneyplus.com, primevideo.com |
| News | news.google.com, cnn.com, foxnews.com, nytimes.com, bbc.com |

### Schedules

| Schedule | Days | Time |
|----------|------|------|
| Work hours (default) | Mon-Fri | 9 AM - 5 PM |
| Extended work | Mon-Fri | 8 AM - 6 PM |
| Evenings | Every day | 6 PM - 10 PM |
| Always on | Every day | All day |

All defaults are customizable in Settings.

## Architecture

```
src/
├── background/       # Service worker - blocking logic, message handling
├── content/          # Content script - overlay injection & styling
├── popup/            # React popup dashboard
├── settings/         # React settings page
└── shared/           # Types, storage, schedule logic, quotes, snarky titles
```

**How it works:**

1. Service worker evaluates on every navigation: Is blocking enabled? Is this site blocked? Is there an active bypass or pause?
2. Content script checks block status and injects the overlay if blocked
3. Overlay displays with randomized title + rotating quote
4. Bypass grants 5 minutes of access, decrements daily budget
5. Toast notifications warn when bypass/pause is about to expire

## Tech Stack

- **Extension**: Chrome Manifest V3
- **UI**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Build**: Vite 7
- **Storage**: Chrome Storage API (local)
- **Icons**: Lucide React

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build (Chrome)
npm run build

# Production build (Firefox)
npm run build:firefox
```

## Roadmap

- [x] Firefox/Zen browser support
- [ ] Safari extension (requires native app wrapper)
- [ ] Custom bypass durations
- [ ] Allowlist for specific paths (e.g., allow youtube.com/watch?v=specific-video)
- [ ] Sync settings across devices
- [ ] Usage insights and trends

## Name

*Sordino* (Italian) — a mute for musical instruments. On a trumpet, it softens the sound without silencing it. That's the vibe: reduce the noise of distraction without pretending you can block it entirely.

The Harmon mute (our logo) is the specific type of mute that gives that distinctive, focused "wah-wah" sound — a perfect metaphor for controlled, intentional access rather than total silence.

## License

MIT
