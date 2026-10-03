import { defineContentScript } from 'wxt/utils/define-content-script'
import logoDataUri from '@/assets/logo.png?inline'
import { FOCUS_QUOTES } from '@/shared/quotes'
import { getRandomSnarkyTitle } from '@/shared/snarky-titles'
import { CONFIRM_RESET_MS } from '@/shared/types'

interface BlockStatus {
  isBlocked: boolean
  reason?: string
  timeRemaining?: string
  bypassesRemaining?: number
  bypassDuration?: number // minutes
  scaffoldingMode?: boolean // when true, bypass button requires a second-click confirm
}

let overlayElement: HTMLElement | null = null
let isChecking = false
let bypassCountdownInterval: number | null = null
let quoteRotationInterval: number | null = null
let currentQuoteIndex: number = -1
const shownBypassNotifications = new Set<number>() // Track which bypass time thresholds we've shown
const shownPauseNotifications = new Set<number>() // Track which pause time thresholds we've shown

// Defense-in-depth text sanitizer. While we use textContent for output (which auto-escapes),
// this provides an extra safety layer in case code changes later to use innerHTML.
function ensureTextOnly(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.textContent || ''
}

async function checkBlockStatus(): Promise<BlockStatus> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: 'GET_BLOCK_STATUS', url: window.location.href },
        (response: BlockStatus) => {
          // Check for extension context invalidation
          if (chrome.runtime.lastError) {
            console.warn('Sordino: Extension context error', chrome.runtime.lastError.message)
            resolve({ isBlocked: false })
            return
          }
          resolve(response || { isBlocked: false })
        }
      )
    } catch (error) {
      console.warn('Sordino: Failed to check block status', error)
      resolve({ isBlocked: false })
    }
  })
}

async function useBypass(): Promise<{ success: boolean; remaining: number }> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'USE_BYPASS', site: window.location.href }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Sordino: Extension context error', chrome.runtime.lastError.message)
          resolve({ success: false, remaining: 0 })
          return
        }
        resolve(response || { success: false, remaining: 0 })
      })
    } catch (error) {
      console.warn('Sordino: Failed to use bypass', error)
      resolve({ success: false, remaining: 0 })
    }
  })
}

function getSiteFromUrl(): string {
  try {
    return new URL(window.location.href).hostname.replace(/^www\./, '')
  } catch {
    return window.location.hostname
  }
}

// Get a random quote index, avoiding the current one
function getNextQuoteIndex(): number {
  let newIndex: number
  do {
    newIndex = Math.floor(Math.random() * FOCUS_QUOTES.length)
  } while (newIndex === currentQuoteIndex && FOCUS_QUOTES.length > 1)
  return newIndex
}

// Rotate to the next quote with animation
function rotateQuote(): void {
  const container = document.getElementById('sordino-quote-container')
  const textEl = document.getElementById('sordino-quote-text')
  const authorEl = document.getElementById('sordino-quote-author')

  if (!container || !textEl || !authorEl) return

  // Reduced-motion: swap text synchronously, skip fade orchestration so
  // users never see a blank-then-snap flash.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) {
    currentQuoteIndex = getNextQuoteIndex()
    const newQuote = FOCUS_QUOTES[currentQuoteIndex]!
    textEl.textContent = `"${ensureTextOnly(newQuote.text)}"`
    authorEl.textContent = `— ${ensureTextOnly(newQuote.author)}`
    return
  }

  // Start fade out
  container.classList.add('sordino-quote-fading')
  container.classList.remove('sordino-quote-entering')

  // After fade out, update content and fade in
  setTimeout(() => {
    // Guard: overlay may have been removed during fade-out
    if (!document.getElementById('sordino-quote-container')) return

    currentQuoteIndex = getNextQuoteIndex()
    const newQuote = FOCUS_QUOTES[currentQuoteIndex]!
    textEl.textContent = `"${ensureTextOnly(newQuote.text)}"`
    authorEl.textContent = `— ${ensureTextOnly(newQuote.author)}`

    container.classList.remove('sordino-quote-fading')
    container.classList.add('sordino-quote-entering')

    // Clean up entering class after animation
    setTimeout(() => {
      if (!document.getElementById('sordino-quote-container')) return
      container.classList.remove('sordino-quote-entering')
    }, 400)
  }, 400)
}

