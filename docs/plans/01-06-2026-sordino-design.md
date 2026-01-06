# Sordino - Design Document

**Date:** 01-06-2026
**Status:** Approved for implementation

## Overview

Sordino is a browser extension that soft-blocks distracting websites with psychological friction, not force. Users stay in control but face just enough resistance to break autopilot browsing.

**Name origin:** A sordino is a mute for musical instruments (trumpet, violin). It dampens sound - a metaphor for muting distractions.

## V1 Scope

| Feature | V1 (Browser Extension) | V2 (Native App) |
|---------|------------------------|-----------------|
| Manual toggle | Yes | Yes |
| Schedule blocking | Yes | Yes |
| Focus Mode sync | No | Yes |
| Soft block overlay | Yes | Yes |
| Chrome + Firefox | Yes | Yes |
| Safari | No | Yes (via native) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser Extension                 │
├─────────────────────────────────────────────────────┤
│  Popup (React + shadcn/ui)                          │
│  ├── Dashboard: status, stats, quick controls       │
│  └── Settings: schedules, sites, categories         │
├─────────────────────────────────────────────────────┤
│  Background Service Worker                          │
│  ├── Schedule engine (checks time rules)            │
│  ├── State management (blocking on/off)             │
│  └── Storage sync (chrome.storage API)              │
├─────────────────────────────────────────────────────┤
│  Content Script (injected into blocked pages)       │
│  ├── Overlay component (block modal)                │
│  ├── Bypass logic (3x daily, 5 min each)            │
│  └── Quote rotation                                 │
└─────────────────────────────────────────────────────┘
```

**Browser support:**
- Chrome (Manifest V3) - primary
- Firefox (Manifest V2/V3) - shared codebase with adapter layer
- Chromium browsers (Arc, Brave, Edge) - get Chrome version for free

## Blocking Logic

### Trigger Hierarchy (evaluated in order)

```
1. Manual override ON → Block active (ignores schedule)
2. Manual override OFF → Block inactive (ignores schedule)
3. No override → Check schedule rules
4. Schedule match → Block active
5. No schedule match → Block inactive
```

### Soft Block Flow

```
User navigates to blocked site
        ↓
Content script detects URL match
        ↓
Inject full-page overlay (blocks interaction)
        ↓
Show: rule that triggered │ time remaining │ random quote
        ↓
User options:
  ├── Wait it out (close tab)
  ├── Bypass (3x daily, 5 min each)
  └── Disable blocking (goes to settings)
