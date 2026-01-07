# Sordino

**Soft-block distracting websites with psychological friction, not force.**

Like a trumpet mute that softens without silencing, Sordino creates gentle resistance to distraction rather than hard blocks you'll just disable.

![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-blue?logo=googlechrome)
![Firefox](https://img.shields.io/badge/Firefox-Supported-orange?logo=firefox)
![License](https://img.shields.io/badge/License-MIT-green)

**[Chrome Web Store](https://chrome.google.com/webstore)** · **[Firefox Add-ons](https://addons.mozilla.org)** *(Coming Soon)*

## Philosophy

Hard blocks don't work. You'll just turn them off when the urge hits. Sordino takes a different approach:

- **Psychological friction** — A beautiful overlay with rotating quotes makes you pause and reflect
- **Limited bypasses** — 3 quick bypasses per day (5 min each) creates scarcity that makes you think twice
- **Schedule-aware** — Block during work hours, free on evenings/weekends
- **Personality** — Music-themed messages with wit, not guilt ("Fermata — That's music for 'you just got paused'")

The goal isn't to cage you. It's to create a moment of mindfulness before you mindlessly scroll.

## Features

- **Soft blocking** — Bypass-able overlays, not hard blocks
- **Flexible schedules** — Work hours, evenings, always-on, or custom (supports overnight spans)
- **Daily bypass budget** — 3× 5-minute bypasses, resets at midnight
- **Pause controls** — 15 min, 1 hour, until tomorrow, or manual override
- **Music-themed block screen** — 40+ jazz/classical-themed titles with rotating quotes
- **Category presets** — Social, Video, and News sites pre-configured
- **Custom sites** — Add any domain from popup or settings
- **Stats tracking** — Daily blocks, bypasses, and per-site breakdowns
- **Countdown alerts** — Toast notifications before bypass/pause expires

## Privacy

Sordino runs entirely on your machine:

- No external API calls
- No analytics or tracking
- No data leaves your browser
- All settings stored locally in `chrome.storage.local`

## Installation

### Chrome

1. Clone this repository
2. Run `npm install && npm run build`
3. Open `chrome://extensions`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** → select `dist/chrome`

### Firefox / Zen

1. Clone this repository
2. Run `npm install && npm run build`
3. Open `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on** → select `dist/firefox/manifest.json`

> **Note**: Temporary add-ons reset when Firefox closes. For permanent install, use Firefox Developer Edition with `xpinstall.signatures.required` set to `false`.

## Development

```bash
npm install        # Install dependencies
npm run dev        # Development build with watch
npm run build      # Production build (Chrome)
npm run build:firefox  # Production build (Firefox)
```

## Name

*Sordino* (Italian) — a mute for musical instruments. On a trumpet, it softens the sound without silencing it. That's the vibe: reduce the noise of distraction without pretending you can block it entirely.

## License

MIT
