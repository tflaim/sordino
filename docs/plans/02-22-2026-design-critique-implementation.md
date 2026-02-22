# Sordino Design Critique Implementation

**Date:** 02-22-2026
**Status:** Approved for implementation

## Overview

Implements all 10 items from the Sordino design critique audit. The changes span all four surfaces (popup, settings, usage dashboard, content overlay) plus the shared types and service worker.

## Item 1: Warmer Popup Copy

**Surface:** Popup
**Files:** `src/popup/App.tsx`

Replace sterile stat labels with warmer, singular-aware copy:
- `"blocked"` → `"distraction caught"` / `"distractions caught"`
- `"bypasses"` → `"bypass used"` / `"bypasses used"`
- `"bypasses left"` → `"bypasses remaining"`

StatCard receives a `value: number` and `singular`/`plural` label strings, picks based on value.

## Item 2: Borderless Filled Cards in Popup

**Surface:** Popup
**Files:** `src/popup/App.tsx`

### Stat cards
- Remove: `border border-border/50` and `bg-secondary/30`
- Add: `bg-secondary/50` (no border)
- Keep: `rounded-xl`, highlight destructive state unchanged

### Status card
- Remove explicit border classes (`border-primary/30`, etc.)
- Increase background fill opacity: `bg-primary/10` → `bg-primary/15`
- Keep glow effect divs

### Add-site button
- Remove: `border border-border`
- Add: `bg-secondary/40 hover:bg-secondary/60`

### Inline add-site form
- Checkmark/X buttons: change from circular (`p-2.5 rounded-xl`) to rounded-rectangle (`px-3 py-2.5 rounded-xl`) matching other buttons
- Input field keeps `bg-secondary border border-border` (standard input treatment, not gold fill)

## Item 3: Wider Settings Column

**Surface:** Settings
**Files:** `src/settings/App.tsx`

Change the content container from `max-w-2xl` to `max-w-3xl`. One class change.

## Item 4: Usage Dashboard Polish

**Surface:** Settings (Usage tab)
**Files:** `src/settings/App.tsx`

