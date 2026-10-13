import { defineBackground } from 'wxt/utils/define-background'
import { getSettings, updateSettings } from '@/shared/storage'
import { decideMuting } from '@/shared/muting'
import { clockTime } from '@/shared/status'
import type { SordinoSettings, MessageType } from '@/shared/types'
import { getLocalDateString, MAX_QUICK_BYPASSES } from '@/shared/types'
import { applyEffects } from '@/store/adapters/apply-effects'
import { chromeStorage } from '@/store/adapters/chrome-storage'
import { serveCommands } from '@/store/adapters/runtime'
import { openReader, type SordinoReader } from '@/store/reader'
import { openStore } from '@/store/store'

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

// Check if URL matches any blocked site
function isUrlBlocked(url: string, settings: SordinoSettings): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace(/^www\./, '')

    // Check categories
    for (const category of settings.categories) {
      if (!category.enabled) continue
      const disabledSites = category.disabledSites ?? []
      for (const site of category.sites) {
        if (disabledSites.includes(site)) continue // Skip toggled-off sites
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
          ...weeklyStats.days.filter((d) => d.date !== prevStats.date),
          {
            date: prevStats.date,
            blocksTriggered: prevStats.blocksTriggered,
            bypassesUsed: prevStats.bypassesUsed,
          },
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

async function handleMessage(message: MessageType, reader: SordinoReader): Promise<unknown> {
  const settings = await checkBypassReset()

  switch (message.type) {
    case 'GET_BLOCK_STATUS': {
      const { state } = await reader.read('state')
      const muting = decideMuting(settings.schedules, state.mode, Date.now())

      if (!muting.muted) {
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
            blocksTriggered: isFirstBlockForSite
              ? s.stats.blocksTriggered + 1
              : s.stats.blocksTriggered,
            siteStats,
          },
        }
      })

      return {
        isBlocked: true,
        reason: muting.source.kind === 'schedule' ? muting.source.name : 'Mute now',
        timeRemaining: muting.until === null ? undefined : `until ${clockTime(muting.until)}`,
        bypassesRemaining:
          (settings.maxBypasses ?? MAX_QUICK_BYPASSES) - settings.bypassState.quickBypassesUsed,
        bypassDuration: settings.bypassDurationMinutes ?? 5,
        scaffoldingMode: settings.scaffoldingMode ?? false,
      }
    }

    case 'USE_BYPASS': {
      const maxBypasses = settings.maxBypasses ?? MAX_QUICK_BYPASSES
      const remaining = maxBypasses - settings.bypassState.quickBypassesUsed
      if (remaining <= 0) {
        return { success: false, remaining: 0 }
      }

      const site = getSiteFromUrl(message.site)

      // Remove site from counted blocks (allows re-counting if they come back)
      await removeCountedBlock(site)

      await updateSettings((s) => {
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
              expiresAt: Date.now() + (settings.bypassDurationMinutes ?? 5) * 60 * 1000,
            },
          },
          stats: {
            ...s.stats,
            bypassesUsed: s.stats.bypassesUsed + 1,
            siteStats,
          },
        }
      })

      return { success: true, remaining: remaining - 1 }
    }

    case 'GET_SETTINGS': {
      return settings
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
      return { success: true, remaining: settings.maxBypasses ?? MAX_QUICK_BYPASSES }
    }

    case 'CLEAR_BYPASS': {
      await updateSettings((s) => ({
        ...s,
        bypassState: {
          ...s.bypassState,
          activeBypass: null,
        },
      }))
      await broadcastSettingsUpdate()
      return { success: true }
    }

    default:
      return { error: 'Unknown message type' }
  }
}

export default defineBackground(() => {
  // The Sordino store is the one writer of `config`, `state` and `usage`
  // (ADR-0004). Listeners are registered synchronously and wait for it to open.
  const storage = chromeStorage()
  const reader = openReader(storage)
  const ready = openStore({ storage, clock: Date.now })
  const settle = () =>
    ready
      .then((store) => store.settle())
      .then(applyEffects)
      .catch((error) => console.error('Sordino: could not settle', error))
  serveCommands(ready, applyEffects)
  chrome.alarms.onAlarm.addListener(settle) // Mute now / Pause ends, schedule boundaries
  chrome.runtime.onStartup.addListener(settle)
  chrome.runtime.onInstalled.addListener(async () => {
    try {
      await checkBypassReset() // initialises the 1.x settings on install
    } catch (error) {
      console.error('Sordino: Error in onInstalled handler', error)
    }
    await settle()
  })

  // Transitional, until schedules move into `config` (#7) and the overlay
  // watches storage itself (#5): schedules edited on the 1.x settings page
  // re-settle the badge and alarms, and a Mute now or Pause re-checks open tabs.
  let lastSchedules: string | undefined
  storage.watch(['sordino_settings'], ({ sordino_settings }) => {
    const schedules = JSON.stringify((sordino_settings as SordinoSettings | undefined)?.schedules)
    if (schedules === lastSchedules) return
    lastSchedules = schedules
    void settle()
  })
  reader.watch(['state'], () => void broadcastSettingsUpdate())

  // 1.x messages from the overlay and settings page, until their tickets
  // replace them with store commands.
  chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return false
    handleMessage(message, reader).then(sendResponse)
    return true // Keep channel open for async response
  })
})
