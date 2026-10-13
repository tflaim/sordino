// In-memory storage adapter for tests. Watchers fire on a microtask after a
// write, as `storage.onChanged` fires after `set`, so ordering bugs show up.
import type { StorageKey, StoragePort, StoredDocs } from '../ports'

export interface MemoryStorage extends StoragePort {
  /** Every write, in the order it started. */
  readonly writes: Partial<StoredDocs>[]
  /** Makes the next write reject. */
  failNextWrite(): void
  /** Holds every write until the returned release is called. */
  holdWrites(): () => void
  /** Sets raw values as another context would (no write recorded). */
  seed(values: { [K in StorageKey]?: unknown }): void
}

export function memoryStorage(initial: { [K in StorageKey]?: unknown } = {}): MemoryStorage {
  const data = new Map<string, unknown>(Object.entries(structuredClone(initial)))
  const watchers = new Set<{
    keys: readonly string[]
    onChange: (c: Record<string, unknown>) => void
  }>()
  const writes: Partial<StoredDocs>[] = []
  let failNext = false
  let held: Promise<void> | null = null

  function notify(changed: Record<string, unknown>) {
    queueMicrotask(() => {
      for (const w of watchers) {
        const mine = Object.fromEntries(Object.entries(changed).filter(([k]) => w.keys.includes(k)))
        if (Object.keys(mine).length) w.onChange(structuredClone(mine))
      }
    })
  }

  return {
    writes,
    async read<K extends StorageKey>(keys: readonly K[]) {
      const present = keys.filter((k) => data.has(k)).map((k) => [k, data.get(k)])
      return structuredClone(Object.fromEntries(present)) as { [P in K]?: unknown }
    },
    watch(keys, onChange) {
      const w = { keys, onChange: onChange as (c: Record<string, unknown>) => void }
      watchers.add(w)
      return () => void watchers.delete(w)
    },
    async write(docs) {
      writes.push(structuredClone(docs))
      if (held) await held
      if (failNext) {
        failNext = false
        throw new Error('write failed (test)')
      }
      for (const [k, v] of Object.entries(docs)) data.set(k, structuredClone(v))
      notify(docs)
    },
    failNextWrite() {
      failNext = true
    },
    holdWrites() {
      let release!: () => void
      held = new Promise((r) => (release = r))
      return () => {
        held = null
        release()
      }
    },
    seed(values) {
      for (const [k, v] of Object.entries(values)) data.set(k, structuredClone(v))
      notify(values)
    },
  }
}
