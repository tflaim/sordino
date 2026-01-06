import { Schedule, DayOfWeek, SordinoSettings } from './types'

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
  const [hours, minutes] = timeStr.split(':').map(Number)
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

  const currentDay = DAY_MAP[now.getDay()]
  if (!schedule.days.includes(currentDay)) return false

  const currentHours = now.getHours()
  const currentMinutes = now.getMinutes()

  return isTimeInRange(currentHours, currentMinutes, schedule.startTime, schedule.endTime)
}

export function getActiveSchedule(schedules: Schedule[], now: Date = new Date()): Schedule | null {
  return schedules.find((s) => isScheduleActive(s, now)) ?? null
}

export function getTimeRemainingInSchedule(schedule: Schedule, now: Date = new Date()): string {
  const end = parseTime(schedule.endTime)
  const currentHours = now.getHours()
  const currentMinutes = now.getMinutes()

  let endTotal = end.hours * 60 + end.minutes
  const currentTotal = currentHours * 60 + currentMinutes

  // Handle overnight - end time is tomorrow
  if (endTotal < parseTime(schedule.startTime).hours * 60 + parseTime(schedule.startTime).minutes) {
    if (currentTotal > endTotal) {
      endTotal += 24 * 60 // Add 24 hours
    }
  }

  const remainingMinutes = endTotal - currentTotal
  if (remainingMinutes <= 0) return 'ending soon'

  const hours = Math.floor(remainingMinutes / 60)
  const minutes = remainingMinutes % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export function formatEndTime(schedule: Schedule): string {
  const end = parseTime(schedule.endTime)
  const hour = end.hours % 12 || 12
  const ampm = end.hours >= 12 ? 'PM' : 'AM'
  const mins = end.minutes.toString().padStart(2, '0')
  return `${hour}:${mins} ${ampm}`
}

export function shouldBlock(settings: SordinoSettings, now: Date = new Date()): {
  shouldBlock: boolean
  reason?: string
  timeRemaining?: string
} {
  const { blockState, schedules } = settings

  // Check if paused
  if (blockState.pausedUntil && now.getTime() < blockState.pausedUntil) {
    return { shouldBlock: false }
  }

  // Manual override takes precedence
  if (blockState.manualOverride === 'on') {
    return { shouldBlock: true, reason: 'Manual block active' }
  }
  if (blockState.manualOverride === 'off') {
    return { shouldBlock: false }
  }

  // Check schedules
  const activeSchedule = getActiveSchedule(schedules, now)
  if (activeSchedule) {
    return {
      shouldBlock: true,
      reason: activeSchedule.name,
      timeRemaining: getTimeRemainingInSchedule(activeSchedule, now),
    }
  }

  return { shouldBlock: false }
}
