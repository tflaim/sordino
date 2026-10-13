import { describe, expect, it } from 'vitest'
import early from './fixtures/v1-9e31291.json'
import daily from './fixtures/v1-1fbc6ea.json'
import options from './fixtures/v1-bbea644.json'
import onboarding from './fixtures/v1-372cc65.json'
import { memoryStorage } from './adapters/memory'
import { directCommandPort } from './adapters/direct'
import { openReader } from './reader'
import { openStore } from './store'
import type { ExportFile } from './migrate'
import type { ConfigDoc } from './docs'

const now = new Date('2026-10-05T10:00').getTime()
const clock = () => now
const page = { kind: 'page' } as const
const runtime = {
  version: 2,
  mode: { kind: 'pause', since: now - 1000, until: now + 60_000 },
  bypasses: { 'reddit.com': { since: now - 1000, until: now + 300_000 } },
  budget: { date: '2026-10-05', used: 2 },
}
const usage = { version: 2, days: { '2026-10-05': { mutes: 4, bypasses: 2, pauses: 1 } } }

async function setup(seed: Parameters<typeof memoryStorage>[0] = {}) {
  const storage = memoryStorage(seed)
  const store = await openStore({ storage, clock })
  const reader = openReader(storage)
  const port = directCommandPort(store, page)
  storage.writes.length = 0
  return { storage, store, reader, port }
}

async function exported(
  port: ReturnType<typeof directCommandPort>,
  includeUsage = false
): Promise<ExportFile> {
  const result = await port.send({ type: 'export', includeUsage })
  if (!result.ok) throw new Error(result.error.detail)
  return result.outcome.file
}

