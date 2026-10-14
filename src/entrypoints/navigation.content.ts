import { defineContentScript } from 'wxt/utils/define-content-script'

// Browsers without Navigation API do not emit an event for quiet history calls.
// No timers/listeners here; the isolated session subscribes only on matched sites.
export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    if ('navigation' in window) return
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = history[method].bind(history)
      history[method] = (...args: Parameters<History['pushState']>) => {
        original(...args)
        window.dispatchEvent(new Event('sordino:address-change'))
      }
    }
  },
})
