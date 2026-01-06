import { useEffect, useState, useRef } from 'react'
import { getSettings, saveSettings, subscribeToSettings } from '../shared/storage'
import type { SordinoSettings, Schedule, Category, DayOfWeek } from '../shared/types'
import { TEMPLATE_SCHEDULE_IDS, DEFAULT_SCHEDULES, getLocalDateString } from '../shared/types'
import { cn } from '../shared/utils'
import { Plus, Trash2, X, Check, ChevronDown, RefreshCw, BarChart3, Settings, Activity, AlertCircle } from 'lucide-react'

const MAX_QUICK_BYPASSES = 3

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
    const updated = updater(settings)
    setSettings(updated)
    await saveSettings(updated)
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Texture overlay */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />

      <div className="relative max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <svg viewBox="0 0 64 64" fill="none" className="w-8 h-8 text-primary">
            <path d="M12 32C12 32 16 28 24 28C32 28 36 32 36 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M36 26V38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M36 32H48C50 32 52 30 52 28V36C52 34 50 32 48 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="48" cy="32" r="4" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 30V34" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <path d="M4 28V36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h1 className="font-serif text-2xl font-medium tracking-wide text-primary">Sordino</h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 mb-8 rounded-xl bg-secondary/50 border border-border">
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === 'settings'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === 'usage'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="w-4 h-4" />
            Usage
          </button>
        </div>

        {activeTab === 'settings' ? (
          <>
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

            {/* Divider */}
            <div className="border-t border-border mb-10" />

            {/* Blocked Sites Section */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Blocked Sites</h2>

              {/* Categories */}
              <div className="mb-6">
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">Categories</h3>
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
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">Custom Sites</h3>
                <div className="space-y-2 mb-3">
                  {settings.customSites.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No custom sites added</p>
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

            {/* Divider */}
            <div className="border-t border-border mb-10" />

            {/* Bypass Settings Section */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Bypass Settings</h2>
              <BypassSettings settings={settings} />
            </section>
          </>
        ) : (
          <>
            {/* Usage Tab */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-medium mb-4 text-foreground">This Week</h2>
              <WeeklyStatsChart settings={settings} />
            </section>

            {/* Most Blocked/Bypassed Sites */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Top Sites</h2>
              <TopSitesDisplay settings={settings} />
            </section>
          </>
        )}
      </div>
    </div>
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
  const [editedSchedule, setEditedSchedule] = useState(schedule)

  const formatDays = (days: DayOfWeek[]) => {
    if (days.length === 7) return 'Every day'
    if (days.length === 5 && !days.includes('sat') && !days.includes('sun')) return 'Weekdays'
    if (days.length === 2 && days.includes('sat') && days.includes('sun')) return 'Weekends'
    return days.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const h = hours % 12 || 12
    const ampm = hours >= 12 ? 'PM' : 'AM'
    return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  if (isEditing) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 animate-in fade-in duration-200">
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
                  "w-8 h-8 rounded-full text-xs font-medium transition-colors duration-150 ease-out",
                  editedSchedule.days.includes(day.key)
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
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
        "rounded-xl border p-4 transition-[background-color,border-color,opacity] duration-200 ease-out",
        schedule.enabled
          ? "bg-secondary/30 border-border"
          : "bg-transparent border-border/50 opacity-60"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
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
          <div>
            <p className="font-medium">{schedule.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDays(schedule.days)} • {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
            </p>
          </div>
        </div>
        {!isTemplate && (
          <div className="flex gap-1">
            <button
              onClick={() => setIsEditing(true)}
              className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-150 ease-out"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors duration-150 ease-out"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        {isTemplate && (
          <span className="text-xs text-muted-foreground/60 px-2 py-1">Template</span>
        )}
      </div>
    </div>
  )
}

// Check if a schedule matches a template schedule
function matchesTemplateSchedule(schedule: Schedule): Schedule | null {
  for (const template of DEFAULT_SCHEDULES) {
    const sameDays = schedule.days.length === template.days.length &&
      schedule.days.every(d => template.days.includes(d))
    const sameTime = schedule.startTime === template.startTime &&
      schedule.endTime === template.endTime
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
      setDuplicateWarning(`This matches the "${matchedTemplate.name}" template. Consider using that instead.`)
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
                  "w-8 h-8 rounded-full text-xs font-medium transition-colors duration-150 ease-out",
                  schedule.days.includes(day.key)
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
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
          <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400">{duplicateWarning}</p>
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
  const [isExpanded, setIsExpanded] = useState(false)
  const [newSite, setNewSite] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  const handleAddSite = () => {
    const cleanSite = newSite.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    if (!cleanSite || category.sites.includes(cleanSite)) return
    onUpdate({ ...category, sites: [...category.sites, cleanSite] })
    setNewSite('')
  }

  const handleRemoveSite = (site: string) => {
    onUpdate({ ...category, sites: category.sites.filter((s) => s !== site) })
  }

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden transition-[background-color,border-color,opacity] duration-200 ease-out",
      category.enabled
        ? "bg-secondary/30 border-border"
        : "bg-transparent border-border/50 opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
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
          <div>
            <p className="font-medium">{category.name}</p>
            <p className="text-sm text-muted-foreground">{category.sites.length} sites</p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-150 ease-out"
        >
          {isExpanded ? 'Hide' : 'Show'} sites
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform duration-200 ease-out",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Expandable sites list - using grid for smooth height animation */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-250 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div ref={contentRef} className="px-4 pb-4 border-t border-border/50 pt-3">
            <div className="space-y-2 mb-3">
              {category.sites.map((site) => (
                <div
                  key={site}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-background/50 border border-border/30"
                >
                  <span className="text-sm">{site}</span>
                  <button
                    onClick={() => handleRemoveSite(site)}
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors duration-150 ease-out"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSite}
                onChange={(e) => setNewSite(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSite()}
                placeholder="Add site..."
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={handleAddSite}
                disabled={!newSite.trim()}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 ease-out disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddSiteInput({ onAdd, existingSites }: { onAdd: (site: string) => void; existingSites: string[] }) {
  const [site, setSite] = useState('')
  const [error, setError] = useState('')

  const handleAdd = () => {
    const cleanSite = site.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]

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

function BypassSettings({ settings }: { settings: SordinoSettings }) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; message: string } | null>(null)
  const [countdown, setCountdown] = useState('')

  const bypassesUsed = settings.bypassState.quickBypassesUsed
  const bypassesRemaining = MAX_QUICK_BYPASSES - bypassesUsed

  // Check if emergency refresh was used today (daily reset at midnight local time)
  const canRefresh = () => {
    if (!settings.bypassState.lastEmergencyRefresh) return true
    const today = getLocalDateString()
    return settings.bypassState.lastEmergencyRefresh !== today
  }

  // Format date for display
  const formatLastUsedDate = (dateStr: string | null): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Calculate countdown to midnight
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setDate(midnight.getDate() + 1)
      midnight.setHours(0, 0, 0, 0)

      const diff = midnight.getTime() - now.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m`)
      } else {
        setCountdown(`${minutes}m`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute
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
    } catch (error) {
      setRefreshResult({ success: false, message: 'Failed to refresh bypasses' })
    }
    setIsRefreshing(false)

    // Clear message after 3 seconds
    setTimeout(() => setRefreshResult(null), 3000)
  }

  const refreshAvailable = canRefresh()
  const lastUsedDate = settings.bypassState.lastEmergencyRefresh

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-medium">Daily Bypasses</p>
            <p className="text-sm text-muted-foreground">
              {bypassesRemaining} of {MAX_QUICK_BYPASSES} remaining today
            </p>
          </div>
          <div className="text-2xl font-serif font-semibold text-primary">
            {bypassesRemaining}/{MAX_QUICK_BYPASSES}
          </div>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(bypassesRemaining / MAX_QUICK_BYPASSES) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Resets at midnight ({countdown} remaining)</p>
      </div>

      {/* Emergency Refresh */}
      <div className={cn(
        "rounded-xl border p-4",
        refreshAvailable
          ? "border-border bg-secondary/30"
          : "border-border/50 bg-secondary/10 opacity-60"
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-medium">Emergency Refresh</p>
            <p className="text-sm text-muted-foreground">
              {refreshAvailable
                ? 'Reset your daily bypasses once per day when you really need them.'
                : `Already used today. Available again at midnight (${countdown}).`}
            </p>
            {lastUsedDate && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                Last used: {formatLastUsedDate(lastUsedDate)}
              </p>
            )}
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
          <p className={cn(
            "text-sm mt-3",
            refreshResult.success ? "text-green-500" : "text-destructive"
          )}>
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
      let dayStats = settings.weeklyStats.days.find(d => d.date === dateStr)

      // If it's today, use current stats
      if (isToday) {
        dayStats = {
          date: dateStr,
          blocksTriggered: settings.stats.blocksTriggered,
          bypassesUsed: settings.stats.bypassesUsed
        }
      }

      return {
        day: dayName,
        date: dateStr,
        blocks: dayStats?.blocksTriggered ?? 0,
        bypasses: dayStats?.bypassesUsed ?? 0,
        isToday,
        isFuture: date > today
      }
    })

    return weekData
  }

  const weekData = getWeekData()
  const maxValue = Math.max(...weekData.map(d => Math.max(d.blocks, d.bypasses)), 1)
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
          <p className="text-2xl font-serif font-semibold text-orange-500">{totalBypasses}</p>
          <p className="text-xs text-muted-foreground">Bypasses</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
          <p className="text-2xl font-serif font-semibold text-muted-foreground">{emergencyRefreshes}</p>
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
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
              <span className="text-muted-foreground">Bypasses</span>
            </div>
          </div>
        </div>
        <div className="flex items-end gap-3">
          {weekData.map((day) => {
            const maxBarHeight = 72 // pixels
            const blocksHeight = day.isFuture ? 2 : Math.max((day.blocks / maxValue) * maxBarHeight, day.blocks > 0 ? 6 : 2)
            const bypassesHeight = day.isFuture ? 2 : Math.max((day.bypasses / maxValue) * maxBarHeight, day.bypasses > 0 ? 6 : 2)

            return (
              <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center gap-1" style={{ height: maxBarHeight + 16 }}>
                  {/* Blocks bar */}
                  <div className="flex-1 flex flex-col items-center justify-end h-full">
                    {day.blocks > 0 && (
                      <span className="text-[10px] text-muted-foreground mb-0.5">{day.blocks}</span>
                    )}
                    <div
                      className={cn(
                        "w-full rounded-t transition-all duration-300",
                        day.isToday ? "bg-primary" : "bg-primary/60",
                        day.isFuture && "bg-secondary"
                      )}
                      style={{ height: `${blocksHeight}px` }}
                    />
                  </div>
                  {/* Bypasses bar */}
                  <div className="flex-1 flex flex-col items-center justify-end h-full">
                    {day.bypasses > 0 && (
                      <span className="text-[10px] text-muted-foreground mb-0.5">{day.bypasses}</span>
                    )}
                    <div
                      className={cn(
                        "w-full rounded-t transition-all duration-300",
                        day.isToday ? "bg-orange-500" : "bg-orange-500/60",
                        day.isFuture && "bg-secondary"
                      )}
                      style={{ height: `${bypassesHeight}px` }}
                    />
                  </div>
                </div>
                <span className={cn(
                  "text-xs",
                  day.isToday ? "font-medium text-primary" : "text-muted-foreground"
                )}>
                  {day.day}
                </span>
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
    .filter(([_, stats]) => stats.blocks > 0)
    .sort((a, b) => b[1].blocks - a[1].blocks)
    .slice(0, 5)

  // Get top bypassed sites
  const topBypassed = Object.entries(siteStats)
    .filter(([_, stats]) => stats.bypasses > 0)
    .sort((a, b) => b[1].bypasses - a[1].bypasses)
    .slice(0, 5)

  if (topBlocked.length === 0 && topBypassed.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">No site activity recorded yet this week.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Stats will appear here as you browse.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Most Blocked */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <p className="text-sm font-medium text-muted-foreground mb-3">Most Blocked</p>
        {topBlocked.length === 0 ? (
          <p className="text-xs text-muted-foreground/70 italic">No blocks yet</p>
        ) : (
          <div className="space-y-2">
            {topBlocked.map(([site, stats], index) => (
              <div key={site} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground/60 w-4">{index + 1}.</span>
                  <span className="text-sm truncate">{site}</span>
                </div>
                <span className="text-sm font-medium text-primary ml-2">{stats.blocks}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Most Bypassed */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <p className="text-sm font-medium text-muted-foreground mb-3">Most Bypassed</p>
        {topBypassed.length === 0 ? (
          <p className="text-xs text-muted-foreground/70 italic">No bypasses yet</p>
        ) : (
          <div className="space-y-2">
            {topBypassed.map(([site, stats], index) => (
              <div key={site} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground/60 w-4">{index + 1}.</span>
                  <span className="text-sm truncate">{site}</span>
                </div>
                <span className="text-sm font-medium text-orange-500 ml-2">{stats.bypasses}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
