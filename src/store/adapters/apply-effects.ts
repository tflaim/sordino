// Applies the store's desired-state effects to the browser. Idempotent: the
// badge is set, and alarms are reconciled to exactly the desired set.
import { browser } from 'wxt/browser'
import type { BadgeShow, Effect } from '../effects'

const BADGE: Record<BadgeShow, { text: string; color: string }> = {
  muting: { text: ' ', color: '#22c55e' },
  paused: { text: 'II', color: '#eab308' },
  off: { text: ' ', color: '#6b7280' },
}

export async function applyEffects(effects: Effect[]): Promise<void> {
  for (const effect of effects) {
    try {
      switch (effect.kind) {
        case 'badge': {
          const { text, color } = BADGE[effect.show]
          await browser.action.setBadgeText({ text })
          await browser.action.setBadgeBackgroundColor({ color })
          break
        }
        case 'alarms': {
          const wanted = new Map(effect.at.map((a) => [a.name as string, a.when]))
          for (const alarm of await browser.alarms.getAll()) {
            if (wanted.get(alarm.name) === alarm.scheduledTime) wanted.delete(alarm.name)
            else await browser.alarms.clear(alarm.name)
          }
          for (const [name, when] of wanted) await browser.alarms.create(name, { when })
          break
        }
      }
    } catch (e) {
      // The command has already run; a failed effect must not lose its reply.
      console.warn('Sordino: could not apply effect', effect, e)
    }
  }
}
