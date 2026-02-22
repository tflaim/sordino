# Design Critique Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all 10 design critique items across popup, settings, usage dashboard, and content overlay.

**Architecture:** UI-first changes with one schema addition (configurable bypass settings). Changes are grouped by file to minimize merge conflicts. No test framework exists in this project — verify each task with `npm run build` (TypeScript compilation catches type errors).

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4.1, Chrome Extension Manifest V3

**Design doc:** `docs/plans/02-22-2026-design-critique-implementation.md`

---

### Task 1: Add configurable bypass fields to types

**Files:**
- Modify: `src/shared/types.ts`

**Step 1: Add new fields to SordinoSettings interface**

In `src/shared/types.ts`, add two new fields to the `SordinoSettings` interface, after `customSites`:

```typescript
export interface SordinoSettings {
  schedules: Schedule[]
  categories: Category[]
  customSites: string[]
  maxBypasses: number           // NEW — default 3, range 1-10
  bypassDurationMinutes: number // NEW — default 5, range 1-30
  blockState: BlockState
  bypassState: BypassState
  stats: Stats
  weeklyStats: WeeklyStats
}
```

**Step 2: Add defaults to DEFAULT_SETTINGS**

```typescript
export const DEFAULT_SETTINGS: SordinoSettings = {
  schedules: DEFAULT_SCHEDULES,
  categories: DEFAULT_CATEGORIES,
  customSites: [],
  maxBypasses: 3,
  bypassDurationMinutes: 5,
  blockState: { ... },
  // ... rest unchanged
}
```

**Step 3: Build to verify types**

Run: `npm run build`
Expected: Clean build, no type errors.

**Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add configurable bypass fields to settings schema"
```

---

### Task 2: Update service worker to use dynamic bypass settings

**Files:**
- Modify: `src/background/service-worker.ts`

**Step 1: Replace hardcoded constants with dynamic settings values**

In `handleMessage`, for the `GET_BLOCK_STATUS` case (around line 316), change:

```typescript
// OLD
bypassesRemaining: MAX_QUICK_BYPASSES - settings.bypassState.quickBypassesUsed,
// NEW
bypassesRemaining: (settings.maxBypasses ?? MAX_QUICK_BYPASSES) - settings.bypassState.quickBypassesUsed,
```

Also add `bypassDuration` to the response so the content script knows:

```typescript
bypassDuration: settings.bypassDurationMinutes ?? 5,
```

For the `USE_BYPASS` case (around line 321), change:

```typescript
// OLD
const remaining = MAX_QUICK_BYPASSES - settings.bypassState.quickBypassesUsed
// NEW
const maxBypasses = settings.maxBypasses ?? MAX_QUICK_BYPASSES
const remaining = maxBypasses - settings.bypassState.quickBypassesUsed
```

And the bypass duration (around line 348):

```typescript
// OLD
expiresAt: Date.now() + BYPASS_DURATION_MS,
// NEW
expiresAt: Date.now() + (settings.bypassDurationMinutes ?? 5) * 60 * 1000,
```

For the `EMERGENCY_REFRESH_BYPASSES` case (around line 425), change:

```typescript
// OLD
return { success: true, remaining: MAX_QUICK_BYPASSES }
// NEW
return { success: true, remaining: settings.maxBypasses ?? MAX_QUICK_BYPASSES }
```

For the badge update in `updateBadge` (around line 74), make the bypass badge text dynamic:

```typescript
case 'bypass':
  await chrome.action.setBadgeText({ text: `${settings?.bypassDurationMinutes ?? 5}m` })
```

This requires changing `updateBadge` signature to accept optional settings. Simplest approach: keep badge text as `'5m'` for now (it's a minor detail) and avoid changing the signature. The dynamic duration is more important in the overlay and service worker logic.

**Step 2: Build to verify**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/background/service-worker.ts
git commit -m "feat: use dynamic bypass settings in service worker"
```

---

### Task 3: Popup overhaul — borderless cards, warm copy, context info

**Files:**
- Modify: `src/popup/App.tsx`

**Step 1: Update StatCard to remove borders and use warm copy**

Replace the `StatCard` component:

