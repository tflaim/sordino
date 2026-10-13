// Readers in any context (popup, settings, overlay) read storage directly and
// subscribe; reads never write (decision 35). Docs are parsed in memory, so a
// reader never sees an unversioned or malformed shape.
import { parseConfig, parseState, parseUsage } from './docs'
import type { StorageReadPort, StoredDocs, StoredKey } from './ports'

const parse: { [K in StoredKey]: (raw: unknown) => StoredDocs[K] } = {
  config: parseConfig,
  state: parseState,
  usage: parseUsage,
}

function parseAll<K extends StoredKey>(
  keys: readonly K[],
  raw: { [P in K]?: unknown }
): Pick<StoredDocs, K> {
  return Object.fromEntries(keys.map((k) => [k, parse[k](raw[k])])) as Pick<StoredDocs, K>
}

export interface SordinoReader {
  read<K extends StoredKey>(...keys: K[]): Promise<Pick<StoredDocs, K>>
  /** Calls back with the parsed docs among `keys` that changed. */
  watch<K extends StoredKey>(
    keys: K[],
    onChange: (docs: Partial<Pick<StoredDocs, K>>) => void
  ): () => void
}

export function openReader(storage: StorageReadPort): SordinoReader {
  return {
    async read(...keys) {
      return parseAll(keys, await storage.read(keys))
    },
    watch(keys, onChange) {
      return storage.watch(keys, (changed) => {
        const present = keys.filter((k) => k in changed)
        onChange(parseAll(present, changed))
      })
    },
  }
}
