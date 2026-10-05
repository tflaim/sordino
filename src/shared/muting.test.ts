import { describe, expect, it } from 'vitest'
import { decideMuting, modeEnd, type Mode } from './muting'
import type { Schedule } from './types'

// vitest.config.ts pins TZ=Europe/London. 2026-10-05 is a Monday.
const at = (local: string) => new Date(local).getTime()

const workHours: Schedule = {
  id: 'work-hours',
  name: 'Work hours',
  enabled: true,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  startTime: '09:00',
  endTime: '17:00',
}
const extendedWork: Schedule = {
  id: 'extended-work',
  name: 'Extended work',
  enabled: true,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  startTime: '08:00',
  endTime: '18:00',
}
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
      case: 'a schedule starting mid-Pause does not override the Pause',
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
  ])('$case', ({ schedules, mode, now, expected }) => {
    expect(decideMuting(schedules, mode, at(now))).toEqual(expected)
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