// Create overlay using safe DOM manipulation (no innerHTML with user data)
function createOverlay(status: BlockStatus): HTMLElement {
  // Get initial quote and track its index
  currentQuoteIndex = getNextQuoteIndex()
  const quote = FOCUS_QUOTES[currentQuoteIndex]!
  const site = getSiteFromUrl()

  const overlay = document.createElement('div')
  overlay.id = 'sordino-overlay'

  // Container
  const container = document.createElement('div')
  container.className = 'sordino-container'

  // Content wrapper
  const content = document.createElement('div')
  content.className = 'sordino-content'

  // Logo section
  const logo = document.createElement('div')
  logo.className = 'sordino-logo'

  const iconImg = document.createElement('img')
  iconImg.src = logoDataUri
  iconImg.alt = 'Sordino'
  iconImg.className = 'sordino-icon'
  logo.appendChild(iconImg)

  const title = document.createElement('span')
  title.className = 'sordino-title'
  title.textContent = 'Sordino'
  logo.appendChild(title)
  content.appendChild(logo)

  // Snarky title - music-themed tagline
  const snarky = getRandomSnarkyTitle()
  const snarkyContainer = document.createElement('div')
  snarkyContainer.className = 'sordino-snarky-container'

  const snarkyTitle = document.createElement('p')
  snarkyTitle.className = 'sordino-snarky-title'

  // Add icon if present
  if (snarky.icon) {
    const iconImg = document.createElement('img')
    iconImg.src = snarky.icon
    iconImg.className = 'sordino-snarky-icon'
    iconImg.alt = ''
    snarkyTitle.appendChild(iconImg)
  }

  const titleText = document.createTextNode(snarky.title)
  snarkyTitle.appendChild(titleText)
  snarkyContainer.appendChild(snarkyTitle)

  if (snarky.subtitle) {
    const snarkySubtitle = document.createElement('p')
    snarkySubtitle.className = 'sordino-snarky-subtitle'
    snarkySubtitle.textContent = snarky.subtitle
    snarkyContainer.appendChild(snarkySubtitle)
  }

  content.appendChild(snarkyContainer)

  // Quote section - SAFE: using textContent
  const quoteDiv = document.createElement('div')
  quoteDiv.className = 'sordino-quote'
  quoteDiv.id = 'sordino-quote-container'

  const quoteText = document.createElement('p')
  quoteText.className = 'sordino-quote-text'
  quoteText.id = 'sordino-quote-text'
  quoteText.textContent = `"${ensureTextOnly(quote.text)}"`
  quoteDiv.appendChild(quoteText)

  const quoteAuthor = document.createElement('p')
  quoteAuthor.className = 'sordino-quote-author'
  quoteAuthor.id = 'sordino-quote-author'
  quoteAuthor.textContent = `— ${ensureTextOnly(quote.author)}`
  quoteDiv.appendChild(quoteAuthor)
  content.appendChild(quoteDiv)

  // Card section - SAFE: using textContent for user-controllable data
  const card = document.createElement('div')
  card.className = 'sordino-card'

  const blockedSite = document.createElement('p')
  blockedSite.className = 'sordino-blocked-site'
  blockedSite.textContent = `${ensureTextOnly(site)} is blocked`
  card.appendChild(blockedSite)

  const reason = document.createElement('p')
  reason.className = 'sordino-reason'

  const reasonIcon = document.createElement('span')
  reasonIcon.className = 'sordino-reason-icon'
  reasonIcon.textContent = '📅'
  reason.appendChild(reasonIcon)

  // CRITICAL: sanitize status.reason as it comes from user-controlled schedule names
  const reasonText = document.createTextNode(
    ` ${ensureTextOnly(status.reason || 'Blocked')}${status.timeRemaining ? ` • ${ensureTextOnly(status.timeRemaining)}` : ''}`
  )
  reason.appendChild(reasonText)
  card.appendChild(reason)
  content.appendChild(card)

  // Go back button (promoted: primary win-path action)
  const goBackBtn = document.createElement('button')
  goBackBtn.className = 'sordino-go-back'
  goBackBtn.type = 'button'
  goBackBtn.textContent = '\u2190 Go back'
  goBackBtn.addEventListener('click', (e) => {
    e.preventDefault()
    if (history.length > 1) {
      history.back()
    } else {
      window.location.href = 'about:newtab'
    }
  })
  content.appendChild(goBackBtn)

  // Bypass button (demoted: smaller ghost weight)
  const bypassBtn = document.createElement('button')
  bypassBtn.className = 'sordino-bypass-btn'
  bypassBtn.id = 'sordino-bypass'
  const bypassDuration = status.bypassDuration ?? 5
  bypassBtn.textContent = `Bypass for ${bypassDuration} min`
  content.appendChild(bypassBtn)

  // Bypass count (caption directly under bypass)
  const bypassCount = document.createElement('p')
  bypassCount.className = 'sordino-bypass-count'
  bypassCount.id = 'sordino-bypass-count'
  const remaining = status.bypassesRemaining ?? 0
  bypassCount.textContent = `${remaining} quick bypass${remaining === 1 ? '' : 'es'} left today`
  content.appendChild(bypassCount)

  container.appendChild(content)

  // Texture overlay
  const texture = document.createElement('div')
  texture.className = 'sordino-texture'
  container.appendChild(texture)

  overlay.appendChild(container)

  // Handle bypass state
  if (remaining === 0) {
    bypassBtn.disabled = true
    bypassBtn.textContent = '0 bypasses left'
    bypassCount.textContent = 'Resets at midnight'
  }

  // Bypass click handler. When scaffoldingMode is on, the first click arms a
  // confirm state and the second click commits. Resolves the
  // Principle-4-vs-ADHD-primary tension PRODUCT.md flagged as live: users who
  // want friction can opt in without imposing it on everyone.
  const scaffoldingMode = status.scaffoldingMode ?? false
  let armedForConfirm = false
  let confirmTimeoutId: number | null = null
  const originalBypassText = bypassBtn.textContent ?? ''

  const resetArmed = () => {
    armedForConfirm = false
    if (confirmTimeoutId !== null) {
      clearTimeout(confirmTimeoutId)
      confirmTimeoutId = null
    }
    bypassBtn.textContent = originalBypassText
  }

  bypassBtn.addEventListener('click', async () => {
    // First click in scaffolding mode: arm the confirm state, don't bypass yet.
    // Timer matches the delete-confirm timeout via the shared CONFIRM_RESET_MS
    // constant so the ADHD-primary persona has the same slack across both
    // confirm flows in the product.
    if (scaffoldingMode && !armedForConfirm) {
      armedForConfirm = true
      bypassBtn.textContent = 'Tap again to bypass'
      confirmTimeoutId = window.setTimeout(resetArmed, CONFIRM_RESET_MS)
      return
    }

    const originalText = bypassBtn.textContent ?? ''
    if (confirmTimeoutId !== null) {
      clearTimeout(confirmTimeoutId)
      confirmTimeoutId = null
    }
    bypassBtn.disabled = true
    bypassBtn.textContent = 'Using bypass...'

    try {
      const result = await useBypass()

      if (result.success) {
        removeOverlay()
      } else {
        bypassBtn.textContent = '0 bypasses left'
        bypassCount.textContent = 'Resets at midnight'
      }
    } catch {
      // Defensive: if useBypass throws unexpectedly, restore the button so the user isn't stranded.
      bypassBtn.disabled = false
      bypassBtn.textContent = originalText
    }
  })

  return overlay
}

