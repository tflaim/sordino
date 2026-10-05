// The only things the Sordino store touches outside itself (ADR-0004).
// Readers in any context get the read half of storage; only the background's
// store holds the read-write half, so "only background writes" is a type rule.
import type { Command, Result } from './commands'
import type { ConfigDoc, StateDoc, UsageDoc } from './docs'

/** The three versioned keys the store owns (decision 36). */
export type StoredKey = 'config' | 'state' | 'usage'
/** The 1.x settings object. Read-only: kept as rollback insurance, and until
 * schedules move into `config` (#7) the store reads them from here. */
export type LegacyKey = 'sordino_settings'
export type StorageKey = StoredKey | LegacyKey

export interface StoredDocs {
  config: ConfigDoc
  state: StateDoc
  usage: UsageDoc
}

/** All a reader context gets. Values are raw: parse them through `openReader`. */
export interface StorageReadPort {
  read<K extends StorageKey>(keys: readonly K[]): Promise<{ [P in K]?: unknown }>
  /** Calls back with the new raw values of whichever watched keys changed. */
  watch<K extends StorageKey>(
    keys: readonly K[],
    onChange: (changed: { [P in K]?: unknown }) => void
  ): () => void
}

/** Background only. */
export interface StoragePort extends StorageReadPort {
  /** One atomic set of the given docs; rejects on failure. */
  write(docs: Partial<StoredDocs>): Promise<void>
}

/** Epoch ms. Local days come from the process time zone. */
export type Clock = () => number

/** How popup, settings, overlay and background-internal callers send commands. */
export interface CommandPort {
  /** Never rejects: a lost transport is `{ ok: false, error: { code: 'transport-lost' } }`. */
  send<C extends Command>(command: C): Promise<Result<C>>
}
