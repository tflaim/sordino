import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryStorage } from '@/store/adapters/memory'
import { directCommandPort } from '@/store/adapters/direct'
import { openReader } from '@/store/reader'
import { openStore } from '@/store/store'
import { SUGGESTED_SCHEDULES, toScheduleDraft } from './schedule'
import { DEFAULT_SETTINGS } from './types'
import { getSettings, updateSettings, subscribeToSettings } from './storage'

const transport = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/store/adapters/runtime', () => ({ runtimeCommandPort: () => transport }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  transport.send.mockReset()
})

async function setup(legacy = false) {
  const storage = memoryStorage(legacy ? { sordino_settings: DEFAULT_SETTINGS } : {})
  const store = await openStore({ storage, clock: () => new Date('2026-10-05T10:00').getTime() })
  const direct = directCommandPort(store, { kind: 'page' })
  transport.send.mockImplementation(direct.send)
  const listeners = new Set<
    (changes: Record<string, { newValue: unknown }>, area: string) => void
  >()
  storage.watch(['config', 'sordino_settings'], (changed) => {
    for (const listener of listeners)
      listener(
        Object.fromEntries(Object.entries(changed).map(([key, newValue]) => [key, { newValue }])),
        'local'
      )
  })
  const legacyWrites: unknown[] = []
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: (keys: ('config' | 'sordino_settings')[]) => storage.read(keys),
        set: async (values: { sordino_settings: unknown }) => {
          legacyWrites.push(values)
          storage.seed(values)
        },
      },
      onChanged: {
        addListener: (
          listener: (changes: Record<string, { newValue: unknown }>, area: string) => void
        ) => listeners.add(listener),
        removeListener: (
          listener: (changes: Record<string, { newValue: unknown }>, area: string) => void
        ) => listeners.delete(listener),
      },
    },
  })
  if (!legacy)
    await direct.send({
      type: 'start',
      categoryIds: ['news'],
      schedule: toScheduleDraft(SUGGESTED_SCHEDULES[0]!),
      maxBypasses: 7,
      bypassWaitSeconds: 9,
    })
  return { storage, store, direct, reader: openReader(storage), legacyWrites }
}

describe('First run compatibility with existing Settings', () => {
  it('reads Start choices and routes intentional edits through the real store', async () => {
    const { reader, legacyWrites, storage } = await setup()
    expect((await getSettings()).categories.filter((c) => c.enabled).map((c) => c.id)).toEqual([
      'news',
    ])
    expect((await getSettings()).maxBypasses).toBe(7)
    expect((await storage.read(['sordino_settings'])).sordino_settings).toBeUndefined()
    const updated = await updateSettings((settings) => ({
      ...settings,
      maxBypasses: 2,
      categories: settings.categories.map((category) =>
        category.id === 'news' ? { ...category, enabled: false } : category
      ),
    }))
    expect(updated.maxBypasses).toBe(2)
    const { config } = await reader.read('config')
    expect(config).toMatchObject({ firstRunDone: true, maxBypasses: 2, bypassWaitSeconds: 9 })
    expect(config.categories?.every((c) => !c.enabled)).toBe(true)
    expect(transport.send.mock.calls.map(([command]) => command.type)).toEqual([
      'set-category',
      'set-bypass-budget',
    ])
    // The UI's storage adapter never writes config; those writes went through dispatch.
    expect(legacyWrites).toHaveLength(1)
    expect(Object.keys(legacyWrites[0]!)).toEqual(['sordino_settings'])
  })

  it('does not undo another category changed after the updater read', async () => {
    const { direct, reader } = await setup()
    const original = transport.send.getMockImplementation()!
    let intervened = false
    transport.send.mockImplementation(async (command) => {
      if (!intervened) {
        intervened = true
        await direct.send({ type: 'set-category', id: 'video', enabled: true, disabledSites: [] })
      }
      return original(command)
    })
    await updateSettings((settings) => ({
      ...settings,
      categories: settings.categories.map((category) =>
        category.id === 'news' ? { ...category, enabled: false } : category
      ),
    }))
    expect(
      (await reader.read('config')).config.categories?.filter((c) => c.enabled).map((c) => c.id)
    ).toEqual(['video'])
    expect((await getSettings()).categories.filter((c) => c.enabled).map((c) => c.id)).toEqual([
      'video',
    ])
  })

  it('updates subscribers when a config command changes a choice', async () => {
    const { direct } = await setup()
    const callback = vi.fn()
    const stop = subscribeToSettings(callback)
    await direct.send({ type: 'set-bypass-budget', maxBypasses: 4 })
    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ maxBypasses: 4 }))
    )
    stop()
    callback.mockClear()
    await direct.send({ type: 'set-bypass-budget', maxBypasses: 5 })
    await Promise.resolve()
    expect(callback).not.toHaveBeenCalled()
  })

  it('keeps legacy ownership for existing users and reports a failed config edit without legacy writes', async () => {
    await setup(true)
    await updateSettings((settings) => ({ ...settings, maxBypasses: 2 }))
    expect((await getSettings()).maxBypasses).toBe(2)
    expect(transport.send).not.toHaveBeenCalled()
    const { storage, reader, legacyWrites } = await setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    storage.failNextWrite()
    await updateSettings((settings) => ({ ...settings, maxBypasses: 3 }))
    expect((await reader.read('config')).config.maxBypasses).toBe(7)
    expect(legacyWrites).toHaveLength(0)
  })
})
