import { describe, expect, it } from 'vitest'
import { decideMuting } from '@/shared/muting'
import type { DayOfWeek } from '@/shared/types'
import {
  SUGGESTED_SCHEDULES,
  toScheduleDraft,
  type Schedule,
  type ScheduleDraft,
} from '@/shared/schedule'
import { directCommandPort } from './adapters/direct'
import { memoryStorage } from './adapters/memory'
import { openReader } from './reader'
import { openStore } from './store'
import type { Sender } from './commands'

// vitest.config.ts pins TZ=Europe/London. 2026-10-05 is a Monday.
const at = (local: string) => new Date(local).getTime()

function fixedClock(local: string) {
  let t = at(local)
  return {
    now: () => t,
    advance: (ms: number) => void (t += ms),
  }
}

const legacyWorkHours = {
  id: 'work-hours',
  name: 'Work hours',
  enabled: true,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'] as DayOfWeek[],
  startTime: '09:00',
  endTime: '17:00',
}
const workHours: Schedule = { ...legacyWorkHours, allDay: false, appliesTo: 'all' }
const legacy = { sordino_settings: { schedules: [legacyWorkHours] } }

const deepWork: ScheduleDraft = {
  name: 'Deep work',
  enabled: true,
  days: ['sat'],
  allDay: false,
  startTime: '10:00',
  endTime: '12:00',
}

const page: Sender = { kind: 'page' }
const tab: Sender = { kind: 'tab', tabId: 7, url: 'https://www.reddit.com/' }

async function setup(now = '2026-10-05T10:00', seed: Record<string, unknown> = legacy) {
  const storage = memoryStorage(seed)
  const clock = fixedClock(now)
  const store = await openStore({ storage, clock: clock.now })
  storage.writes.length = 0 // forget the first-open write
  return { storage, clock, store, popup: directCommandPort(store, page) }
}

