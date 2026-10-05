import { useEffect, useState, useRef } from 'react'
import {
  getSettings,
  updateSettings as updateSettingsQueued,
  subscribeToSettings,
} from '@/shared/storage'
import type { SordinoSettings, Schedule, Category, DayOfWeek } from '@/shared/types'
import {
  TEMPLATE_SCHEDULE_IDS,
  DEFAULT_SCHEDULES,
  getLocalDateString,
  MAX_QUICK_BYPASSES,
  CONFIRM_RESET_MS,
} from '@/shared/types'
import { cn } from '@/shared/utils'
import { decideMuting, mutingShow } from '@/shared/muting'
import { statusLine } from '@/shared/status'
import { useNow, useSordinoState } from '@/shared/use-sordino-state'
import {
  Plus,
  Trash2,
  X,
  Check,
  ChevronDown,
  RefreshCw,
  BarChart3,
  Settings,
  Activity,
  AlertCircle,
} from 'lucide-react'
import logoUrl from '@/assets/logo.png'

type Tab = 'settings' | 'usage'

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'mon', label: 'Monday', short: 'M' },
  { key: 'tue', label: 'Tuesday', short: 'T' },
  { key: 'wed', label: 'Wednesday', short: 'W' },
  { key: 'thu', label: 'Thursday', short: 'T' },
  { key: 'fri', label: 'Friday', short: 'F' },
  { key: 'sat', label: 'Saturday', short: 'S' },
  { key: 'sun', label: 'Sunday', short: 'S' },
]

