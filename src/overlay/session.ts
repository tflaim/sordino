import { matchMutedSite, type MutedList } from '@/shared/muted-sites'
import { decideMuting } from '@/shared/muting'
import { parseState, resolveConfig } from '@/store/docs'
import { legacyCategories } from '@/store/legacy-sites'
import type { Clock, CommandPort, StorageReadPort } from '@/store/ports'

export interface OverlayView {
  siteId: string
  until: number | null
  reason: string
  orphaned: boolean
  stillness: boolean
}

export interface OverlayRenderer {
  cover(): void
  show(view: OverlayView): void
  remove(): void
  dispose(): void
}

export interface SessionEnvironment {
  url(): string
  navigationId(): string
  valid(): boolean
  watch(recheck: () => void): () => void
  at(when: number, callback: () => void): () => void
  leave(list: MutedList): void
  reload(): void
}

/** All ordering, storage races and decision timers are private to this session. */
export function openOverlaySession(deps: {
  storage: StorageReadPort
  commands: CommandPort
  renderer: OverlayRenderer
  clock: Clock
  environment: SessionEnvironment
}) {
  const { storage, commands, renderer, clock, environment } = deps
  const keys = ['config', 'state', 'sordino_settings'] as const
  let stopped = false
  let orphaned = false
  let revision = 0
  let timer: (() => void) | null = null
  let unwatch: (() => void) | null = null
  let unlisten: (() => void) | null = null
  let last: OverlayView | null = null
  let list: MutedList = { categories: [], ownSites: [] }
  let url = environment.url()
  let navigationId = environment.navigationId()
  let recorded = false

  function stopWatching() {
    for (const stop of [timer, unwatch, unlisten]) {
      try {
        stop?.()
      } catch {
        // Invalidated extension APIs can reject even listener removal.
        // Cleanup must never prevent the local fail-closed renderer.
      }
    }
    timer = null
    unwatch = null
    unlisten = null
  }

  function orphan() {
    if (stopped || orphaned) return
    orphaned = true
    revision++
    stopWatching()
    last = {
      ...(last ?? {
        siteId: new URL(url).hostname,
        until: null,
        reason: 'Sordino is restarting.',
        stillness: true,
      }),
      orphaned: true,
    }
    renderer.show(last)
  }

  async function refresh() {
    if (stopped || orphaned) return
    if (!environment.valid()) return orphan()
    const mine = ++revision
    try {
      const raw = await storage.read(keys)
      if (stopped || orphaned || mine !== revision) return
      if (!environment.valid()) return orphan()
      const config = resolveConfig(raw.config, raw.sordino_settings)
      list = { categories: legacyCategories(raw.sordino_settings), ownSites: config.ownSites }
      const site = matchMutedSite(environment.url(), list)
      if (!site) {
        stopWatching()
        renderer.remove()
        // Host-only rules cannot become related through an in-page address change.
        stopped = true
        return
      }
      if (!unwatch) {
        unwatch = storage.watch(keys, () => void refresh())
        unlisten = environment.watch(() => void refresh())
        // Close the first read / subscription gap before revealing the page.
        void refresh()
        return
      }
      const nextUrl = environment.url()
      if (url !== nextUrl) {
        url = nextUrl
        navigationId = environment.navigationId()
        recorded = false
      }
      const state = parseState(raw.state)
      const decision = decideMuting(config.schedules, state.mode, clock())
      timer?.()
      timer =
        decision.nextChange === null
          ? null
          : environment.at(decision.nextChange, () => void refresh())
      if (!decision.muted) {
        last = null
        renderer.remove()
        return
      }
      const settings = raw.config as { stillness?: unknown } | undefined
      last = {
        siteId: site.id,
        until: decision.until,
        reason: decision.source.kind === 'schedule' ? decision.source.name : 'Mute now',
        orphaned: false,
        stillness: settings?.stillness === true,
      }
      renderer.show(last)
      if (!recorded) {
        recorded = true
        const result = await commands.send({ type: 'record-mute', siteId: site.id, navigationId })
        if (!stopped && !orphaned && !result.ok && result.error.code === 'transport-lost') orphan()
      }
    } catch {
      if (!stopped && !orphaned && mine === revision) orphan()
    }
  }

  renderer.cover()
  void refresh()
  return {
    orphan,
    turnBack() {
      if (last && !orphaned && environment.valid()) {
        void commands.send({ type: 'turn-back', siteId: last.siteId, navigationId })
      }
      environment.leave(list)
    },
    bypass() {
      if (!environment.valid()) orphan()
      if (orphaned) environment.reload()
    },
    dispose() {
      stopped = true
      revision++
      stopWatching()
      renderer.dispose()
    },
  }
}