```tsx
function StatCard({ value, singular, plural, highlight, subtext }: {
  value: number | string
  singular: string
  plural: string
  highlight?: boolean
  subtext?: string
}) {
  const numValue = typeof value === 'number' ? value : parseInt(value)
  const label = numValue === 1 ? singular : plural
  return (
    <div className={cn(
      "rounded-2xl p-3 text-center",
      highlight ? "bg-destructive/10" : "bg-secondary/50"
    )}>
      <p className={cn(
        "text-xl font-semibold font-serif",
        highlight ? "text-destructive" : "text-foreground"
      )}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {subtext && (
        <p className="text-[10px] text-muted-foreground/70 mt-1">{subtext}</p>
      )}
    </div>
  )
}
```

**Step 2: Update StatCard usage in the stats section**

Replace the stat cards grid:

```tsx
<StatCard
  value={settings.stats.blocksTriggered}
  singular="distraction caught"
  plural="distractions caught"
/>
<StatCard
  value={settings.stats.bypassesUsed}
  singular="bypass used"
  plural="bypasses used"
/>
<StatCard
  value={`${bypassesRemaining}/${maxBypasses}`}
  singular="bypasses remaining"
  plural="bypasses remaining"
  highlight={bypassesRemaining === 0}
  subtext={bypassesRemaining === 0 ? 'Resets at midnight' : undefined}
/>
```

Where `maxBypasses` is computed near the top of the component:

```tsx
const maxBypasses = settings.maxBypasses ?? MAX_QUICK_BYPASSES
const bypassesRemaining = maxBypasses - settings.bypassState.quickBypassesUsed
```

**Step 3: Remove borders from status card**

In the status card `<div>`, change the border classes:

```tsx
// OLD
"relative rounded-xl p-5 border transition-all duration-300",
status === 'active' && "bg-primary/10 border-primary/30",
status === 'bypass' && "bg-orange-500/10 border-orange-500/30",
status === 'paused' && "bg-yellow-500/10 border-yellow-500/30",
status === 'inactive' && "bg-secondary/50 border-border"

// NEW
"relative rounded-xl p-5 transition-all duration-300",
status === 'active' && "bg-primary/15",
status === 'bypass' && "bg-orange-500/15",
status === 'paused' && "bg-yellow-500/15",
status === 'inactive' && "bg-secondary/50"
```

**Step 4: Add contextual info below status subtext**

After the `statusSubtext` paragraph, add a site count line (only when active):

```tsx
<p className="text-sm text-muted-foreground mb-4">{statusSubtext}</p>
{status === 'active' && (
  <p className="text-xs text-muted-foreground/70 mb-4">
    {(() => {
      const enabledSiteCount = settings.categories
        .filter(c => c.enabled)
        .reduce((sum, c) => sum + c.sites.length - (c.disabledSites?.length ?? 0), 0)
        + settings.customSites.length
      const enabledCategoryCount = settings.categories.filter(c => c.enabled).length
      return `${enabledSiteCount} sites across ${enabledCategoryCount} ${enabledCategoryCount === 1 ? 'category' : 'categories'}`
    })()}
  </p>
)}
```

Remove the `mb-4` from the `statusSubtext` line since the context line now provides the bottom spacing, and adjust to avoid double-margin when inactive:

```tsx
<p className={cn("text-sm text-muted-foreground", status !== 'active' && "mb-4")}>{statusSubtext}</p>
```

**Step 5: Update add-site button — borderless**

Change the `+ Add site` button:

```tsx
// OLD
className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-secondary/50 text-sm font-medium transition-colors"
// NEW
className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 text-sm font-medium transition-colors"
```

**Step 6: Update inline add-site form — consistent button shapes**

In the `QuickAddSite` open state, update the confirm/cancel buttons to rectangular shapes matching the rest of the popup:

```tsx
<button
  onClick={handleAdd}
  disabled={!site.trim()}
  className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
  title="Add site"
>
  <Check className="w-4 h-4" />
</button>
<button
  onClick={() => { setIsOpen(false); setSite('') }}
  className="px-3 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
  title="Cancel"
>
  <X className="w-4 h-4" />
</button>
```

**Step 7: Build to verify**

