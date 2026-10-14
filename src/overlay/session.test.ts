import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryStorage } from '@/store/adapters/memory'
import type { Command } from '@/store/commands'
import type { StorageReadPort } from '@/store/ports'
import { openOverlaySession, type OverlayView } from './session'

const now = new Date('2026-10-05T10:00').getTime()
const muted = { version: 2, mode: { kind: 'mute-now', since: now, until: now + 60_000 } }
const seed = { config: { version: 2, schedules: [], ownSites: [] }, state: muted }
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

function setup(
  source: StorageReadPort = memoryStorage(seed),
  initialUrl = 'https://www.reddit.com/'
) {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  let url = initialUrl
  let valid = true
  let onAddress: (() => void) | null = null
  let view: OverlayView | null = null
  let covers = 0
  let watches = 0
  const commands: Command[] = []
  const leave = vi.fn()
  const reload = vi.fn()
  const watched: StorageReadPort = {
    read: source.read,
    watch(keys, fn) {
      watches++
      const stop = source.watch(keys, fn)
      return () => {
        watches--
        stop()
      }
    },
  }
  const session = openOverlaySession({
    storage: watched,
    commands: {
      async send(command) {
        commands.push(command)
        return {
          ok: false,
          error: { code: valid ? 'not-allowed' : 'transport-lost', detail: 'test' },
        }
      },
    },
    renderer: {
      cover() {
        covers++
      },
      show(next) {
        view = next
      },
      remove() {
        view = null
      },
      dispose() {
        view = null
      },
    },
    clock: Date.now,
    environment: {
      url: () => url,
      valid: () => valid,
      navigationId: () => crypto.randomUUID(),
      leave,
      reload,
      watch(fn) {
        onAddress = fn
        return () => {
          onAddress = null
        }
      },
      at(when, fn) {
        const id = setTimeout(fn, when - Date.now())
        return () => clearTimeout(id)
      },
    },
  })
  return {
    session,
    commands,
    leave,
    reload,
    get view() {
      return view
    },
    get covers() {
      return covers
    },
    get watches() {
      return watches
    },
    navigate(next: string) {
      url = next
      onAddress?.()
    },
    invalidate() {
      valid = false
      onAddress?.()
    },
  }
}

afterEach(() => vi.useRealTimers())

describe('Overlay session', () => {
  it('covers synchronously, then leaves unrelated pages without timers or subscriptions', async () => {
    const s = setup(undefined, 'https://reddit.com.example.org/')
    expect(s.covers).toBe(1)
    await flush()
    expect(s.view).toBeNull()
    expect(s.watches).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(s.commands).toEqual([])
  })

  it('records once per address navigation, not for updates or Pause/resume', async () => {
    const storage = memoryStorage(seed)
    const s = setup(storage)
    await flush()
    expect(s.view?.reason).toBe('Mute now')
    expect(s.commands).toHaveLength(1)
    storage.seed({
      state: { version: 2, mode: { kind: 'pause', since: now, until: now + 20_000 } },
    })
    await flush()
    expect(s.view).toBeNull()
    storage.seed({ state: muted })
    await flush()
    expect(s.commands).toHaveLength(1)
    s.navigate('https://www.reddit.com/r/music')
    await flush()
    expect(s.commands).toHaveLength(2)
    expect(s.commands[0]).toMatchObject({ type: 'record-mute', siteId: 'reddit.com' })
    expect(s.commands[1]).not.toEqual(s.commands[0])
    s.session.turnBack()
    expect(s.leave).toHaveBeenCalledOnce()
    expect(s.commands[2]).toMatchObject({
      type: 'turn-back',
      navigationId: 'navigationId' in s.commands[1]! ? s.commands[1].navigationId : '',
    })
    s.session.dispose()
  })

  it('arms exactly one decision boundary and removes the overlay when Mute now ends', async () => {
    const s = setup()
    await flush()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(60_000)
    await flush()
    expect(s.view).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    s.session.dispose()
  })

  it('fails closed on invalidation, keeps Turn back, and offers reload', async () => {
    const s = setup()
    await flush()
    s.invalidate()
    expect(s.view?.orphaned).toBe(true)
    expect(s.watches).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(s.view?.orphaned).toBe(true)
    s.session.bypass()
    expect(s.reload).toHaveBeenCalledOnce()
    s.session.turnBack()
    expect(s.leave).toHaveBeenCalledOnce()
    expect(s.commands).toHaveLength(1)
    s.session.dispose()
  })

  it('a pending read cannot undo terminal orphaning', async () => {
    let resolve!: (raw: typeof seed) => void
    const storage: StorageReadPort = {
      read: () =>
        new Promise((r) => {
          resolve = r
        }),
      watch: () => () => {},
    }
    const s = setup(storage)
    s.session.orphan()
    resolve(seed)
    await flush()
    expect(s.view?.orphaned).toBe(true)
    expect(s.commands).toEqual([])
    s.session.dispose()
  })

  it('keeps the orphaned escape route when invalidated storage refuses listener cleanup', async () => {
    const source = memoryStorage(seed)
    const s = setup({
      ...source,
      watch: () => () => {
        throw new Error('Extension context invalidated')
      },
    })
    await flush()
    s.invalidate()
    expect(s.view?.orphaned).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    s.session.turnBack()
    expect(s.leave).toHaveBeenCalledOnce()
    s.session.dispose()
  })

  it('replaces a stale subscribed read when storage changes while it is pending', async () => {
    const source = memoryStorage(seed)
    let reads = 0
    let resolve!: (raw: typeof seed) => void
    const storage: StorageReadPort = {
      ...source,
      read: (keys) =>
        ++reads === 2
          ? new Promise((r) => {
              resolve = r
            })
          : source.read(keys),
    }
    const s = setup(storage)
    await flush()
    source.seed({ state: { version: 2, mode: { kind: 'pause', since: now, until: now + 20_000 } } })
    await flush()
    resolve(seed)
    await flush()
    expect(s.view).toBeNull()
    expect(s.commands).toEqual([])
    s.session.dispose()
  })
})
