import { describe, expect, it } from 'vitest'
import { directCommandPort } from './adapters/direct'
import { memoryStorage } from './adapters/memory'
import { openReader } from './reader'
import { openStore } from './store'
import type { Sender } from './commands'
import type { Schedule } from '@/shared/types'

// vitest.config.ts pins TZ=Europe/London. 2026-10-05 is a Monday.
const at = (local: string) => new Date(local).getTime()

function fixedClock(local: string) {
  let t = at(local)
  return {
    now: () => t,
    advance: (ms: number) => void (t += ms),
  }
}

const workHours: Schedule = {
  id: 'work-hours',
  name: 'Work hours',
  enabled: true,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  startTime: '09:00',
  endTime: '17:00',
}
// Until schedules move into `config` (#7), the store reads them from the 1.x key.
const legacy = { sordino_settings: { schedules: [workHours] } }

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
      { config: { version: 2 }, state: { version: 2, mode: null }, usage: { version: 2 } },
    ])

    await openStore({ storage, clock: clock.now })
    expect(storage.writes).toHaveLength(1)
  })

  it('a malformed stored state is repaired to defaults on open', async () => {
    const storage = memoryStorage({ ...legacy, state: { version: 2, mode: { kind: 'forever' } } })

    await openStore({ storage, clock: fixedClock('2026-10-05T10:00').now })
    expect(storage.writes).toEqual([
      { config: { version: 2 }, state: { version: 2, mode: null }, usage: { version: 2 } },
    ])
  })
})