function injectStyles(): void {
  if (document.getElementById('sordino-styles')) return
  if (!document.head) return // Safety check

  const styles = document.createElement('style')
  styles.id = 'sordino-styles'
  // Using system fonts to avoid external requests (privacy/performance)
  styles.textContent = `
    #sordino-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 16px !important; /* Reset rem baseline - isolates from site CSS while preserving browser zoom */
      animation: sordino-fade-in 0.4s ease-out !important;
    }

    @keyframes sordino-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes sordino-quote-fade-out {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-10px); }
    }

    @keyframes sordino-quote-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .sordino-container {
      position: relative !important;
      width: 100% !important;
      height: 100% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: linear-gradient(145deg, #1a1612 0%, #2d2620 50%, #1f1a16 100%) !important;
      overflow: hidden !important;
    }

    .sordino-texture {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E") !important;
      opacity: 0.03 !important;
      pointer-events: none !important;
    }

    .sordino-content {
      position: relative !important;
      z-index: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      text-align: center !important;
      padding: 2rem !important;
      max-width: 480px !important;
    }

    .sordino-logo {
      display: flex !important;
      align-items: center !important;
      gap: 0.75rem !important;
      margin-bottom: 1rem !important;
    }

    .sordino-icon {
      width: 36px !important;
      height: 36px !important;
      color: #cda468 !important;
    }

    .sordino-title {
      font-family: Georgia, 'Times New Roman', serif !important;
      font-size: 1.75rem !important;
      font-weight: 500 !important;
      letter-spacing: 0.05em !important;
      color: #cda468 !important;
    }

    .sordino-snarky-container {
      text-align: center !important;
      margin-top: 1.5rem !important;
      margin-bottom: 2.5rem !important;
    }

    .sordino-snarky-title {
      font-family: Georgia, 'Times New Roman', serif !important;
      font-size: 2.5rem !important;
      font-weight: 500 !important;
      color: #e8dcc8 !important;
      letter-spacing: 0.02em !important;
      margin: 0 !important;
      line-height: 1.3 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.75rem !important;
    }

    .sordino-snarky-icon {
      height: 2.5rem !important;
      width: auto !important;
    }

    .sordino-snarky-subtitle {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 1rem !important;
      font-weight: 400 !important;
      color: #9a8b7a !important;
      margin: 0.75rem 0 0 0 !important;
      letter-spacing: 0.01em !important;
    }

    .sordino-quote {
      margin-bottom: 2.5rem !important;
      padding: 0 1rem !important;
      transition: opacity 0.4s ease, transform 0.4s ease !important;
      min-height: 140px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
    }

    .sordino-quote.sordino-quote-fading {
      animation: sordino-quote-fade-out 0.4s ease forwards !important;
    }

    .sordino-quote.sordino-quote-entering {
      animation: sordino-quote-fade-in 0.4s ease forwards !important;
    }

    .sordino-quote-text {
      font-family: Georgia, 'Times New Roman', serif !important;
      font-size: 1.5rem !important;
      font-weight: 400 !important;
      font-style: italic !important;
      line-height: 1.6 !important;
      color: #e8dcc8 !important;
      margin: 0 0 1rem 0 !important;
    }

    .sordino-quote-author {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 0.875rem !important;
      font-weight: 500 !important;
      color: #9a8b7a !important;
      letter-spacing: 0.05em !important;
      margin: 0 !important;
    }

    .sordino-card {
      background: rgba(205, 164, 104, 0.08) !important;
      border: 1px solid rgba(205, 164, 104, 0.10) !important;
      border-radius: 12px !important;
      padding: 1.25rem 2rem !important;
      margin-bottom: 2rem !important;
      backdrop-filter: blur(8px) !important;
    }

    .sordino-blocked-site {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 1.125rem !important;
      font-weight: 600 !important;
      color: #e8dcc8 !important;
      margin: 0 0 0.5rem 0 !important;
    }

    .sordino-reason {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 0.875rem !important;
      color: #9a8b7a !important;
      margin: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.5rem !important;
    }

    .sordino-reason-icon {
      font-size: 0.875rem !important;
    }

    .sordino-go-back {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 1rem !important;
      font-weight: 500 !important;
      color: #e8dcc8 !important;
      background: #463e39 !important;
      border: 1px solid rgba(205, 164, 104, 0.18) !important;
      border-radius: 12px !important;
      padding: 0.8125rem 1.75rem !important;
      cursor: pointer !important;
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease !important;
      text-decoration: none !important;
      margin: 0 0 0.5rem 0 !important;
    }

    .sordino-go-back:hover {
      background: #524740 !important;
      border-color: rgba(205, 164, 104, 0.35) !important;
    }

    .sordino-go-back:active {
      background: #5c5247 !important;
    }

    .sordino-bypass-btn {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 0.875rem !important;
      font-weight: 500 !important;
      color: #e8dcc8 !important;
      background: transparent !important;
      border: 1px solid rgba(205, 164, 104, 0.22) !important;
      border-radius: 8px !important;
      padding: 0.5rem 1.125rem !important;
      cursor: pointer !important;
      transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease !important;
      text-decoration: none !important;
      margin: 0.5rem 0 0 0 !important;
    }

    .sordino-bypass-btn:hover:not(:disabled) {
      border-color: rgba(205, 164, 104, 0.45) !important;
      background: rgba(205, 164, 104, 0.06) !important;
    }

    .sordino-bypass-btn:active:not(:disabled) {
      background: rgba(205, 164, 104, 0.12) !important;
      border-color: rgba(205, 164, 104, 0.6) !important;
    }

    .sordino-bypass-btn:disabled {
      color: #8a7a66 !important;
      border-color: rgba(205, 164, 104, 0.10) !important;
      background: rgba(205, 164, 104, 0.02) !important;
      cursor: not-allowed !important;
    }

    .sordino-bypass-count {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 0.75rem !important;
      color: #8a7a66 !important;
      margin: 0.25rem 0 0 0 !important;
    }

    @media (prefers-reduced-motion: reduce) {
      #sordino-overlay,
      .sordino-quote,
      .sordino-quote.sordino-quote-fading,
      .sordino-quote.sordino-quote-entering {
        animation: none !important;
        transition: none !important;
      }
      /* Color/background tweens on interactive elements are vestibular-safe
         and explicitly permitted by WCAG; only disable motion-bearing transitions. */
    }
  `
  document.head.appendChild(styles)
}

