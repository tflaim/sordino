import { SordinoSettings, DEFAULT_SETTINGS } from './types'

const STORAGE_KEY = 'sordino_settings'

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

export async function updateSettings(
  updater: (settings: SordinoSettings) => SordinoSettings
): Promise<SordinoSettings> {
  const current = await getSettings()
  const updated = updater(current)
  await saveSettings(updated)
  return updated
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
