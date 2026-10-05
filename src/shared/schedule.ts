import type { Schedule, DayOfWeek } from './types'

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number) as [number, number]
  return { hours, minutes }
}

function isTimeInRange(
  currentHours: number,
  currentMinutes: number,
  startTime: string,
  endTime: string
): boolean {
  const start = parseTime(startTime)
  const end = parseTime(endTime)

  const currentTotal = currentHours * 60 + currentMinutes
  const startTotal = start.hours * 60 + start.minutes
  const endTotal = end.hours * 60 + end.minutes

  // Handle overnight schedules (e.g., 22:00 - 06:00)
  if (endTotal < startTotal) {
    return currentTotal >= startTotal || currentTotal < endTotal
  }

  return currentTotal >= startTotal && currentTotal < endTotal
}

export function isScheduleActive(schedule: Schedule, now: Date = new Date()): boolean {
  if (!schedule.enabled) return false

  const currentDay = DAY_MAP[now.getDay()]!
  const currentHours = now.getHours()
  const currentMinutes = now.getMinutes()

  const start = parseTime(schedule.startTime)
  const end = parseTime(schedule.endTime)
  const startTotal = start.hours * 60 + start.minutes
  const endTotal = end.hours * 60 + end.minutes
  const currentTotal = currentHours * 60 + currentMinutes

  // Check if this is an overnight schedule (e.g., 22:00 - 06:00)
  const isOvernight = endTotal < startTotal

  if (isOvernight) {
    // For overnight schedules, we need to check two cases:
    // 1. Evening portion (current time >= start): check if TODAY is in schedule
    // 2. Morning portion (current time < end): check if YESTERDAY is in schedule

    if (currentTotal >= startTotal) {
      // Evening portion - check if today is in schedule
      if (!schedule.days.includes(currentDay)) return false
      return true
    } else if (currentTotal < endTotal) {
      // Morning portion - check if yesterday is in schedule
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDay = DAY_MAP[yesterday.getDay()]!
      if (!schedule.days.includes(yesterdayDay)) return false
      return true
    }
    return false
  }

  // Standard schedule (not overnight)
  if (!schedule.days.includes(currentDay)) return false
  return isTimeInRange(currentHours, currentMinutes, schedule.startTime, schedule.endTime)
}