function App() {
  const [settings, setSettings] = useState<SordinoSettings | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('settings')

  useEffect(() => {
    getSettings().then(setSettings)
    const unsubscribe = subscribeToSettings(setSettings)
    return unsubscribe
  }, [])

  const updateSettings = async (updater: (s: SordinoSettings) => SordinoSettings) => {
    if (!settings) return
    // Use the queued updateSettings to prevent race conditions
    const updated = await updateSettingsQueued(updater)
    setSettings(updated)
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="motion-safe:animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Texture overlay */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />

      <div className="relative max-w-3xl mx-auto px-6 py-8">
        {/* Header — status moved to RightNowCallout below the tab strip so
            the Settings surface doesn't carry two indicators of the same
            information at the same time. */}
        <div className="flex items-center gap-3 mb-6">
          <img src={logoUrl} alt="Sordino" className="w-8 h-8" />
          <h1 className="font-serif text-2xl font-medium tracking-wide text-primary">Sordino</h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 mb-8 rounded-xl bg-secondary/50 border border-border">
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === 'settings'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === 'usage'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Activity className="w-4 h-4" />
            Usage
          </button>
        </div>

        {activeTab === 'settings' ? (
          <>
            {/* Right Now callout — orients the user before the body content
                begins. Mirrors the header status pill in plain-sentence form
                so the ADHD-primary persona doesn't have to look back up
                during a scroll-and-scan task. */}
            <RightNowCallout settings={settings} />

            {/* Schedules Section */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Schedules</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Template schedules can be toggled on/off. Create custom schedules for full control.
              </p>
              <div className="space-y-3">
                {settings.schedules.map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    isTemplate={TEMPLATE_SCHEDULE_IDS.includes(schedule.id)}
                    onToggle={() => {
                      updateSettings((s) => ({
                        ...s,
                        schedules: s.schedules.map((sch) =>
                          sch.id === schedule.id ? { ...sch, enabled: !sch.enabled } : sch
                        ),
                      }))
                    }}
                    onUpdate={(updated) => {
                      updateSettings((s) => ({
                        ...s,
                        schedules: s.schedules.map((sch) =>
                          sch.id === schedule.id ? updated : sch
                        ),
                      }))
                    }}
                    onDelete={() => {
                      updateSettings((s) => ({
                        ...s,
                        schedules: s.schedules.filter((sch) => sch.id !== schedule.id),
                      }))
                    }}
                  />
                ))}
              </div>
              <AddScheduleButton
                onAdd={(schedule) => {
                  updateSettings((s) => ({
                    ...s,
                    schedules: [...s.schedules, schedule],
                  }))
                }}
              />
            </section>

            <MusicalDivider />

            {/* Blocked Sites Section */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Blocked Sites</h2>

              {/* Categories */}
              <div className="mb-6">
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Categories
                </h3>
                <div className="space-y-3">
                  {settings.categories.map((category) => (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      onToggle={() => {
                        updateSettings((s) => ({
                          ...s,
                          categories: s.categories.map((cat) =>
                            cat.id === category.id ? { ...cat, enabled: !cat.enabled } : cat
                          ),
                        }))
                      }}
                      onUpdate={(updated) => {
                        updateSettings((s) => ({
                          ...s,
                          categories: s.categories.map((cat) =>
                            cat.id === category.id ? updated : cat
                          ),
                        }))
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Custom Sites */}
              <div>
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Custom Sites
                </h3>
                <div className="space-y-2 mb-3">
                  {settings.customSites.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No custom sites added.</p>
                  ) : (
                    settings.customSites.map((site) => (
                      <div
                        key={site}
                        className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-secondary/30 border border-border/50"
                      >
                        <span className="text-sm">{site}</span>
                        <button
                          onClick={() => {
                            updateSettings((s) => ({
                              ...s,
                              customSites: s.customSites.filter((siteName) => siteName !== site),
                            }))
                          }}
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors duration-150 ease-out"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <AddSiteInput
                  onAdd={(site) => {
                    updateSettings((s) => ({
                      ...s,
                      customSites: [...s.customSites, site],
                    }))
                  }}
                  existingSites={settings.customSites}
                />
              </div>
            </section>

            {/* Bypass Settings Section */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-medium mb-4 text-foreground">
                Bypass Settings
              </h2>
              <BypassSettings settings={settings} onUpdate={updateSettings} />
            </section>
          </>
        ) : (
          <>
            {/* Usage Tab */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-medium mb-4 text-foreground">This Week</h2>
              <WeeklyStatsChart settings={settings} />
            </section>

            <section className="mb-10">
              <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Bypass Budget</h2>
              <BypassBudget settings={settings} />
            </section>

            <section className="mb-10">
              <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Top Sites</h2>
              <TopSitesDisplay settings={settings} />
            </section>
          </>
        )}

        <Footer />
      </div>
    </div>
  )
}

const SORDINO_REPO_URL = 'https://github.com/tflaim/sordino'

function Footer() {
  // Read the version from the extension manifest at runtime so future bumps
  // stay in sync without source edits. Safe inside a Chrome MV3 extension.
  const version = chrome?.runtime?.getManifest?.()?.version ?? ''
  const [showHelp, setShowHelp] = useState(false)
  return (
    <footer className="mt-16 pt-6 border-t border-border/40 space-y-3 text-xs text-muted-foreground/70">
      {showHelp && (
        <div className="rounded-lg bg-secondary/30 border border-border/40 p-4 text-sm text-foreground space-y-2">
          <p>
            Sordino blocks distracting sites softly. The overlay always offers a bypass; the bypass
            is the product.
          </p>
          <p>
            You get a fixed number of quick bypasses per day, reset at midnight. The count is set in
            Bypass Settings.
          </p>
          <p>
            Blocking runs on whichever schedules you turn on. Multiple schedules can overlap; if any
            one is active, blocking is active.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{version ? `Sordino v${version}` : 'Sordino'}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="rounded hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-expanded={showHelp}
          >
            {showHelp ? 'Hide overview' : 'How Sordino works'}
          </button>
          <span className="text-muted-foreground/30">·</span>
          <a
            href={`${SORDINO_REPO_URL}/blob/main/PRIVACY.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            Privacy
          </a>
          <span className="text-muted-foreground/30">·</span>
          <a
            href={SORDINO_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            Source code
          </a>
        </div>
      </div>
      <p className="text-muted-foreground/50">
        Stored on this device. Nothing leaves your browser.
      </p>
    </footer>
  )
}

// Hand-shaped SVG musical-mute divider. Replaces glyph-unicode dividers
// (pp ♪♫♪ 𝄐 ♫♪♫ pp) whose fermata + flagged-note glyphs do not render
// reliably across browser font stacks. Inline SVG ensures consistent
// rendering on every platform. currentColor inherits the surrounding text
// color and opacity from the wrapper. The pp text spans were removed because
// italic Cormorant under 24px violates the 24px Cormorant Rule (§3) and
// stacking two dividers ×two italic spans each blew the Italic Budget Rule.
function MusicalDivider() {
  return (
    <div className="flex items-center justify-center text-primary/40 mb-10 select-none" aria-hidden>
      <svg
        width="148"
        height="22"
        viewBox="0 0 148 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Three eighth notes: stem + filled notehead */}
        <g>
          {/* Note 1 */}
          <line x1="6" y1="3" x2="6" y2="17" />
          <ellipse cx="4" cy="17" rx="3" ry="2.2" fill="currentColor" strokeWidth="0" />
          {/* Note 2 */}
          <line x1="20" y1="3" x2="20" y2="17" />
          <ellipse cx="18" cy="17" rx="3" ry="2.2" fill="currentColor" strokeWidth="0" />
          {/* Note 3 */}
          <line x1="34" y1="3" x2="34" y2="17" />
          <ellipse cx="32" cy="17" rx="3" ry="2.2" fill="currentColor" strokeWidth="0" />
          {/* Beam connecting the three eighths */}
          <line x1="6" y1="3" x2="34" y2="3" strokeWidth="2" />
        </g>
        {/* Fermata: arc with a dot below */}
        <g transform="translate(74 11)">
          <path d="M -10 2 A 10 10 0 0 1 10 2" />
          <circle cx="0" cy="2" r="1.2" fill="currentColor" strokeWidth="0" />
        </g>
        {/* Three more eighth notes mirroring the first group */}
        <g>
          <line x1="114" y1="3" x2="114" y2="17" />
          <ellipse cx="112" cy="17" rx="3" ry="2.2" fill="currentColor" strokeWidth="0" />
          <line x1="128" y1="3" x2="128" y2="17" />
          <ellipse cx="126" cy="17" rx="3" ry="2.2" fill="currentColor" strokeWidth="0" />
          <line x1="142" y1="3" x2="142" y2="17" />
          <ellipse cx="140" cy="17" rx="3" ry="2.2" fill="currentColor" strokeWidth="0" />
          <line x1="114" y1="3" x2="142" y2="3" strokeWidth="2" />
        </g>
      </svg>
    </div>
  )
}

// Right-now status callout — sits above the first body section on the
// Settings tab and owns state for that surface (the duplicate header pill
// was removed to avoid two indicators showing the same information). Reads
// as one sentence per state, no parental prefix, no end-of-line period
// (matches the no-period pill convention elsewhere).
function RightNowCallout({ settings }: { settings: SordinoSettings }) {
  const state = useSordinoState()
  const now = useNow()
  if (!state) return null
  const muting = decideMuting(settings.schedules, state.mode, now)
  const body =
    muting.source.kind === 'none'
      ? 'Not muting. Turn on a schedule below to start'
      : statusLine(muting)
  const dotColor = { muting: 'bg-success', paused: 'bg-warning', off: 'bg-muted-foreground/50' }[
    mutingShow(muting)
  ]

  return (
    <div className="mb-8 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-secondary/30 border border-border/40 text-sm">
      <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotColor)} aria-hidden />
      <p className="text-foreground">{body}</p>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200',
        checked ? 'bg-primary' : 'bg-secondary'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-foreground shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        )}
      />
    </button>
  )
}

function ScheduleCard({
  schedule,
  isTemplate = false,
  onToggle,
  onUpdate,
  onDelete,
}: {
  schedule: Schedule
  isTemplate?: boolean
  onToggle: () => void
  onUpdate: (schedule: Schedule) => void
  onDelete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [editedSchedule, setEditedSchedule] = useState(schedule)

  // Auto-cancel the delete-confirm after 8 seconds of inaction so the UI
  // doesn't strand a user mid-action. 8s leaves slack for the ADHD-primary
  // persona to glance away and come back without losing the state.
  useEffect(() => {
    if (!isConfirmingDelete) return
    const t = setTimeout(() => setIsConfirmingDelete(false), CONFIRM_RESET_MS)
    return () => clearTimeout(t)
  }, [isConfirmingDelete])

  const formatDays = (days: DayOfWeek[]) => {
    if (days.length === 7) return 'Every day'
    if (days.length === 5 && !days.includes('sat') && !days.includes('sun')) return 'Weekdays'
    if (days.length === 2 && days.includes('sat') && days.includes('sun')) return 'Weekends'
    return days.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number) as [number, number]
    const h = hours % 12 || 12
    const ampm = hours >= 12 ? 'PM' : 'AM'
    return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  if (isEditing) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <input
          type="text"
          value={editedSchedule.name}
          onChange={(e) => setEditedSchedule({ ...editedSchedule, name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Schedule name"
        />

        {/* Days */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Days</p>
          <div className="flex gap-1">
            {DAYS.map((day) => (
              <button
                key={day.key}
                onClick={() => {
                  const days = editedSchedule.days.includes(day.key)
                    ? editedSchedule.days.filter((d) => d !== day.key)
                    : [...editedSchedule.days, day.key]
                  setEditedSchedule({ ...editedSchedule, days })
                }}
                className={cn(
                  'w-8 h-8 rounded-full text-xs font-medium transition-colors duration-150 ease-out',
                  editedSchedule.days.includes(day.key)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                )}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">Start time</p>
            <input
              type="time"
              value={editedSchedule.startTime}
              onChange={(e) => setEditedSchedule({ ...editedSchedule, startTime: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">End time</p>
            <input
              type="time"
              value={editedSchedule.endTime}
              onChange={(e) => setEditedSchedule({ ...editedSchedule, endTime: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setIsEditing(false)
              setEditedSchedule(schedule)
            }}
            className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors duration-150 ease-out"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onUpdate(editedSchedule)
              setIsEditing(false)
            }}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 ease-out"
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-[background-color,border-color,opacity] duration-200 ease-out',
        schedule.enabled
          ? 'bg-secondary/30 border-border'
          : 'bg-transparent border-border/50 opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Toggle checked={schedule.enabled} onChange={onToggle} />
          <div>
            <p className="font-medium">{schedule.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDays(schedule.days)} • {formatTime(schedule.startTime)} -{' '}
              {formatTime(schedule.endTime)}
            </p>
          </div>
        </div>
        {!isTemplate && (
          <div className="flex items-center gap-1">
            {isConfirmingDelete ? (
              <>
                <button
                  onClick={() => {
                    setIsConfirmingDelete(false)
                    onDelete()
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-foreground hover:bg-secondary transition-colors duration-150 ease-out"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-150 ease-out"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-150 ease-out"
                >
                  Edit
                </button>
                <button
                  onClick={() => setIsConfirmingDelete(true)}
                  className="p-1 rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-150 ease-out"
                  aria-label="Remove schedule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
        {isTemplate && <span className="text-xs text-muted-foreground/60 px-2 py-1">Template</span>}
      </div>
    </div>
  )
}

// Check if a schedule matches a template schedule
function matchesTemplateSchedule(schedule: Schedule): Schedule | null {
  for (const template of DEFAULT_SCHEDULES) {
    const sameDays =
      schedule.days.length === template.days.length &&
      schedule.days.every((d) => template.days.includes(d))
    const sameTime =
      schedule.startTime === template.startTime && schedule.endTime === template.endTime
    if (sameDays && sameTime) {
      return template
    }
  }
  return null
}

function AddScheduleButton({ onAdd }: { onAdd: (schedule: Schedule) => void }) {
  const [isAdding, setIsAdding] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<Schedule>({
    id: '',
    name: '',
    enabled: true,
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startTime: '09:00',
    endTime: '17:00',
  })

  // Check for duplicates whenever schedule changes
  useEffect(() => {
    if (!isAdding) return

    const matchedTemplate = matchesTemplateSchedule(schedule)
    if (matchedTemplate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 1.x surface, rebuilt in 2.0
      setDuplicateWarning(
        `This matches the "${matchedTemplate.name}" template. Consider using that instead.`
      )
    } else {
      setDuplicateWarning(null)
    }
  }, [schedule.days, schedule.startTime, schedule.endTime, isAdding])

  const handleAdd = () => {
    if (!schedule.name.trim()) return
    onAdd({
      ...schedule,
      id: `custom-${Date.now()}`,
    })
    setIsAdding(false)
    setDuplicateWarning(null)
    setSchedule({
      id: '',
      name: '',
      enabled: true,
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      startTime: '09:00',
      endTime: '17:00',
    })
  }

  if (isAdding) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
        <input
          type="text"
          value={schedule.name}
          onChange={(e) => setSchedule({ ...schedule, name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="New schedule name"
          autoFocus
        />

        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Days</p>
          <div className="flex gap-1">
            {DAYS.map((day) => (
              <button
                key={day.key}
                onClick={() => {
                  const days = schedule.days.includes(day.key)
                    ? schedule.days.filter((d) => d !== day.key)
                    : [...schedule.days, day.key]
                  setSchedule({ ...schedule, days })
                }}
                className={cn(
                  'w-8 h-8 rounded-full text-xs font-medium transition-colors duration-150 ease-out',
                  schedule.days.includes(day.key)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                )}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">Start time</p>
            <input
              type="time"
              value={schedule.startTime}
              onChange={(e) => setSchedule({ ...schedule, startTime: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">End time</p>
            <input
              type="time"
              value={schedule.endTime}
              onChange={(e) => setSchedule({ ...schedule, endTime: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Duplicate Warning */}
        {duplicateWarning && (
          <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <p className="text-sm text-warning">{duplicateWarning}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setIsAdding(false)
              setDuplicateWarning(null)
            }}
            className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors duration-150 ease-out"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!schedule.name.trim()}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 ease-out disabled:opacity-50"
          >
            Add Schedule
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsAdding(true)}
      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-sm text-muted-foreground hover:text-foreground transition-[border-color,background-color,color] duration-200 ease-out"
    >
      <Plus className="w-4 h-4" />
      Add schedule
    </button>
  )
}

function CategoryCard({
  category,
  onToggle,
  onUpdate,
}: {
  category: Category
  onToggle: () => void
  onUpdate: (category: Category) => void
}) {
  // Default-expanded when the category is enabled so the per-site checkboxes
  // are visible without an extra discovery click (the previous default-
  // collapsed pattern hid the per-site disable path; the ADHD-primary
  // persona would not find it).
  const [isExpanded, setIsExpanded] = useState(category.enabled)
  const contentRef = useRef<HTMLDivElement>(null)

  const disabledSites = category.disabledSites ?? []
  const enabledCount = category.sites.length - disabledSites.length

  const handleToggleSite = (site: string) => {
    const isDisabled = disabledSites.includes(site)
    const newDisabledSites = isDisabled
      ? disabledSites.filter((s) => s !== site)
      : [...disabledSites, site]
    onUpdate({ ...category, disabledSites: newDisabledSites })
  }

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-[background-color,border-color,opacity] duration-200 ease-out',
        category.enabled
          ? 'bg-secondary/30 border-border'
          : 'bg-transparent border-border/50 opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Toggle checked={category.enabled} onChange={onToggle} />
          <div>
            <p className="font-medium">{category.name}</p>
            <p className="text-sm text-muted-foreground">
              {enabledCount}/{category.sites.length} sites
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-150 ease-out"
        >
          {isExpanded ? 'Hide' : 'Show'} sites
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 transition-transform duration-200 ease-out',
              isExpanded && 'rotate-180'
            )}
          />
        </button>
      </div>

      {/* Expandable sites list - using grid for smooth height animation */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-250 ease-out',
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div ref={contentRef} className="px-4 pb-4 border-t border-border/50 pt-3">
            <div className="space-y-2">
              {category.sites.map((site) => {
                const isEnabled = !disabledSites.includes(site)
                return (
                  <div
                    key={site}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg border transition-opacity duration-150',
                      isEnabled
                        ? 'bg-background/50 border-border/30'
                        : 'bg-transparent border-border/20 opacity-50'
                    )}
                  >
                    <span className="text-sm">{site}</span>
                    <button
                      onClick={() => handleToggleSite(site)}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-150 ease-out',
                        isEnabled
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground hover:border-primary/50'
                      )}
                    >
                      {isEnabled && <Check className="w-3 h-3" />}
                    </button>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Add more sites in Custom Sites below
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddSiteInput({
  onAdd,
  existingSites,
}: {
  onAdd: (site: string) => void
  existingSites: string[]
}) {
  const [site, setSite] = useState('')
  const [error, setError] = useState('')

  const handleAdd = () => {
    const cleanSite = site
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]

    if (!cleanSite) {
      setError('Please enter a site')
      return
    }

    if (existingSites.includes(cleanSite)) {
      setError('Site already added')
      return
    }

    onAdd(cleanSite)
    setSite('')
    setError('')
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={site}
          onChange={(e) => {
            setSite(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="example.com"
          className="flex-1 px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 ease-out"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}

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
        {value}
        {suffix}
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

function BypassSettings({
  settings,
  onUpdate,
}: {
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
            <p className="text-sm text-muted-foreground">How long each bypass lasts</p>
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
      <div className="rounded-xl bg-secondary/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Scaffolding mode</p>
            <p className="text-sm text-muted-foreground">
              Adds a second-click confirm on the bypass button.
            </p>
          </div>
          <Toggle
            checked={settings.scaffoldingMode ?? false}
            onChange={() =>
              onUpdate((s) => ({ ...s, scaffoldingMode: !(s.scaffoldingMode ?? false) }))
            }
          />
        </div>
      </div>
    </div>
  )
}

function BypassBudget({ settings }: { settings: SordinoSettings }) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; message: string } | null>(
    null
  )
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
        <p className="text-xs text-muted-foreground mt-2">
          Resets at midnight ({countdown} remaining)
        </p>
      </div>

      <div
        className={cn(
          'rounded-xl border p-4',
          refreshAvailable
            ? 'border-border bg-secondary/30'
            : 'border-border/50 bg-secondary/10 opacity-60'
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-medium">Emergency Refresh</p>
            <p className="text-sm text-muted-foreground">
              {refreshAvailable
                ? 'Resets your daily bypass count. Once per day, available at midnight.'
                : `Used today. Available again at midnight (${countdown}).`}
            </p>
          </div>
          <button
            onClick={handleEmergencyRefresh}
            disabled={!refreshAvailable || isRefreshing}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
              refreshAvailable
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'motion-safe:animate-spin')} />
            Refresh
          </button>
        </div>
        {refreshResult && (
          <p
            className={cn(
              'text-sm mt-3',
              refreshResult.success ? 'text-success' : 'text-destructive'
            )}
          >
            {refreshResult.message}
          </p>
        )}
      </div>
    </div>
  )
}

function WeeklyStatsChart({ settings }: { settings: SordinoSettings }) {
  const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Build stats for the current week
  const getWeekData = () => {
    const today = new Date()
    const day = today.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)

    const weekData = DAYS_OF_WEEK.map((dayName, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const dateStr = getLocalDateString(date)

      // Check if it's today
      const isToday = dateStr === settings.stats.date

      // Find stats for this day
      let dayStats = settings.weeklyStats.days.find((d) => d.date === dateStr)

      // If it's today, use current stats
      if (isToday) {
        dayStats = {
          date: dateStr,
          blocksTriggered: settings.stats.blocksTriggered,
          bypassesUsed: settings.stats.bypassesUsed,
        }
      }

      return {
        day: dayName,
        date: dateStr,
        blocks: dayStats?.blocksTriggered ?? 0,
        bypasses: dayStats?.bypassesUsed ?? 0,
        isToday,
        isFuture: date > today,
      }
    })

    return weekData
  }

  const weekData = getWeekData()
  const maxValue = Math.max(...weekData.map((d) => Math.max(d.blocks, d.bypasses)), 1)
  const totalBlocks = weekData.reduce((sum, d) => sum + d.blocks, 0)
  const totalBypasses = weekData.reduce((sum, d) => sum + d.bypasses, 0)
  const emergencyRefreshes = settings.weeklyStats.emergencyRefreshesUsed || 0

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
          <p className="text-2xl font-serif font-semibold text-primary">{totalBlocks}</p>
          <p className="text-xs text-muted-foreground">Blocks</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
          <p className="text-2xl font-serif font-semibold text-info">{totalBypasses}</p>
          <p className="text-xs text-muted-foreground">Bypasses</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
          <p className="text-2xl font-serif font-semibold text-muted-foreground">
            {emergencyRefreshes}
          </p>
          <p className="text-xs text-muted-foreground">Refreshes</p>
        </div>
      </div>

      {/* Dual Bar Chart */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Daily Activity</p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
              <span className="text-muted-foreground">Blocks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-info" />
              <span className="text-muted-foreground">Bypasses</span>
            </div>
          </div>
        </div>
        <div className="flex items-end gap-3">
          {weekData
            .filter((day) => !day.isFuture)
            .map((day) => {
              const maxBarHeight = 72
              const blocksHeight =
                day.blocks > 0 ? Math.max((day.blocks / maxValue) * maxBarHeight, 6) : 0
              const bypassesHeight =
                day.bypasses > 0 ? Math.max((day.bypasses / maxValue) * maxBarHeight, 6) : 0

              return (
                <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="flex items-end justify-center gap-1.5"
                    style={{ height: maxBarHeight + 16 }}
                  >
                    <div className="flex flex-col items-center justify-end h-full w-5">
                      {day.blocks > 0 && (
                        <span className="text-[10px] text-muted-foreground mb-0.5 tabular-nums">
                          {day.blocks}
                        </span>
                      )}
                      {blocksHeight > 0 && (
                        <div
                          className={cn(
                            'w-full rounded-t-sm transition-colors duration-300',
                            day.isToday ? 'bg-primary' : 'bg-primary/60'
                          )}
                          style={{ height: `${blocksHeight}px` }}
                        />
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-end h-full w-5">
                      {day.bypasses > 0 && (
                        <span className="text-[10px] text-muted-foreground mb-0.5 tabular-nums">
                          {day.bypasses}
                        </span>
                      )}
                      {bypassesHeight > 0 && (
                        <div
                          className={cn(
                            'w-full rounded-t-sm transition-colors duration-300',
                            day.isToday ? 'bg-info' : 'bg-info/60'
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
      </div>
    </div>
  )
}

function TopSitesDisplay({ settings }: { settings: SordinoSettings }) {
  // Combine today's stats with weekly stats
  const getCombinedSiteStats = () => {
    const combined: { [site: string]: { blocks: number; bypasses: number } } = {}

    // Add weekly stats
    if (settings.weeklyStats.siteStats) {
      for (const [site, stats] of Object.entries(settings.weeklyStats.siteStats)) {
        combined[site] = { ...stats }
      }
    }

    // Add today's stats
    if (settings.stats.siteStats) {
      for (const [site, stats] of Object.entries(settings.stats.siteStats)) {
        if (combined[site]) {
          combined[site] = {
            blocks: combined[site].blocks + stats.blocks,
            bypasses: combined[site].bypasses + stats.bypasses,
          }
        } else {
          combined[site] = { ...stats }
        }
      }
    }

    return combined
  }

  const siteStats = getCombinedSiteStats()

  // Get top blocked sites
  const topBlocked = Object.entries(siteStats)
    .filter(([, stats]) => stats.blocks > 0)
    .sort((a, b) => b[1].blocks - a[1].blocks)
    .slice(0, 5)

  // Get top bypassed sites
  const topBypassed = Object.entries(siteStats)
    .filter(([, stats]) => stats.bypasses > 0)
    .sort((a, b) => b[1].bypasses - a[1].bypasses)
    .slice(0, 5)

  if (topBlocked.length === 0 && topBypassed.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">No site activity recorded this week.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Most Blocked */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <p className="text-sm font-medium text-muted-foreground mb-3">Most Blocked</p>
        {topBlocked.length === 0 ? (
          <p className="text-xs text-muted-foreground">No blocks recorded this week.</p>
        ) : (
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
        )}
      </div>

      {/* Most Bypassed */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <p className="text-sm font-medium text-muted-foreground mb-3">Most Bypassed</p>
        {topBypassed.length === 0 ? (
          <p className="text-xs text-muted-foreground">No bypasses used this week.</p>
        ) : (
          <div className="space-y-2">
            {topBypassed.map(([site, stats], index) => {
              const maxBypasses = topBypassed[0]?.[1].bypasses ?? 1
              const pct = (stats.bypasses / maxBypasses) * 100
              return (
                <div key={site} className="relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-info/10 rounded"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground/60 w-4">{index + 1}.</span>
                      <span className="text-sm truncate">{site}</span>
                    </div>
                    <span className="text-sm font-medium text-info ml-2">{stats.bypasses}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
