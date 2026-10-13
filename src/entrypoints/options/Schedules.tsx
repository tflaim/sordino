import { useEffect, useId, useState, type Dispatch, type SetStateAction } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import {
  DAYS_OF_WEEK,
  SCHEDULE_REASON,
  describeSchedule,
  toScheduleDraft,
  validateSchedule,
  type Schedule,
  type ScheduleDraft,
} from '@/shared/schedule'
import type { DayOfWeek } from '@/shared/types'
import { CONFIRM_RESET_MS } from '@/shared/types'
import { cn } from '@/shared/utils'
import { useSordinoConfig } from '@/shared/use-sordino-state'
import { runtimeCommandPort } from '@/store/adapters/runtime'
import type { Command } from '@/store/commands'

const sordino = runtimeCommandPort()

const DAY_BUTTONS: { key: DayOfWeek; letter: string; label: string }[] = [
  { key: 'mon', letter: 'M', label: 'Monday' },
  { key: 'tue', letter: 'T', label: 'Tuesday' },
  { key: 'wed', letter: 'W', label: 'Wednesday' },
  { key: 'thu', letter: 'T', label: 'Thursday' },
  { key: 'fri', letter: 'F', label: 'Friday' },
  { key: 'sat', letter: 'S', label: 'Saturday' },
  { key: 'sun', letter: 'S', label: 'Sunday' },
]

const NEW_SCHEDULE: ScheduleDraft = {
  name: '',
  enabled: true,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  allDay: false,
  startTime: '09:00',
  endTime: '17:00',
}

export function SchedulesSection() {
  const config = useSordinoConfig()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<ScheduleDraft>(NEW_SCHEDULE)
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const send = async (command: Command): Promise<boolean> => {
    setPending(true)
    try {
      const result = await sordino.send(command)
      if (!result.ok) {
        setProblem('Sordino is restarting. Try again in a moment.')
        return false
      }
      if (result.outcome.kind === 'missing') {
        setProblem('That schedule is already gone.')
        return false
      }
      setProblem(null)
      return result.outcome.kind !== 'refused'
    } finally {
      setPending(false)
    }
  }

  const save = async (next: ScheduleDraft) => {
    if (!validateSchedule(next).ok) return false
    return send({ type: 'save-schedule', schedule: next })
  }

  if (!config) {
    return (
      <section className="mb-10">
        <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Schedules</h2>
        <p className="text-sm text-muted-foreground">Loading schedules...</p>
      </section>
    )
  }

  return (
    <section className="mb-10">
      <h2 className="font-serif text-xl font-medium mb-4 text-foreground">Schedules</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Schedules run on the days and times you choose. Any of them can be edited or removed.
      </p>
      {problem && <p className="mb-4 text-sm text-destructive">{problem}</p>}
      <div className="space-y-3">
        {config.schedules.length === 0 && (
          <p className="text-sm text-muted-foreground">No schedules yet.</p>
        )}
        {config.schedules.map((schedule) => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            pending={pending}
            onToggle={() => save({ ...toScheduleDraft(schedule), enabled: !schedule.enabled })}
            onSave={save}
            onDelete={() => send({ type: 'delete-schedule', id: schedule.id })}
          />
        ))}
      </div>
      {adding ? (
        <div className="mt-3">
          <ScheduleForm
            draft={draft}
            onChange={setDraft}
            submitLabel="Add schedule"
            pending={pending}
            autoFocus
            onCancel={() => {
              setAdding(false)
              setDraft(NEW_SCHEDULE)
            }}
            onSubmit={async () => {
              if (await save(draft)) {
                setAdding(false)
                setDraft(NEW_SCHEDULE)
              }
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(NEW_SCHEDULE)
            setAdding(true)
          }}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-sm text-muted-foreground hover:text-foreground transition-[border-color,background-color,color] duration-200 ease-out motion-reduce:transition-none"
        >
          <Plus className="w-4 h-4" />
          Add schedule
        </button>
      )}
    </section>
  )
}

