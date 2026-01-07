import { getSettings, updateSettings } from '../shared/storage'
import { shouldBlock, getActiveSchedule, formatEndTime } from '../shared/schedule'
import type { SordinoSettings, MessageType } from '../shared/types'
import { getLocalDateString, MAX_QUICK_BYPASSES, BYPASS_DURATION_MS } from '../shared/types'

// Broadcast settings update to all tabs so content scripts can react immediately
async function broadcastSettingsUpdate(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATE' }).catch(() => {
          // Ignore errors for tabs without content script (chrome://, etc.)
        })
      }
    }
  } catch (error) {
    console.warn('Sordino: Failed to broadcast settings update', error)
  }
}

// Track URLs that have already been counted as blocks (prevents inflation)
// Using chrome.storage.session to persist across service worker restarts (MV3)
// Clears when browser closes (appropriate for daily data)
async function getCountedBlocks(): Promise<Set<string>> {
  const result = await chrome.storage.session.get('countedBlockUrls')
  return new Set(result.countedBlockUrls || [])
}

async function addCountedBlock(blockKey: string): Promise<void> {
  const counted = await getCountedBlocks()
  counted.add(blockKey)
  await chrome.storage.session.set({ countedBlockUrls: Array.from(counted) })
}

async function removeCountedBlock(blockKey: string): Promise<void> {
  const counted = await getCountedBlocks()
  counted.delete(blockKey)
  await chrome.storage.session.set({ countedBlockUrls: Array.from(counted) })
}

async function clearCountedBlocks(): Promise<void> {
  await chrome.storage.session.remove('countedBlockUrls')
}

async function hasCountedBlock(blockKey: string): Promise<boolean> {
  const counted = await getCountedBlocks()
  return counted.has(blockKey)
}

// Update extension icon badge to reflect blocking state
type BadgeState = 'active' | 'paused' | 'inactive' | 'bypass'

async function updateBadge(state: BadgeState): Promise<void> {
  switch (state) {
    case 'active':
      // Small green square when blocking is active
      await chrome.action.setBadgeText({ text: ' ' })
      await chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }) // green-500
      break
    case 'paused':
      // Pause indicator (cross-platform safe text)
      await chrome.action.setBadgeText({ text: 'II' })
      await chrome.action.setBadgeBackgroundColor({ color: '#eab308' }) // yellow-500
      break
    case 'inactive':
      // Small grey square when inactive
      await chrome.action.setBadgeText({ text: ' ' })
      await chrome.action.setBadgeBackgroundColor({ color: '#6b7280' }) // gray-500
      break
    case 'bypass':
      // Timer indicator (cross-platform safe text)
      await chrome.action.setBadgeText({ text: '5m' })
      await chrome.action.setBadgeBackgroundColor({ color: '#f97316' }) // orange-500
      break
  }
}

// Determine badge state from settings
function getBadgeState(settings: SordinoSettings): BadgeState {
  // Check for active bypass first (highest priority - time sensitive)
  const bypass = settings.bypassState.activeBypass
  if (bypass && Date.now() < bypass.expiresAt) return 'bypass'

  // Then check for paused
  const isPaused = settings.blockState.pausedUntil && Date.now() < settings.blockState.pausedUntil
  if (isPaused) return 'paused'

  // Then check blocking status
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

// Get Monday of a given date's week (local timezone)
function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return getLocalDateString(d)
}

// Check if emergency refresh is available (once per day, resets at midnight local time)
function canEmergencyRefresh(settings: SordinoSettings): boolean {
  if (!settings.bypassState.lastEmergencyRefresh) return true
  const today = getLocalDateString()
  return settings.bypassState.lastEmergencyRefresh !== today
}

// Merge site stats into weekly totals
function mergeSiteStats(
  weeklySiteStats: { [site: string]: { blocks: number; bypasses: number } },
  dailySiteStats: { [site: string]: { blocks: number; bypasses: number } }
): { [site: string]: { blocks: number; bypasses: number } } {
  const merged = { ...weeklySiteStats }
  for (const [site, stats] of Object.entries(dailySiteStats)) {
    if (merged[site]) {
      merged[site] = {
        blocks: merged[site].blocks + stats.blocks,
        bypasses: merged[site].bypasses + stats.bypasses,
      }
    } else {
      merged[site] = { ...stats }
    }
  }
  return merged
}

