// PROTOTYPE — throwaway fixture data. Categories and schedules come from the real
// defaults in src/shared/types.ts so density is realistic; usage counts are fake.
import { DEFAULT_CATEGORIES, DEFAULT_SCHEDULES, type DayOfWeek } from '@/shared/types'

export const categories = DEFAULT_CATEGORIES
export const schedules = DEFAULT_SCHEDULES

export const DAY_NAMES: Record<DayOfWeek, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

export function describeDays(days: DayOfWeek[]): string {
  if (days.length === 7) return 'Every day'
  const wk: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri']
  if (days.length === 5 && wk.every((d) => days.includes(d))) return 'Weekdays'
  return days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')
}

export function describeHours(start: string, end: string): string {
  if (start === '00:00' && end === '23:59') return 'all day'
  return `${start}–${end}`
}

export const bypass = { budget: 3, used: 1, minutes: 5, wait: 5, spentWait: 30 }

// The one quote used across overlay variants. Source: William James,
// The Principles of Psychology (1890), vol. 2, ch. 22.
export const quote = {
  text: 'The art of being wise is the art of knowing what to overlook.',
  author: 'William James',
  source: 'The Principles of Psychology, 1890',
}

// ---------- Usage: 12 Monday-start weeks of daily counts ----------

export interface DayCounts {
  date: Date
  muted: number
  turnedBack: number
  bypassed: number
  paused: number
  future: boolean
}
export interface WeekCounts {
  start: Date
  days: DayCounts[]
  muted: number
  turnedBack: number
  bypassed: number
  paused: number
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Prototype "today": Saturday 3 October 2026.
export const TODAY = new Date(2026, 9, 3)

function buildUsage(): WeekCounts[] {
  const rnd = mulberry32(20261003)
  const thisMonday = new Date(2026, 8, 28)
  const weeks: WeekCounts[] = []
  for (let w = 11; w >= 0; w--) {
    const start = new Date(thisMonday)
    start.setDate(start.getDate() - w * 7)
    const holiday = w === 7 // a quiet week away, to show the empty sentence
    const days: DayCounts[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(date.getDate() + d)
      const future = date > TODAY
      const weekend = d >= 5
      let muted = 0
      if (!future && !holiday) {
        muted = weekend
          ? rnd() < 0.45
            ? Math.floor(rnd() * 4)
            : 0
          : 4 + Math.floor(rnd() * 11)
      }
      const turnedBack = Math.round(muted * (0.4 + rnd() * 0.35))
      const bypassed = Math.min(
        muted - turnedBack,
        Math.max(0, Math.round((muted - turnedBack) * (0.6 + rnd() * 0.4))),
      )
      const paused = !future && !holiday && rnd() < 0.16 ? 1 : 0
      days.push({ date, muted, turnedBack, bypassed, paused, future })
    }
    const sum = (k: 'muted' | 'turnedBack' | 'bypassed' | 'paused') =>
      days.reduce((a, x) => a + x[k], 0)
    weeks.push({
      start,
      days,
      muted: sum('muted'),
      turnedBack: sum('turnedBack'),
      bypassed: sum('bypassed'),
      paused: sum('paused'),
    })
  }
  return weeks.reverse() // newest first
}

export const usage = buildUsage()

export const fmtDay = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtShort = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
export const fmtLong = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}
export function times(n: number) {
  if (n === 0) return 'no times'
  if (n === 1) return 'once'
  if (n === 2) return 'twice'
  return `${n} times`
}
