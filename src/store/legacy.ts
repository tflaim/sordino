// Transitional: 1.x surfaces (settings page) still edit schedules in the 1.x
// key until the Schedule ticket (#7) moves them into `config`. Same fallback
// as 1.x `getSettings`: no stored schedules means the defaults.
import { DEFAULT_SCHEDULES, type Schedule } from '@/shared/types'
import { isRecord } from './docs'

export function legacySchedules(raw: unknown): Schedule[] {
  return isRecord(raw) && Array.isArray(raw.schedules)
    ? (raw.schedules as Schedule[])
    : DEFAULT_SCHEDULES
}