// Check and reset bypass state if new day (local timezone)
async function checkBypassReset(): Promise<SordinoSettings> {
  const today = getLocalDateString()
  const currentWeekStart = getWeekStart()

  // Check current settings to see if we need to clear session storage
  const currentSettings = await getSettings()
  const isNewDay = currentSettings.bypassState.lastResetDate !== today

  const result = await updateSettings((settings) => {
    let updated = { ...settings }

    // Check if we need to archive yesterday's stats to weekly
    if (settings.bypassState.lastResetDate !== today) {
      // Archive previous day's stats to weekly
      const prevStats = settings.stats
      let weeklyStats = { ...settings.weeklyStats }

      // If it's a new week, reset weekly stats completely
      if (weeklyStats.weekStart !== currentWeekStart) {
        weeklyStats = {
          weekStart: currentWeekStart,
          days: [],
          siteStats: {},
          emergencyRefreshesUsed: 0,
        }
      }

      // Add previous day to weekly stats (if it had any activity)
      if (prevStats.blocksTriggered > 0 || prevStats.bypassesUsed > 0) {
        weeklyStats.days = [
          ...weeklyStats.days.filter(d => d.date !== prevStats.date),
          { date: prevStats.date, blocksTriggered: prevStats.blocksTriggered, bypassesUsed: prevStats.bypassesUsed }
        ].slice(-7) // Keep only last 7 days
      }

      // Merge daily site stats into weekly
      weeklyStats.siteStats = mergeSiteStats(weeklyStats.siteStats || {}, prevStats.siteStats || {})

      updated = {
        ...updated,
        bypassState: {
          ...settings.bypassState,
          quickBypassesUsed: 0,
          lastResetDate: today,
          activeBypass: null,
        },
        stats: {
          date: today,
          blocksTriggered: 0,
          bypassesUsed: 0,
          siteStats: {},
        },
        weeklyStats,
      }
    }

    return updated
  })

  // Clear counted blocks on new day (async operation outside the sync updater)
  if (isNewDay) {
    await clearCountedBlocks()
  }

  return result
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

      // Record block with per-site tracking
      const blockKey = getBlockKey(message.url)
      const isFirstBlockForSite = !(await hasCountedBlock(blockKey))
      await addCountedBlock(blockKey)

      await updateSettings((s) => {
        const siteStats = { ...s.stats.siteStats }
        if (!siteStats[blockKey]) {
          siteStats[blockKey] = { blocks: 0, bypasses: 0 }
        }
        siteStats[blockKey] = {
          ...siteStats[blockKey],
          blocks: siteStats[blockKey].blocks + 1,
        }

        return {
          ...s,
          stats: {
            ...s.stats,
            blocksTriggered: isFirstBlockForSite ? s.stats.blocksTriggered + 1 : s.stats.blocksTriggered,
            siteStats,
          },
        }
      })

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
      await removeCountedBlock(site)

      const updated = await updateSettings((s) => {
        const siteStats = { ...s.stats.siteStats }
        if (!siteStats[site]) {
          siteStats[site] = { blocks: 0, bypasses: 0 }
        }
        siteStats[site] = {
          ...siteStats[site],
          bypasses: siteStats[site].bypasses + 1,
        }

        return {
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
            siteStats,
          },
        }
      })
      await updateBadge(getBadgeState(updated))

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
      await broadcastSettingsUpdate()
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
      await broadcastSettingsUpdate()
      return { success: true }
    }

    case 'EMERGENCY_REFRESH_BYPASSES': {
      if (!canEmergencyRefresh(settings)) {
        return { success: false, reason: 'Already used today' }
      }

      const today = getLocalDateString()
      await updateSettings((s) => ({
        ...s,
        bypassState: {
          ...s.bypassState,
          quickBypassesUsed: 0,
          lastEmergencyRefresh: today,
        },
        weeklyStats: {
          ...s.weeklyStats,
          emergencyRefreshesUsed: (s.weeklyStats.emergencyRefreshesUsed || 0) + 1,
        },
      }))
      return { success: true, remaining: MAX_QUICK_BYPASSES }
    }

    case 'CLEAR_BYPASS': {
      const updated = await updateSettings((s) => ({
        ...s,
        bypassState: {
          ...s.bypassState,
          activeBypass: null,
        },
      }))
      await updateBadge(getBadgeState(updated))
      await broadcastSettingsUpdate()
      return { success: true }
    }

    default:
      return { error: 'Unknown message type' }
  }
}

// Set up alarm to check schedule every minute
chrome.alarms.create('checkSchedule', { periodInMinutes: 1 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
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
  } catch (error) {
    console.error('Sordino: Error in alarm handler', error)
  }
})

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  try {
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
  } catch (error) {
    console.error('Sordino: Error in onInstalled handler', error)
  }
})

// Initialize badge on service worker start (handles browser restart)
;(async () => {
  try {
    const settings = await getSettings()
    await updateBadge(getBadgeState(settings))
  } catch (error) {
    console.error('Sordino: Error initializing badge', error)
  }
})()

console.log('Sordino background service worker initialized')
