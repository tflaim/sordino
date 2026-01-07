import { useEffect, useState } from 'react'
import { getSettings, updateSettings, subscribeToSettings } from '../shared/storage'
import { shouldBlock, getActiveSchedule, formatEndTime } from '../shared/schedule'
import type { SordinoSettings } from '../shared/types'
import { MAX_QUICK_BYPASSES } from '../shared/types'
import { cn } from '../shared/utils'
import { Settings, Plus, Pause, Play, Clock, Timer, X, Check } from 'lucide-react'

type BlockingStatus = 'active' | 'paused' | 'inactive' | 'bypass'

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
  const [showPauseMenu, setShowPauseMenu] = useState(false)
  const [bypassTimeLeft, setBypassTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    const unsubscribe = subscribeToSettings(setSettings)
    return unsubscribe
  }, [])

  // Countdown timer for active bypass
  useEffect(() => {
    if (!settings?.bypassState.activeBypass) {
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

  if (!settings) {
    return (
      <div className="w-[340px] h-[420px] bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const blockStatus = shouldBlock(settings)
  const activeSchedule = getActiveSchedule(settings.schedules)
  const isPaused = settings.blockState.pausedUntil && Date.now() < settings.blockState.pausedUntil
  const hasBypass = bypassTimeLeft !== null && settings.bypassState.activeBypass

  let status: BlockingStatus = 'inactive'
  let statusText = 'Blocking inactive'
  let statusSubtext = 'No schedule active'

  // Bypass has highest priority - it's a time-sensitive state
  if (hasBypass) {
    status = 'bypass'
    statusText = 'Bypass active'
    statusSubtext = `${settings.bypassState.activeBypass!.site} • ${formatTimeRemaining(bypassTimeLeft!)} left`
  } else if (isPaused) {
    status = 'paused'
    const pauseEnd = new Date(settings.blockState.pausedUntil!)
    statusText = 'Paused'
    statusSubtext = `Until ${pauseEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  } else if (settings.blockState.manualOverride === 'on') {
    status = 'active'
    statusText = 'Blocking active'
    statusSubtext = 'Manual block enabled'
  } else if (settings.blockState.manualOverride === 'off') {
    status = 'inactive'
    statusText = 'Blocking disabled'
    statusSubtext = 'Manual override'
  } else if (blockStatus.shouldBlock && activeSchedule) {
    status = 'active'
    statusText = 'Blocking active'
    statusSubtext = `${activeSchedule.name} • until ${formatEndTime(activeSchedule)}`
  }

  const bypassesRemaining = MAX_QUICK_BYPASSES - settings.bypassState.quickBypassesUsed

  const handleToggle = async () => {
    const newState = status === 'active' ? 'off' : 'on'
    await chrome.runtime.sendMessage({ type: 'TOGGLE_MANUAL_OVERRIDE', state: newState })
  }

  const handlePause = async (duration: number | null) => {
    if (duration === null) {
      // Until I turn it back on
      await chrome.runtime.sendMessage({ type: 'TOGGLE_MANUAL_OVERRIDE', state: 'off' })
    } else {
      const until = Date.now() + duration
      await chrome.runtime.sendMessage({ type: 'PAUSE_BLOCKING', until })
    }
    setShowPauseMenu(false)
  }

  const handleResume = async () => {
    await chrome.runtime.sendMessage({ type: 'RESUME_BLOCKING' })
  }

  const handleClearBypass = async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_BYPASS' })
  }

  const openSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') })
  }

  return (
    <div className="w-[340px] bg-background text-foreground overflow-hidden">
      {/* Subtle texture overlay */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />

      {/* Header */}
      <div className="relative px-4 pt-4 pb-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2">
          <img src="icons/logo.png" alt="Sordino" className="w-6 h-6" />
          <h1 className="font-serif text-lg font-medium tracking-wide text-primary">Sordino</h1>
        </div>
        <button
          onClick={openSettings}
          className="p-2 rounded-xl hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Status Card */}
      <div className="p-4">
        <div className={cn(
          "relative rounded-xl p-5 border transition-all duration-300",
          status === 'active' && "bg-primary/10 border-primary/30",
          status === 'bypass' && "bg-orange-500/10 border-orange-500/30",
          status === 'paused' && "bg-yellow-500/10 border-yellow-500/30",
          status === 'inactive' && "bg-secondary/50 border-border"
        )}>
          {/* Glow effect for active/bypass */}
          {status === 'active' && (
            <div className="absolute inset-0 rounded-xl bg-primary/5 blur-xl" />
          )}
          {status === 'bypass' && (
            <div className="absolute inset-0 rounded-xl bg-orange-500/5 blur-xl" />
          )}

          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {status === 'bypass' ? (
                  <Timer className="w-4 h-4 text-orange-500" />
                ) : (
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    status === 'active' && "bg-green-500 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_8px_rgba(34,197,94,0.6)]",
                    status === 'paused' && "bg-yellow-500",
                    status === 'inactive' && "bg-muted-foreground/50"
                  )} />
                )}
                <span className={cn(
                  "text-sm font-medium uppercase tracking-wider transition-all duration-300",
                  status === 'active' && "text-primary [text-shadow:0_0_10px_rgba(205,164,104,0.5),0_0_20px_rgba(205,164,104,0.3)]",
                  status === 'bypass' && "text-orange-500 [text-shadow:0_0_10px_rgba(249,115,22,0.5),0_0_20px_rgba(249,115,22,0.3)]",
                  status === 'paused' && "text-yellow-500 [text-shadow:0_0_10px_rgba(234,179,8,0.5),0_0_20px_rgba(234,179,8,0.3)]",
                  status === 'inactive' && "text-muted-foreground"
                )}>
                  {statusText}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">{statusSubtext}</p>

            {/* Action buttons */}
            <div className="flex gap-2">
              {status === 'active' && (
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowPauseMenu(!showPauseMenu)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>

                  {/* Pause dropdown */}
                  {showPauseMenu && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-10 overflow-hidden">
                      <button onClick={() => handlePause(15 * 60 * 1000)} className="w-full px-4 py-2.5 text-left text-sm hover:bg-secondary/50 transition-colors flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        15 minutes
                      </button>
                      <button onClick={() => handlePause(60 * 60 * 1000)} className="w-full px-4 py-2.5 text-left text-sm hover:bg-secondary/50 transition-colors flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        1 hour
                      </button>
                      <button onClick={() => handlePause(getMillisecondsUntilTomorrow())} className="w-full px-4 py-2.5 text-left text-sm hover:bg-secondary/50 transition-colors flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        Until tomorrow
                      </button>
                      <div className="border-t border-border" />
                      <button onClick={() => handlePause(null)} className="w-full px-4 py-2.5 text-left text-sm hover:bg-secondary/50 transition-colors text-muted-foreground">
                        Until I turn it back on
                      </button>
                    </div>
                  )}
                </div>
              )}

              {status === 'bypass' && (
                <button
                  onClick={handleClearBypass}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-500 text-sm font-medium transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Resume Blocking
                </button>
              )}

              {(status === 'paused' || status === 'inactive') && (
                <button
                  onClick={status === 'paused' ? handleResume : handleToggle}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors"
                >
                  <Play className="w-4 h-4" />
                  {status === 'paused' ? 'Resume' : 'Start Blocking'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Today</p>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            value={settings.stats.blocksTriggered}
            label="blocked"
          />
          <StatCard
            value={settings.stats.bypassesUsed}
            label="bypasses"
          />
          <StatCard
            value={`${bypassesRemaining}/${MAX_QUICK_BYPASSES}`}
            label="bypasses left"
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

function StatCard({ value, label, highlight, subtext }: { value: number | string; label: string; highlight?: boolean; subtext?: string }) {
  return (
    <div className={cn(
      "rounded-xl p-3 text-center border",
      highlight ? "bg-destructive/10 border-destructive/30" : "bg-secondary/30 border-border/50"
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

function QuickAddSite() {
  const [isOpen, setIsOpen] = useState(false)
  const [site, setSite] = useState('')

  const handleAdd = async () => {
    if (!site.trim()) return

    const cleanSite = site.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]

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
            if (e.key === 'Escape') { setIsOpen(false); setSite('') }
          }}
          placeholder="example.com"
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoFocus
        />
        <button
          onClick={handleAdd}
          disabled={!site.trim()}
          className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          title="Add site"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setIsOpen(false); setSite('') }}
          className="p-2.5 rounded-xl border border-border hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
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
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-secondary/50 text-sm font-medium transition-colors"
    >
      <Plus className="w-4 h-4" />
      Add site
    </button>
  )
}

function getMillisecondsUntilTomorrow(): number {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.getTime() - now.getTime()
}

export default App
