// PROTOTYPE — motion tokens for the overlay motion study. Premium personality
// (motion-design skill): one signature easing, three durations, 0% overshoot.
// Everything here is CSS/WAAPI-portable (ADR-0003): element.animate() only.

/** Signature easing for every eased motion. Progress that IS the clock runs linear. */
export const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

/** Duration palette: quick / standard / slow. */
export const T = { quick: 350, standard: 500, slow: 800 } as const

/**
 * full     = all four events choreographed.
 * reduced  = OS prefers-reduced-motion (real or simulated): no spatial movement,
 *            opacity only, durations halved; the gesture steps by opacity per beat.
 * still    = Sordino Stillness: no motion at all, no gesture; the plain number rules.
 */
export type Mode = 'full' | 'reduced' | 'still'

/** Strip spatial properties (and line drawing) so a keyframe list becomes opacity-only. */
function opacityOnly(frames: Keyframe[]): Keyframe[] {
  return frames.map((f) => {
    const rest = { ...f }
    delete rest.transform
    delete rest.strokeDashoffset
    return rest
  })
}

/**
 * The single animation entry point. Same choreography in every mode, degraded:
 * reduced → opacity only, half duration (delays keep their clock position);
 * still → no tween at all: the end state applies instantly, at the same moment.
 */
export function play(
  el: Element | null | undefined,
  frames: Keyframe[],
  opts: KeyframeAnimationOptions & { duration: number },
  mode: Mode,
): Animation | null {
  if (!el) return null
  if (mode === 'still') return el.animate(opacityOnly(frames), { ...opts, duration: 0, fill: opts.fill ?? 'both' })
  if (mode === 'reduced') return el.animate(opacityOnly(frames), { ...opts, duration: opts.duration / 2 })
  return el.animate(frames, opts)
}

/** Cubic-bezier solver for the JS-driven audio level (the page's volume, not overlay motion). */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0, hi = 1, t = x
    for (let i = 0; i < 24; i++) {
      const v = sx(t)
      if (Math.abs(v - x) < 1e-4) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return sy(t)
  }
}
export const easeFn = bezier(0.4, 0, 0.2, 1)
