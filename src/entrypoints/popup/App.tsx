import { useEffect, useState } from 'react'
import { getSettings, updateSettings, subscribeToSettings } from '@/shared/storage'
import {
  decideMuting,
  modeEnd,
  mutingShow,
  runningMode,
  type Length,
  type MutingShow,
} from '@/shared/muting'
import { clockTime, statusLine } from '@/shared/status'
import type { SordinoSettings } from '@/shared/types'
import { MAX_QUICK_BYPASSES } from '@/shared/types'
import { useNow, useSordinoState } from '@/shared/use-sordino-state'
import { cn } from '@/shared/utils'
import { runtimeCommandPort } from '@/store/adapters/runtime'
import type { Command } from '@/store/commands'
import { Settings, Plus, Play, Timer, X, Check } from 'lucide-react'
import logoUrl from '@/assets/logo.png'

const sordino = runtimeCommandPort()

const LENGTH_LABELS: Record<Length, { short: string; long: string }> = {
  '15m': { short: '15 min', long: '15 minutes' },
  '1h': { short: '1 hour', long: '1 hour' },
  'rest-of-today': { short: 'Rest of today', long: 'the rest of today' },
}

type PopupStatus = MutingShow | 'bypass'

// Format milliseconds as "Xm Xs"
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }
  return `${seconds}s`
}

