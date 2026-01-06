import { getSettings, updateSettings } from '../shared/storage'
import { shouldBlock, getActiveSchedule, formatEndTime } from '../shared/schedule'
import type { SordinoSettings, MessageType } from '../shared/types'

const MAX_QUICK_BYPASSES = 3
const BYPASS_DURATION_MS = 5 * 60 * 1000 // 5 minutes

// Track URLs that have already been counted as blocks (prevents inflation)
// Cleared when a new day starts or when bypass is used
const countedBlockUrls = new Set<string>()

// Update extension icon badge to reflect blocking state
type BadgeState = 'active' | 'paused' | 'inactive'

async function updateBadge(state: BadgeState): Promise<void> {
  switch (state) {
    case 'active':
      // Small green dot when blocking is active
      await chrome.action.setBadgeText({ text: ' ' })
      await chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }) // green-500
      break
    case 'paused':
      // Pause symbol when paused
      await chrome.action.setBadgeText({ text: '❚❚' })
      await chrome.action.setBadgeBackgroundColor({ color: '#eab308' }) // yellow-500
      break
    case 'inactive':
      // Small grey dot when inactive
      await chrome.action.setBadgeText({ text: ' ' })
      await chrome.action.setBadgeBackgroundColor({ color: '#6b7280' }) // gray-500
      break
  }
}

// Determine badge state from settings
function getBadgeState(settings: SordinoSettings): BadgeState {
  const isPaused = settings.blockState.pausedUntil && Date.now() < settings.blockState.pausedUntil
  if (isPaused) return 'paused'

  const blockStatus = shouldBlock(settings)
  return blockStatus.shouldBlock ? 'active' : 'inactive'
}

// Check if URL matches any blocked site
function isUrlBlocked(url: string, settings: SordinoSettings): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace(/^www\./, '')

    // Check categories
    for (const category of settings.categories) {
      if (!category.enabled) continue
      for (const site of category.sites) {
        if (hostname === site || hostname.endsWith(`.${site}`)) {
          return true
        }
      }
    }

    // Check custom sites
    for (const site of settings.customSites) {
      const cleanSite = site.replace(/^www\./, '')
      if (hostname === cleanSite || hostname.endsWith(`.${cleanSite}`)) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

// Check and reset bypass state if new day
async function checkBypassReset(): Promise<SordinoSettings> {
  const today = new Date().toISOString().split('T')[0]
  return updateSettings((settings) => {
    if (settings.bypassState.lastResetDate !== today) {
      // Clear counted URLs on new day
      countedBlockUrls.clear()
      return {
        ...settings,
        bypassState: {
          quickBypassesUsed: 0,
          lastResetDate: today,
          activeBypass: null,
        },
        stats: {
          date: today,
          blocksTriggered: 0,
          bypassesUsed: 0,
        },
      }
    }
    return settings
  })
}

// Check if site has active bypass
function hasBypass(url: string, settings: SordinoSettings): boolean {
  const bypass = settings.bypassState.activeBypass
  if (!bypass) return false
  if (Date.now() > bypass.expiresAt) return false

  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace(/^www\./, '')
    return hostname === bypass.site || hostname.endsWith(`.${bypass.site}`)
  } catch {
    return false
  }
}

// Get site from URL
function getSiteFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Get a unique key for tracking counted blocks (hostname only, not full URL)
function getBlockKey(url: string): string {
  return getSiteFromUrl(url)
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse)
  return true // Keep channel open for async response
})

async function handleMessage(message: MessageType): Promise<unknown> {
  const settings = await checkBypassReset()

  switch (message.type) {
    case 'GET_BLOCK_STATUS': {
      const blockStatus = shouldBlock(settings)

      if (!blockStatus.shouldBlock) {
        return { isBlocked: false }
      }

      if (!isUrlBlocked(message.url, settings)) {
        return { isBlocked: false }
      }

      if (hasBypass(message.url, settings)) {
        return { isBlocked: false }
      }

      // Only record block if we haven't counted this site yet today
      const blockKey = getBlockKey(message.url)
      if (!countedBlockUrls.has(blockKey)) {
        countedBlockUrls.add(blockKey)
        await updateSettings((s) => ({
          ...s,
          stats: {
            ...s.stats,
            blocksTriggered: s.stats.blocksTriggered + 1,
          },
        }))
      }

      const activeSchedule = getActiveSchedule(settings.schedules)
      return {
        isBlocked: true,
        reason: blockStatus.reason,
        timeRemaining: activeSchedule
          ? `until ${formatEndTime(activeSchedule)}`
          : undefined,
        bypassesRemaining: MAX_QUICK_BYPASSES - settings.bypassState.quickBypassesUsed,
      }
    }

    case 'USE_BYPASS': {
      const remaining = MAX_QUICK_BYPASSES - settings.bypassState.quickBypassesUsed
      if (remaining <= 0) {
        return { success: false, remaining: 0 }
      }

      const site = getSiteFromUrl(message.site)

      // Remove site from counted blocks (allows re-counting if they come back)
      countedBlockUrls.delete(site)

      await updateSettings((s) => ({
        ...s,
        bypassState: {
          ...s.bypassState,
          quickBypassesUsed: s.bypassState.quickBypassesUsed + 1,
          activeBypass: {
            site,
            expiresAt: Date.now() + BYPASS_DURATION_MS,
          },
        },
        stats: {
          ...s.stats,
          bypassesUsed: s.stats.bypassesUsed + 1,
        },
      }))

      return { success: true, remaining: remaining - 1 }
    }

    case 'GET_SETTINGS': {
      return settings
    }

    case 'TOGGLE_MANUAL_OVERRIDE': {
      const updated = await updateSettings((s) => ({
        ...s,
        blockState: {
          ...s.blockState,
          manualOverride: message.state,
          pausedUntil: null, // Clear pause when manually toggling
        },
      }))
      await updateBadge(getBadgeState(updated))
      return { success: true }
    }

    case 'PAUSE_BLOCKING': {
      const updated = await updateSettings((s) => ({
        ...s,
        blockState: {
          ...s.blockState,
          pausedUntil: message.until,
        },
      }))
      await updateBadge(getBadgeState(updated))
      return { success: true }
    }

    default:
      return { error: 'Unknown message type' }
  }
}

// Set up alarm to check schedule every minute
chrome.alarms.create('checkSchedule', { periodInMinutes: 1 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkSchedule') {
    const settings = await checkBypassReset()
    const blockStatus = shouldBlock(settings)

    // Update block state and badge
    const updated = await updateSettings((s) => ({
      ...s,
      blockState: {
        ...s.blockState,
        isBlocking: blockStatus.shouldBlock,
        activeSchedule: blockStatus.reason ?? null,
      },
    }))
    await updateBadge(getBadgeState(updated))

    // Clear expired bypasses
    if (settings.bypassState.activeBypass) {
      if (Date.now() > settings.bypassState.activeBypass.expiresAt) {
        await updateSettings((s) => ({
          ...s,
          bypassState: {
            ...s.bypassState,
            activeBypass: null,
          },
        }))
      }
    }
  }
})

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await checkBypassReset()
  const blockStatus = shouldBlock(settings)

  const updated = await updateSettings((s) => ({
    ...s,
    blockState: {
      ...s.blockState,
      isBlocking: blockStatus.shouldBlock,
      activeSchedule: blockStatus.reason ?? null,
    },
  }))
  await updateBadge(getBadgeState(updated))
})

// Initialize badge on service worker start (handles browser restart)
;(async () => {
  const settings = await getSettings()
  await updateBadge(getBadgeState(settings))
})()

console.log('Sordino background service worker initialized')
