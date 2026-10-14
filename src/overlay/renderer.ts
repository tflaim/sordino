import { clockTime } from '@/shared/status'
import type { OverlayRenderer, OverlayView } from './session'

// Same Stagewood/cream/brass tokens as DESIGN.md, isolated from the page cascade.
const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
dialog { margin: 0; border: 0; padding: 0; max-width: none; max-height: none;
  width: 100vw; height: 100dvh; position: fixed; inset: 0; overflow: auto;
  background: #1c1917; color: #eae2d7; font: 16px/1.5 system-ui, sans-serif;
  visibility: visible; }
dialog[open] { display: flex; flex-direction: column; }
dialog::backdrop { background: #1c1917; }
header { padding: 32px 40px; font-size: 18px; }
main { flex: 1; display: flex; flex-direction: column; justify-content: center;
  width: 100%; max-width: 900px; margin: auto; padding: 48px 40px; }
h1 { margin: 0; font: 500 48px/1.2 Georgia, serif; overflow-wrap: anywhere; }
#reason { margin: 20px 0 0; color: #bcb0a0; font-size: 18px; }
#line { margin: 48px 0 0; min-height: 72px; color: #bcb0a0; font: 28px/1.4 Georgia, serif; }
footer { border-top: 1px solid #4c4033; padding: 24px 40px; background: #28231f; }
.actions { display: flex; align-items: center; gap: 16px; max-width: 820px; margin: auto; flex-wrap: wrap; }
button { appearance: none; font: 500 16px/1.5 system-ui, sans-serif;
  min-height: 48px; padding: 12px 24px; border-radius: 12px; cursor: pointer;
  color: #eae2d7; border: 1px solid #4c4033; background: transparent; }
#turn-back { background: #cca766; color: #1c1917; border-color: #cca766; }
button:focus-visible { outline: 2px solid #cca766; outline-offset: 4px; }
button:disabled { color: #bcb0a0; cursor: default; }
#explanation { flex: 1; font-size: 14px; color: #bcb0a0; margin: 0; }
@media(max-width: 600px) { header { padding: 24px; } main { padding: 32px 24px; }
  h1 { font-size: 34px; } footer { padding: 24px; } #explanation { flex-basis: 100%; } }
`

/** Owns top-layer placement, recovery, trusted actions, focus and page media. */
export function createOverlayRenderer(actions: {
  turnBack(): void
  bypass(): void
}): OverlayRenderer {
  const host = document.createElement('div')
  host.id = 'sordino-overlay'
  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = CSS
  const dialog = document.createElement('dialog')
  dialog.setAttribute('aria-labelledby', 'headline')
  dialog.setAttribute('aria-describedby', 'reason explanation')
  const header = document.createElement('header')
  header.textContent = 'Sordino'
  const main = document.createElement('main')
  const headline = document.createElement('h1')
  headline.id = 'headline'
  headline.setAttribute('aria-live', 'polite')
  const reason = document.createElement('p')
  reason.id = 'reason'
  const line = document.createElement('p')
  line.id = 'line'
  // Verified repertoire / own line arrives in #13. Keep that space static here.
  line.setAttribute('aria-hidden', 'true')
  main.append(headline, reason, line)
  const footer = document.createElement('footer')
  const bar = document.createElement('div')
  bar.className = 'actions'
  const turnBack = document.createElement('button')
  turnBack.id = 'turn-back'
  turnBack.type = 'button'
  turnBack.textContent = 'Turn back'
  turnBack.autofocus = true
  const bypass = document.createElement('button')
  bypass.id = 'sordino-bypass'
  bypass.type = 'button'
  const explanation = document.createElement('p')
  explanation.id = 'explanation'
  explanation.setAttribute('aria-live', 'polite')
  bar.append(turnBack, bypass, explanation)
  footer.append(bar)
  dialog.append(header, main, footer)
  shadow.append(style, dialog)
  const coverStyle = document.createElement('style')
  coverStyle.id = 'sordino-cover'
  coverStyle.textContent = 'html { visibility: hidden !important; background: #1c1917 !important; }'
  let visible = false
  let loading = false
  let observer: MutationObserver | null = null
  let stillness = false
  const media = new Map<HTMLMediaElement, { volume: number; frame: number; timeout: number }>()

  function resetHost() {
    const properties = {
      display: 'block',
      position: 'fixed',
      inset: '0px',
      width: '100vw',
      height: '100vh',
      visibility: 'visible',
      opacity: '1',
      transform: 'none',
      'pointer-events': 'auto',
      'z-index': '2147483647',
      'font-size': '16px',
      'color-scheme': 'dark',
    }
    for (const [key, value] of Object.entries(properties))
      host.style.setProperty(key, value, 'important')
  }

  function attach() {
    if (!visible || !document.documentElement) return
    if (!host.isConnected) {
      resetHost()
      document.documentElement.append(host)
      // Detachment removes native modality without clearing the open attribute.
      // Re-enter the top layer instead of merely reattaching an open dialog.
      if (dialog.open) dialog.close()
    }
    if (loading && !coverStyle.isConnected) document.documentElement.append(coverStyle)
    if (!dialog.open) {
      dialog.showModal()
      turnBack.focus({ preventScroll: true })
    }
  }

  function suppress(element: HTMLMediaElement) {
    if (element.paused || media.has(element)) return
    const entry = { volume: element.volume, frame: 0, timeout: 0 }
    media.set(element, entry)
    const pause = () => {
      cancelAnimationFrame(entry.frame)
      clearTimeout(entry.timeout)
      element.volume = 0
      element.pause()
    }
    if (stillness || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return pause()
    const start = performance.now()
    function fade(now: number) {
      element.volume = entry.volume * Math.max(0, 1 - (now - start) / 800)
      if (now - start >= 800) pause()
      else entry.frame = requestAnimationFrame(fade)
    }
    entry.frame = requestAnimationFrame(fade)
    // rAF may be suspended in a background tab; the finite fade must still finish.
    entry.timeout = window.setTimeout(pause, 800)
  }

  function scanMedia() {
    document.querySelectorAll<HTMLMediaElement>('audio,video').forEach((element) => {
      const entry = media.get(element)
      if (entry && !element.paused && element.volume === 0) element.pause()
      else suppress(element)
    })
  }

  function onPlay(event: Event) {
    if (loading) return
    if (!(event.target instanceof HTMLMediaElement)) return
    const entry = media.get(event.target)
    if (entry) {
      event.target.volume = 0
      event.target.pause()
    } else suppress(event.target)
  }

  function reorder() {
    if (!visible) return
    dialog.close()
    attach()
  }

  function start() {
    if (visible) return
    visible = true
    observer = new MutationObserver(() => {
      attach()
      if (!loading) scanMedia()
    })
    observer.observe(document, { childList: true, subtree: true })
    document.addEventListener('fullscreenchange', reorder)
    document.addEventListener('play', onPlay, true)
    attach()
  }

  function remove() {
    visible = false
    loading = false
    observer?.disconnect()
    observer = null
    document.removeEventListener('fullscreenchange', reorder)
    document.removeEventListener('play', onPlay, true)
    for (const [element, entry] of media) {
      cancelAnimationFrame(entry.frame)
      clearTimeout(entry.timeout)
      element.volume = entry.volume
    }
    media.clear()
    dialog.close()
    host.remove()
    coverStyle.remove()
  }

  turnBack.addEventListener('click', (event) => {
    if (event.isTrusted) actions.turnBack()
  })
  bypass.addEventListener('click', (event) => {
    if (event.isTrusted) actions.bypass()
  })
  dialog.addEventListener('cancel', (event) => event.preventDefault())
  dialog.addEventListener('close', () => {
    if (visible) attach()
  })
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    if (bypass.disabled) turnBack.focus()
    else (shadow.activeElement === turnBack ? bypass : turnBack).focus()
  })

  return {
    cover() {
      loading = true
      headline.textContent = 'Checking this site…'
      bypass.disabled = true
      start()
    },
    show(view: OverlayView) {
      loading = false
      stillness = view.stillness
      const title = `${view.siteId} is muted${view.until === null ? '' : ` until ${clockTime(view.until)}`}.`
      if (headline.textContent !== title) headline.textContent = title
      if (reason.textContent !== view.reason) reason.textContent = view.reason
      bypass.disabled = !view.orphaned
      bypass.textContent = view.orphaned ? 'Reload to bypass' : 'Bypass'
      explanation.textContent = view.orphaned
        ? 'Sordino is restarting. Reload this page to bypass.'
        : 'Turn back to leave this site.'
      start()
      attach()
      coverStyle.remove()
      scanMedia()
    },
    remove,
    dispose: remove,
  }
}