function App() {
  const [settings, setSettings] = useState<SordinoSettings | null>(null)
  const state = useSordinoState()
  const now = useNow()
  const [problem, setProblem] = useState<string | null>(null)
  const [bypassTimeLeft, setBypassTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    const unsubscribe = subscribeToSettings(setSettings)
    return unsubscribe
  }, [])

  // Countdown timer for active bypass
  useEffect(() => {
    if (!settings?.bypassState.activeBypass) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 1.x surface, rebuilt in 2.0
      setBypassTimeLeft(null)
      return
    }

    const updateCountdown = () => {
      const remaining = settings.bypassState.activeBypass!.expiresAt - Date.now()
      setBypassTimeLeft(remaining > 0 ? remaining : null)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [settings?.bypassState.activeBypass])

  if (!settings || !state) {
    return (
      <div className="w-[340px] h-[420px] bg-background flex items-center justify-center">
        <div className="motion-safe:animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const muting = decideMuting(settings.schedules, state.mode, now)
  const running = runningMode(state.mode, now)
  const hasBypass = bypassTimeLeft !== null && settings.bypassState.activeBypass

  let status: PopupStatus = mutingShow(muting)
  let statusText = statusLine(muting)
  let statusSubtext = running ? null : 'Following your schedules'

  // A bypass (1.x, until #6) is the most time-sensitive thing to show.
  if (hasBypass) {
    status = 'bypass'
    statusText = 'Bypass active'
    statusSubtext = `${settings.bypassState.activeBypass!.site} • ${formatTimeRemaining(bypassTimeLeft!)} left`
  }

  const maxBypasses = settings.maxBypasses ?? MAX_QUICK_BYPASSES
  const bypassesRemaining = maxBypasses - settings.bypassState.quickBypassesUsed

  // The status follows the storage watch; only a command that did not run shows here.
  const send = async (command: Command) => {
    const result = await sordino.send(command)
    setProblem(result.ok ? null : 'Sordino is restarting. Try again in a moment.')
  }

  const handleClearBypass = async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_BYPASS' })
  }

  const openSettings = () => {
    chrome.runtime.openOptionsPage()
  }

  const dismissOnboarding = async () => {
    await updateSettings((s) => ({ ...s, onboardingDismissed: true }))
  }

  return (
    <div className="w-[340px] bg-background text-foreground overflow-hidden">
      {/* Subtle texture overlay */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />

      {/* Header */}
      <div className="relative px-4 pt-4 pb-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Sordino" className="w-6 h-6" />
          <h1 className="font-serif text-lg font-medium tracking-wide text-primary">Sordino</h1>
        </div>
        <button
          onClick={openSettings}
          className="p-2 rounded-xl hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* First-run onboarding card */}
      {!settings.onboardingDismissed && (
        <div className="relative px-4 pt-4">
          <div className="relative rounded-xl border border-border bg-secondary/40 p-4 pr-9">
            <button
              onClick={dismissOnboarding}
              className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              aria-label="Dismiss tip"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <p className="text-sm leading-relaxed text-foreground">
              Sordino softens distracting sites on your schedule. {maxBypasses} quick bypasses are
              built in each day, reset at midnight. Schedules live in{' '}
              <button
                onClick={async () => {
                  await dismissOnboarding()
                  openSettings()
                }}
                className="underline underline-offset-2 decoration-primary/40 hover:decoration-primary/70 hover:text-primary transition-colors"
              >
                Settings
              </button>
              .
            </p>
            <div className="mt-3 flex justify-end">
              <button
                onClick={dismissOnboarding}
                className="px-3 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Card */}
      <div className="p-4">
        <div
          className={cn(
            'relative rounded-xl p-5 transition-colors duration-200',
            status === 'muting' && 'bg-primary/15',
            status === 'bypass' && 'bg-info/15',
            status === 'paused' && 'bg-warning/15',
            status === 'off' && 'bg-secondary/50'
          )}
        >
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {status === 'bypass' ? (
                  <Timer className="w-4 h-4 text-info" />
                ) : (
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      status === 'muting' &&
                        'bg-success motion-safe:animate-[pulse_1.5s_ease-in-out_infinite]',
                      status === 'paused' && 'bg-warning',
                      status === 'off' && 'bg-muted-foreground/50'
                    )}
                  />
                )}
                <span
                  className={cn(
                    'text-sm font-medium transition-colors duration-200',
                    status === 'muting' && 'text-primary',
                    status === 'bypass' && 'text-info',
                    status === 'paused' && 'text-warning',
                    status === 'off' && 'text-muted-foreground'
                  )}
                >
                  {statusText}
                </span>
              </div>
            </div>

            {statusSubtext && (
              <p className={cn('text-sm text-muted-foreground', status !== 'muting' ? 'mb-4' : '')}>
                {statusSubtext}
              </p>
            )}
            {status === 'muting' && (
              <p className="text-xs text-muted-foreground/70 mb-4">
                {(() => {
                  const enabledSiteCount =
                    settings.categories
                      .filter((c) => c.enabled)
                      .reduce(
                        (sum, c) => sum + c.sites.length - (c.disabledSites?.length ?? 0),
                        0
                      ) + settings.customSites.length
                  const enabledCategoryCount = settings.categories.filter((c) => c.enabled).length
                  return `${enabledSiteCount} sites across ${enabledCategoryCount} ${enabledCategoryCount === 1 ? 'category' : 'categories'}`
                })()}
              </p>
            )}

            {status === 'bypass' && (
              <button
                onClick={handleClearBypass}
                className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-info/20 hover:bg-info/30 border border-info/30 text-info text-sm font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                End bypass
              </button>
            )}

            {/* Always one tap away; on schedule already, it changes nothing. */}
            <button
              onClick={() => send({ type: 'back-to-schedule' })}
              className={cn(
                'w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
                running
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'bg-secondary/40 hover:bg-secondary/60 text-muted-foreground'
              )}
            >
              <Play className="w-4 h-4" />
              Back to schedule
            </button>

            <ModeChoices
              label="Mute now"
              now={now}
              onChoose={(length) => send({ type: 'mute-now', length })}
            />
            <ModeChoices
              label="Pause"
              now={now}
              onChoose={(length) => send({ type: 'pause', length })}
            />
            {problem && (
              <p role="status" className="mt-3 text-xs text-muted-foreground">
                {problem}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Today
        </p>
        <div className="grid grid-cols-3 gap-3">
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
        </div>
      </div>

      {/* Quick Add Site */}
      <div className="px-4 pb-4">
        <QuickAddSite />
      </div>
    </div>
  )
}

function StatCard({
  value,
  singular,
  plural,
  highlight,
  subtext,
}: {
  value: number | string
  singular: string
  plural: string
  highlight?: boolean
  subtext?: string
}) {
  const numValue = typeof value === 'number' ? value : parseInt(value)
  const label = numValue === 1 ? singular : plural
  return (
    <div
      className={cn(
        'rounded-2xl p-3 text-center',
        highlight ? 'bg-destructive/10' : 'bg-secondary/50'
      )}
    >
      <p
        className={cn(
          'text-xl font-semibold font-serif',
          highlight ? 'text-destructive' : 'text-foreground'
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {subtext && <p className="text-[10px] text-muted-foreground/70 mt-1">{subtext}</p>}
    </div>
  )
}

function QuickAddSite() {
  const [isOpen, setIsOpen] = useState(false)
  const [site, setSite] = useState('')

  const handleAdd = async () => {
    if (!site.trim()) return

    const cleanSite = site
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]!

    // Use queued updateSettings to prevent race conditions
    await updateSettings((s) => ({
      ...s,
      customSites: [...s.customSites, cleanSite],
    }))

    setSite('')
    setIsOpen(false)
  }

  if (isOpen) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          value={site}
          onChange={(e) => setSite(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
            if (e.key === 'Escape') {
              setIsOpen(false)
              setSite('')
            }
          }}
          placeholder="example.com"
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoFocus
        />
        <button
          onClick={handleAdd}
          disabled={!site.trim()}
          className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          title="Add site"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setIsOpen(false)
            setSite('')
          }}
          className="px-3 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 text-sm font-medium transition-colors"
    >
      <Plus className="w-4 h-4" />
      Add site
    </button>
  )
}

// One row per mode: each length with the end time it would have if chosen now.
function ModeChoices({
  label,
  now,
  onChoose,
}: {
  label: 'Mute now' | 'Pause'
  now: number
  onChoose: (length: Length) => void
}) {
  return (
    <div className="mt-3 first:mt-0" role="group" aria-label={label}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(LENGTH_LABELS) as Length[]).map((length) => {
          const until = clockTime(modeEnd(length, now))
          return (
            <button
              key={length}
              onClick={() => onChoose(length)}
              aria-label={`${label} for ${LENGTH_LABELS[length].long}, until ${until}`}
              className="flex flex-col items-center px-2 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors"
            >
              {LENGTH_LABELS[length].short}
              <span className="text-[11px] font-normal text-muted-foreground">until {until}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default App
