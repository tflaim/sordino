import { describe, expect, it } from 'vitest'
import { decideMuting, modeEnd, type Mode } from './muting'
import type { Schedule } from './schedule'

// vitest.config.ts pins TZ=Europe/London. 2026-10-05 is a Monday, 2026-10-04 a Sunday.
const at = (local: string) => new Date(local).getTime()

function schedule(
  overrides: Omit<Schedule, 'enabled' | 'allDay' | 'appliesTo'> & Partial<Schedule>
): Schedule {
  return { enabled: true, allDay: false, appliesTo: 'all', ...overrides }
}

const workHours: Schedule = schedule({
  id: 'work-hours',
  name: 'Work hours',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  startTime: '09:00',
  endTime: '17:00',
})
const extendedWork: Schedule = schedule({
  id: 'extended-work',
  name: 'Extended work',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  startTime: '08:00',
  endTime: '18:00',
})
const evenings: Schedule = schedule({
  id: 'evenings',
  name: 'Evenings',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  startTime: '17:00',
  endTime: '22:00',
})
const lateSunday: Schedule = schedule({
  id: 'late',
  name: 'Late night',
  days: ['sun'],
  startTime: '22:00',
  endTime: '02:00',
})
const allDayMonday: Schedule = schedule({
  id: 'monday',
  name: 'Monday',
  days: ['mon'],
  allDay: true,
  startTime: '00:00',
  endTime: '23:59',
})
const allDayEveryDay: Schedule = {
  ...allDayMonday,
  id: 'always',
  name: 'Always',
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
}
const mondayNight: Schedule = { ...lateSunday, days: ['mon'] }
const almostAllDay: Schedule = schedule({
  id: 'almost',
  name: 'Almost',
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  startTime: '00:00',
  endTime: '23:59',
})
const earlySunday: Schedule = schedule({
  id: 'early',
  name: 'Early',
  days: ['sun'],
  startTime: '00:00',
  endTime: '04:00',
})
const pause = (since: string, until: string): Mode => ({
  kind: 'pause',
  since: at(since),
  until: at(until),
})
const muteNow = (since: string, until: string): Mode => ({
  kind: 'mute-now',
  since: at(since),
  until: at(until),
})