// Fixtures are DEFAULT_SETTINGS evaluated from git show <commit>:src/shared/types.ts,
// with Date fixed at 2026-10-05T10:00. Persisted-user variants below retain each
// historical schema; no fixture borrows fields introduced in a later release.
describe('v1 migration and portable settings through the store', () => {
  it.each([
    ['9e31291', early],
    ['1fbc6ea', daily],
    ['bbea644', options],
    ['372cc65', onboarding],
  ])(
    'migrates the real %s schema once and imports it through the same chain',
    async (_, snapshot) => {
      const legacy = {
        ...snapshot,
        customSites: ['Example.ORG/news', 'Reddit.com'],
        categories: snapshot.categories.map((category) =>
          category.id === 'social' ? { ...category, enabled: false } : category
        ),
        ...('maxBypasses' in snapshot ? { maxBypasses: 7, bypassDurationMinutes: 12 } : {}),
      }
      const { storage, port, reader } = await setup({ sordino_settings: legacy })
      const { config, state } = await reader.read('config', 'state')
      expect(config).toMatchObject({
        version: 2,
        firstRunDone: true,
        ownLine: '',
        stillness: false,
        bypassWaitSeconds: 5,
        maxBypasses: 'maxBypasses' in snapshot ? 7 : 3,
        bypassDurationMinutes: 'maxBypasses' in snapshot ? 12 : 5,
        ownSites: [
          { id: 'example.org', rule: { kind: 'host', host: 'example.org' } },
          { id: 'reddit.com', rule: { kind: 'host', host: 'reddit.com' } },
        ],
      })
      expect(config.categories.find((category) => category.id === 'social')?.enabled).toBe(false)
      expect(
        config.schedules.map((schedule) => [
          schedule.id,
          schedule.days,
          schedule.startTime,
          schedule.endTime,
        ])
      ).toEqual(
        snapshot.schedules.map((schedule) => [
          schedule.id,
          schedule.days,
          schedule.startTime,
          schedule.endTime,
        ])
      )
      expect(config.schedules.find((schedule) => schedule.id === 'always-on')?.allDay).toBe(true)
      expect(state).toEqual({ version: 2, mode: null })
      for (const retired of [
        'manualOverride',
        'blockState',
        'bypassState',
        'lastEmergencyRefresh',
        'scaffoldingMode',
        'onboardingDismissed',
      ]) {
        expect(config).not.toHaveProperty(retired)
        expect(state).not.toHaveProperty(retired)
      }
      expect((await storage.read(['sordino_settings'])).sordino_settings).toEqual(legacy)
      await openStore({ storage, clock })
      expect(storage.writes).toEqual([])
      const fresh = await setup()
      expect(await fresh.port.send({ type: 'import', data: JSON.stringify(legacy) })).toEqual({
        ok: true,
        outcome: { kind: 'imported' },
      })
      expect((await fresh.reader.read('config')).config).toEqual(config)
      expect((await exported(port)).config).toEqual(config)
    }
  )

  it('merges category defaults by id without changing saved toggles or disabled sites', async () => {
    const { reader } = await setup({
      sordino_settings: {
        schedules: [],
        categories: [
          {
            id: 'social',
            name: 'My social',
            enabled: true,
            sites: ['reddit.com'],
            disabledSites: ['Reddit.com'],
          },
          { id: 'reading', name: 'Reading', enabled: false, sites: ['example.org'] },
        ],
        customSites: ['Reddit.com', 'example.org'],
      },
    })
    const { config } = await reader.read('config')
    expect(config.categories.map((category) => category.id)).toEqual([
      'social',
      'video',
      'news',
      'reading',
    ])
    expect(config.categories[0]).toEqual({
      id: 'social',
      name: 'My social',
      enabled: true,
      sites: ['reddit.com'],
      disabledSites: ['reddit.com'],
    })
    expect(config.ownSites.map((site) => site.id)).toEqual(['reddit.com', 'example.org'])
    expect(config.schedules).toEqual([])
  })

  it('marks every returning v1 user done even when the old tip was never dismissed', async () => {
    const returning = await setup({
      sordino_settings: { ...onboarding, onboardingDismissed: false },
    })
    expect((await returning.reader.read('config')).config.firstRunDone).toBe(true)
    const fresh = await setup()
    expect((await fresh.reader.read('config')).config.firstRunDone).toBe(false)
  })

  it('exports only config by default, opts into Usage, and never exports runtime', async () => {
    const { storage, port } = await setup({ state: runtime, usage })
    const file = await exported(port)
    expect(Object.keys(file).sort()).toEqual(['config', 'version'])
    const opted = await exported(port, true)
    expect(opted.usage).toEqual(usage)
    expect(opted).not.toHaveProperty('state')
    file.config.categories.length = 0
    expect((await exported(port)).config.categories).toHaveLength(3)
    expect(storage.writes).toEqual([])
  })

  it('round-trips setup, preserves Pause/bypasses/budget, and keeps omitted Usage', async () => {
    const source = await setup({ sordino_settings: onboarding })
    await source.port.send({ type: 'add-muted-site', input: 'example.org' })
    const file = await exported(source.port)
    file.config.ownLine = 'Practice the Bach'
    file.config.stillness = true
    file.config.categories = []
    file.config.schedules = []
    const target = await setup({ state: runtime, usage })
    expect(await target.port.send({ type: 'import', data: JSON.stringify(file) })).toEqual({
      ok: true,
      outcome: { kind: 'imported' },
    })
    expect((await exported(target.port)).config).toEqual(file.config)
    expect(await target.storage.read(['state', 'usage'])).toEqual({ state: runtime, usage })
    expect(target.storage.writes).toEqual([{ config: file.config }])
    await target.port.send({ type: 'import', data: file })
    expect(target.storage.writes).toHaveLength(1)
    await openStore({ storage: target.storage, clock })
    expect(target.storage.writes).toHaveLength(1)
  })

  it('atomically restores opted-in Usage alongside config without touching runtime', async () => {
    const source = await setup({ sordino_settings: options, usage })
    const file = await exported(source.port, true)
    const target = await setup({ state: runtime })
    await target.port.send({ type: 'import', data: file })
    expect(target.storage.writes).toEqual([{ config: file.config, usage }])
    expect((await target.storage.read(['state'])).state).toEqual(runtime)
  })

  it('honors imported categories in store duplicate detection, independently of the v1 key', async () => {
    const { port } = await setup({ sordino_settings: onboarding })
    const file = await exported(port)
    file.config.categories = []
    await port.send({ type: 'import', data: file })
    expect(await port.send({ type: 'add-muted-site', input: 'reddit.com' })).toMatchObject({
      ok: true,
      outcome: { kind: 'added' },
    })
  })

  it('refuses malformed and future files with a reason, leaving every stored key unchanged', async () => {
    const { storage, port } = await setup({ state: runtime, usage, sordino_settings: onboarding })
    const file = await exported(port, true)
    const before = await storage.read(['config', 'state', 'usage', 'sordino_settings'])
    const brokenConfig = (patch: Partial<Record<keyof ConfigDoc, unknown>>) => ({
      ...file,
      config: { ...file.config, ...patch },
    })
    const inputs = [
      '{',
      null,
      [],
      {},
      { unrelated: true },
      { version: 3 },
      { ...file, version: '2' },
      { ...file, config: { ...file.config, version: 3 } },
      { ...file, usage: { version: 3 } },
      { ...file, usage: null },
      { ...file, usage: { version: 2, count: NaN } },
      brokenConfig({ schedules: 'bad' }),
      brokenConfig({
        schedules: [
          { ...file.config.schedules[0], allDay: true, startTime: 'invalid', endTime: 'invalid' },
        ],
      }),
      { schedules: [{ ...onboarding.schedules[0], allDay: true, startTime: 'invalid' }] },
      brokenConfig({ schedules: [{ ...file.config.schedules[0], days: ['nope'] }] }),
      brokenConfig({ schedules: [{ ...file.config.schedules[0], enabled: 'yes' }] }),
      brokenConfig({
        schedules: [{ ...file.config.schedules[0], startTime: '09:00', endTime: '09:00' }],
      }),
      brokenConfig({ schedules: [file.config.schedules[0], file.config.schedules[0]] }),
      brokenConfig({ ownSites: [{ id: 'x', rule: { kind: 'path', host: 'example.org' } }] }),
      brokenConfig({ ownSites: [{ id: 'wrong', rule: { kind: 'host', host: 'example.org' } }] }),
      brokenConfig({ maxBypasses: 0 }),
      brokenConfig({ bypassDurationMinutes: 31 }),
      brokenConfig({ bypassWaitSeconds: 16 }),
      brokenConfig({
        categories: [{ id: 'social', name: 'Social', enabled: true, sites: ['???'] }],
      }),
      brokenConfig({ firstRunDone: null }),
      brokenConfig({ ownLine: 8 }),
      { customSites: ['???'] },
      { categories: 'bad' },
      { schedules: [{}] },
      { maxBypasses: '3' },
    ]
    for (const data of inputs) {
      const result = await port.send({ type: 'import', data })
      expect(result).toMatchObject({
        ok: true,
        outcome: { kind: 'refused', reason: expect.any(String) },
      })
      expect(storage.writes).toEqual([])
      expect(await storage.read(['config', 'state', 'usage', 'sordino_settings'])).toEqual(before)
    }
  })

  it.each(['config', 'state', 'usage', 'sordino_settings'] as const)(
    'refuses future %s storage before any startup writes',
    async (key) => {
      const storage = memoryStorage({ [key]: { version: 3 } })
      await expect(openStore({ storage, clock })).rejects.toThrow('version 3')
      expect(storage.writes).toEqual([])
    }
  )

  it('checks senders and command payloads before exposing data or writing', async () => {
    const { storage, store, port } = await setup()
    const file = await exported(port)
    const tab = { kind: 'tab', tabId: 7, url: 'https://reddit.com' } as const
    for (const command of [
      { type: 'export', includeUsage: true },
      { type: 'import', data: file },
    ] as const) {
      expect(await store.dispatch(command, tab)).toMatchObject({
        result: { ok: false, error: { code: 'not-allowed' } },
        effects: [],
      })
    }
    expect(
      await store.dispatch({ type: 'export', includeUsage: 'yes' } as never, page)
    ).toMatchObject({ result: { ok: false, error: { code: 'invalid-command' } } })
    expect(storage.writes).toEqual([])
  })

  it('does not publish a failed import to readers or subsequent exports, and the queue recovers', async () => {
    const { storage, port, reader } = await setup({ state: runtime })
    const file = await exported(port)
    const changed = structuredClone(file)
    changed.config.ownLine = 'Read'
    storage.failNextWrite()
    expect(await port.send({ type: 'import', data: changed })).toMatchObject({
      ok: false,
      error: { code: 'storage-failed' },
    })
    expect((await reader.read('config')).config).toEqual(file.config)
    expect(await exported(port)).toEqual(file)
    expect(await port.send({ type: 'import', data: changed })).toMatchObject({
      ok: true,
      outcome: { kind: 'imported' },
    })
  })

  it('serializes an import after a concurrent Pause without replacing its runtime', async () => {
    const { storage, port } = await setup({ state: runtime })
    const file = await exported(port)
    file.config.ownLine = 'Read'
    const release = storage.holdWrites()
    const pause = port.send({ type: 'pause', length: '1h' })
    const imported = port.send({ type: 'import', data: file })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(storage.writes).toHaveLength(1)
    release()
    expect(await pause).toMatchObject({
      ok: true,
      outcome: { kind: 'paused', until: now + 3_600_000 },
    })
    expect(await imported).toMatchObject({ ok: true, outcome: { kind: 'imported' } })
    expect(storage.writes).toHaveLength(2)
    expect(storage.writes[1]).toEqual({ config: file.config })
    await openStore({ storage, clock })
    expect((await storage.read(['state'])).state).toEqual({
      ...runtime,
      mode: { kind: 'pause', since: now, until: now + 3_600_000 },
    })
  })

  it('keeps additive runtime fields across ordinary state commands and reopening', async () => {
    const { storage, port } = await setup({ state: runtime })
    await port.send({ type: 'mute-now', length: '1h' })
    const before = await storage.read(['state'])
    expect(before.state).toMatchObject({ bypasses: runtime.bypasses, budget: runtime.budget })
    await openStore({ storage, clock })
    expect(await storage.read(['state'])).toEqual(before)
  })
})
