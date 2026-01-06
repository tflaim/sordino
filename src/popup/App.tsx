import { useEffect, useState } from 'react'
import { getSettings, subscribeToSettings } from '../shared/storage'
import { shouldBlock, getActiveSchedule, formatEndTime, getTimeRemainingInSchedule } from '../shared/schedule'
import type { SordinoSettings } from '../shared/types'
import { cn } from '../shared/utils'
import { Settings, Plus, Pause, Play, Clock } from 'lucide-react'

const MAX_QUICK_BYPASSES = 3

type BlockingStatus = 'active' | 'paused' | 'inactive'

function App() {
  const [settings, setSettings] = useState<SordinoSettings | null>(null)
  const [showPauseMenu, setShowPauseMenu] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings)
    const unsubscribe = subscribeToSettings(setSettings)
    return unsubscribe
  }, [])

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

  let status: BlockingStatus = 'inactive'
  let statusText = 'Blocking inactive'
  let statusSubtext = 'No schedule active'

  if (isPaused) {
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
    await chrome.runtime.sendMessage({ type: 'TOGGLE_MANUAL_OVERRIDE', state: null })
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
          <svg viewBox="0 0 64 64" fill="none" className="w-6 h-6 text-primary">
            <path d="M12 32C12 32 16 28 24 28C32 28 36 32 36 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M36 26V38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M36 32H48C50 32 52 30 52 28V36C52 34 50 32 48 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="48" cy="32" r="4" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 30V34" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <path d="M4 28V36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h1 className="font-serif text-lg font-medium tracking-wide text-primary">Sordino</h1>
        </div>
        <button
          onClick={openSettings}
          className="p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Status Card */}
      <div className="p-4">
        <div className={cn(
          "relative rounded-xl p-5 border transition-all duration-300",
          status === 'active' && "bg-primary/10 border-primary/30",
          status === 'paused' && "bg-yellow-500/10 border-yellow-500/30",
          status === 'inactive' && "bg-secondary/50 border-border"
        )}>
          {/* Glow effect for active */}
          {status === 'active' && (
            <div className="absolute inset-0 rounded-xl bg-primary/5 blur-xl" />
          )}

          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  status === 'active' && "bg-green-500 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_8px_rgba(34,197,94,0.6)]",
                  status === 'paused' && "bg-yellow-500",
                  status === 'inactive' && "bg-muted-foreground/50"
                )} />
                <span className={cn(
                  "text-sm font-medium uppercase tracking-wider",
                  status === 'active' && "text-primary",
                  status === 'paused' && "text-yellow-500",
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>

                  {/* Pause dropdown */}
                  {showPauseMenu && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-xl z-10 overflow-hidden">
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

              {(status === 'paused' || status === 'inactive') && (
                <button
                  onClick={status === 'paused' ? handleResume : handleToggle}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors"
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
          />
        </div>
      </div>

      {/* Quick Controls */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <QuickAddSite />
          <button
            onClick={openSettings}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary/50 text-sm font-medium transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ value, label, highlight }: { value: number | string; label: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-lg p-3 text-center border",
      highlight ? "bg-destructive/10 border-destructive/30" : "bg-secondary/30 border-border/50"
    )}>
      <p className={cn(
        "text-xl font-semibold font-serif",
        highlight ? "text-destructive" : "text-foreground"
      )}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function QuickAddSite() {
  const [isOpen, setIsOpen] = useState(false)
  const [site, setSite] = useState('')

  const handleAdd = async () => {
    if (!site.trim()) return

    const cleanSite = site.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]

    const settings = await getSettings()
    const updatedSettings = {
      ...settings,
      customSites: [...settings.customSites, cleanSite],
    }

    await chrome.storage.local.set({ sordino_settings: updatedSettings })
    setSite('')
    setIsOpen(false)
  }

  if (isOpen) {
    return (
      <div className="flex-1 flex gap-2">
        <input
          type="text"
          value={site}
          onChange={(e) => setSite(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="example.com"
          className="flex-1 px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoFocus
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Add
        </button>
        <button
          onClick={() => { setIsOpen(false); setSite('') }}
          className="px-3 py-2.5 rounded-lg border border-border hover:bg-secondary/50 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary/50 text-sm font-medium transition-colors"
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