```

### Bypass Mechanics

| Bypass type | Uses/day | Duration | Resets |
|-------------|----------|----------|--------|
| Quick bypass | 3x | 5 min each | Midnight (local) |

- Counter visible in popup and overlay
- Future: user-configurable limits

## Site Management

### Default Blocked Sites

**Social:**
- x.com, twitter.com, facebook.com, instagram.com
- reddit.com, linkedin.com, threads.net, tiktok.com

**Video:**
- youtube.com, twitch.tv, netflix.com
- hulu.com, disneyplus.com, primevideo.com

**News:**
- news.google.com, cnn.com, foxnews.com
- nytimes.com, bbc.com

### Category System

- User toggles categories on/off (Social ✓, Video ✓, News ✗)
- Categories expand to their site lists
- User can remove individual sites from active categories
- Custom sites added separately (not tied to categories)

### Site Matching

- Match full domain + all subdomains (`*.youtube.com`)
- Optional path matching for power users (`reddit.com/r/funny`)
- Glob pattern support: `*reddit.com*` catches old.reddit.com

## Schedule System

### Presets

| Preset | Days | Time |
|--------|------|------|
| Work hours | Mon-Fri | 9am - 5pm |
| Extended work | Mon-Fri | 8am - 6pm |
| Evenings | Every day | 6pm - 10pm |
| Always on | Every day | 24/7 |

### Custom Schedules

- User creates named schedules ("Deep work", "Weekend mornings")
- Day picker: select any combination of days
- Time range: start time → end time
- Multiple schedules can overlap (if any schedule is active → blocking on)

### Data Model

```typescript
type Schedule = {
  id: string
  name: string
  enabled: boolean
  days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[]
  startTime: string  // "09:00" (24h format)
  endTime: string    // "17:00"
}
```

### Edge Cases

- Overnight schedules (10pm → 6am) span two calendar days - handled correctly
- Multiple schedules active = still just "blocked" (no stacking)
- Schedule disabled = ignored but preserved for re-enabling
- Timezone: uses browser's local timezone (inherits from OS)

## UI Design

### Popup Dashboard

```
┌─────────────────────────────────────┐
│  🎺 Sordino              [≡ Menu]   │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │      BLOCKING ACTIVE        │    │
│  │      ● Work hours           │    │
│  │      until 5:00 PM          │    │
│  │                             │    │
│  │      [ Pause ▼ ]            │    │
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│  Today                              │
│  ┌────────┐ ┌────────┐ ┌────────┐   │
│  │   12   │ │   2    │ │  3/3   │   │
│  │ blocked│ │bypasses│ │ quick  │   │
│  └────────┘ └────────┘ └────────┘   │
├─────────────────────────────────────┤
│  Quick controls                     │
│  [ + Add site ]     [ Settings ]    │
└─────────────────────────────────────┘
```

**Status states:**
- Blocking active (green) - shows which rule + time remaining
- Manually paused (yellow) - shows "Paused until X"
- Inactive (gray) - no schedule active, not manually on

**Pause options (dropdown):**
- 15 minutes
- 1 hour
- Until tomorrow
- Until I turn it back on

### Block Overlay

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    🎺 Sordino                           │
│                                                         │
│              "The successful warrior is the             │
│               average man, with laser-like focus."      │
│                         — Bruce Lee                     │
│                                                         │
│         ┌─────────────────────────────────────┐         │
│         │   x.com is blocked                  │         │
│         │                                     │         │
│         │   📅 Work hours • until 5:00 PM     │         │
│         └─────────────────────────────────────┘         │
│                                                         │
│              [ Bypass for 5 min ]                       │
│                  2 quick bypasses left                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Quote rotation:**
- 20-30 curated focus/productivity quotes
- Random selection on each block
- Future: user can add custom quotes

**Visual design:**
- Dark, calming background (reduces urgency to bypass)
- Subtle animation on load (not jarring)
- Clear hierarchy: quote → context → actions

### Settings Page

```
┌─────────────────────────────────────────────────────────┐
│  🎺 Sordino Settings                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SCHEDULES                                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ☑ Work hours       Mon-Fri    9:00 AM - 5:00 PM │    │
│  │ ☐ Evenings         Daily      6:00 PM - 10:00 PM│    │
│  └─────────────────────────────────────────────────┘    │
│  [ + Add schedule ]                                     │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  BLOCKED SITES                                          │
│                                                         │
│  Categories                                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ☑ Social (8 sites)    ☑ Video (6 sites)          │   │
│  │ ☐ News (5 sites)                                 │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Custom sites                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ hackernews.com                              [ x ]│   │
│  │ techmeme.com                                [ x ]│   │
│  └──────────────────────────────────────────────────┘   │
│  [ + Add site ]                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Settings opens in new tab (full page).

## Tech Stack

- **React 18** + TypeScript
- **shadcn/ui** + Tailwind CSS
- **Vite** (fast builds, good extension support)
- **WebExtension APIs** (chrome.storage, chrome.tabs, etc.)

## Project Structure

```
sordino/
├── src/
│   ├── popup/              # Dashboard popup
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── index.html
│   ├── settings/           # Full settings page
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── index.html
│   ├── content/            # Block overlay (injected)
│   │   ├── Overlay.tsx
│   │   └── content.ts
│   ├── background/         # Service worker
│   │   └── service-worker.ts
│   ├── shared/             # Shared code
│   │   ├── types.ts
│   │   ├── storage.ts
│   │   ├── schedule.ts
│   │   └── quotes.ts
│   └── components/         # shadcn/ui components
├── public/
│   ├── manifest.json       # Chrome MV3
│   ├── manifest.firefox.json
│   └── icons/
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

**Build outputs:**
- `dist/chrome/` - Chrome extension
- `dist/firefox/` - Firefox extension

## Future Considerations (V2+)

- Native macOS app with Focus Mode integration
- Native iOS app
- Safari extension (via native app)
- User-configurable bypass limits
- Custom quotes
- Path-based blocking rules
- Sync across devices
- Usage analytics/insights