function showOverlay(status: BlockStatus): void {
  if (overlayElement) return

  // Wait for document.body and document.head to exist (content script runs at document_start)
  if (!document.body || !document.head) {
    document.addEventListener('DOMContentLoaded', () => showOverlay(status), { once: true })
    return
  }

  injectStyles()
  overlayElement = createOverlay(status)
  document.body.appendChild(overlayElement)

  // Prevent scrolling
  document.body.style.overflow = 'hidden'

  // Start quote rotation
  if (quoteRotationInterval) {
    clearInterval(quoteRotationInterval)
  }
  // 11s cadence — long enough to read, short enough that short-stay users see at least one rotation
  quoteRotationInterval = window.setInterval(rotateQuote, 11000)
}

function removeOverlay(): void {
  if (overlayElement) {
    overlayElement.remove()
    overlayElement = null
    document.body.style.overflow = ''
  }

  // Stop quote rotation
  if (quoteRotationInterval) {
    clearInterval(quoteRotationInterval)
    quoteRotationInterval = null
  }

  // Clear any lingering countdown toast (a persistent urgent toast that fired
  // shortly before the bypass expired would otherwise stay in DOM, masked by
  // a returning overlay, displaying a stale "5 seconds" warning).
  document.getElementById('sordino-toast')?.remove()
}

