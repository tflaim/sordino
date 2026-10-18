import { defineContentScript } from 'wxt/utils/define-content-script'
import { matchMutedSite, type MutedList } from '@/shared/muted-sites'
import { chromeStorageReader } from '@/store/adapters/chrome-storage-reader'
import { runtimeCommandPort } from '@/store/adapters/runtime'
import { createOverlayRenderer } from '@/overlay/renderer'
import { openOverlaySession } from '@/overlay/session'

function leave(list: MutedList) {
  const candidates = [
    document.referrer,
    'https://www.google.com/',
    'https://www.wikipedia.org/',
    'https://example.org/',
  ]
  const safe = candidates.find((url) => {
    try {
      return /^https?:$/.test(new URL(url).protocol) && !matchMutedSite(url, list)
    } catch {
      return false
    }
  })
  // Even a user muting all suggested exits can leave; never cycle through another overlay.
  location.replace(safe ?? 'about:blank')
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  main(ctx) {
    const renderer = createOverlayRenderer({
      turnBack: () => session.turnBack(),
      bypass: () => session.bypass(),
    })
    const session = openOverlaySession({
      storage: chromeStorageReader(),
      commands: runtimeCommandPort(),
      renderer,
      clock: Date.now,
      environment: {
        url: () => location.href,
        navigationId: () => crypto.randomUUID(),
        valid: () => {
          try {
            return !!chrome.runtime?.id
          } catch {
            return false
          }
        },
        leave,
        reload: () => location.reload(),
        at(when, callback) {
          const id = window.setTimeout(
            callback,
            Math.min(2_147_483_647, Math.max(0, when - Date.now()))
          )
          return () => clearTimeout(id)
        },
        watch(recheck) {
          const navigation = (window as Window & { navigation?: EventTarget }).navigation
          const events = ['popstate', 'hashchange', 'sordino:address-change', 'pageshow', 'focus']
          for (const event of events) window.addEventListener(event, recheck)
          navigation?.addEventListener('currententrychange', recheck)
          document.addEventListener('visibilitychange', recheck)
          return () => {
            for (const event of events) window.removeEventListener(event, recheck)
            navigation?.removeEventListener('currententrychange', recheck)
            document.removeEventListener('visibilitychange', recheck)
          }
        },
      },
    })
    // Losing extension context keeps the modal and its local escape action alive.
    ctx.onInvalidated(() => session.orphan())
  },
})