describe('Sordino store', () => {
  it('a Pause during a schedule stops muting until it ends', async () => {
    const { store, popup, storage } = await setup('2026-10-05T10:00')

    const result = await popup.send({ type: 'pause', length: '1h' })

    expect(result).toEqual({ ok: true, outcome: { kind: 'paused', until: at('2026-10-05T11:00') } })
    expect(storage.writes).toEqual([
      {
        state: {
          version: 2,
          mode: { kind: 'pause', since: at('2026-10-05T10:00'), until: at('2026-10-05T11:00') },
        },
      },
    ])
    expect(await store.settle()).toEqual([
      { kind: 'badge', show: 'paused' },
      { kind: 'alarms', at: [{ name: 'muting-change', when: at('2026-10-05T11:00') }] },
    ])
  })

  it('runs commands one at a time, reading the clock when each is dequeued', async () => {
    const { popup, storage, clock } = await setup('2026-10-05T10:00')
    const release = storage.holdWrites()

    const first = popup.send({ type: 'pause', length: '15m' })
    const second = popup.send({ type: 'mute-now', length: '1h' })
    await new Promise((r) => setTimeout(r, 0))
    expect(storage.writes).toHaveLength(1) // the second waits for the first
    clock.advance(5 * 60_000)
    release()

    expect(await first).toEqual({
      ok: true,
      outcome: { kind: 'paused', until: at('2026-10-05T10:15') },
    })
    expect(await second).toEqual({
      ok: true,
      outcome: { kind: 'muting', until: at('2026-10-05T11:05') },
    })
    expect(storage.writes.map((w) => w.state?.mode?.kind)).toEqual(['pause', 'mute-now'])
  })

  it('a read never writes, and readers see what a command wrote', async () => {
    const { store, popup, storage } = await setup('2026-10-05T10:00')
    const reader = openReader(storage)
    const seen: unknown[] = []
    reader.watch(['state'], (docs) => seen.push(docs.state?.mode?.kind))

    await popup.send({ type: 'mute-now', length: '15m' })
    const writes = storage.writes.length
    const { state, config, usage } = await reader.read('state', 'config', 'usage')
    await store.settle()
    await new Promise((r) => setTimeout(r, 0))

    expect(state.mode).toEqual({
      kind: 'mute-now',
      since: at('2026-10-05T10:00'),
      until: at('2026-10-05T10:15'),
    })
    expect([config.version, usage.version]).toEqual([2, 2])
    expect(seen).toEqual(['mute-now'])
    expect(storage.writes).toHaveLength(writes)
  })

  it('a command that changes nothing writes nothing', async () => {
    const { popup, storage, clock } = await setup('2026-10-05T10:00')

    expect(await popup.send({ type: 'back-to-schedule' })).toEqual({
      ok: true,
      outcome: { kind: 'already-on-schedule' },
    })
    expect(storage.writes).toEqual([])

    await popup.send({ type: 'pause', length: 'rest-of-today' })
    clock.advance(60_000)
    expect(await popup.send({ type: 'pause', length: 'rest-of-today' })).toEqual({
      ok: true,
      outcome: { kind: 'paused', until: at('2026-10-06T00:00') },
    })
    expect(storage.writes).toHaveLength(1)
  })

  it('refuses Mute now, Pause and Back to schedule from a content script, without running them', async () => {
    const { store, storage } = await setup('2026-10-05T10:00')

    for (const command of [
      { type: 'mute-now', length: '1h' },
      { type: 'pause', length: '15m' },
      { type: 'back-to-schedule' },
    ] as const) {
      expect(await store.dispatch(command, tab)).toEqual({
        result: { ok: false, error: { code: 'not-allowed', detail: expect.any(String) } },
        effects: [],
      })
    }
    expect(storage.writes).toEqual([])
  })

  it('refuses a malformed command, whatever its static type', async () => {
    const { store, storage } = await setup('2026-10-05T10:00')

    for (const command of [
      { type: 'pause', length: 'forever' },
      { type: 'pause' },
      { type: 'update-settings', settings: {} },
      { type: 'save-schedule' },
      { type: 'save-schedule', schedule: null },
      { type: 'delete-schedule' },
      { type: 'delete-schedule', id: '  ' },
      null,
    ]) {
      const { result } = await store.dispatch(command as never, page)
      expect(result).toMatchObject({ ok: false, error: { code: 'invalid-command' } })
    }
    expect(storage.writes).toEqual([])
  })

  it('the most recent of Mute now and Pause wins, and Back to schedule ends either', async () => {
    const { store, popup } = await setup('2026-10-05T19:00') // after Work hours
    const badge = async () => (await store.settle())[0]

    await popup.send({ type: 'pause', length: '1h' })
    expect(await badge()).toEqual({ kind: 'badge', show: 'paused' })

    await popup.send({ type: 'mute-now', length: '15m' }) // Mute now during a Pause
    expect(await badge()).toEqual({ kind: 'badge', show: 'muting' })

    await popup.send({ type: 'pause', length: '15m' }) // Pause during Mute now
    expect(await badge()).toEqual({ kind: 'badge', show: 'paused' })

    expect(await popup.send({ type: 'back-to-schedule' })).toEqual({
      ok: true,
      outcome: { kind: 'back-to-schedule' },
    })
    expect(await store.settle()).toEqual([
      { kind: 'badge', show: 'off' },
      { kind: 'alarms', at: [{ name: 'muting-change', when: at('2026-10-06T09:00') }] },
    ])
  })

  it('Mute now ends on its alarm, even after a browser restart', async () => {
    const { store, storage, clock } = await setup('2026-10-05T19:00')
    const { effects } = await store.dispatch({ type: 'mute-now', length: '1h' }, page)
    expect(effects).toEqual([
      { kind: 'badge', show: 'muting' },
      { kind: 'alarms', at: [{ name: 'muting-change', when: at('2026-10-05T20:00') }] },
    ])

    // The browser is closed at 19:30 and reopened at 21:00: a new store settles.
    clock.advance(2 * 60 * 60_000)
    const restarted = await openStore({ storage, clock: clock.now })
    expect(await restarted.settle()).toEqual([
      { kind: 'badge', show: 'off' },
      { kind: 'alarms', at: [{ name: 'muting-change', when: at('2026-10-06T09:00') }] },
    ])
  })

  it('a failed write leaves state as it was and returns no effects', async () => {
    const { store, popup, storage } = await setup('2026-10-05T10:00')
    storage.failNextWrite()

    expect(await store.dispatch({ type: 'pause', length: '1h' }, page)).toEqual({
      result: { ok: false, error: { code: 'storage-failed', detail: expect.any(String) } },
      effects: [],
    })
    expect(await store.settle()).toContainEqual({ kind: 'badge', show: 'muting' })
    expect(await popup.send({ type: 'back-to-schedule' })).toEqual({
      ok: true,
      outcome: { kind: 'already-on-schedule' },
    })
  })

  it('first open stores all three keys at the current version; later opens write nothing', async () => {
    const storage = memoryStorage(legacy)
    const clock = fixedClock('2026-10-05T10:00')

    await openStore({ storage, clock: clock.now })
    expect(storage.writes).toEqual([
      {
        config: { version: 2, schedules: [workHours] },
        state: { version: 2, mode: null },
        usage: { version: 2 },
      },
    ])

    await openStore({ storage, clock: clock.now })
    expect(storage.writes).toHaveLength(1)
  })

  it('a malformed stored state is repaired to defaults on open', async () => {
    const storage = memoryStorage({ ...legacy, state: { version: 2, mode: { kind: 'forever' } } })

    await openStore({ storage, clock: fixedClock('2026-10-05T10:00').now })
    expect(storage.writes).toEqual([
      {
        config: { version: 2, schedules: [workHours] },
        state: { version: 2, mode: null },
        usage: { version: 2 },
      },
    ])
  })

  it('copies 1.x schedules into config, and a later edit of the 1.x key does not change them', async () => {
    const storage = memoryStorage({
      config: { version: 2 },
      sordino_settings: {
        schedules: [
          {
            id: 'always-on',
            name: 'Always on',
            enabled: true,
            days: ['mon'],
            startTime: '00:00',
            endTime: '23:59',
          },
        ],
      },
    })
    const store = await openStore({ storage, clock: fixedClock('2026-10-05T23:59:30').now })
    const reader = openReader(storage)

    const { config } = await reader.read('config')
    expect(config.schedules).toEqual([
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
    expect(decideMuting(config.schedules, null, at('2026-10-05T23:59:30'))).toMatchObject({
      muted: true,
      until: at('2026-10-06T00:00'),
    })

    storage.seed({ sordino_settings: { schedules: [] } })
    expect(await store.settle()).toContainEqual({ kind: 'badge', show: 'muting' })
    expect((await reader.read('config')).config.schedules).toHaveLength(1)
  })

  it('a reader migrates 1.x schedules in memory without writing', async () => {
    const storage = memoryStorage(legacy)
    const { config } = await openReader(storage).read('config')
    expect(config.schedules).toEqual([workHours])
    expect(storage.writes).toEqual([])
  })

  it('an empty schedule list stays empty, and is not refilled from the 1.x key', async () => {
    const storage = memoryStorage({
      config: { version: 2, schedules: [] },
      ...legacy,
    })
    const store = await openStore({ storage, clock: fixedClock('2026-10-05T10:00').now })
    expect((await openReader(storage).read('config')).config.schedules).toEqual([])
    expect(await store.settle()).toEqual([
      { kind: 'badge', show: 'off' },
      { kind: 'alarms', at: [] },
    ])
  })

  it('seeds the suggested schedules when nothing is stored, and they can be edited and deleted', async () => {
    const storage = memoryStorage()
    const clock = fixedClock('2026-10-05T10:00')
    const store = await openStore({ storage, clock: clock.now })
    expect((await openReader(storage).read('config')).config.schedules).toEqual(SUGGESTED_SCHEDULES)

    const suggestedWork = SUGGESTED_SCHEDULES.find((s) => s.id === 'work-hours')
    const edited = await store.dispatch(
      {
        type: 'save-schedule',
        schedule: { ...toScheduleDraft(suggestedWork!), endTime: '12:00' },
      },
      page
    )
    expect(edited.result).toMatchObject({
      ok: true,
      outcome: { kind: 'saved', schedule: { id: 'work-hours', endTime: '12:00' } },
    })
    expect(await store.settle()).toEqual([
      { kind: 'badge', show: 'muting' },
      { kind: 'alarms', at: [{ name: 'muting-change', when: at('2026-10-05T12:00') }] },
    ])

    expect(await store.dispatch({ type: 'delete-schedule', id: 'work-hours' }, page)).toEqual({
      result: { ok: true, outcome: { kind: 'deleted' } },
      effects: [
        { kind: 'badge', show: 'off' },
        { kind: 'alarms', at: [] },
      ],
    })
    const reopened = await openStore({ storage, clock: clock.now })
    expect(
      (await openReader(storage).read('config')).config.schedules.map((s) => s.id)
    ).not.toContain('work-hours')
    expect(await reopened.settle()).toContainEqual({ kind: 'badge', show: 'off' })
  })

  it('refuses a schedule that can never run, and writes nothing', async () => {
    const { popup, storage } = await setup('2026-10-05T10:00')

    expect(
      await popup.send({
        type: 'save-schedule',
        schedule: {
          name: '   ',
          enabled: true,
          days: [],
          allDay: false,
          startTime: '',
          endTime: '09:00',
        },
      })
    ).toEqual({
      ok: true,
      outcome: { kind: 'refused', reasons: ['blank-name', 'no-days', 'missing-time'] },
    })
    expect(
      await popup.send({
        type: 'save-schedule',
        schedule: { ...deepWork, startTime: '10:00', endTime: '10:00' },
      })
    ).toEqual({ ok: true, outcome: { kind: 'refused', reasons: ['start-equals-end'] } })
    expect(storage.writes).toEqual([])
  })

  it('saves a new schedule, treats a repeat as unchanged, and deletes it', async () => {
    const { popup, storage } = await setup('2026-10-05T10:00')

    const saved = await popup.send({ type: 'save-schedule', schedule: deepWork })
    expect(saved).toMatchObject({
      ok: true,
      outcome: { kind: 'saved', schedule: { name: 'Deep work' } },
    })
    const id = saved.ok && saved.outcome.kind === 'saved' ? saved.outcome.schedule.id : ''
    expect(id).toMatch(/^[0-9a-f-]{36}$/)

    expect(await popup.send({ type: 'save-schedule', schedule: { ...deepWork, id } })).toEqual({
      ok: true,
      outcome: { kind: 'unchanged' },
    })
    expect(storage.writes).toHaveLength(1)

    expect(await popup.send({ type: 'delete-schedule', id })).toEqual({
      ok: true,
      outcome: { kind: 'deleted' },
    })
    expect(await popup.send({ type: 'delete-schedule', id })).toEqual({
      ok: true,
      outcome: { kind: 'missing' },
    })
    expect(storage.writes).toHaveLength(2)
  })

  it('refuses Save schedule and Delete schedule from a content script, without running them', async () => {
    const { store, storage } = await setup('2026-10-05T10:00')

    for (const command of [
      { type: 'save-schedule' as const, schedule: deepWork },
      { type: 'delete-schedule' as const, id: 'work-hours' },
    ]) {
      expect(await store.dispatch(command, tab)).toEqual({
        result: { ok: false, error: { code: 'not-allowed', detail: expect.any(String) } },
        effects: [],
      })
    }
    expect(storage.writes).toEqual([])
  })

  it('a failed schedule write leaves the list as it was', async () => {
    const { store, storage } = await setup('2026-10-05T10:00')
    storage.failNextWrite()

    expect(await store.dispatch({ type: 'delete-schedule', id: 'work-hours' }, page)).toEqual({
      result: { ok: false, error: { code: 'storage-failed', detail: expect.any(String) } },
      effects: [],
    })
    expect(await store.settle()).toContainEqual({ kind: 'badge', show: 'muting' })
    expect((await openReader(storage).read('config')).config.schedules).toEqual([workHours])
  })
})
