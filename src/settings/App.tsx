import { useEffect, useState } from 'react'
import { getSettings, saveSettings, subscribeToSettings } from '../shared/storage'
import type { SordinoSettings, Schedule, Category, DayOfWeek } from '../shared/types'
import { cn } from '../shared/utils'
import { Plus, Trash2, X, Check } from 'lucide-react'

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
        <div className="flex items-center gap-3 mb-8">
          <svg viewBox="0 0 64 64" fill="none" className="w-8 h-8 text-primary">
            <path d="M12 32C12 32 16 28 24 28C32 28 36 32 36 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M36 26V38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M36 32H48C50 32 52 30 52 28V36C52 34 50 32 48 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="48" cy="32" r="4" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 30V34" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <path d="M4 28V36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h1 className="font-serif text-2xl font-medium tracking-wide text-primary">Sordino Settings</h1>
        </div>

        {/* Schedules Section */}
        <section className="mb-10">
          <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Schedules</h2>
          <div className="space-y-3">
            {settings.schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
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
            <div className="flex flex-wrap gap-3">
              {settings.categories.map((category) => (
                <CategoryToggle
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
                          customSites: s.customSites.filter((s) => s !== site),
                        }))
                      }}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
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
      </div>
    </div>
  )
}

function ScheduleCard({
  schedule,
  onToggle,
  onUpdate,
  onDelete,
}: {
  schedule: Schedule
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
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
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
                  "w-8 h-8 rounded-full text-xs font-medium transition-colors",
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
            className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onUpdate(editedSchedule)
              setIsEditing(false)
            }}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
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
        "rounded-xl border p-4 transition-all",
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
              "mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
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
        <div className="flex gap-1">
          <button
            onClick={() => setIsEditing(true)}
            className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function AddScheduleButton({ onAdd }: { onAdd: (schedule: Schedule) => void }) {
  const [isAdding, setIsAdding] = useState(false)
  const [schedule, setSchedule] = useState<Schedule>({
    id: '',
    name: '',
    enabled: true,
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startTime: '09:00',
    endTime: '17:00',
  })

  const handleAdd = () => {
    if (!schedule.name.trim()) return
    onAdd({
      ...schedule,
      id: `custom-${Date.now()}`,
    })
    setIsAdding(false)
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
                  "w-8 h-8 rounded-full text-xs font-medium transition-colors",
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

        <div className="flex justify-end gap-2">
          <button
            onClick={() => setIsAdding(false)}
            className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!schedule.name.trim()}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
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
      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <Plus className="w-4 h-4" />
      Add schedule
    </button>
  )
}

function CategoryToggle({ category, onToggle }: { category: Category; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all",
        category.enabled
          ? "bg-primary/10 border-primary/30 text-foreground"
          : "bg-secondary/30 border-border/50 text-muted-foreground"
      )}
    >
      <div className={cn(
        "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
        category.enabled
          ? "bg-primary border-primary text-primary-foreground"
          : "border-muted-foreground"
      )}>
        {category.enabled && <Check className="w-2.5 h-2.5" />}
      </div>
      <span className="text-sm font-medium">{category.name}</span>
      <span className="text-xs text-muted-foreground">({category.sites.length})</span>
    </button>
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}

export default App
