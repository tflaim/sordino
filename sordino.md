# Sordino - Browser Extension

**Repo:** https://github.com/tflaim/sordino
**Local:** `/Users/taco/Documents/sordino`
**License:** MIT

## What It Does

Sordino is a soft-blocking browser extension for Chrome and Firefox. Instead of hard-blocking distracting sites, it creates psychological friction with bypass-able overlays — "like a trumpet mute that softens without silencing."

### Key Features
- **Soft blocking** — overlay with bypass option, not a hard block
- **Flexible schedules** — work hours, evenings, always-on, custom (supports overnight spans like 22:00–06:00)
- **Daily bypass budget** — 3 quick 5-min bypasses per day, resetting at midnight
- **Pause controls** — 15 min, 1 hour, until tomorrow, or manual override
- **Music-themed block screen** — 40+ jazz/classical titles with rotating focus quotes
- **Category presets** — Social, Video, News with common sites pre-configured
- **Custom sites** — add any domain from popup or settings
- **Stats tracking** — daily blocks, bypasses, per-site breakdowns
- **Countdown alerts** — toast notifications before bypass/pause expires
- **Emergency refresh** — once-per-day bypass budget refill (tracked weekly)
- **Privacy-first** — zero data collection, all storage local

## Tech Stack

| Layer | Tech |
|-------|------|
| UI | React 19, TypeScript 5.9 |
| Styling | Tailwind CSS 4.1, class-variance-authority, tailwind-merge |
| Icons | lucide-react |
| Build | Vite 7.3, PostCSS, autoprefixer |
| Extension | Manifest V3 (Chrome & Firefox) |
| Storage | `chrome.storage.local` (persistent), `chrome.storage.session` (temporary) |

## Project Structure

```
sordino/
├── src/
│   ├── background/
│   │   └── service-worker.ts    # Core logic: scheduling, bypasses, stats, alarms
│   ├── content/
│   │   └── content.ts           # DOM overlay injection, quotes, bypass UI, countdowns
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx              # Popup: status, pause, quick-add site, stats
│   ├── settings/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx              # Settings: schedules, categories, custom sites, usage
│   ├── shared/
│   │   ├── types.ts             # Interfaces, constants, defaults
│   │   ├── storage.ts           # Chrome storage wrapper with queuing
│   │   ├── schedule.ts          # Schedule matching (timezone-aware, overnight support)
│   │   ├── quotes.ts            # 25+ focus quotes
│   │   ├── snarky-titles.ts     # 40+ music-themed block screen titles
│   │   └── utils.ts             # Class name utilities (clsx/tailwind-merge)
│   └── index.css                # Tailwind CSS + custom theme
├── public/
│   ├── manifest.json            # Chrome MV3 manifest
│   ├── manifest.firefox.json    # Firefox MV3 manifest (gecko settings)
│   └── icons/                   # 16/32/48/128 PNGs + SVG logo
├── vite.config.ts               # Build config with restructure plugin
├── tsconfig.json
├── package.json
├── README.md
├── PRIVACY.md
└── BUILD.md
```

## Architecture

### Content Script (`content.ts` — ~785 lines)
Injected at `document_start` on all URLs. Checks block status via background message, then creates an overlay with:
- Logo + snarky music-themed title
- Rotating quote (every 5s)
- Block reason + time remaining
- "Bypass for 5 min" button + count display
- Countdown toast notifications (1 min, 30s, 10s, 5s warnings)
- Uses inline styles for isolation; `textContent` only (XSS-safe)

### Background Service Worker (`service-worker.ts` — ~515 lines)
Handles all core logic:
- **Messages:** `GET_BLOCK_STATUS`, `USE_BYPASS`, `GET_SETTINGS`, `TOGGLE_MANUAL_OVERRIDE`, `PAUSE_BLOCKING`, `RESUME_BLOCKING`, `EMERGENCY_REFRESH_BYPASSES`, `CLEAR_BYPASS`
- **Alarms:** 1-minute periodic check for schedule changes
- **Stats:** per-site, daily, weekly tracking
- **Badge:** color-coded status indicators
- **Resets:** daily bypass reset (timezone-aware)

### Popup (`popup/App.tsx` — ~367 lines)
Quick-access UI: status card with glow effects, pause dropdown, inline add-site form, today's stats, link to settings.

### Settings (`settings/App.tsx` — ~700+ lines)
Full config page with two tabs:
- **Settings:** schedule editor (day pickers, time pickers, templates), category toggles, custom site management
- **Usage:** weekly stats, per-site breakdowns, emergency refresh tracker

### Storage (`storage.ts`)
Wraps `chrome.storage.local` with queued updates to prevent race conditions. Deep-merges with defaults for schema migrations. Supports subscriptions for real-time UI updates.

### Schedule Logic (`schedule.ts`)
Timezone-aware matching with overnight span support. Calculates time remaining with human-readable formatting.

## Build & Dev

```bash
cd /Users/taco/Documents/sordino
npm install

# Development (watch mode)
npm run dev

# Build both browsers
npm run build

# Build individually
npm run build:chrome
npm run build:firefox
```

**Output:** `dist/chrome/` and `dist/firefox/`

The Vite build uses a custom `restructureExtension` plugin that:
1. Renames HTML files from subdirectories to root
2. Copies the appropriate manifest (Chrome vs Firefox)
3. Cleans up unnecessary files

## Browser Support

| Browser | Manifest | Status | ID |
|---------|----------|--------|----|
| Chrome | MV3 (`service_worker`) | In Review (CWS) | — |
| Firefox | MV3 (`scripts` + gecko) | Published (AMO) | `sordino@tflaim.com` |

Both use identical source code; manifest differences handled at build time via `BROWSER=firefox` env var.

## Design / Theme

- Dark warm palette (browns, golds, creams)
- Gold primary: `#cda468`
- Serif headings: Cormorant Garamond
- Sans body: DM Sans
- Glow effects and floating animations