describe('Muting decision', () => {
  it.each([
    {
      case: 'no schedule running and no Mute now or Pause',
      schedules: [workHours],
      mode: null,
      now: '2026-10-05T07:00',
      expected: {
        muted: false,
        source: { kind: 'none' },
        until: null,
        nextChange: at('2026-10-05T09:00'),
      },
    },
    {
      case: 'a schedule running',
      schedules: [workHours],
      mode: null,
      now: '2026-10-05T10:00',
      expected: {
        muted: true,
        source: { kind: 'schedule', id: 'work-hours', name: 'Work hours' },
        until: at('2026-10-05T17:00'),
        nextChange: at('2026-10-05T17:00'),
      },
    },
    {
      case: 'a disabled schedule never mutes',
      schedules: [{ ...workHours, enabled: false }],
      mode: null,
      now: '2026-10-05T10:00',
      expected: { muted: false, source: { kind: 'none' }, until: null, nextChange: null },
    },
    {
      case: 'a weekend outside the schedule days',
      schedules: [workHours],
      mode: null,
      now: '2026-10-10T10:00', // Saturday
      expected: {
        muted: false,
        source: { kind: 'none' },
        until: null,
        nextChange: at('2026-10-12T09:00'), // Monday
      },
    },
    {
      case: 'Pause during a schedule',
      schedules: [workHours],
      mode: pause('2026-10-05T10:00', '2026-10-05T11:00'),
      now: '2026-10-05T10:30',
      expected: {
        muted: false,
        source: { kind: 'pause' },
        until: at('2026-10-05T11:00'),
        nextChange: at('2026-10-05T11:00'),
      },
    },
    {
      case: 'a schedule starting mid-Pause leaves the Pause in place',
      schedules: [workHours],
      mode: pause('2026-10-05T08:30', '2026-10-05T09:30'),
      now: '2026-10-05T09:15',
      expected: {
        muted: false,
        source: { kind: 'pause' },
        until: at('2026-10-05T09:30'),
        nextChange: at('2026-10-05T09:30'),
      },
    },
    {
      case: 'before a schedule starts mid-Pause, nothing changes at the schedule start',
      schedules: [workHours],
      mode: pause('2026-10-05T08:30', '2026-10-05T09:30'),
      now: '2026-10-05T08:45',
      expected: {
        muted: false,
        source: { kind: 'pause' },
        until: at('2026-10-05T09:30'),
        nextChange: at('2026-10-05T09:30'),
      },
    },
    {
      case: 'when a Pause ends, back to the schedule',
      schedules: [workHours],
      mode: pause('2026-10-05T08:30', '2026-10-05T09:30'),
      now: '2026-10-05T09:30',
      expected: {
        muted: true,
        source: { kind: 'schedule', id: 'work-hours', name: 'Work hours' },
        until: at('2026-10-05T17:00'),
        nextChange: at('2026-10-05T17:00'),
      },
    },
    {
      case: 'a Pause outside any schedule ends into no muting',
      schedules: [workHours],
      mode: pause('2026-10-05T19:00', '2026-10-05T20:00'),
      now: '2026-10-05T19:30',
      expected: {
        muted: false,
        source: { kind: 'pause' },
        until: at('2026-10-05T20:00'),
        nextChange: at('2026-10-05T20:00'),
      },
    },
    {
      // Most recent wins: starting Mute now replaces the Pause in the one slot.
      case: 'Mute now during a Pause mutes, outside any schedule',
      schedules: [workHours],
      mode: muteNow('2026-10-05T19:30', '2026-10-05T19:45'), // started mid-Pause (19:00–20:00)
      now: '2026-10-05T19:35',
      expected: {
        muted: true,
        source: { kind: 'mute-now' },
        until: at('2026-10-05T19:45'),
        nextChange: at('2026-10-05T19:45'),
      },
    },
    {
      case: 'Mute now outside any schedule',
      schedules: [workHours],
      mode: muteNow('2026-10-05T19:00', '2026-10-05T20:00'),
      now: '2026-10-05T19:30',
      expected: {
        muted: true,
        source: { kind: 'mute-now' },
        until: at('2026-10-05T20:00'),
        nextChange: at('2026-10-05T20:00'),
      },
    },
    {
      case: 'Mute now running into a schedule reports the honest end of muting',
      schedules: [workHours],
      mode: muteNow('2026-10-05T08:30', '2026-10-05T09:30'),
      now: '2026-10-05T08:45',
      expected: {
        muted: true,
        source: { kind: 'mute-now' },
        until: at('2026-10-05T17:00'),
        nextChange: at('2026-10-05T09:30'),
      },
    },
    {
      case: 'an ended Mute now leaves nothing behind',
      schedules: [workHours],
      mode: muteNow('2026-10-05T19:00', '2026-10-05T20:00'),
      now: '2026-10-05T20:00',
      expected: {
        muted: false,
        source: { kind: 'none' },
        until: null,
        nextChange: at('2026-10-06T09:00'),
      },
    },
    {
      case: 'overlapping schedules report the merged end; the reason changes when the first ends',
      schedules: [workHours, extendedWork],
      mode: null,
      now: '2026-10-05T10:00',
      expected: {
        muted: true,
        source: { kind: 'schedule', id: 'work-hours', name: 'Work hours' },
        until: at('2026-10-05T18:00'),
        nextChange: at('2026-10-05T17:00'),
      },
    },
    {
      case: 'contiguous schedules report the merged end',
      schedules: [workHours, evenings],
      mode: null,
      now: '2026-10-05T10:00',
      expected: {
        muted: true,
        source: { kind: 'schedule', id: 'work-hours', name: 'Work hours' },
        until: at('2026-10-05T22:00'),
        nextChange: at('2026-10-05T17:00'),
      },
    },
    {
      case: 'an overnight schedule crosses midnight',
      schedules: [lateSunday],
      mode: null,
      now: '2026-10-04T23:00',
      expected: {
        muted: true,
        source: { kind: 'schedule', id: 'late', name: 'Late night' },
        until: at('2026-10-05T02:00'),
        nextChange: at('2026-10-05T02:00'),
      },
    },
    {
      case: 'an overnight Sunday schedule covers Monday morning',
      schedules: [lateSunday],
      mode: null,
      now: '2026-10-05T01:00',
      expected: {
        muted: true,
        source: { kind: 'schedule', id: 'late', name: 'Late night' },
        until: at('2026-10-05T02:00'),
        nextChange: at('2026-10-05T02:00'),
      },
    },
    {
      case: 'a Monday-only overnight schedule does not cover Monday morning',
      schedules: [mondayNight],
      mode: null,
      now: '2026-10-05T01:00',
      expected: {
        muted: false,
        source: { kind: 'none' },
        until: null,
        nextChange: at('2026-10-05T22:00'),
      },
    },
    {
      case: 'an all-day schedule is still on at 23:59:30 and ends at midnight',
      schedules: [allDayMonday],
      mode: null,
      now: '2026-10-05T23:59:30',
      expected: {
        muted: true,
        source: { kind: 'schedule', id: 'monday', name: 'Monday' },
        until: at('2026-10-06T00:00'),
        nextChange: at('2026-10-06T00:00'),
      },
    },
    {
      case: 'all day, every day, does not end at 23:59',
      schedules: [allDayEveryDay],
      mode: null,
      now: '2026-10-05T23:59:30',
      expected: {
        muted: true,
        source: { kind: 'schedule', id: 'always', name: 'Always' },
        until: null,
        nextChange: null,
      },
    },
    {
      case: 'a window ending at 23:59 is already over at 23:59:30',
      schedules: [almostAllDay],
      mode: null,
      now: '2026-10-05T23:59:30',
      expected: {
        muted: false,
        source: { kind: 'none' },
        until: null,
        nextChange: at('2026-10-06T00:00'),
      },
    },
    {
      // Clocks go back at 02:00 on Sunday 25 October. Friday 18:00 to Monday 09:00
      // is not a whole number of 24-hour days.
      case: 'the next start after the autumn clock change is local Monday 09:00',
      schedules: [workHours],
      mode: null,
      now: '2026-10-23T18:00',
      expected: {
        muted: false,
        source: { kind: 'none' },
        until: null,
        nextChange: at('2026-10-26T09:00'),
      },
    },
    {
      // Clocks spring forward at 01:00 on Sunday 29 March, so 01:30 does not exist.
      case: 'a schedule keeps its local end through the spring-forward morning',
      schedules: [earlySunday],
      mode: null,
      now: '2026-03-29T00:30',
      expected: {
        muted: true,
        source: { kind: 'schedule', id: 'early', name: 'Early' },
        until: at('2026-03-29T04:00'),
        nextChange: at('2026-03-29T04:00'),
      },
    },
    {
      case: 'the same schedule is still on at the time the missing hour collapses to',
      schedules: [earlySunday],
      mode: null,
      now: '2026-03-29T02:30',
      expected: {
        muted: true,
        source: { kind: 'schedule', id: 'early', name: 'Early' },
        until: at('2026-03-29T04:00'),
        nextChange: at('2026-03-29T04:00'),
      },
    },
  ])('$case', ({ schedules, mode, now, expected }) => {
    expect(decideMuting(schedules, mode, at(now))).toEqual(expected)
  })

  it('covers both 01:30s on the day the clocks go back, and ends at the later 02:00', () => {
    const hour = schedule({
      id: 'hour',
      name: 'The small hour',
      days: ['sun'],
      startTime: '01:00',
      endTime: '02:00',
    })
    const end = new Date('2026-10-25T02:00:00+00:00').getTime()
    const expected = {
      muted: true,
      source: { kind: 'schedule', id: 'hour', name: 'The small hour' },
      until: end,
      nextChange: end,
    }
    // 01:30 happens twice: first on BST, then again after the clocks go back to GMT.
    for (const now of ['2026-10-25T01:30:00+01:00', '2026-10-25T01:30:00+00:00']) {
      expect(decideMuting([hour], null, new Date(now).getTime())).toEqual(expected)
    }
  })
})

describe('Mute now and Pause lengths', () => {
  it.each([
    { length: '15m', now: '2026-10-05T10:00', end: '2026-10-05T10:15' },
    { length: '1h', now: '2026-10-05T10:00', end: '2026-10-05T11:00' },
    { length: '1h', now: '2026-10-05T23:30', end: '2026-10-06T00:30' },
    { length: 'rest-of-today', now: '2026-10-05T10:00', end: '2026-10-06T00:00' },
    { length: 'rest-of-today', now: '2026-10-05T23:50', end: '2026-10-06T00:00' },
    // Clocks go back at 02:00 on 25 October in London: midnight is still local midnight.
    { length: 'rest-of-today', now: '2026-10-24T22:00', end: '2026-10-25T00:00' },
  ] as const)('$length from $now ends at $end', ({ length, now, end }) => {
    expect(modeEnd(length, at(now))).toBe(at(end))
  })
})