Run: `npm run build`
Expected: Clean build.

**Step 8: Commit**

```bash
git add src/popup/App.tsx
git commit -m "feat: popup overhaul — borderless cards, warm copy, context info"
```

---

### Task 4: Settings page — wider column, toggle switches, status indicator

**Files:**
- Modify: `src/settings/App.tsx`

**Step 1: Widen content column**

Change the container class:

```tsx
// OLD
<div className="relative max-w-2xl mx-auto px-6 py-8">
// NEW
<div className="relative max-w-3xl mx-auto px-6 py-8">
```

**Step 2: Add status indicator to header**

Import `shouldBlock` from schedule:

```tsx
import { shouldBlock } from '../shared/schedule'
```

Update the header section to show blocking status:

```tsx
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    <img src="icons/logo.png" alt="Sordino" className="w-8 h-8" />
    <h1 className="font-serif text-2xl font-medium tracking-wide text-primary">Sordino</h1>
  </div>
  {settings && (() => {
    const isPaused = settings.blockState.pausedUntil && Date.now() < settings.blockState.pausedUntil
    const isActive = !isPaused && (
      settings.blockState.manualOverride === 'on' ||
      (settings.blockState.manualOverride === null && shouldBlock(settings).shouldBlock)
    )
    const statusLabel = isPaused ? 'Paused' : isActive ? 'Blocking' : 'Inactive'
    const dotColor = isPaused ? 'bg-yellow-500' : isActive ? 'bg-green-500' : 'bg-muted-foreground/50'
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className={cn("w-2 h-2 rounded-full", dotColor)} />
        <span>{statusLabel}</span>
      </div>
    )
  })()}
</div>
```

**Step 3: Create Toggle component**

Add this component before the `ScheduleCard` component:

```tsx
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-primary" : "bg-secondary"
      )}
    >
      <span className={cn(
        "inline-block h-5 w-5 rounded-full bg-foreground shadow-sm transition-transform duration-200",
        checked ? "translate-x-[22px]" : "translate-x-[2px]"
      )} />
    </button>
  )
}
```

**Step 4: Replace checkboxes in ScheduleCard**

In the `ScheduleCard` component's non-editing view, replace the checkbox button:

```tsx
// OLD
<button
  onClick={onToggle}
  className={cn(
    "mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-150 ease-out",
    schedule.enabled
      ? "bg-primary border-primary text-primary-foreground"
      : "border-muted-foreground"
  )}
>
  {schedule.enabled && <Check className="w-3 h-3" />}
</button>

// NEW
<Toggle checked={schedule.enabled} onChange={onToggle} />
```

Remove the `gap-3` → keep `gap-3` in the flex container (toggle is slightly wider so spacing still works).

**Step 5: Replace checkboxes in CategoryCard**

Same replacement in the `CategoryCard` component header:

```tsx
// OLD
<button
  onClick={onToggle}
  className={cn(
    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-150 ease-out",
    category.enabled
      ? "bg-primary border-primary text-primary-foreground"
      : "border-muted-foreground"
  )}
>
  {category.enabled && <Check className="w-3 h-3" />}
</button>

// NEW
<Toggle checked={category.enabled} onChange={onToggle} />
```

Individual site checkboxes within expanded categories stay as checkboxes — no change.

**Step 6: Build to verify**

Run: `npm run build`
Expected: Clean build.

**Step 7: Commit**

```bash
git add src/settings/App.tsx
git commit -m "feat: settings — wider layout, toggle switches, status indicator"
```

---

### Task 5: Settings — bypass configuration controls + move status to Usage

**Files:**
- Modify: `src/settings/App.tsx`

**Step 1: Create NumberStepper component**

Add this component:

```tsx
function NumberStepper({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium flex items-center justify-center transition-colors disabled:opacity-30"
      >
        −
      </button>
      <span className="text-sm font-medium w-12 text-center tabular-nums">
        {value}{suffix}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium flex items-center justify-center transition-colors disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}
```

**Step 2: Replace BypassSettings component content**

Replace the entire `BypassSettings` component with configurable controls:

