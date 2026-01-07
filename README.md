# Sordino

<img width="1024" height="1536" alt="ChatGPT Image Jan 6, 2026, 03_09_42 PM(1)" src="https://github.com/user-attachments/assets/c3467d8d-21c9-46bf-8599-c5cc7ff7a249" />

**Soft-block distracting websites with psychological friction, not force.**

Like a trumpet mute that softens without silencing, Sordino creates gentle resistance to distraction rather than hard blocks you'll just disable.

The goal isn't to cage you. It's to create a moment of mindfulness before you mindlessly scroll.

![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-blue?logo=googlechrome)
![Firefox](https://img.shields.io/badge/Firefox-Supported-orange?logo=firefox)
![License](https://img.shields.io/badge/License-MIT-green)

**[Chrome Web Store](https://chrome.google.com/webstore)** · **[Firefox Add-ons](https://addons.mozilla.org)**

## Features

<img width="605" height="728" alt="70204" src="https://github.com/user-attachments/assets/2e3f5562-f716-4c77-83e1-496f3733f4fd" />

- **Soft blocking** — Bypass-able overlays, not hard blocks
- **Flexible schedules** — Work hours, evenings, always-on, or custom (supports overnight spans)
- **Daily bypass budget** — 3× 5-minute bypasses, resets at midnight
- **Pause controls** — 15 min, 1 hour, until tomorrow, or manual override
- **Music-themed block screen** — 40+ jazz/classical-themed titles with rotating focus-based quotes
- **Category presets** — Social, Video, and News sites pre-configured
- **Custom sites** — Add any domain from popup or settings
- **Stats tracking** — Daily blocks, bypasses, and per-site breakdowns
- **Countdown alerts** — Toast notifications before bypass/pause expires

## Privacy

Sordino runs entirely on your machine:

- No external API calls
- No analytics or tracking
- No data leaves your browser
- All settings stored in local browser storage

## Installation

### Chrome

**[Chrome Web Store](https://chrome.google.com/webstore)**

1. Clone this repository
2. Run `npm install && npm run build`
3. Open `chrome://extensions`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** → select `dist/chrome`

### Firefox

**[Firefox Add-ons](https://addons.mozilla.org)**

1. Clone this repository
2. Run `npm install && npm run build`
3. Open `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on** → select `dist/firefox/manifest.json`

> **Note**: Temporary add-ons reset when Firefox closes. For permanent install, use Firefox Developer Edition with `xpinstall.signatures.required` set to `false`.

### Safari

_Coming Soon_

## License

MIT @tflaim
