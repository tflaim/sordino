// Production storage adapter, read-write: the background's store only
// (ADR-0004). ESLint refuses this import anywhere else.
import { browser } from 'wxt/browser'
import type { StoragePort } from '../ports'
import { chromeStorageReader } from './chrome-storage-reader'

export function chromeStorage(): StoragePort {
  return {
    ...chromeStorageReader(),
    async write(docs) {
      await browser.storage.local.set(docs)
    },
  }
}
