import { SordinoSettings, DEFAULT_SETTINGS } from './types'

const STORAGE_KEY = 'sordino_settings'

// Simple mutex to prevent race conditions in read-modify-write operations
let updateQueue: Promise<SordinoSettings> = Promise.resolve(DEFAULT_SETTINGS)

// Heuristic: a stored object lacking `onboardingDismissed` but with real usage
// (any custom sites, any logged blocks, any persisted weekly data) is a returning
// user upgrading across the onboarding-card release. Default them to dismissed so
// they don't get re-greeted with a first-run tip.
function inferOnboardingDismissed(stored: Partial<SordinoSettings>): boolean {
  if (typeof stored.onboardingDismissed === 'boolean') return stored.onboardingDismissed
  const hasCustomSites = (stored.customSites?.length ?? 0) > 0
  const hasBlocks = (stored.stats?.blocksTriggered ?? 0) > 0
  const hasWeeklyHistory = (stored.weeklyStats?.days?.length ?? 0) > 0
  return hasCustomSites || hasBlocks || hasWeeklyHistory
}

// Deep merge stored settings with defaults to handle schema migrations
function mergeWithDefaults(stored: Partial<SordinoSettings>): SordinoSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    blockState: {
      ...DEFAULT_SETTINGS.blockState,
      ...stored.blockState,
    },
    bypassState: {
      ...DEFAULT_SETTINGS.bypassState,
      ...stored.bypassState,
    },
    stats: {
      ...DEFAULT_SETTINGS.stats,
      ...stored.stats,
      siteStats: stored.stats?.siteStats ?? DEFAULT_SETTINGS.stats.siteStats,
    },
    weeklyStats: {
      ...DEFAULT_SETTINGS.weeklyStats,
      ...stored.weeklyStats,
      siteStats: stored.weeklyStats?.siteStats ?? DEFAULT_SETTINGS.weeklyStats.siteStats,
      emergencyRefreshesUsed: stored.weeklyStats?.emergencyRefreshesUsed ?? DEFAULT_SETTINGS.weeklyStats.emergencyRefreshesUsed,
    },
    // Arrays should use stored values if they exist, otherwise defaults
    schedules: stored.schedules ?? DEFAULT_SETTINGS.schedules,
    categories: stored.categories ?? DEFAULT_SETTINGS.categories,
    customSites: stored.customSites ?? DEFAULT_SETTINGS.customSites,
    onboardingDismissed: inferOnboardingDismissed(stored),
  }
}

export async function getSettings(): Promise<SordinoSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (result[STORAGE_KEY]) {
        // Merge with defaults to handle new fields added in updates
        resolve(mergeWithDefaults(result[STORAGE_KEY]))
      } else {
        resolve(DEFAULT_SETTINGS)
      }
    })
  })
}

export async function saveSettings(settings: SordinoSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: settings }, resolve)
  })
}

// Queued update to prevent race conditions
// Each update waits for the previous one to complete before executing
export async function updateSettings(
  updater: (settings: SordinoSettings) => SordinoSettings
): Promise<SordinoSettings> {
  // Chain this update after all pending updates
  updateQueue = updateQueue.then(async () => {
    const current = await getSettings()
    const updated = updater(current)
    await saveSettings(updated)
    return updated
  }).catch(async (error) => {
    console.error('Sordino: Error updating settings', error)
    // On error, try to return current settings
    return getSettings()
  })

  return updateQueue
}

export function subscribeToSettings(
  callback: (settings: SordinoSettings) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      // Merge with defaults to handle new fields
      callback(mergeWithDefaults(changes[STORAGE_KEY].newValue))
    }
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
