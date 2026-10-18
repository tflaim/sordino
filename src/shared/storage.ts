import { runtimeCommandPort } from '@/store/adapters/runtime'
import { resolveConfig } from '@/store/docs'
import { type SordinoSettings, DEFAULT_SETTINGS } from './types'

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
      emergencyRefreshesUsed:
        stored.weeklyStats?.emergencyRefreshesUsed ??
        DEFAULT_SETTINGS.weeklyStats.emergencyRefreshesUsed,
    },
    // Arrays should use stored values if they exist, otherwise defaults.
    // A 1.x `schedules` array may still sit on the stored object; this shape
    // does not read or default it. The store copies that array into config.
    categories: stored.categories ?? DEFAULT_SETTINGS.categories,
    customSites: stored.customSites ?? DEFAULT_SETTINGS.customSites,
    onboardingDismissed: inferOnboardingDismissed(stored),
  }
}

export async function getSettings(): Promise<SordinoSettings> {
  const raw = await chrome.storage.local.get([STORAGE_KEY, 'config'])
  const settings = mergeWithDefaults(raw[STORAGE_KEY] ?? {})
  const config = resolveConfig(raw.config, raw[STORAGE_KEY])
  // Compatibility for the existing popup/options until their store rebuild.
  // Once Start owns a field, these pages read that same value.
  return {
    ...settings,
    categories: config.categories ?? settings.categories,
    maxBypasses: config.maxBypasses ?? settings.maxBypasses,
    onboardingDismissed: config.firstRunDone || settings.onboardingDismissed,
  }
}

async function saveSettings(settings: SordinoSettings, before: SordinoSettings): Promise<void> {
  const raw = await chrome.storage.local.get(['config'])
  const config = resolveConfig(raw.config, undefined)
  const commands = runtimeCommandPort()
  // Send only the changes the updater intended. Comparing against the later
  // config snapshot would undo another page's intervening, unrelated edits.
  if (config.categories) {
    for (const category of settings.categories) {
      const previous = before.categories.find((c) => c.id === category.id)
      if (
        !previous ||
        (previous.enabled === category.enabled &&
          JSON.stringify(previous.disabledSites ?? []) ===
            JSON.stringify(category.disabledSites ?? []))
      )
        continue
      const result = await commands.send({
        type: 'set-category',
        id: category.id,
        enabled: category.enabled,
        disabledSites: category.disabledSites ?? [],
      })
      if (!result.ok || result.outcome.kind === 'missing')
        throw new Error('Could not save category.')
    }
  }
  if (config.maxBypasses !== undefined && before.maxBypasses !== settings.maxBypasses) {
    const result = await commands.send({
      type: 'set-bypass-budget',
      maxBypasses: settings.maxBypasses,
    })
    if (!result.ok) throw new Error('Could not save bypass budget.')
  }
  // The remaining legacy fields keep their current writer until #6/#9/#12.
  await chrome.storage.local.set({ [STORAGE_KEY]: settings })
}

// Queued update to prevent race conditions
// Each update waits for the previous one to complete before executing
export async function updateSettings(
  updater: (settings: SordinoSettings) => SordinoSettings
): Promise<SordinoSettings> {
  // Chain this update after all pending updates
  updateQueue = updateQueue
    .then(async () => {
      const current = await getSettings()
      const updated = updater(current)
      await saveSettings(updated, current)
      return getSettings()
    })
    .catch(async (error) => {
      console.error('Sordino: Error updating settings', error)
      // On error, try to return current settings
      return getSettings()
    })

  return updateQueue
}

export function subscribeToSettings(callback: (settings: SordinoSettings) => void): () => void {
  let active = true
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'local' && (changes[STORAGE_KEY] || changes.config)) {
      void getSettings().then((settings) => {
        if (active) callback(settings)
      })
    }
  }

  chrome.storage.onChanged.addListener(listener)
  return () => {
    active = false
    chrome.storage.onChanged.removeListener(listener)
  }
}