function ScheduleCard({
  schedule,
  pending,
  onToggle,
  onSave,
  onDelete,
}: {
  schedule: Schedule
  pending: boolean
  onToggle: () => void
  onSave: (draft: ScheduleDraft) => Promise<boolean>
  onDelete: () => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => toScheduleDraft(schedule))
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Drop the confirm if the user looks away. 8s leaves slack to glance off and come back.
  useEffect(() => {
    if (!confirmingDelete) return
    const timer = setTimeout(() => setConfirmingDelete(false), CONFIRM_RESET_MS)
    return () => clearTimeout(timer)
  }, [confirmingDelete])

  if (editing) {
    return (
      <ScheduleForm
        draft={draft}
        onChange={setDraft}
        submitLabel="Save"
        pending={pending}
        onCancel={() => setEditing(false)}
        onSubmit={async () => {
          if (await onSave(draft)) setEditing(false)
        }}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-[background-color,border-color,opacity] duration-200 ease-out motion-reduce:transition-none',
        schedule.enabled
          ? 'bg-secondary/30 border-border'
          : 'bg-transparent border-border/50 opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Toggle
            checked={schedule.enabled}
            onChange={onToggle}
            label={schedule.enabled ? `Turn off ${schedule.name}` : `Turn on ${schedule.name}`}
          />
          <div>
            <p className="font-medium">{schedule.name}</p>
            <p className="text-sm text-muted-foreground">{describeSchedule(schedule)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {confirmingDelete ? (
            <DeleteConfirm
              onConfirm={async () => {
                setConfirmingDelete(false)
                await onDelete()
              }}
              onCancel={() => setConfirmingDelete(false)}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(toScheduleDraft(schedule))
                  setEditing(true)
                }}
                className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-150 ease-out motion-reduce:transition-none"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="p-1 rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-150 ease-out motion-reduce:transition-none"
                aria-label={`Remove ${schedule.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onConfirm}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-foreground hover:bg-secondary transition-colors duration-150 ease-out motion-reduce:transition-none"
      >
        <Trash2 className="w-3 h-3" />
        Remove
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors duration-150 ease-out motion-reduce:transition-none"
      >
        Cancel
      </button>
    </>
  )
}

/**
 * One form for adding and editing. Reasons come from the Schedule module, so a
 * schedule that can never run cannot be saved.
 */
export function ScheduleForm({
  draft,
  onChange: setDraft,
  onCancel,
  onSubmit,
  submitLabel,
  pending,
  autoFocus = false,
}: {
  draft: ScheduleDraft
  /** Parent setState. Updaters chain, so several edits in one tick all stick. */
  onChange: Dispatch<SetStateAction<ScheduleDraft>>
  onCancel: () => void
  onSubmit: () => void
  submitLabel: string
  pending: boolean
  autoFocus?: boolean
}) {
  const validation = validateSchedule(draft)
  const reasons = validation.ok ? [] : validation.reasons
  const nameId = useId()
  const startId = useId()
  const endId = useId()

  const toggleDay = (day: DayOfWeek) => {
    setDraft((prev) => {
      const days = DAYS_OF_WEEK.filter((d) =>
        d === day ? !prev.days.includes(d) : prev.days.includes(d)
      )
      return { ...prev, days: [...days] }
    })
  }

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
      <label htmlFor={nameId} className="block text-xs text-muted-foreground mb-2">
        Name
      </label>
      <input
        id={nameId}
        type="text"
        value={draft.name}
        autoFocus={autoFocus}
        onChange={(e) => {
          const name = e.target.value
          setDraft((prev) => ({ ...prev, name }))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && validation.ok && !pending) onSubmit()
        }}
        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
        placeholder="Schedule name"
      />

      <p className="text-xs text-muted-foreground mb-2">Days</p>
      <div className="flex gap-1 mb-4">
        {DAY_BUTTONS.map((day) => {
          const selected = draft.days.includes(day.key)
          return (
            <button
              key={day.key}
              type="button"
              aria-pressed={selected}
              aria-label={day.label}
              onClick={() => toggleDay(day.key)}
              className={cn(
                'w-8 h-8 rounded-full text-xs font-medium transition-colors duration-150 ease-out motion-reduce:transition-none',
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              )}
            >
              {day.letter}
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-2 mb-4 text-sm">
        <button
          type="button"
          role="checkbox"
          aria-checked={draft.allDay}
          onClick={() => setDraft((prev) => ({ ...prev, allDay: !prev.allDay }))}
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-150 ease-out motion-reduce:transition-none',
            draft.allDay
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-muted-foreground hover:border-primary/50'
          )}
        >
          {draft.allDay && <Check className="w-3 h-3" />}
        </button>
        All day
      </label>

      {!draft.allDay && (
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label htmlFor={startId} className="block text-xs text-muted-foreground mb-2">
              Start time
            </label>
            <input
              id={startId}
              type="time"
              value={draft.startTime}
              onChange={(e) => {
                const startTime = e.target.value
                setDraft((prev) => ({ ...prev, startTime }))
              }}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex-1">
            <label htmlFor={endId} className="block text-xs text-muted-foreground mb-2">
              End time
            </label>
            <input
              id={endId}
              type="time"
              value={draft.endTime}
              onChange={(e) => {
                const endTime = e.target.value
                setDraft((prev) => ({ ...prev, endTime }))
              }}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      )}

      {reasons.length > 0 && (
        <ul className="mb-4 space-y-1">
          {reasons.map((reason) => (
            <li key={reason} className="text-sm text-destructive">
              {SCHEDULE_REASON[reason]}
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors duration-150 ease-out motion-reduce:transition-none"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!validation.ok || pending}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150 ease-out motion-reduce:transition-none disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 motion-reduce:transition-none',
        checked ? 'bg-primary' : 'bg-secondary'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-foreground shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        )}
      />
    </button>
  )
}
