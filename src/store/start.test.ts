import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from '@/shared/types'
import { toScheduleDraft, SUGGESTED_SCHEDULES } from '@/shared/schedule'
import { memoryStorage } from './adapters/memory'
import { directCommandPort } from './adapters/direct'
import { openReader } from './reader'
import { openStore } from './store'
import type { Command } from './commands'

const now = () => new Date('2026-10-05T10:00:00').getTime()
const choices = {
  type: 'start',
  categoryIds: ['social', 'video'],
  schedule: toScheduleDraft(SUGGESTED_SCHEDULES[0]!),
  maxBypasses: 3,
  bypassWaitSeconds: 5,
} as const satisfies Command

async function fresh() {
  const storage = memoryStorage()
  const store = await openStore({ storage, clock: now })
  const commands = directCommandPort(store, { kind: 'page' })
  const reader = openReader(storage)
  storage.writes.length = 0
  return { storage, store, commands, reader }
}

describe('First run through the store', () => {
  it('stays unmuted on fresh reads, commands and restart until Start', async () => {
    const { storage, store, commands, reader } = await fresh()
    expect((await reader.read('config')).config).toEqual({
      version: 2,
      firstRunDone: false,
      schedules: [],
      ownSites: [],
    })
    expect(await store.settle()).toEqual([
      { kind: 'badge', show: 'off' },
      { kind: 'alarms', at: [] },
    ])
    for (const command of [
      { type: 'mute-now', length: '1h' },
      { type: 'pause', length: '1h' },
      { type: 'save-schedule', schedule: choices.schedule },
    ] as Command[]) {
      expect(await commands.send(command)).toMatchObject({
        ok: false,
        error: { code: 'not-allowed' },
      })
    }
    await commands.send({ type: 'add-muted-site', input: 'example.org' })
    // onInstalled's legacy compatibility initialization cannot count as consent.
    storage.seed({ sordino_settings: { categories: DEFAULT_CATEGORIES } })
    const reopened = await openStore({ storage, clock: now })
    expect(await reopened.settle()).toEqual([
      { kind: 'badge', show: 'off' },
      { kind: 'alarms', at: [] },
    ])
    expect((await reader.read('config')).config.firstRunDone).toBe(false)
  })

  it('commits the chosen defaults in one write and creates ordinary editable schedules', async () => {
    const { storage, store, commands, reader } = await fresh()
    const start = {
      ...choices,
      categoryIds: ['news'],
      maxBypasses: 7,
      bypassWaitSeconds: 0,
      schedule: { ...choices.schedule, startTime: '08:00', endTime: '12:00' },
    }
    expect(await commands.send(start)).toEqual({ ok: true, outcome: { kind: 'started' } })
    expect(storage.writes).toHaveLength(1)
    expect(Object.keys(storage.writes[0]!)).toEqual(['config'])
    const { config } = await reader.read('config')
    expect(config).toMatchObject({ firstRunDone: true, maxBypasses: 7, bypassWaitSeconds: 0 })
    expect(config.categories?.filter((c) => c.enabled).map((c) => c.id)).toEqual(['news'])
    expect(config.schedules).toEqual([
      { ...SUGGESTED_SCHEDULES[0], startTime: '08:00', endTime: '12:00' },
      ...SUGGESTED_SCHEDULES.slice(1),
    ])
    expect(await store.settle()).toEqual([
      { kind: 'badge', show: 'muting' },
      {
        kind: 'alarms',
        at: [{ name: 'muting-change', when: new Date('2026-10-05T12:00:00').getTime() }],
      },
    ])
    await commands.send({ type: 'delete-schedule', id: 'work-hours' })
    const before = await storage.read(['config', 'state', 'usage'])
    expect(await commands.send(choices)).toEqual({ ok: true, outcome: { kind: 'already-started' } })
    expect(await storage.read(['config', 'state', 'usage'])).toEqual(before)
    const reopened = await openStore({ storage, clock: now })
    expect(await directCommandPort(reopened, { kind: 'page' }).send(choices)).toEqual({
      ok: true,
      outcome: { kind: 'already-started' },
    })
    expect((await reader.read('config')).config.schedules.map((s) => s.id)).not.toContain(
      'work-hours'
    )
  })

  it('validates everything before consent and leaves failed writes inactive', async () => {
    const { storage, store, commands, reader } = await fresh()
    expect(
      await commands.send({ ...choices, schedule: { ...choices.schedule, endTime: '09:00' } })
    ).toEqual({
      ok: true,
      outcome: { kind: 'refused', reasons: ['start-equals-end'] },
    })
    for (const invalid of [
      { ...choices, categoryIds: [] },
      { ...choices, categoryIds: ['made-up'] },
      { ...choices, maxBypasses: 11 },
      { ...choices, bypassWaitSeconds: 16 },
      { ...choices, bypassWaitSeconds: 0.5 },
      { ...choices, schedule: null },
    ])
      expect(await commands.send(invalid as never)).toMatchObject({
        ok: false,
        error: { code: 'invalid-command' },
      })
    expect(storage.writes).toEqual([])
    storage.failNextWrite()
    expect(await commands.send(choices)).toMatchObject({
      ok: false,
      error: { code: 'storage-failed' },
    })
    expect((await reader.read('config')).config.firstRunDone).toBe(false)
    expect(await store.settle()).toContainEqual({ kind: 'badge', show: 'off' })
    expect(await commands.send(choices)).toEqual({ ok: true, outcome: { kind: 'started' } })
  })

  it('refuses Start from a site and serializes simultaneous welcome tabs', async () => {
    const { storage, store, reader } = await fresh()
    expect(
      await store.dispatch(choices, { kind: 'tab', tabId: 1, url: 'https://reddit.com' })
    ).toMatchObject({
      result: { ok: false, error: { code: 'not-allowed' } },
      effects: [],
    })
    const results = await Promise.all([
      store.dispatch(choices, { kind: 'page' }),
      store.dispatch({ ...choices, maxBypasses: 9 }, { kind: 'page' }),
    ])
    expect(results.map((r) => r.result)).toEqual([
      { ok: true, outcome: { kind: 'started' } },
      { ok: true, outcome: { kind: 'already-started' } },
    ])
    expect(storage.writes).toHaveLength(1)
    expect((await reader.read('config')).config.maxBypasses).toBe(3)
  })

  it.each([
    { sordino_settings: { schedules: SUGGESTED_SCHEDULES, maxBypasses: 8 } },
    { config: { version: 2, schedules: SUGGESTED_SCHEDULES, ownSites: [] } },
  ])('keeps returning users completed and their schedules intact', async (seed) => {
    const storage = memoryStorage(seed)
    const store = await openStore({ storage, clock: now })
    const before = await storage.read(['config'])
    expect((await openReader(storage).read('config')).config.firstRunDone).toBe(true)
    expect(await directCommandPort(store, { kind: 'page' }).send(choices)).toEqual({
      ok: true,
      outcome: { kind: 'already-started' },
    })
    expect(await storage.read(['config'])).toEqual(before)
    expect(await store.settle()).toContainEqual({ kind: 'badge', show: 'muting' })
  })
})
