/*
 * PROTOTYPE — throwaway. Question: what should Sordino 2.0's overlay, popup, First run
 * and Usage look like? 3 variants each, switchable via ?surface=&variant=&theme=.
 *
 * Plan: one Vite page (npm run proto), not part of the extension build. Each surface
 * mounts its variants inside a fake host (busy forum feed, browser toolbar, settings
 * tabs) so nothing is judged in a vacuum. Extra params: ?state= for overlay
 * (normal|spent|armed), popup (schedule|mutenow|paused|off) and motion (normal|spent|own);
 * the motion surface (motion/variants.tsx) is the round-2 motion study; the stage surface
 * (stage/variants.tsx) is round 3, genre stages. ?proto=1 shows the
 * switcher in a static build. No persistence; all state is in memory.
 * Lives on branch prototype/overhaul-ui only. Do not merge.
 */
/// <reference types="vite/client" />
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cormorant-garamond/latin-500.css'
import '@fontsource/cormorant-garamond/latin-500-italic.css'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import './proto.css'
import { PrototypeSwitcher } from './PrototypeSwitcher'
import { overlayVariants, overlayStates } from './overlay/variants'
import { popupVariants } from './popup/variants'
import { popupStates } from './popup/model'
import { firstrunVariants } from './firstrun/variants'
import { usageVariants } from './usage/variants'
import { motionVariants, motionStates } from './motion/variants'
import { stageVariants, stageStates } from './stage/variants'

// `extra` carries surface-specific state beyond surface/variant/theme/state (the motion
// surface stores motion mode and motif there, e.g. #motion.F.dark.normal.still.2).
type Variant = {
  key: string
  label: string
  Component: (p: {
    state: string
    extra?: string
    onExtra?: (x: string) => void
    nav?: { setVariant: (v: string, extra?: string) => void; setState: (s: string) => void }
  }) => React.ReactNode
}

const SURFACES: Record<string, { label: string; variants: Variant[]; states: { key: string; label: string }[] }> = {
  overlay: { label: 'Overlay', variants: overlayVariants, states: overlayStates },
  popup: { label: 'Popup', variants: popupVariants, states: popupStates },
  firstrun: { label: 'First run', variants: firstrunVariants as Variant[], states: [] },
  usage: { label: 'Usage', variants: usageVariants as Variant[], states: [] },
  motion: { label: 'Motion', variants: motionVariants, states: motionStates },
  stage: { label: 'Genre stage', variants: stageVariants, states: stageStates },
}

// Surfaces that are always dark (the overlay and the motion study built on it).
const DARK_ONLY = ['overlay', 'motion', 'stage']

// Hosts that only pass a bare #anchor (e.g. a published artifact) get the same state
// as a dot-separated hash token: #surface.variant.theme[.state[.extra...]]
function readParams() {
  const q = new URLSearchParams(location.search)
  const h = location.hash.replace(/^#/, '').split('.')
  if (!q.get('surface') && h[0]) {
    q.set('surface', h[0]); if (h[1]) q.set('variant', h[1]); if (h[2]) q.set('theme', h[2]); if (h[3]) q.set('state', h[3])
    if (h.length > 4) q.set('extra', h.slice(4).join('.'))
  }
  const surface = SURFACES[q.get('surface') ?? ''] ? q.get('surface')! : 'overlay'
  const s = SURFACES[surface]
  const variant = s.variants.some((v) => v.key === q.get('variant')) ? q.get('variant')! : s.variants[0].key
  const theme = ['light', 'dark', 'system'].includes(q.get('theme') ?? '') ? q.get('theme')! : 'system'
  const state = s.states.some((x) => x.key === q.get('state')) ? q.get('state')! : (s.states[0]?.key ?? '')
  return { surface, variant, theme, state, extra: q.get('extra') ?? '', proto: q.get('proto') === '1' }
}

function App() {
  const [p, setP] = useState(readParams)
  const surface = SURFACES[p.surface]
  const v = surface.variants.find((x) => x.key === p.variant)!

  // Keep the URL in sync so every state is shareable and reload-stable.
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    q.set('surface', p.surface)
    q.set('variant', p.variant)
    q.set('theme', p.theme)
    if (p.state) q.set('state', p.state)
    else q.delete('state')
    if (p.extra) q.set('extra', p.extra)
    else q.delete('extra')
    const hash = [p.surface, p.variant, p.theme, p.state, p.extra].filter(Boolean).join('.')
    try {
      history.replaceState(null, '', location.search ? `${location.pathname}?${q.toString()}` : `#${hash}`)
    } catch {
      /* sandboxed hosts may refuse; state still lives in memory */
    }
    // The overlay is always dark; the theme param applies to the other surfaces.
    document.documentElement.dataset.theme = DARK_ONLY.includes(p.surface) ? 'dark' : p.theme
    document.title = `${surface.label} ${p.variant} · Sordino prototype`
  }, [p, surface.label])

  const showBar = import.meta.env.DEV || p.proto || import.meta.env.VITE_PROTO_BAR === '1'
  const set = (patch: Partial<typeof p>) => setP((cur) => ({ ...cur, ...patch }))

  return (
    <>
      <v.Component
        key={`${p.surface}-${p.variant}-${p.state}`}
        state={p.state}
        extra={p.extra}
        onExtra={(extra) => set({ extra })}
        nav={{ setVariant: (variant, extra) => set(extra === undefined ? { variant } : { variant, extra }), setState: (state) => set({ state }) }}
      />
      {showBar && (
        <PrototypeSwitcher
          surfaces={Object.entries(SURFACES).map(([key, s]) => ({ key, label: s.label }))}
          surface={p.surface}
          onSurface={(s) =>
            set({ surface: s, variant: SURFACES[s].variants[0].key, state: SURFACES[s].states[0]?.key ?? '', extra: '' })
          }
          variants={surface.variants}
          variant={p.variant}
          onVariant={(variant) => set({ variant })}
          theme={p.theme}
          onTheme={(theme) => set({ theme })}
          themeApplies={!DARK_ONLY.includes(p.surface)}
          placement={p.surface === 'motion' || p.surface === 'stage' ? 'top' : 'bottom'}
          states={surface.states}
          state={p.state}
          onState={(state) => set({ state })}
        />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
