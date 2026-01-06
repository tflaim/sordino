import { SordinoSettings, DEFAULT_SETTINGS } from './types'

const STORAGE_KEY = 'sordino_settings'

// Simple mutex to prevent race conditions in read-modify-write operations
let updateQueue: Promise<SordinoSettings> = Promise.resolve(DEFAULT_SETTINGS)

export async function getSettings(): Promise<SordinoSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (result[STORAGE_KEY]) {
        resolve(result[STORAGE_KEY] as SordinoSettings)
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
      callback(changes[STORAGE_KEY].newValue as SordinoSettings)
    }
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
