import { describe, expect, it, vi } from 'vitest'
import {
  SUGGESTED_SCHEDULES,
  describeSchedule,
  isScheduleActive,
  schedulesFromConfig,
  schedulesFromLegacy,
  toScheduleDraft,
  validateSchedule,
  type Schedule,
  type ScheduleDraft,
} from './schedule'

// vitest.config.ts pins TZ=Europe/London. 2026-10-05 is a Monday; 2026-10-04 is a Sunday.
const at = (local: string) => new Date(local).getTime()

const draft = (overrides: Partial<ScheduleDraft> = {}): ScheduleDraft => ({
  name: 'Deep work',
  enabled: true,
  days: ['mon', 'wed'],
  allDay: false,
  startTime: '09:00',
  endTime: '17:00',
  ...overrides,
})

describe('validateSchedule', () => {
  it.each([
    { case: 'no days', overrides: { days: [] as ScheduleDraft['days'] }, reasons: ['no-days'] },
    {
      case: 'a day that is not a day',
      overrides: { days: ['nope' as ScheduleDraft['days'][number]] },
      reasons: ['no-days'],
    },
    {
      case: 'start equal to end',
      overrides: { startTime: '09:00', endTime: '09:00' },
      reasons: ['start-equals-end'],
    },
    {
      case: 'the same time written with and without seconds',
      overrides: { startTime: '9:00', endTime: '09:00:00' },
      reasons: ['start-equals-end'],
    },
    { case: 'a cleared start', overrides: { startTime: '' }, reasons: ['missing-time'] },
    { case: 'a cleared end', overrides: { endTime: '' }, reasons: ['missing-time'] },
    {
      case: 'a time that is not a time',
      overrides: { endTime: '25:00' },
      reasons: ['missing-time'],
    },
    { case: 'a blank name', overrides: { name: '   ' }, reasons: ['blank-name'] },
    {
      case: 'a blank name, no days and a cleared time together',
      overrides: { name: '', days: [], startTime: '', endTime: '' },
      reasons: ['blank-name', 'no-days', 'missing-time'],
    },
  ])('refuses $case', ({ overrides, reasons }) => {
    expect(validateSchedule(draft(overrides))).toEqual({ ok: false, reasons })
  })

  it('accepts an overnight draft and an all-day draft that has no times', () => {
    const overnight = validateSchedule(
      draft({ name: 'Late', days: ['sun'], startTime: '22:00', endTime: '02:00' })
    )
    const allDay = validateSchedule(
      draft({ name: 'Always', allDay: true, startTime: '', endTime: '' })
    )
    const allDaySameTime = validateSchedule(
      draft({ name: 'Always', allDay: true, startTime: '09:00', endTime: '09:00' })
    )

    expect(overnight).toMatchObject({
      ok: true,
      schedule: { name: 'Late', days: ['sun'], allDay: false, appliesTo: 'all' },
    })
    expect(allDay).toMatchObject({
      ok: true,
      schedule: { allDay: true, startTime: '00:00', endTime: '00:00', appliesTo: 'all' },
    })
    expect(allDaySameTime).toMatchObject({ ok: true, schedule: { allDay: true } })
  })

  it('stores days Monday-first, without duplicates', () => {
    const result = validateSchedule(draft({ days: ['fri', 'mon', 'fri'] }))
    expect(result).toMatchObject({ ok: true, schedule: { days: ['mon', 'fri'] } })
  })
})

describe('describeSchedule', () => {
  it('describes an overnight schedule as ending the next day', () => {
    expect(
      describeSchedule({ days: ['sun'], allDay: false, startTime: '22:00', endTime: '02:00' })
    ).toBe('Sun · 22:00–02:00, ends next day')
  })

  it('describes an all-day schedule as all day', () => {
    expect(
      describeSchedule({
        days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        allDay: true,
        startTime: '00:00',
        endTime: '23:59',
      })
    ).toBe('Every day · all day')
  })

  it('names weekdays, weekends and a sparse set', () => {
    expect(
      describeSchedule({
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        allDay: false,
        startTime: '09:00',
        endTime: '17:00',
      })
    ).toBe('Weekdays · 09:00–17:00')
    expect(
      describeSchedule({
        days: ['sat', 'sun'],
        allDay: false,
        startTime: '10:00',
        endTime: '12:00',
      })
    ).toBe('Weekends · 10:00–12:00')
    expect(
      describeSchedule({
        days: ['fri', 'mon'],
        allDay: false,
        startTime: '09:00',
        endTime: '17:00',
      })
    ).toBe('Mon, Fri · 09:00–17:00')
  })
})

