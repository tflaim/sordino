import { getRandomQuote } from '../shared/quotes'

interface BlockStatus {
  isBlocked: boolean
  reason?: string
  timeRemaining?: string
  bypassesRemaining?: number
}

let overlayElement: HTMLElement | null = null
let isChecking = false

async function checkBlockStatus(): Promise<BlockStatus> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GET_BLOCK_STATUS', url: window.location.href },
      (response: BlockStatus) => {
        resolve(response || { isBlocked: false })
      }
    )
  })
}

async function useBypass(): Promise<{ success: boolean; remaining: number }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'USE_BYPASS', site: window.location.href },
      (response) => {
        resolve(response || { success: false, remaining: 0 })
      }
    )
  })
}

function getSiteFromUrl(): string {
  try {
    return new URL(window.location.href).hostname.replace(/^www\./, '')
  } catch {
    return window.location.hostname
  }
}

function createOverlay(status: BlockStatus): HTMLElement {
  const quote = getRandomQuote()
  const site = getSiteFromUrl()

  const overlay = document.createElement('div')
  overlay.id = 'sordino-overlay'
  overlay.innerHTML = `
    <div class="sordino-container">
      <div class="sordino-glow"></div>
      <div class="sordino-content">
        <div class="sordino-logo">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="sordino-icon">
            <!-- Trumpet icon -->
            <path d="M12 32C12 32 16 28 24 28C32 28 36 32 36 32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M36 26V38" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M36 32H48C50 32 52 30 52 28V36C52 34 50 32 48 32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="48" cy="32" r="4" stroke="currentColor" stroke-width="2"/>
            <path d="M8 30V34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            <path d="M4 28V36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="sordino-title">Sordino</span>
        </div>

        <div class="sordino-quote">
          <p class="sordino-quote-text">"${quote.text}"</p>
          <p class="sordino-quote-author">— ${quote.author}</p>
        </div>

        <div class="sordino-card">
          <p class="sordino-blocked-site">${site} is blocked</p>
          <p class="sordino-reason">
            <span class="sordino-reason-icon">📅</span>
            ${status.reason || 'Blocked'} ${status.timeRemaining ? `• ${status.timeRemaining}` : ''}
          </p>
        </div>

        <button class="sordino-bypass-btn" id="sordino-bypass">
          Bypass for 5 min
        </button>
        <p class="sordino-bypass-count" id="sordino-bypass-count">
          ${status.bypassesRemaining} quick bypass${status.bypassesRemaining === 1 ? '' : 'es'} left
        </p>
      </div>
      <div class="sordino-texture"></div>
    </div>
  `

  // Add event listener for bypass button
  const bypassBtn = overlay.querySelector('#sordino-bypass') as HTMLButtonElement
  const bypassCount = overlay.querySelector('#sordino-bypass-count') as HTMLParagraphElement

  if (status.bypassesRemaining === 0) {
    bypassBtn.disabled = true
    bypassBtn.textContent = 'No bypasses left'
    bypassCount.textContent = 'Resets at midnight'
  }

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

  const styles = document.createElement('style')
  styles.id = 'sordino-styles'
  styles.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500;600&display=swap');

    #sordino-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      font-family: 'DM Sans', -apple-system, sans-serif !important;
      animation: sordino-fade-in 0.4s ease-out !important;
    }

    @keyframes sordino-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes sordino-float {
      0%, 100% {
        transform: translateY(0) scale(1);
      }
      50% {
        transform: translateY(-8px) scale(1.02);
      }
    }

    @keyframes sordino-glow-pulse {
      0%, 100% {
        opacity: 0.4;
        transform: translate(-50%, -50%) scale(1);
      }
      50% {
        opacity: 0.6;
        transform: translate(-50%, -50%) scale(1.1);
      }
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
      font-family: 'Cormorant Garamond', Georgia, serif !important;
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
      font-family: 'Cormorant Garamond', Georgia, serif !important;
      font-size: 1.5rem !important;
      font-weight: 400 !important;
      font-style: italic !important;
      line-height: 1.6 !important;
      color: #e8dcc8 !important;
      margin: 0 0 1rem 0 !important;
    }

    .sordino-quote-author {
      font-family: 'DM Sans', sans-serif !important;
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
      font-family: 'DM Sans', sans-serif !important;
      font-size: 1.125rem !important;
      font-weight: 600 !important;
      color: #e8dcc8 !important;
      margin: 0 0 0.5rem 0 !important;
    }

    .sordino-reason {
      font-family: 'DM Sans', sans-serif !important;
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
      font-family: 'DM Sans', sans-serif !important;
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
      font-family: 'DM Sans', sans-serif !important;
      font-size: 0.8125rem !important;
      color: #6b5d4d !important;
      margin: 0.75rem 0 0 0 !important;
    }
  `
  document.head.appendChild(styles)
}

function showOverlay(status: BlockStatus): void {
  if (overlayElement) return

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

async function checkAndBlock(): Promise<void> {
  if (isChecking) return
  isChecking = true

  try {
    const status = await checkBlockStatus()

    if (status.isBlocked) {
      showOverlay(status)
    } else {
      removeOverlay()
    }
  } catch (error) {
    console.error('Sordino: Error checking block status', error)
  } finally {
    isChecking = false
  }
}

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
