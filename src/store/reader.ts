// Readers in any context (popup, settings, overlay) read storage directly and
// subscribe; reads never write (decision 35). Docs are parsed in memory, so a
// reader never sees an unversioned or malformed shape.
import { parseConfig, parseState, parseUsage, resolveConfig } from './docs'
import type { StorageKey, StorageReadPort, StoredDocs, StoredKey } from './ports'

const parse: { [K in StoredKey]: (raw: unknown) => StoredDocs[K] } = {
  config: parseConfig,
  state: parseState,
  usage: parseUsage,
}

function parseAll<K extends StoredKey>(
  keys: readonly K[],
  raw: { [P in K]?: unknown },
  legacySettings?: unknown
): Pick<StoredDocs, K> {
  return Object.fromEntries(
    keys.map((k) => [
      k,
      k === 'config'
        ? resolveConfig((raw as { config?: unknown }).config, legacySettings)
        : parse[k](raw[k]),
    ])
  ) as Pick<StoredDocs, K>
}

export interface SordinoReader {
  read<K extends StoredKey>(...keys: K[]): Promise<Pick<StoredDocs, K>>
  /** Calls back with the parsed docs among `keys` that changed. */
  watch<K extends StoredKey>(
    keys: K[],
    onChange: (docs: Partial<Pick<StoredDocs, K>>) => void
  ): () => void
}

export function openReader(storage: StorageReadPort, ready?: Promise<unknown>): SordinoReader {
  const gate = () =>
    Promise.resolve(ready).then(
      () => undefined,
      () => undefined
    )
  return {
    async read(...keys) {
      // The background's open writes migration. Readers that share that promise
      // do not read until the write has finished.
      await gate()
      // A config missing its schedule list or own-site list is filled from the 1.x key, in memory.
      const list = keys as readonly StoredKey[]
      const ask: StorageKey[] = list.includes('config') ? [...list, 'sordino_settings'] : [...list]
      const raw = await storage.read(ask)
      const legacy = (raw as { sordino_settings?: unknown }).sordino_settings
      return parseAll(keys, raw, legacy)
    },
    watch(keys, onChange) {
      return storage.watch(keys, (changed) => {
        const present = keys.filter((k) => k in changed)
        onChange(parseAll(present, changed))
      })
    },
  }
}