```tsx
function BypassSettings({ settings, onUpdate }: {
  settings: SordinoSettings
  onUpdate: (updater: (s: SordinoSettings) => SordinoSettings) => void
}) {
  const maxBypasses = settings.maxBypasses ?? MAX_QUICK_BYPASSES
  const bypassDuration = settings.bypassDurationMinutes ?? 5

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-secondary/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Daily bypass limit</p>
            <p className="text-sm text-muted-foreground">
              Max bypasses per day before midnight reset
            </p>
          </div>
          <NumberStepper
            value={maxBypasses}
            onChange={(v) => onUpdate((s) => ({ ...s, maxBypasses: v }))}
            min={1}
            max={10}
          />
        </div>
      </div>
      <div className="rounded-xl bg-secondary/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Bypass duration</p>
            <p className="text-sm text-muted-foreground">
              How long each bypass lasts
            </p>
          </div>
          <NumberStepper
            value={bypassDuration}
            onChange={(v) => onUpdate((s) => ({ ...s, bypassDurationMinutes: v }))}
            min={1}
            max={30}
            suffix=" min"
          />
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Pass onUpdate prop to BypassSettings**

In the Settings tab section where `BypassSettings` is rendered:

```tsx
// OLD
<BypassSettings settings={settings} />
// NEW
<BypassSettings settings={settings} onUpdate={updateSettings} />
```

**Step 4: Create BypassBudget component for Usage tab**

Add a new component that contains the old bypass status display (progress bar, emergency refresh):

```tsx
function BypassBudget({ settings }: { settings: SordinoSettings }) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; message: string } | null>(null)
  const [countdown, setCountdown] = useState('')

  const maxBypasses = settings.maxBypasses ?? MAX_QUICK_BYPASSES
  const bypassesUsed = settings.bypassState.quickBypassesUsed
  const bypassesRemaining = maxBypasses - bypassesUsed

  const canRefresh = () => {
    if (!settings.bypassState.lastEmergencyRefresh) return true
    const today = getLocalDateString()
    return settings.bypassState.lastEmergencyRefresh !== today
  }

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setDate(midnight.getDate() + 1)
      midnight.setHours(0, 0, 0, 0)
      const diff = midnight.getTime() - now.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setCountdown(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`)
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleEmergencyRefresh = async () => {
    if (!canRefresh()) {
      setRefreshResult({ success: false, message: 'Emergency refresh already used today' })
      return
    }
    setIsRefreshing(true)
    try {
      const response = await chrome.runtime.sendMessage({ type: 'EMERGENCY_REFRESH_BYPASSES' })
      if (response.success) {
        setRefreshResult({ success: true, message: 'Bypasses refreshed! Use wisely.' })
      } else {
        setRefreshResult({ success: false, message: response.reason || 'Failed to refresh' })
      }
    } catch {
      setRefreshResult({ success: false, message: 'Failed to refresh bypasses' })
    }
    setIsRefreshing(false)
    setTimeout(() => setRefreshResult(null), 3000)
  }

  const refreshAvailable = canRefresh()

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-medium">Daily Bypasses</p>
            <p className="text-sm text-muted-foreground">
              {bypassesRemaining} of {maxBypasses} remaining today
            </p>
          </div>
          <div className="text-2xl font-serif font-semibold text-primary">
            {bypassesRemaining}/{maxBypasses}
          </div>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(bypassesRemaining / maxBypasses) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Resets at midnight ({countdown} remaining)</p>
      </div>

      <div className={cn(
        "rounded-xl border p-4",
        refreshAvailable ? "border-border bg-secondary/30" : "border-border/50 bg-secondary/10 opacity-60"
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-medium">Emergency Refresh</p>
            <p className="text-sm text-muted-foreground">
              {refreshAvailable
                ? 'Reset your daily bypasses once per day when you really need them.'
                : `Already used today. Available again at midnight (${countdown}).`}
            </p>
          </div>
          <button
            onClick={handleEmergencyRefresh}
            disabled={!refreshAvailable || isRefreshing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
              refreshAvailable
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
        {refreshResult && (
          <p className={cn("text-sm mt-3", refreshResult.success ? "text-green-500" : "text-destructive")}>
            {refreshResult.message}
          </p>
        )}
      </div>
    </div>
  )
}
```

**Step 5: Add BypassBudget to Usage tab**

In the Usage tab section, add the new section between weekly stats and Top Sites:

```tsx
{/* Usage Tab */}
<section className="mb-10">
  <h2 className="font-serif text-xl font-medium mb-4 text-foreground">This Week</h2>
  <WeeklyStatsChart settings={settings} />
</section>

{/* NEW: Bypass Budget */}
<section className="mb-10">
  <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Bypass Budget</h2>
  <BypassBudget settings={settings} />
</section>

<section className="mb-10">
  <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Top Sites</h2>
  <TopSitesDisplay settings={settings} />
</section>
```

**Step 6: Build to verify**

Run: `npm run build`
Expected: Clean build.

**Step 7: Commit**

```bash
git add src/settings/App.tsx
git commit -m "feat: configurable bypass controls + move bypass status to usage tab"
```

---

### Task 6: Usage dashboard polish — chart + top sites

**Files:**
- Modify: `src/settings/App.tsx`

**Step 1: Update WeeklyStatsChart — hide future days, today dot, no stubs**

Replace the bar chart rendering section in `WeeklyStatsChart`. The key changes:
- Filter out future days
- Today gets a dot indicator below the label instead of orange text
- Zero-data days show no bars (not 2px stubs)

Replace the bar chart `<div className="flex items-end gap-3">` and its contents:

```tsx
<div className="flex items-end gap-3">
  {weekData.filter(day => !day.isFuture).map((day) => {
    const maxBarHeight = 72
    const blocksHeight = day.blocks > 0 ? Math.max((day.blocks / maxValue) * maxBarHeight, 6) : 0
    const bypassesHeight = day.bypasses > 0 ? Math.max((day.bypasses / maxValue) * maxBarHeight, 6) : 0

    return (
      <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
        <div className="w-full flex items-end justify-center gap-1" style={{ height: maxBarHeight + 16 }}>
          <div className="flex-1 flex flex-col items-center justify-end h-full">
            {day.blocks > 0 && (
              <span className="text-[10px] text-muted-foreground mb-0.5">{day.blocks}</span>
            )}
            {blocksHeight > 0 && (
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all duration-300",
                  day.isToday ? "bg-primary" : "bg-primary/60"
                )}
                style={{ height: `${blocksHeight}px` }}
              />
            )}
          </div>
          <div className="flex-1 flex flex-col items-center justify-end h-full">
            {day.bypasses > 0 && (
              <span className="text-[10px] text-muted-foreground mb-0.5">{day.bypasses}</span>
            )}
            {bypassesHeight > 0 && (
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all duration-300",
                  day.isToday ? "bg-orange-500" : "bg-orange-500/60"
                )}
                style={{ height: `${bypassesHeight}px` }}
              />
            )}
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground">{day.day}</span>
          {day.isToday && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />}
        </div>
      </div>
    )
  })}
</div>
```

**Step 2: Update Refreshes stat card — muted when zero**

In the summary grid (3 stat cards), change the Refreshes card:

```tsx
<div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
  <p className={cn(
    "text-2xl font-serif font-semibold",
    emergencyRefreshes > 0 ? "text-muted-foreground" : "text-muted-foreground/50"
  )}>
    {emergencyRefreshes}
  </p>
  <p className="text-xs text-muted-foreground">Refreshes</p>
</div>
```

**Step 3: Update TopSitesDisplay — proportional bars**

Replace the site row rendering in both Most Blocked and Most Bypassed lists. For Most Blocked:

```tsx
<div className="space-y-2">
  {topBlocked.map(([site, stats], index) => {
    const maxBlocks = topBlocked[0]?.[1].blocks ?? 1
    const pct = (stats.blocks / maxBlocks) * 100
    return (
      <div key={site} className="relative">
        <div
          className="absolute inset-y-0 left-0 bg-primary/10 rounded"
          style={{ width: `${pct}%` }}
        />
        <div className="relative flex items-center justify-between py-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground/60 w-4">{index + 1}.</span>
            <span className="text-sm truncate">{site}</span>
          </div>
          <span className="text-sm font-medium text-primary ml-2">{stats.blocks}</span>
        </div>
      </div>
    )
  })}
</div>
```

For Most Bypassed, same pattern but with `bg-orange-500/10` and `text-orange-500`:

```tsx
<div className="space-y-2">
  {topBypassed.map(([site, stats], index) => {
    const maxBypasses = topBypassed[0]?.[1].bypasses ?? 1
    const pct = (stats.bypasses / maxBypasses) * 100
    return (
      <div key={site} className="relative">
        <div
          className="absolute inset-y-0 left-0 bg-orange-500/10 rounded"
          style={{ width: `${pct}%` }}
        />
        <div className="relative flex items-center justify-between py-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground/60 w-4">{index + 1}.</span>
            <span className="text-sm truncate">{site}</span>
          </div>
          <span className="text-sm font-medium text-orange-500 ml-2">{stats.bypasses}</span>
        </div>
      </div>
    )
  })}
</div>
```

**Step 4: Build to verify**

Run: `npm run build`
Expected: Clean build.

**Step 5: Commit**

```bash
git add src/settings/App.tsx
git commit -m "feat: usage dashboard polish — chart cleanup, proportional bars, muted zero state"
```

---

### Task 7: Content overlay — "Go back" link + wordmark unification + dynamic bypass

**Files:**
- Modify: `src/content/content.ts`

**Step 1: Add bypassDuration to BlockStatus interface**

```typescript
interface BlockStatus {
  isBlocked: boolean
  reason?: string
  timeRemaining?: string
  bypassesRemaining?: number
  bypassDuration?: number  // NEW — minutes
}
```

**Step 2: Update createOverlay to use dynamic bypass duration**

In `createOverlay`, change the bypass button text:

```typescript
// OLD
bypassBtn.textContent = 'Bypass for 5 min'
// NEW
const bypassDuration = status.bypassDuration ?? 5
bypassBtn.textContent = `Bypass for ${bypassDuration} min`
```

Also update the disabled state text if needed (the "No bypasses left" text stays the same).

**Step 3: Add "Go back" link after bypass count**

After the bypass count element is appended to content, add:

```typescript
// Go back link
const goBackLink = document.createElement('a')
goBackLink.className = 'sordino-go-back'
goBackLink.textContent = '\u2190 Go back'
goBackLink.addEventListener('click', (e) => {
  e.preventDefault()
  if (history.length > 1) {
    history.back()
  } else {
    window.location.href = 'about:newtab'
  }
})
content.appendChild(goBackLink)
```

**Step 4: Add CSS for go-back link**

In the `injectStyles` function, add to the CSS string:

```css
.sordino-go-back {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  font-size: 0.8125rem !important;
  color: #6b5d4d !important;
  margin: 1rem 0 0 0 !important;
  cursor: pointer !important;
  text-decoration: none !important;
  transition: color 0.2s ease !important;
}

.sordino-go-back:hover {
  color: #9a8b7a !important;
  text-decoration: underline !important;
}
```

**Step 5: Unify wordmark — remove uppercase**

In the `.sordino-title` CSS, change:

```css
/* OLD */
letter-spacing: 0.1em !important;
color: #cda468 !important;
text-transform: uppercase !important;

/* NEW */
letter-spacing: 0.05em !important;
color: #cda468 !important;
```

Remove the `text-transform: uppercase !important;` line entirely. The `title.textContent = 'Sordino'` already outputs title case.

**Step 6: Build to verify**

Run: `npm run build`
Expected: Clean build.

**Step 7: Commit**

```bash
git add src/content/content.ts
git commit -m "feat: overlay — go back link, unified wordmark, dynamic bypass duration"
```

---

### Task 8: Final build verification

**Step 1: Full build for both browsers**

Run: `npm run build && BROWSER=firefox npm run build`
Expected: Both builds succeed with no errors.

**Step 2: Verify output structure**

Run: `ls dist/chrome/ && ls dist/firefox/`
Expected: Both contain the expected files (manifest.json, HTML, JS, icons).

**Step 3: Commit any remaining changes and verify clean status**

Run: `git status`
Expected: Clean working tree (all changes committed in prior tasks).
