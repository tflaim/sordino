// A Schedule: when muting follows the clock. Validates a draft (with reasons),
// describes one for display, and answers whether it covers a moment. The store
// is the only writer; Muting decision asks `isScheduleActive` per schedule.
import type { DayOfWeek } from './types'

export const DAYS_OF_WEEK = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const satisfies readonly DayOfWeek[]

/** Why a draft is not a schedule that can run. */
export type ScheduleReason = 'blank-name' | 'no-days' | 'missing-time' | 'start-equals-end'

export const SCHEDULE_REASON: Record<ScheduleReason, string> = {
  'blank-name': 'A schedule needs a name.',
  'no-days': 'Choose at least one day.',
  'missing-time': 'Set a start and an end time.',
  'start-equals-end': 'Start and end are the same, so this schedule would never run.',
}

/**
 * What the form and the Save schedule command carry. `id` is absent when
 * adding; the store assigns one. Times may be cleared ("").
 */
export interface ScheduleDraft {
  id?: string
  name: string
  enabled: boolean
  days: DayOfWeek[]
  /** The whole local day, with no gap at 23:59. Times are kept for when this is turned off. */
  allDay: boolean
  startTime: string
  endTime: string
}

/** A schedule that passed validation. `appliesTo` is 'all' until per-category schedules exist. */
export interface Schedule {
  id: string
  name: string
  enabled: boolean
  days: DayOfWeek[]
  allDay: boolean
  startTime: string
  endTime: string
  appliesTo: 'all'
}

/** The four built-in schedules, seeded when a user has no list yet. Ordinary: editable and deletable. */
export const SUGGESTED_SCHEDULES: readonly Schedule[] = [
  {
    id: 'work-hours',
    name: 'Work hours',
    enabled: true,
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    allDay: false,
    startTime: '09:00',
    endTime: '17:00',
    appliesTo: 'all',
  },
  {
    id: 'extended-work',
    name: 'Extended work',
    enabled: false,
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    allDay: false,
    startTime: '08:00',
    endTime: '18:00',
    appliesTo: 'all',
  },
  {
    id: 'evenings',
    name: 'Evenings',
    enabled: false,
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    allDay: false,
    startTime: '18:00',
    endTime: '22:00',
    appliesTo: 'all',
  },
  {
    id: 'always-on',
    name: 'Always on',
    enabled: false,
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    allDay: true,
    startTime: '00:00',
    endTime: '23:59',
    appliesTo: 'all',
  },
]

const REASON_ORDER: readonly ScheduleReason[] = [
  'blank-name',
  'no-days',
  'missing-time',
  'start-equals-end',
]

const DAY_FROM_JS: readonly DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const DAY_SHORT: Record<DayOfWeek, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

export function toScheduleDraft(schedule: Schedule): ScheduleDraft {
  return {
    id: schedule.id,
    name: schedule.name,
    enabled: schedule.enabled,
    days: [...schedule.days],
    allDay: schedule.allDay,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
  }
}

/**
 * A draft from an untrusted command payload, or null when it isn't an object.
 * Domain problems (no days, a blank name) stay in the draft for `validateSchedule`
 * to refuse with reasons.
 */
export function coerceScheduleDraft(raw: unknown): ScheduleDraft | null {
  if (!isRecord(raw)) return null
  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    name: typeof raw.name === 'string' ? raw.name : '',
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    days: readDays(raw.days),
    allDay: raw.allDay === true,
    startTime: typeof raw.startTime === 'string' ? raw.startTime : '',
    endTime: typeof raw.endTime === 'string' ? raw.endTime : '',
  }
}

export function validateSchedule(
  draft: ScheduleDraft
):
  | { ok: true; schedule: Omit<Schedule, 'id'> & { id?: string } }
  | { ok: false; reasons: ScheduleReason[] } {
  const reasons = new Set<ScheduleReason>()
  const name = draft.name.trim()
  if (!name) reasons.add('blank-name')

  const days = canonicalDays(draft.days)
  if (days.length === 0) reasons.add('no-days')

  const start = normalizeTime(draft.startTime)
  const end = normalizeTime(draft.endTime)
  if (!draft.allDay) {
    if (!start || !end) reasons.add('missing-time')
    else if (start === end) reasons.add('start-equals-end')
  }

  if (reasons.size) {
    return { ok: false, reasons: REASON_ORDER.filter((r) => reasons.has(r)) }
  }

  const id = draft.id?.trim()
  return {
    ok: true,
    schedule: {
      ...(id ? { id } : {}),
      name,
      enabled: draft.enabled,
      days,
      allDay: draft.allDay,
      startTime: draft.allDay ? (start ?? '00:00') : start!,
      endTime: draft.allDay ? (end ?? '00:00') : end!,
      appliesTo: 'all',
    },
  }
}

/** "Weekdays · 09:00–17:00", "Sun · 22:00–02:00, ends next day", "Every day · all day". */
export function describeSchedule(
  schedule: Pick<Schedule, 'days' | 'allDay' | 'startTime' | 'endTime'>
): string {
  const days = describeDays(schedule.days)
  if (schedule.allDay) return `${days} · all day`
  const span = `${schedule.startTime}–${schedule.endTime}`
  const overnight = schedule.endTime < schedule.startTime
  return overnight ? `${days} · ${span}, ends next day` : `${days} · ${span}`
}

