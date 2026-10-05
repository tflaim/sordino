// Effects are desired state, not actions (decision 38): applying the same
// effects twice is harmless, so a restarted service worker only needs to settle.
import { decideMuting } from '@/shared/muting'
import type { Schedule } from '@/shared/types'
import type { StateDoc } from './docs'

export type BadgeShow = 'off' | 'muting' | 'paused'
export type AlarmName = 'muting-change'

export type Effect =
  | { kind: 'badge'; show: BadgeShow }
  /** The full set of future alarms; any other alarm is cleared. */
  | { kind: 'alarms'; at: { name: AlarmName; when: number }[] }

export function desiredEffects(
  schedules: readonly Schedule[],
  state: StateDoc,
  now: number
): Effect[] {
  const muting = decideMuting(schedules, state.mode, now)
  const show: BadgeShow = muting.muted
    ? 'muting'
    : muting.source.kind === 'pause'
      ? 'paused'
      : 'off'
  return [
    { kind: 'badge', show },
    {
      kind: 'alarms',
      at: muting.nextChange === null ? [] : [{ name: 'muting-change', when: muting.nextChange }],
    },
  ]
}
