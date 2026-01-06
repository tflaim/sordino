# Sordino

**Soft-block distracting websites with psychological friction, not force.**

Like a trumpet mute that softens without silencing, Sordino creates gentle resistance to distraction rather than hard blocks you'll just disable.

## Philosophy

Hard blocks don't work. You'll just turn them off when the urge hits. Sordino takes a different approach:

- **Psychological friction** — A beautiful overlay with a motivational quote makes you pause and reflect
- **Limited bypasses** — 3 quick bypasses per day (5 min each) creates scarcity that makes you think twice
- **Schedule-aware** — Block during work hours, free on evenings/weekends

The goal isn't to cage you. It's to create a moment of mindfulness before you mindlessly scroll.

## Features

- **Soft blocking** — Bypass-able overlays, not hard blocks
- **Schedule-based** — Define custom schedules (supports overnight spans like 10 PM - 6 AM)
- **Daily bypass budget** — 3x 5-minute bypasses, resets at midnight
- **Curated quotes** — 25 focus/productivity quotes from Seneca to Cal Newport
- **Category presets** — Social media and video streaming pre-configured
- **Custom sites** — Add any domain you want to block
- **Privacy-first** — No external requests, no tracking, all data stays local

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

**Popup Dashboard**
- See current blocking status and active schedule
- View daily stats (blocks triggered, bypasses used)
- Pause blocking temporarily (15 min, 1 hour, or until tomorrow)
- Quick-add sites to block list

**Settings Page**
- Manage schedules (add, edit, delete)
- Toggle site categories (Social, Video)
- Add/remove custom blocked sites
- Manual override toggle

## Architecture

```
src/
├── background/       # Service worker - blocking logic, message handling
├── content/          # Content script - overlay injection
├── popup/            # React dashboard
├── settings/         # React settings page
└── shared/           # Types, storage, schedule logic, quotes
```

**How it works:**

1. Content script checks block status on every page load
2. Service worker evaluates: Is blocking enabled? Is this site blocked? Is there an active bypass?
3. If blocked, content script injects a full-page overlay with quote and bypass button
4. Bypass grants 5 minutes of access, decrements daily budget

## Configuration

Default blocked sites:

| Category | Sites |
|----------|-------|
| Social | twitter.com, x.com, facebook.com, instagram.com, reddit.com, tiktok.com, linkedin.com |
| Video | youtube.com, netflix.com, twitch.tv, hulu.com, disneyplus.com |

Default schedule: **Work Hours** (Mon-Fri, 9 AM - 5 PM)

All defaults are customizable in Settings.

## Tech Stack

- **Extension**: Chrome Manifest V3
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Build**: Vite
- **Storage**: Chrome Storage API (local)

## Privacy

Sordino runs entirely on your machine:

- No external API calls
- No analytics or tracking
- No data leaves your browser
- All settings stored in `chrome.storage.local`

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck
```

## Roadmap

- [x] Firefox extension
- [ ] Safari extension (requires native app wrapper)
- [ ] macOS native app with Focus Mode sync
- [ ] iOS app with Screen Time integration
- [ ] Sync settings across devices
- [ ] Custom bypass durations
- [ ] Allowlist for specific paths (e.g., allow youtube.com/watch?v=specific-video)

## Name

*Sordino* (Italian) — a mute for musical instruments. On a trumpet, it softens the sound without silencing it. That's the vibe: reduce the noise of distraction without pretending you can block it entirely.

## License

MIT