### Bar chart improvements
- Hide future days entirely (don't render bars for days after today)
- Today indicator: add a small `w-1.5 h-1.5 rounded-full bg-primary` dot below the day label instead of coloring the label orange
- Remove 2px stub bars for zero-data days — show nothing
- Add `rounded-t-sm` to bars for slightly softer tops

### Top Sites: proportional bars
Each row gets a background bar proportional to the max value:
```
<div className="relative">
  <div className="absolute inset-y-0 left-0 bg-primary/10 rounded" style={{ width: `${pct}%` }} />
  <div className="relative flex items-center justify-between">
    <span>reddit.com</span>
    <span>28</span>
  </div>
</div>
```
Gold-tinted for Most Blocked, orange-tinted for Most Bypassed.

### Zero Refreshes treatment
When `emergencyRefreshes === 0`, render the Refreshes stat card number in `text-muted-foreground` instead of the themed color.

## Item 5: Toggle Switches for Schedules & Categories

**Surface:** Settings
**Files:** `src/settings/App.tsx`

Create an inline `Toggle` component:
- Track: 44px wide, 24px tall, `rounded-full`
- Off: `bg-secondary` track
- On: `bg-primary` track with smooth transition
- Knob: 20px circle, translates from left to right
- `transition-all duration-200`

Replace the checkbox `<button>` in `ScheduleCard` and `CategoryCard` headers with `<Toggle>`.

Individual site checkboxes within expanded categories remain as checkboxes (those are selection, not activation).

## Item 6: "Go Back" Link on Overlay

**Surface:** Content overlay
**Files:** `src/content/content.ts`

Add a `← Go back` text link below the bypass count element:
- Style: `color: #6b5d4d`, `font-size: 0.8125rem`, `cursor: pointer`
- Hover: `color: #9a8b7a`
- Behavior: `history.back()`. If `history.length <= 1`, navigate to `about:newtab` (Chrome) or close behavior.
- Positioned 16px below bypass count text
- No underline by default, underline on hover

## Item 7: Pluralization Fix + Contextual Info

**Surface:** Popup
**Files:** `src/popup/App.tsx`

### Pluralization
Already handled by Item 1's singular-aware labels.

### Contextual info
Add a line below `statusSubtext` showing the active configuration:
```
const enabledSiteCount = settings.categories
  .filter(c => c.enabled)
  .reduce((sum, c) => sum + c.sites.length - (c.disabledSites?.length ?? 0), 0)
  + settings.customSites.length

const enabledCategoryCount = settings.categories.filter(c => c.enabled).length
```

Display as: `"19 sites across 3 categories"` in `text-xs text-muted-foreground/70`.

Only shown when status is `active` (not when paused/inactive — those states don't need this info).

## Item 8: Wordmark Unification

**Surface:** Content overlay
**Files:** `src/content/content.ts`

Change `.sordino-title` CSS:
- Remove: `text-transform: uppercase`
- Change: `letter-spacing: 0.1em` → `letter-spacing: 0.05em`
- Keep: Georgia serif, `#cda468` color, `font-weight: 500`

The `title.textContent` is already `'Sordino'` (title case). Removing the CSS uppercase is the fix.

Also standardize popup and settings to both use `tracking-wide` (they already do).

## Item 9: Status Indicator in Settings Header

**Surface:** Settings
**Files:** `src/settings/App.tsx`, `src/shared/schedule.ts` (import)

Add a status pill to the settings page header row, right-aligned:

```tsx
<div className="flex items-center gap-2 text-xs text-muted-foreground">
  <div className={cn(
    "w-2 h-2 rounded-full",
    isActive && "bg-green-500",
    isPaused && "bg-yellow-500",
    isInactive && "bg-muted-foreground/50"
  )} />
  <span>{statusLabel}</span>
</div>
```

State derived from existing `settings.blockState` + `shouldBlock(settings)` (already imported in popup, same logic reused).

## Item 10: Bypass Settings Split

**Surface:** Settings, Types, Service Worker
**Files:** `src/shared/types.ts`, `src/settings/App.tsx`, `src/background/service-worker.ts`, `src/content/content.ts`, `src/popup/App.tsx`

### New settings fields in `SordinoSettings`

```typescript
// In types.ts
maxBypasses: number      // default: 3 (range 1-10)
bypassDurationMinutes: number  // default: 5 (range 1-30)
```

Add to `DEFAULT_SETTINGS`. Existing `MAX_QUICK_BYPASSES` and `BYPASS_DURATION_MS` become fallback defaults.

### Settings tab: configurable bypass controls

Replace the current BypassSettings component content with two stepper rows:

```
Daily bypass limit       [−] 3 [+]
Bypass duration          [−] 5 min [+]
```

Each stepper: a label, minus button, value display, plus button. Minus/plus are small circular buttons with `−`/`+` icons. Value updates call `updateSettings()`.

### Usage tab: bypass status display

Move the existing bypass status card (remaining count, progress bar, midnight countdown) and Emergency Refresh card into the Usage tab, as a new section between weekly stats and Top Sites.

New section heading: "Bypass Budget"

### Service worker changes

- Replace `MAX_QUICK_BYPASSES` references with `settings.maxBypasses ?? MAX_QUICK_BYPASSES`
- Replace `BYPASS_DURATION_MS` with `(settings.bypassDurationMinutes ?? 5) * 60 * 1000`
- Keep the constants as fallbacks for missing fields (schema migration safety)

### Content script changes

- The overlay's "Bypass for 5 min" button text becomes dynamic: `Bypass for ${duration} min`
- Bypass count reads from settings' `maxBypasses` instead of the constant

### Popup changes

- `MAX_QUICK_BYPASSES` references replaced with `settings.maxBypasses ?? MAX_QUICK_BYPASSES`
- Stat card for bypasses remaining uses the dynamic max

## Implementation Order

Items are ordered to minimize conflicts and build on each other:

1. **Item 10 — Types + service worker** (schema changes first, everything depends on this)
2. **Item 5 — Toggle switches** (shared component, used by settings)
3. **Items 3, 9 — Settings layout + header status** (quick settings changes)
4. **Item 10 continued — Settings tab bypass controls + Usage tab bypass status**
5. **Item 4 — Usage dashboard polish** (chart + top sites, same file)
6. **Items 1, 2, 7 — Popup overhaul** (all popup changes together)
7. **Items 6, 8 — Overlay changes** (content script changes together)

## Testing

After implementation, verify:
- Build succeeds for both Chrome and Firefox (`npm run build`)
- Popup renders correctly in all 4 states (active, inactive, paused, bypass)
- Settings page toggle switches work for schedules and categories
- Bypass stepper controls persist values to storage
- Usage tab shows bypass budget section
- Overlay shows "Go back" link and title-case wordmark
- Content script reads dynamic bypass duration/count from settings