describe('isScheduleActive', () => {
  const lateSunday: Schedule = {
    id: 'late',
    name: 'Late night',
    enabled: true,
    days: ['sun'],
    allDay: false,
    startTime: '22:00',
    endTime: '02:00',
    appliesTo: 'all',
  }

  it('an all-day schedule is active at 23:59:30', () => {
    const always = SUGGESTED_SCHEDULES.find((s) => s.id === 'always-on')!
    expect(isScheduleActive({ ...always, enabled: true }, at('2026-10-05T23:59:30'))).toBe(true)
    expect(isScheduleActive({ ...always, enabled: true }, at('2026-10-05T00:00:00'))).toBe(true)
  })

  it('a window that ends at 23:59 does not cover 23:59:30', () => {
    const almost: Schedule = {
      ...lateSunday,
      days: ['mon'],
      startTime: '00:00',
      endTime: '23:59',
    }
    expect(isScheduleActive(almost, at('2026-10-05T23:59:30'))).toBe(false)
  })

  it('an overnight schedule covers the next morning, including Monday after Sunday', () => {
    expect(isScheduleActive(lateSunday, at('2026-10-04T23:00'))).toBe(true)
    expect(isScheduleActive(lateSunday, at('2026-10-05T01:00'))).toBe(true)
    expect(isScheduleActive(lateSunday, at('2026-10-05T02:00'))).toBe(false)
  })

  it('a Monday-only overnight schedule does not cover Monday morning', () => {
    const mondayNight: Schedule = { ...lateSunday, days: ['mon'] }
    expect(isScheduleActive(mondayNight, at('2026-10-04T23:00'))).toBe(false)
    expect(isScheduleActive(mondayNight, at('2026-10-05T01:00'))).toBe(false)
    expect(isScheduleActive(mondayNight, at('2026-10-05T23:00'))).toBe(true)
  })

  it('a disabled schedule never covers the moment', () => {
    expect(isScheduleActive({ ...lateSunday, enabled: false }, at('2026-10-04T23:00'))).toBe(false)
  })
})

describe('schedulesFromLegacy', () => {
  it('uses the suggested schedules when nothing is stored, and they are ordinary', () => {
    expect(schedulesFromLegacy(undefined)).toEqual(SUGGESTED_SCHEDULES)
    expect(schedulesFromLegacy({})).toEqual(SUGGESTED_SCHEDULES)
    const enabled = SUGGESTED_SCHEDULES.filter((s) => s.enabled).map((s) => s.id)
    expect(enabled).toEqual(['work-hours'])
    for (const schedule of SUGGESTED_SCHEDULES) {
      expect(validateSchedule(toScheduleDraft(schedule)).ok).toBe(true)
    }
    expect(SUGGESTED_SCHEDULES.find((s) => s.id === 'always-on')?.allDay).toBe(true)
  })

  it('turns a 1.x 00:00–23:59 window into all day and drops one that can never run', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const schedules = schedulesFromLegacy({
      schedules: [
        {
          id: 'always-on',
          name: 'Always on',
          enabled: true,
          days: ['mon'],
          startTime: '00:00',
          endTime: '23:59',
        },
        {
          id: 'broken',
          name: 'Broken',
          enabled: true,
          days: ['mon'],
          startTime: '09:00',
          endTime: '09:00',
        },
        {
          id: 'nameless',
          name: '  ',
          enabled: true,
          days: ['mon'],
          startTime: '09:00',
          endTime: '10:00',
        },
        'not-a-schedule',
      ],
    })

    expect(schedules).toEqual([
      {
        id: 'always-on',
        name: 'Always on',
        enabled: true,
        days: ['mon'],
        allDay: true,
        startTime: '00:00',
        endTime: '23:59',
        appliesTo: 'all',
      },
    ])
    expect(isScheduleActive(schedules[0]!, at('2026-10-05T23:59:30'))).toBe(true)
    expect(debug.mock.calls.map((call) => call[0])).toEqual([
      'Sordino: dropped 1.x schedule "Broken" (broken): start-equals-end — Start and end are the same, so this schedule would never run.',
      'Sordino: dropped 1.x schedule (nameless): blank-name — A schedule needs a name.',
      'Sordino: dropped 1.x schedule (not an object): not an object',
    ])
    debug.mockRestore()
  })

  it('assigns an id when a 1.x schedule has none', () => {
    const [schedule] = schedulesFromLegacy({
      schedules: [
        {
          name: 'Mornings',
          enabled: true,
          days: ['tue'],
          startTime: '08:00',
          endTime: '09:00',
        },
      ],
    })

    expect(schedule).toMatchObject({
      name: 'Mornings',
      enabled: true,
      days: ['tue'],
      allDay: false,
      startTime: '08:00',
      endTime: '09:00',
      appliesTo: 'all',
    })
    expect(schedule?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('assigns an id to a stored schedule that has none, and does not log a stored drop', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const [schedule] = schedulesFromConfig([
      {
        name: 'Mornings',
        enabled: false,
        days: ['tue'],
        allDay: false,
        startTime: '08:00',
        endTime: '09:00',
      },
      {
        name: 'Broken',
        enabled: true,
        days: ['mon'],
        startTime: '09:00',
        endTime: '09:00',
      },
    ])

    expect(schedule).toMatchObject({ name: 'Mornings', enabled: false, appliesTo: 'all' })
    expect(schedule?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(debug).not.toHaveBeenCalled()
    debug.mockRestore()
  })

  it('keeps an empty list empty', () => {
    expect(schedulesFromLegacy({ schedules: [] })).toEqual([])
  })
})
