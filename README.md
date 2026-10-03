# Sordino

<img width="280" alt="Sordino logo" src="https://github.com/user-attachments/assets/c3467d8d-21c9-46bf-8599-c5cc7ff7a249" />

**Soft-block distracting websites with psychological friction, not force.**

Like a trumpet mute that softens without silencing, Sordino creates gentle resistance to distraction rather than hard blocks you'll just disable.

The goal isn't to cage you. It's to create a moment of mindfulness before you mindlessly scroll.

![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-blue?logo=googlechrome)
![Firefox](https://img.shields.io/badge/Firefox-Supported-orange?logo=firefox)
![License](https://img.shields.io/badge/License-MIT-green)

**[Chrome Web Store](https://chrome.google.com/webstore)** _(In Review)_ · **[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/sordino/)**

## Features

![sordino-screenshot-1](https://github.com/user-attachments/assets/74de3990-830e-47fc-9dcc-64c6b54bb9af)


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

**[Chrome Web Store](https://chrome.google.com/webstore)** _Coming Soon (In Review)_

**Manual install:**
1. Download [sordino-chrome-v1.0.0.zip](https://github.com/tflaim/sordino/releases/download/v1.0.0/sordino-chrome-v1.0.0.zip)
2. Unzip it
3. Open `chrome://extensions`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** → select the unzipped folder

### Firefox

**[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/sordino/)**

**Manual install:**
1. Download [sordino-firefox-v1.0.0.zip](https://github.com/tflaim/sordino/releases/download/v1.0.0/sordino-firefox-v1.0.0.zip)
2. Unzip it
3. Open `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on** → select `manifest.json` from the unzipped folder

> **Note**: Temporary add-ons reset when the browser closes. Use the [store version](https://addons.mozilla.org/en-US/firefox/addon/sordino/) for persistence.

### Safari

_Coming Soon_

### Build from Source

```bash
git clone https://github.com/tflaim/sordino.git
cd sordino
npm install
npm run build        # builds both Chrome and Firefox
```

Output: `.output/chrome-mv3/` and `.output/firefox-mv3/`

## Development

### Tech Stack

- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **[WXT](https://wxt.dev)** — build tooling (Vite underneath); one source for Chrome and Firefox
- **Manifest V3**

### Project Structure

```
src/
├── entrypoints/      # WXT entrypoints
│   ├── background.ts # Background (scheduling, bypass logic, stats)
│   ├── content.ts    # Content script (the overlay)
│   ├── popup/        # Toolbar popup
│   └── options/      # Settings page (the browser's Options entry)
├── assets/           # Bundled assets (logo)
└── shared/           # Shared types, storage, schedule logic, styles, fonts

public/icons/         # Extension icons
scripts/              # Post-build guards
tests/e2e/            # Playwright smoke tests against the built extension
wxt.config.ts         # Manifest and build config for both browsers
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run the extension in a dev browser with reload (`dev:firefox` for Firefox) |
| `npm run build` | Clean, typecheck, build Chrome and Firefox, check the content script |
| `npm run build:chrome` / `build:firefox` | Build one browser only |
| `npm run typecheck` | `tsc` over the whole project |
| `npm run lint` | ESLint and Prettier check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:smoke` | Playwright smoke tests: overlay on a muted site, popup and settings make no network requests |
| `npm run lint:firefox` | `web-ext lint` on the Firefox build |

A pre-commit hook formats staged files and runs typecheck and tests. CI runs every check on each push.

## Support

If Sordino helps you stay focused, consider buying me a coffee. It funds late-night vibe coding sessions and keeps this project free and ad-free.

<a href="https://buymeacoffee.com/tflaim">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" />
</a>

## License

MIT @tflaim
