// PROTOTYPE — throwaway. Floating bottom-centre bar for flipping surfaces/variants/
// theme/state. Deliberately styled in cool slate + monospace so it never reads as
// part of the Sordino design being judged.
import { useEffect } from 'react'

export interface SwitcherOption {
  key: string
  label: string
}

interface Props {
  surfaces: SwitcherOption[]
  surface: string
  onSurface: (s: string) => void
  variants: SwitcherOption[]
  variant: string
  onVariant: (v: string) => void
  theme: string
  onTheme: (t: string) => void
  themeApplies: boolean
  states: SwitcherOption[]
  state: string
  onState: (s: string) => void
}

const THEMES = ['system', 'light', 'dark']

export function PrototypeSwitcher(p: Props) {
  const idx = Math.max(
    0,
    p.variants.findIndex((v) => v.key === p.variant),
  )
  const step = (d: number) => {
    const n = p.variants.length
    p.onVariant(p.variants[(idx + d + n) % n].key)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const cur = p.variants[idx]
  const sel =
    'rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[12px] text-slate-100 focus-visible:outline-2 focus-visible:outline-sky-400'
  const btn =
    'grid h-7 w-7 place-items-center rounded-full bg-slate-700 text-slate-100 hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-sky-400'

  return (
    <div
      role="region"
      aria-label="Prototype switcher"
      data-proto-switcher
      className="fixed bottom-4 left-1/2 z-[2147483647] flex w-max max-w-[calc(100vw-16px)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl bg-slate-900/95 px-3 py-2 font-mono text-[12px] text-slate-100 shadow-[0_8px_30px_rgba(2,6,23,0.45)] ring-1 ring-slate-700"
    >
      <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
        proto
      </span>
      <label className="flex items-center gap-1">
        <span className="sr-only">Surface</span>
        <select className={sel} value={p.surface} onChange={(e) => p.onSurface(e.target.value)}>
          {p.surfaces.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} onClick={() => step(-1)} aria-label="Previous variant">
          ←
        </button>
        <span className="min-w-[150px] text-center" aria-live="polite">
          <b className="text-sky-300">{cur.key}</b> ({cur.label})
        </span>
        <button type="button" className={btn} onClick={() => step(1)} aria-label="Next variant">
          →
        </button>
      </div>
      {p.states.length > 0 && (
        <label className="flex items-center gap-1">
          <span className="text-slate-400">state</span>
          <select className={sel} value={p.state} onChange={(e) => p.onState(e.target.value)}>
            {p.states.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className="rounded-md bg-slate-700 px-2 py-1 hover:bg-slate-600 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-sky-400"
        onClick={() => p.onTheme(THEMES[(THEMES.indexOf(p.theme) + 1) % THEMES.length])}
        disabled={!p.themeApplies}
        title={p.themeApplies ? 'Cycle theme' : 'The overlay is always dark'}
      >
        theme: {p.themeApplies ? p.theme : 'dark (fixed)'}
      </button>
    </div>
  )
}
