import { getRandomQuote } from '../shared/quotes'

interface BlockStatus {
  isBlocked: boolean
  reason?: string
  timeRemaining?: string
  bypassesRemaining?: number
}

let overlayElement: HTMLElement | null = null
let isChecking = false
let hasRecordedBlock = false // Track if we've already recorded a block for this page
let bypassCountdownInterval: number | null = null
let shownBypassNotifications = new Set<number>() // Track which bypass time thresholds we've shown
let shownPauseNotifications = new Set<number>() // Track which pause time thresholds we've shown

// Sanitize text to prevent XSS - strip any HTML tags
function sanitizeText(text: string): string {
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
      chrome.runtime.sendMessage(
        { type: 'USE_BYPASS', site: window.location.href },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Sordino: Extension context error', chrome.runtime.lastError.message)
            resolve({ success: false, remaining: 0 })
            return
          }
          resolve(response || { success: false, remaining: 0 })
        }
      )
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

// Create overlay using safe DOM manipulation (no innerHTML with user data)
function createOverlay(status: BlockStatus): HTMLElement {
  const quote = getRandomQuote()
  const site = getSiteFromUrl()

  const overlay = document.createElement('div')
  overlay.id = 'sordino-overlay'

  // Container
  const container = document.createElement('div')
  container.className = 'sordino-container'

  // Glow effect
  const glow = document.createElement('div')
  glow.className = 'sordino-glow'
  container.appendChild(glow)

  // Content wrapper
  const content = document.createElement('div')
  content.className = 'sordino-content'

  // Logo section
  const logo = document.createElement('div')
  logo.className = 'sordino-logo'

  const iconImg = document.createElement('img')
  iconImg.src = chrome.runtime.getURL('icons/logo.png')
  iconImg.alt = 'Sordino'
  iconImg.className = 'sordino-icon'
  logo.appendChild(iconImg)

  const title = document.createElement('span')
  title.className = 'sordino-title'
  title.textContent = 'Sordino'
  logo.appendChild(title)
  content.appendChild(logo)

  // Quote section - SAFE: using textContent
  const quoteDiv = document.createElement('div')
  quoteDiv.className = 'sordino-quote'

  const quoteText = document.createElement('p')
  quoteText.className = 'sordino-quote-text'
  quoteText.textContent = `"${sanitizeText(quote.text)}"`
  quoteDiv.appendChild(quoteText)

  const quoteAuthor = document.createElement('p')
  quoteAuthor.className = 'sordino-quote-author'
  quoteAuthor.textContent = `— ${sanitizeText(quote.author)}`
  quoteDiv.appendChild(quoteAuthor)
  content.appendChild(quoteDiv)

  // Card section - SAFE: using textContent for user-controllable data
  const card = document.createElement('div')
  card.className = 'sordino-card'

  const blockedSite = document.createElement('p')
  blockedSite.className = 'sordino-blocked-site'
  blockedSite.textContent = `${sanitizeText(site)} is blocked`
  card.appendChild(blockedSite)

  const reason = document.createElement('p')
  reason.className = 'sordino-reason'

  const reasonIcon = document.createElement('span')
  reasonIcon.className = 'sordino-reason-icon'
  reasonIcon.textContent = '📅'
  reason.appendChild(reasonIcon)

  // CRITICAL: sanitize status.reason as it comes from user-controlled schedule names
  const reasonText = document.createTextNode(
    ` ${sanitizeText(status.reason || 'Blocked')}${status.timeRemaining ? ` • ${sanitizeText(status.timeRemaining)}` : ''}`
  )
  reason.appendChild(reasonText)
  card.appendChild(reason)
  content.appendChild(card)

  // Bypass button
  const bypassBtn = document.createElement('button')
  bypassBtn.className = 'sordino-bypass-btn'
  bypassBtn.id = 'sordino-bypass'
  bypassBtn.textContent = 'Bypass for 5 min'
  content.appendChild(bypassBtn)

  // Bypass count
  const bypassCount = document.createElement('p')
  bypassCount.className = 'sordino-bypass-count'
  bypassCount.id = 'sordino-bypass-count'
  const remaining = status.bypassesRemaining ?? 0
  bypassCount.textContent = `${remaining} quick bypass${remaining === 1 ? '' : 'es'} left`
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
    bypassBtn.textContent = 'No bypasses left'
    bypassCount.textContent = 'Resets at midnight'
  }

  // Bypass click handler
  bypassBtn.addEventListener('click', async () => {
    bypassBtn.disabled = true
    bypassBtn.textContent = 'Using bypass...'

    const result = await useBypass()

    if (result.success) {
      removeOverlay()
    } else {
      bypassBtn.textContent = 'No bypasses left'
      bypassCount.textContent = 'Resets at midnight'
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
      animation: sordino-fade-in 0.4s ease-out !important;
    }

    @keyframes sordino-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes sordino-float {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-8px) scale(1.02); }
    }

    @keyframes sordino-glow-pulse {
      0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.1); }
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

    .sordino-glow {
      position: absolute !important;
      top: 40% !important;
      left: 50% !important;
      width: 600px !important;
      height: 600px !important;
      background: radial-gradient(circle, rgba(205, 164, 104, 0.15) 0%, rgba(205, 164, 104, 0.05) 40%, transparent 70%) !important;
      transform: translate(-50%, -50%) !important;
      animation: sordino-glow-pulse 6s ease-in-out infinite !important;
      pointer-events: none !important;
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
      animation: sordino-float 8s ease-in-out infinite !important;
    }

    .sordino-logo {
      display: flex !important;
      align-items: center !important;
      gap: 0.75rem !important;
      margin-bottom: 2.5rem !important;
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
      letter-spacing: 0.1em !important;
      color: #cda468 !important;
      text-transform: uppercase !important;
    }

    .sordino-quote {
      margin-bottom: 2.5rem !important;
      padding: 0 1rem !important;
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
      border: 1px solid rgba(205, 164, 104, 0.2) !important;
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

    .sordino-bypass-btn {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 0.9375rem !important;
      font-weight: 500 !important;
      color: #1a1612 !important;
      background: linear-gradient(135deg, #cda468 0%, #b8935d 100%) !important;
      border: none !important;
      border-radius: 8px !important;
      padding: 0.875rem 2rem !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      box-shadow: 0 4px 12px rgba(205, 164, 104, 0.3) !important;
    }

    .sordino-bypass-btn:hover:not(:disabled) {
      transform: translateY(-2px) !important;
      box-shadow: 0 6px 20px rgba(205, 164, 104, 0.4) !important;
    }

    .sordino-bypass-btn:active:not(:disabled) {
      transform: translateY(0) !important;
    }

    .sordino-bypass-btn:disabled {
      background: rgba(205, 164, 104, 0.3) !important;
      color: #9a8b7a !important;
      cursor: not-allowed !important;
      box-shadow: none !important;
    }

    .sordino-bypass-count {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 0.8125rem !important;
      color: #6b5d4d !important;
      margin: 0.75rem 0 0 0 !important;
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
}

function removeOverlay(): void {
  if (overlayElement) {
    overlayElement.remove()
    overlayElement = null
    document.body.style.overflow = ''
  }
}

// Toast notification for countdown (bypass or pause)
type ToastTheme = 'bypass' | 'pause'

function showCountdownToast(message: string, urgent: boolean = false, theme: ToastTheme = 'bypass'): void {
  // Remove existing toast
  const existing = document.getElementById('sordino-toast')
  if (existing) existing.remove()

  if (!document.body) return

  // Color schemes
  const colors = {
    bypass: {
      normal: 'rgba(249, 115, 22, 0.95)', // orange
      urgent: 'rgba(239, 68, 68, 0.95)',  // red
      icon: '⏱'
    },
    pause: {
      normal: 'rgba(234, 179, 8, 0.95)',  // yellow
      urgent: 'rgba(245, 158, 11, 0.95)', // amber
      icon: '▶'
    }
  }

  const colorScheme = colors[theme]

  const toast = document.createElement('div')
  toast.id = 'sordino-toast'
  toast.style.cssText = `
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    background: ${urgent ? colorScheme.urgent : colorScheme.normal} !important;
    color: ${theme === 'pause' ? '#1a1612' : 'white'} !important;
    padding: 12px 20px !important;
    border-radius: 8px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    z-index: 2147483646 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
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
    `
    document.head?.appendChild(style)
  }

  document.body.appendChild(toast)

  // Auto-remove after 2.5 seconds with graceful fade
  setTimeout(() => {
    toast.style.animation = 'sordino-toast-out 0.5s ease-in-out forwards !important'
    setTimeout(() => toast.remove(), 500)
  }, 2500)
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
      { ms: 5000, label: '5 seconds', urgent: true }
    ]

    // Check bypass countdown
    const bypass = response?.bypassState?.activeBypass
    if (bypass) {
      const currentSite = getSiteFromUrl()
      const isCurrentSite = bypass.site === currentSite || currentSite.endsWith(`.${bypass.site}`)

      if (isCurrentSite) {
        const remaining = bypass.expiresAt - Date.now()

        for (const threshold of THRESHOLDS) {
          if (remaining <= threshold.ms && remaining > threshold.ms - 5000 && !shownBypassNotifications.has(threshold.ms)) {
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
        if (remaining <= threshold.ms && remaining > threshold.ms - 5000 && !shownPauseNotifications.has(threshold.ms)) {
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
      hasRecordedBlock = false // Reset when no longer blocked
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

// Content script runs at document_start, so DOM might not be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