// Toast notification for countdown (bypass or pause)
type ToastTheme = 'bypass' | 'pause'

function showCountdownToast(
  message: string,
  urgent: boolean = false,
  theme: ToastTheme = 'bypass'
): void {
  // Remove existing toast
  const existing = document.getElementById('sordino-toast')
  if (existing) existing.remove()

  if (!document.body) return

  // Color schemes — warm-walnut-tinted to match the system palette.
  // Urgent variants shift to a perceptibly warmer/deeper amber so the
  // 5-second state reads with time-running urgency without crossing into
  // hard-blocker red. The Δ between normal and urgent is ≥20 sRGB units on
  // every channel so the escalation is visible at a glance.
  const colors = {
    bypass: {
      normal: 'rgba(56, 46, 38, 0.94)', // walnut shadow
      urgent: 'rgba(118, 70, 40, 0.96)', // warm amber — urgent but still in-palette
      icon: '⏱',
    },
    pause: {
      normal: 'rgba(56, 46, 38, 0.94)', // walnut shadow
      urgent: 'rgba(118, 70, 40, 0.96)', // warm amber — urgent but still in-palette
      icon: '▶',
    },
  }

  const colorScheme = colors[theme]

  const toast = document.createElement('div')
  toast.id = 'sordino-toast'
  toast.style.cssText = `
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    background: ${urgent ? colorScheme.urgent : colorScheme.normal} !important;
    color: ${urgent ? '#f3e5cf' : '#e8dcc8'} !important;
    border: 1px solid rgba(205, 164, 104, ${urgent ? '0.35' : '0.20'}) !important;
    padding: 12px 20px !important;
    border-radius: 8px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    z-index: 2147483646 !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    animation: sordino-toast-in 0.3s ease-out !important;
  `
  toast.textContent = message

  // Add icon
  const icon = document.createElement('span')
  icon.textContent = colorScheme.icon
  icon.style.cssText = 'font-size: 16px !important;'
  toast.insertBefore(icon, toast.firstChild)

  // Add animation keyframes if not present
  if (!document.getElementById('sordino-toast-styles')) {
    const style = document.createElement('style')
    style.id = 'sordino-toast-styles'
    style.textContent = `
      @keyframes sordino-toast-in {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes sordino-toast-out {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to { opacity: 0; transform: translateY(-10px) scale(0.95); }
      }
      @media (prefers-reduced-motion: reduce) {
        #sordino-toast {
          animation: none !important;
        }
      }
    `
    document.head?.appendChild(style)
  }

  document.body.appendChild(toast)

  // Non-urgent toasts auto-remove at 2.5s. Urgent toasts (the 5-second final
  // warning) linger longer — 15s — so a user who glances away during the
  // warning still finds the signal when they look back, but the toast won't
  // outlive its truthfulness (a 5-second warning from a minute ago would
  // be a lie). 15s ≈ 3× the original urgent window.
  const dismissAfter = urgent ? 15000 : 2500
  setTimeout(() => {
    // Bail if the toast was already replaced or removed
    if (!toast.isConnected) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      toast.remove()
    } else {
      // setProperty is required for !important — inline `style.animation = '... !important'` is silently dropped by CSSOM
      toast.style.setProperty(
        'animation',
        'sordino-toast-out 0.5s ease-in-out forwards',
        'important'
      )
      setTimeout(() => toast.remove(), 500)
    }
  }, dismissAfter)
}