/** Whether this schedule covers `now` (epoch ms, local clock). End is exclusive; all-day covers every second. */
export function isScheduleActive(schedule: Schedule, now: number): boolean {
  if (!schedule.enabled) return false
  const date = new Date(now)
  const today = DAY_FROM_JS[date.getDay()]!
  if (schedule.allDay) return schedule.days.includes(today)

  const start = minutes(schedule.startTime)
  const end = minutes(schedule.endTime)
  if (start === null || end === null || start === end) return false
  const current = date.getHours() * 60 + date.getMinutes()

  // Overnight (22:00–02:00): the morning belongs to yesterday's chosen day,
  // which is what carries a Sunday schedule onto Monday.
  if (end < start) {
    if (current >= start) return schedule.days.includes(today)
    if (current < end) return schedule.days.includes(dayBefore(date))
    return false
  }
  return schedule.days.includes(today) && current >= start && current < end
}

/**
 * Schedules from a 1.x settings object. No schedule list means the suggested
 * ones; a list is kept as-is. An entry that can never run is dropped, with a
 * debug line naming it and why. A window of 00:00–23:59 was 1.x's all-day
 * approximation and becomes a true all day.
 */
export function schedulesFromLegacy(settings: unknown): Schedule[] {
  if (!isRecord(settings) || !Array.isArray(settings.schedules))
    return copySchedules(SUGGESTED_SCHEDULES)
  return unique(settings.schedules.flatMap((item) => fromLegacyItem(item)))
}

/** Schedules already stored on `config`. Invalid entries are dropped. */
export function schedulesFromConfig(raw: unknown): Schedule[] {
  if (!Array.isArray(raw)) return []
  return unique(raw.flatMap((item) => fromStoredItem(item)))
}

function fromLegacyItem(raw: unknown): Schedule[] {
  const draft = coerceScheduleDraft(raw)
  if (!draft) {
    logDropped(raw, 'not an object')
    return []
  }
  const start = normalizeTime(draft.startTime)
  const end = normalizeTime(draft.endTime)
  if (!draft.allDay && start === '00:00' && end === '23:59') draft.allDay = true
  const validated = validateSchedule(draft)
  if (!validated.ok) {
    logDropped(raw, unrunnableWhy(validated.reasons))
    return []
  }
  return finish(draft)
}

function fromStoredItem(raw: unknown): Schedule[] {
  const draft = coerceScheduleDraft(raw)
  if (!draft) return []
  return finish(draft)
}

function finish(draft: ScheduleDraft): Schedule[] {
  const validated = validateSchedule(draft)
  if (!validated.ok) return []
  return [{ ...validated.schedule, id: validated.schedule.id ?? crypto.randomUUID() }]
}

function logDropped(raw: unknown, why: string): void {
  console.debug(`Sordino: dropped 1.x schedule ${droppedName(raw)}: ${why}`)
}

function droppedName(raw: unknown): string {
  if (!isRecord(raw)) return '(not an object)'
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (name && id) return `"${name}" (${id})`
  if (name) return `"${name}"`
  if (id) return `(${id})`
  return '(unnamed)'
}

function unrunnableWhy(reasons: readonly ScheduleReason[]): string {
  return reasons.map((reason) => `${reason} — ${SCHEDULE_REASON[reason]}`).join('; ')
}

function unique(schedules: Schedule[]): Schedule[] {
  const seen = new Set<string>()
  return schedules.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })
}

function copySchedules(schedules: readonly Schedule[]): Schedule[] {
  return schedules.map((s) => ({ ...s, days: [...s.days] }))
}

function describeDays(days: readonly DayOfWeek[]): string {
  const ordered = canonicalDays(days)
  if (ordered.length === 7) return 'Every day'
  const weekend = ordered.length === 2 && ordered[0] === 'sat' && ordered[1] === 'sun'
  if (weekend) return 'Weekends'
  const weekdays = ordered.length === 5 && ordered.every((d, i) => d === DAYS_OF_WEEK[i])
  if (weekdays) return 'Weekdays'
  return ordered.map((d) => DAY_SHORT[d]).join(', ')
}

function canonicalDays(days: readonly DayOfWeek[]): DayOfWeek[] {
  return DAYS_OF_WEEK.filter((d) => days.includes(d))
}

function readDays(raw: unknown): DayOfWeek[] {
  if (!Array.isArray(raw)) return []
  return canonicalDays(raw.filter(isDay))
}

function isDay(v: unknown): v is DayOfWeek {
  return typeof v === 'string' && (DAYS_OF_WEEK as readonly string[]).includes(v)
}

/** "9:00" and "09:00:00" become "09:00". Anything else, including a cleared input, is null. */
function normalizeTime(raw: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw.trim())
  if (!match) return null
  const hours = Number(match[1])
  const mins = Number(match[2])
  if (hours > 23 || mins > 59) return null
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

function minutes(hhmm: string): number | null {
  const time = normalizeTime(hhmm)
  if (!time) return null
  const [h, m] = time.split(':').map(Number) as [number, number]
  return h * 60 + m
}

function dayBefore(date: Date): DayOfWeek {
  const previous = new Date(date)
  previous.setDate(previous.getDate() - 1)
  return DAY_FROM_JS[previous.getDay()]!
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
