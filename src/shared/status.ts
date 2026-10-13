// Plain words for the Muting decision, shared by every surface so the popup
// and settings never disagree.
import type { Muting } from './muting'

/** A local time as "17:00"; local midnight as "midnight" (the end of "rest of today"). */
export function clockTime(ms: number): string {
  const d = new Date(ms)
  if (d.getHours() === 0 && d.getMinutes() === 0) return 'midnight'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "Muting until 17:00 · Work hours", "Paused until 11:00", "Not muting". */
export function statusLine(muting: Muting): string {
  const until = muting.until === null ? '' : ` until ${clockTime(muting.until)}`
  switch (muting.source.kind) {
    case 'schedule':
      return `Muting${until} · ${muting.source.name}`
    case 'mute-now':
      return `Muting${until} · Mute now`
    case 'pause':
      return `Paused${until}`
    case 'none':
      return 'Not muting'
  }
}