// Check for active bypass or pause and show countdown notifications
async function checkCountdowns(): Promise<void> {
  try {
    const response = await new Promise<{
      bypassState?: { activeBypass?: { expiresAt: number; site: string } | null }
      blockState?: { pausedUntil?: number | null }
    }>((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({})
          return
        }
        resolve(response || {})
      })
    })

    const THRESHOLDS = [
      { ms: 60000, label: '1 minute', urgent: false },
      { ms: 30000, label: '30 seconds', urgent: false },
      { ms: 10000, label: '10 seconds', urgent: true },
      { ms: 5000, label: '5 seconds', urgent: true },
    ]

    // Check bypass countdown
    const bypass = response?.bypassState?.activeBypass
    if (bypass) {
      const currentSite = getSiteFromUrl()
      const isCurrentSite = bypass.site === currentSite || currentSite.endsWith(`.${bypass.site}`)

      if (isCurrentSite) {
        const remaining = bypass.expiresAt - Date.now()

        for (const threshold of THRESHOLDS) {
          if (
            remaining <= threshold.ms &&
            remaining > threshold.ms - 5000 &&
            !shownBypassNotifications.has(threshold.ms)
          ) {
            shownBypassNotifications.add(threshold.ms)
            showCountdownToast(`Bypass ending: ${threshold.label}`, threshold.urgent, 'bypass')
          }
        }

        if (remaining <= 0) {
          shownBypassNotifications.clear()
        }
      }
    } else {
      shownBypassNotifications.clear()
    }

    // Check pause countdown
    const pausedUntil = response?.blockState?.pausedUntil
    if (pausedUntil && Date.now() < pausedUntil) {
      const remaining = pausedUntil - Date.now()

      for (const threshold of THRESHOLDS) {
        if (
          remaining <= threshold.ms &&
          remaining > threshold.ms - 5000 &&
          !shownPauseNotifications.has(threshold.ms)
        ) {
          shownPauseNotifications.add(threshold.ms)
          showCountdownToast(`Blocking resumes: ${threshold.label}`, threshold.urgent, 'pause')
        }
      }

      if (remaining <= 0) {
        shownPauseNotifications.clear()
      }
    } else {
      shownPauseNotifications.clear()
    }
  } catch (error) {
    console.warn('Sordino: Error checking countdowns', error)
  }
}

async function checkAndBlock(): Promise<void> {
  if (isChecking) return
  isChecking = true

  try {
    const status = await checkBlockStatus()

    if (status.isBlocked) {
      showOverlay(status)
      // Stop countdown checking when blocked
      if (bypassCountdownInterval) {
        clearInterval(bypassCountdownInterval)
        bypassCountdownInterval = null
      }
    } else {
      removeOverlay()
      // Start countdown checking when not blocked (may have active bypass or pause)
      if (!bypassCountdownInterval) {
        bypassCountdownInterval = window.setInterval(checkCountdowns, 1000)
        checkCountdowns() // Check immediately
      }
    }
  } catch (error) {
    console.error('Sordino: Error checking block status', error)
  } finally {
    isChecking = false
  }
}

// Wait for DOM to be ready before initial check
function init() {
  // Initial check
  checkAndBlock()

  // Re-check on visibility change (user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAndBlock()
    }
  })

  // Re-check periodically (for bypass expiration)
  setInterval(checkAndBlock, 30000)

  // Listen for settings changes
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SETTINGS_UPDATE') {
      checkAndBlock()
    }
  })
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    // Content script runs at document_start, so DOM might not be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true })
    } else {
      init()
    }
  },
})
