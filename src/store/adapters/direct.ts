// Direct-call command transport: tests (one port per simulated sender) and
// background-internal callers. Clones both ways to keep parity with the wire.
import type { Effect } from '../effects'
import type { CommandPort } from '../ports'
import type { Sender } from '../commands'
import type { SordinoStore } from '../store'

export function directCommandPort(
  store: SordinoStore,
  sender: Sender,
  apply: (effects: Effect[]) => unknown = () => {}
): CommandPort {
  return {
    async send(command) {
      const { result, effects } = await store.dispatch(structuredClone(command), sender)
      await apply(effects)
      return structuredClone(result)
    },
  }
}
