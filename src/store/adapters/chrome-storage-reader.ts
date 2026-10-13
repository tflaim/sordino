// Production storage adapter, read half: what every context may hold.
import { browser } from 'wxt/browser'
import type { StorageKey, StorageReadPort } from '../ports'

export function chromeStorageReader(): StorageReadPort {
  return {
    async read<K extends StorageKey>(keys: readonly K[]) {
      return (await browser.storage.local.get([...keys])) as { [P in K]?: unknown }
    },
    watch<K extends StorageKey>(
      keys: readonly K[],
      onChange: (changed: { [P in K]?: unknown }) => void
    ) {
      const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
        if (area !== 'local') return
        const mine = keys.filter((k) => k in changes)
        // A removed key arrives without newValue; readers parse that to defaults.
        if (!mine.length) return
        onChange(
          Object.fromEntries(mine.map((k) => [k, changes[k]!.newValue])) as { [P in K]?: unknown }
        )
      }
      browser.storage.onChanged.addListener(listener)
      return () => browser.storage.onChanged.removeListener(listener)
    },
  }
}
