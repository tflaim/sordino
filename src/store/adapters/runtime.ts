// Messaging command transport: `runtime.sendMessage` from popup, settings and
// content scripts to the background's store. Validation and sender rules live
// in the store's `dispatch`; this adapter only works out who sent a message.
import { browser } from 'wxt/browser'
import type { Command, Result, Sender } from '../commands'
import type { Effect } from '../effects'
import type { CommandPort } from '../ports'
import type { SordinoStore } from '../store'

/** Wire envelope, so the store's messages never collide with 1.x ones. */
interface Envelope {
  sordino: 2
  command: unknown
}
const isEnvelope = (m: unknown): m is Envelope =>
  typeof m === 'object' && m !== null && (m as Envelope).sordino === 2

export function runtimeCommandPort(): CommandPort {
  return {
    async send<C extends Command>(command: C): Promise<Result<C>> {
      try {
        const envelope: Envelope = { sordino: 2, command }
        const result = (await browser.runtime.sendMessage(envelope)) as Result<C> | undefined
        if (result) return result
        return lost('no reply from the background')
      } catch (e) {
        // "Receiving end does not exist", "Extension context invalidated", …
        return lost(String(e))
      }
    },
  }
}

const lost = (detail: string) => ({
  ok: false as const,
  error: { code: 'transport-lost' as const, detail },
})

interface MessageSender {
  id?: string
  url?: string
  tab?: { id?: number }
}

/**
 * Who sent a message: one of our extension pages, a content script in a tab
 * (with its frame's URL), or null for anything else.
 * `self.origin` is `runtime.getURL('')`, e.g. `chrome-extension://<id>/`.
 */
export function toSender(
  sender: MessageSender,
  self: { id: string; origin: string }
): Sender | null {
  if (sender.id !== self.id || !sender.url) return null
  if (sender.url.startsWith(self.origin)) return { kind: 'page' }
  if (sender.tab?.id !== undefined) return { kind: 'tab', tabId: sender.tab.id, url: sender.url }
  return null
}

/**
 * Serves store commands sent over `runtime.sendMessage`. Register synchronously
 * at background start (MV3); `ready` resolves once the store has opened.
 * Effects are applied before the reply is sent. Other messages are left alone.
 */
export function serveCommands(
  ready: Promise<SordinoStore>,
  apply: (effects: Effect[]) => Promise<void>
): void {
  const self = { id: browser.runtime.id, origin: browser.runtime.getURL('/') }
  browser.runtime.onMessage.addListener((message: unknown, messageSender, sendResponse) => {
    if (!isEnvelope(message)) return false
    const sender = toSender(messageSender, self)
    const reply = async (): Promise<Result<Command>> => {
      if (!sender) return { ok: false, error: { code: 'not-allowed', detail: 'unknown sender' } }
      const { result, effects } = await (await ready).dispatch(message.command as Command, sender)
      await apply(effects)
      return result
    }
    reply().then(sendResponse, (e) =>
      sendResponse({ ok: false, error: { code: 'storage-failed', detail: String(e) } })
    )
    return true // keeps the channel open for the async reply (Chrome and Firefox)
  })
}
