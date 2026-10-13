import { defineBackground } from 'wxt/utils/define-background'
import { getSettings, updateSettings } from '@/shared/storage'
import { decideMuting } from '@/shared/muting'
import {
  COMMAND_FAILED,
  matchMutedSite,
  muteThisSiteNotice,
  parseMutedSite,
  type MutedList,
} from '@/shared/muted-sites'
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

async function mutedList(settings: SordinoSettings, reader: SordinoReader): Promise<MutedList> {
  const { config } = await reader.read('config')
  return { categories: settings.categories, ownSites: config.ownSites }
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

// A bypass covers the muted site it was granted for. 1.x bypasses were keyed
// by the raw host; those still match until they expire.
function hasBypass(url: string, settings: SordinoSettings, list: MutedList): boolean {
  const bypass = settings.bypassState.activeBypass
  if (!bypass || Date.now() > bypass.expiresAt) return false
  const matched = matchMutedSite(url, list)
  if (matched?.id === bypass.site) return true
  const parsed = parseMutedSite(url)
  if (!parsed.ok) return false
  return parsed.site.id === bypass.site || parsed.site.id.endsWith(`.${bypass.site}`)
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

async function handleMessage(message: MessageType, reader: SordinoReader): Promise<unknown> {
  const settings = await checkBypassReset()

  switch (message.type) {
    case 'GET_BLOCK_STATUS': {
      const { state, config } = await reader.read('state', 'config')
      const muting = decideMuting(config.schedules, state.mode, Date.now())
      if (!muting.muted) return { isBlocked: false }

      const list = await mutedList(settings, reader)
      const matched = matchMutedSite(message.url, list)
      if (!matched) return { isBlocked: false }

      if (hasBypass(message.url, settings, list)) {
        return { isBlocked: false }
      }

      // The matched muted site's id is the key Usage will keep using.
      const blockKey = matched.id
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

      const list = await mutedList(settings, reader)
      const matched = matchMutedSite(message.site, list)
      const parsed = parseMutedSite(message.site)
      const site = matched?.id ?? (parsed.ok ? parsed.site.id : getSiteFromUrl(message.site))

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

  // Schedules live in `config`. A change re-settles the badge and alarms.
  // The overlay still asks GET_BLOCK_STATUS until it watches storage itself (#5),
  // and a Mute now or Pause re-checks open tabs.
  reader.watch(['config'], () => void settle())
  reader.watch(['state'], () => void broadcastSettingsUpdate())

  // "Mute this site" adds the page through the same command. It does not start muting.
  // Adding is quiet (the page is now muted). Already muted, refused, or a command
  // that did not run uses the popup's sentence.
  const muteThisSite = 'mute-this-site'
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== muteThisSite || !info.pageUrl) return
    const input = info.pageUrl
    void ready
      .then((store) => store.dispatch({ type: 'add-muted-site', input }, { kind: 'background' }))
      .then(({ result, effects }) => {
        applyEffects(effects)
        const message = muteThisSiteNotice(result)
        if (message) notifyMuteThisSite(message)
      })
      .catch((error) => {
        console.error('Sordino: Mute this site failed', error)
        notifyMuteThisSite(COMMAND_FAILED)
      })
  })
  chrome.contextMenus.create(
    {
      id: muteThisSite,
      title: 'Mute this site',
      contexts: ['page', 'frame', 'selection', 'link', 'image', 'video', 'audio'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    },
    () => void chrome.runtime.lastError // the id already exists after the first start
  )

  function notifyMuteThisSite(message: string): void {
    chrome.notifications.create(
      muteThisSite,
      {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: 'Sordino',
        message,
      },
      () => void chrome.runtime.lastError
    )
  }

  // 1.x messages from the overlay and settings page, until their tickets
  // replace them with store commands.
  chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return false
    handleMessage(message, reader).then(sendResponse)
    return true // Keep channel open for async response
  })
})
