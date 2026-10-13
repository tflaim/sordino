// The Muting decision: given the schedules, the current Mute now or Pause and
// the time, whether muting is in effect, why, until when, and the next moment
// the answer can change. Pure; the store derives its badge and alarms from it
// and readers (popup, settings, overlay) call it on a snapshot they read.
import { isScheduleActive } from './schedule'
import type { Schedule } from './types'

/** How long a Mute now or a Pause lasts, chosen when it starts. */
export type Length = '15m' | '1h' | 'rest-of-today'
export const LENGTHS: readonly Length[] = ['15m', '1h', 'rest-of-today']

/**
 * The user's latest Mute now or Pause. There is one slot: starting either
 * replaces the other (most recent wins), and when it ends muting is back to
 * schedule. Both are finite. An ended mode may stay stored; it is ignored.
 */
export type Mode =
  | { kind: 'mute-now'; since: number; until: number }
  | { kind: 'pause'; since: number; until: number }

export type MutingSource =
  | { kind: 'schedule'; id: string; name: string }
  | { kind: 'mute-now' }
  | { kind: 'pause' }
  | { kind: 'none' }

export interface Muting {
  muted: boolean
  source: MutingSource
  /**
   * While muted: when muting actually stops, across a Mute now running into
   * schedules and overlapping schedules (null if it never stops within a week).
   * While paused: when the Pause ends. Otherwise null.
   */
  until: number | null
  /** The next moment `muted` or `source` changes (null if none within a week). */
  nextChange: number | null
}

const MINUTE = 60_000
// Schedules repeat weekly, so a week and a day of boundaries finds every change.
const LOOKAHEAD_DAYS = 8

/** When a Mute now or Pause of `length` started at `now` ends. */
export function modeEnd(length: Length, now: number): number {
  switch (length) {
    case '15m':
      return now + 15 * MINUTE
    case '1h':
      return now + 60 * MINUTE
    case 'rest-of-today': {
      const d = new Date(now)
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
    }
  }
}

/** The Mute now or Pause still running at `now`, or null. */
export function runningMode(mode: Mode | null, now: number): Mode | null {
  return mode && now < mode.until ? mode : null
}

export function decideMuting(
  schedules: readonly Schedule[],
  mode: Mode | null,
  now: number
): Muting {
  const here = sample(schedules, mode, now)
  let nextChange: number | null = null
  let mutedUntil: number | null = null
  for (const t of boundaries(schedules, mode, now)) {
    const there = sample(schedules, mode, t)
    if (nextChange === null && !sameAnswer(here, there)) nextChange = t
    if (mutedUntil === null && here.muted && !there.muted) mutedUntil = t
    if (nextChange !== null && (mutedUntil !== null || !here.muted)) break
  }
  const until = here.source.kind === 'pause' ? mode!.until : here.muted ? mutedUntil : null
  return { ...here, until, nextChange }
}

function sample(
  schedules: readonly Schedule[],
  mode: Mode | null,
  t: number
): Pick<Muting, 'muted' | 'source'> {
  const running = runningMode(mode, t)
  if (running) return { muted: running.kind === 'mute-now', source: { kind: running.kind } }
  const date = new Date(t)
  const schedule = schedules.find((s) => isScheduleActive(s, date))
  return schedule
    ? { muted: true, source: { kind: 'schedule', id: schedule.id, name: schedule.name } }
    : { muted: false, source: { kind: 'none' } }
}

function sameAnswer(a: Pick<Muting, 'muted' | 'source'>, b: Pick<Muting, 'muted' | 'source'>) {
  if (a.muted !== b.muted) return false
  if (a.source.kind === 'schedule' && b.source.kind === 'schedule')
    return a.source.id === b.source.id
  return a.source.kind === b.source.kind
}

/** The one-word state every surface shows: the badge, the popup, settings. */
export type MutingShow = 'muting' | 'paused' | 'off'

export function mutingShow(muting: Muting): MutingShow {
  return muting.muted ? 'muting' : muting.source.kind === 'pause' ? 'paused' : 'off'
}

/** Every future moment the answer could change, ascending. */
function boundaries(schedules: readonly Schedule[], mode: Mode | null, now: number): number[] {
  const times = new Set<number>()
  if (mode && mode.until > now) times.add(mode.until)
  const today = new Date(now)
  for (const s of schedules) {
    if (!s.enabled) continue
    for (let day = 0; day <= LOOKAHEAD_DAYS; day++) {
      for (const hhmm of [s.startTime, s.endTime]) {
        const [h, m] = hhmm.split(':').map(Number) as [number, number]
        const t = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + day,
          h,
          m
        ).getTime()
        if (t > now) times.add(t)
      }
    }
  }
  return [...times].sort((a, b) => a - b)
}
