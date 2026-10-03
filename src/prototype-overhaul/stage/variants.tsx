// PROTOTYPE — throwaway. Round 3: GENRE STAGES (decision 52).
// Question: if the Metronome (round 2 pick, decision 51) is the constant, what should it
// feel like when each arrival *performs* that same measure in a musical style, on a
// dark generative stage behind Overlay C? Variant key = genre:
//   B Baroque · R Romantic · I Impressionist · J Jazz · M Minimalist
// The wait is always N countable beats (5 at ♩ = 60; 10 at ♩ = 20 when the budget is
// spent) and the plain "Bypass in N" stays visible and true. Each genre carries only the
// four musical events (mute going in, the wait, the release, the turn back) and goes
// still once its cadence has landed. Stillness and OS reduced motion: one composed
// still frame plus the plain number. No WebGL: the round-2 SVG metronome.
//
// Reuses round 2: the arrival (cover on the first frame, the page's 800 ms decrescendo,
// then pause), Overlay C's layout, the fake playing video and the prototype monitor.
//
// URL: #stage.<B|R|I|J|M>.dark.<normal|spent|own>[.<full|still|reduced>][.rot][.nogl][.r75|.r50]
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { HostFeed } from '../overlay/HostFeed'
import { Logo } from '../ui'
import { bypass, quote } from '../data'
import { EASE, T, play, type Mode } from '../motion/tokens'
import { PagePlayer } from '../motion/player'
import { LeadVideo, Meter, Readout } from '../motion/FakeVideo'
import { families } from '../motion/gestures'
import { GENRES, genreByKey, plan as makePlan, type Genre, type Plan } from './score'
import type { Stage, StagePerf } from './engine'

export const stageStates = [
  { key: 'normal', label: 'normal (5 beats, 5 s)' },
  { key: 'spent', label: 'budget spent (10 beats, 30 s)' },
  { key: 'own', label: 'own line' },
]

const SITE = 'reddit.com'
const UNTIL = '17:00'
const PRELUDE_MS = 1400
const COVER_DELAY = 250
/** Turn back: navigation starts at +0 ms; the old page stays on screen until the next one
 *  commits (~250 ms for a back navigation). Any cadence plays only inside this window. */
const NAV_COMMIT_MS = 250
type UserMode = 'full' | 'still' | 'reduced'
type Phase = 'prelude' | 'muted' | 'releasing' | 'released' | 'turning' | 'turned'

const Metronome = families.find((f) => f.key === 'M')!.Gesture

function parseExtra(extra = '') {
  const parts = extra.split('.')
  const mode: UserMode = parts.includes('still') ? 'still' : parts.includes('reduced') ? 'reduced' : 'full'
  const rs = parts.find((x) => /^r(50|75)$/.test(x))
  return { mode, rot: parts.includes('rot'), nogl: parts.includes('nogl'), scale: rs ? Number(rs.slice(1)) / 100 : 1 }
}
function serializeExtra(mode: UserMode, rot: boolean, nogl: boolean, scale: number) {
  const flags = [rot ? 'rot' : '', nogl ? 'nogl' : '', scale < 1 ? `r${Math.round(scale * 100)}` : ''].filter(Boolean)
  return [mode === 'full' && flags.length ? 'full' : mode === 'full' ? '' : mode, ...flags].filter(Boolean).join('.')
}

function useOsReduced() {
  const q = '(prefers-reduced-motion: reduce)'
  const [v, setV] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const on = () => setV(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return v
}

/** Tight text boxes (one per element, from its line boxes) for the stage's contrast cap. */
function textRects(els: (Element | null)[]) {
  const out: { left: number; top: number; right: number; bottom: number }[] = []
  for (const el of els) {
    if (!el) continue
    const r = document.createRange()
    r.selectNodeContents(el)
    const b = r.getBoundingClientRect()
    if (b.width > 0 && b.height > 0) out.push({ left: b.left, top: b.top, right: b.right, bottom: b.bottom })
  }
  return out
}

// ================================================================ the count on the button
// N dots, one per onset (rubato onsets for Romantic: the dot and the stage agree), the
// last in brass. Each landing *ends* on its beat. Full motion only.
function BeatDots({ p, t0, frozen }: { p: Plan; t0: number; frozen: boolean }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  const anims = useRef<Animation[]>([])
  useEffect(() => {
    const D = p.beatMs >= 3000 ? T.slow : T.quick
    anims.current = refs.current.flatMap((el, i) => {
      if (!el) return []
      const a = el.animate(
        [
          { opacity: 0, transform: 'scale(0.4)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: D, delay: p.onsets[i + 1] - D, easing: EASE, fill: 'both' },
      )
      a.startTime = t0
      return [a]
    })
    return () => anims.current.forEach((a) => a.cancel())
  }, [p, t0])
  useEffect(() => {
    if (frozen) anims.current.forEach((a) => a.pause())
  }, [frozen])
  const dense = p.beats > 6
  return (
    <span className={`flex items-center ${dense ? 'gap-[5px]' : 'gap-[8px]'}`} aria-hidden="true">
      {p.onsets.slice(1).map((_, i) => (
        <span key={i} className={`relative block ${dense ? 'h-[6px] w-[6px]' : 'h-[8px] w-[8px]'}`}>
          <span className="absolute inset-0 rounded-full border border-muted opacity-60" />
          <span
            ref={(el) => {
              refs.current[i] = el
            }}
            className={`absolute inset-0 rounded-full ${i === p.beats - 1 ? 'bg-brass' : 'bg-fg'}`}
            style={{ opacity: 0 }}
          />
        </span>
      ))}
    </span>
  )
}

// ================================================================ overlay (C) over the stage
interface OverlayProps {
  genre: Genre
  p: Plan
  mode: Mode
  phase: Phase
  t0: number
  remaining: number
  ready: boolean
  spent: boolean
  ownLine: string | null
  stage: Stage | null
  fallback: boolean
  onTurnBack: () => void
  onBypass: () => void
}

function StageOverlay(o: OverlayProps) {
  const root = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const words = useRef<HTMLElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const hairpin = useRef<SVGGElement>(null)
  const muteNote = useRef<HTMLSpanElement>(null)
  const edge = useRef<HTMLSpanElement>(null)
  const turnBack = useRef<HTMLButtonElement>(null)
  const total = o.p.beats * o.p.beatMs

  // 1 · Mute going in (shared with round 2): the cover is opaque on the first frame;
  // the words settle, the hairpin draws over the page's 800 ms decrescendo.
  useEffect(() => {
    turnBack.current?.focus({ preventScroll: true })
    const m = o.mode
    const settle = [
      { opacity: 0, transform: 'scale(0.98)' },
      { opacity: 1, transform: 'scale(1)' },
    ]
    const list = [
      play(head.current, settle, { duration: T.standard, easing: EASE, fill: 'both' }, m),
      play(words.current, settle, { duration: T.standard, delay: 80, easing: EASE, fill: 'both' }, m),
      play(bar.current, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: T.standard, delay: 160, easing: EASE, fill: 'both' }, m),
      m === 'full'
        ? hairpin.current!.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: T.slow, easing: EASE, fill: 'both' })
        : play(hairpin.current, [{ opacity: 0 }, { opacity: 1 }], { duration: T.slow, easing: EASE, fill: 'both' }, m),
      play(muteNote.current, [{ opacity: 0 }, { opacity: 1 }], { duration: T.quick, delay: T.slow, easing: EASE, fill: 'both' }, m),
      play(edge.current, [{ opacity: 0 }, { opacity: 1 }], { duration: T.quick, delay: total - (m === 'full' ? T.quick : T.quick / 2), easing: EASE, fill: 'both' }, m),
    ]
    list.forEach((a) => a && (a.startTime = o.t0))
    return () => list.forEach((a) => a?.cancel())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.t0, o.mode])

  // The stage: attach the pre-compiled canvas behind the words, tell it where the text
  // is (contrast cap), then play the measure or draw the one still frame.
  useEffect(() => {
    const s = o.stage
    if (!s || !root.current) return
    s.attach(root.current, bar.current?.getBoundingClientRect().top ?? innerHeight - 100)
    const measure = () => {
      s.setBarTop(bar.current?.getBoundingClientRect().top ?? innerHeight - 100)
      s.setSafe(textRects(Array.from(root.current?.querySelectorAll('[data-safe]') ?? [])))
    }
    measure()
    if (o.mode === 'full') s.start(o.t0)
    else s.renderStill()
    // Words settle at scale 0.98 -> 1; fonts may swap: re-measure once both have happened.
    const id = window.setTimeout(measure, T.standard + 120)
    document.fonts?.ready.then(measure)
    addEventListener('resize', measure)
    return () => {
      clearTimeout(id)
      removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.stage])

  // 3 · Release (the mute lifts) and 4 · Turn back — the words' part, as in round 2.
  useEffect(() => {
    const m = o.mode
    const list: (Animation | null)[] = []
    if (o.phase === 'releasing') {
      const out = [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.98)' },
      ]
      list.push(play(head.current, out, { duration: T.quick, easing: EASE, fill: 'forwards' }, m))
      list.push(play(words.current, out, { duration: T.quick, easing: EASE, fill: 'forwards' }, m))
      list.push(play(bar.current, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }], { duration: T.quick, easing: EASE, fill: 'forwards' }, m))
      list.push(play(root.current, [{ opacity: 1 }, { opacity: 0 }], { duration: T.standard, delay: COVER_DELAY, easing: EASE, fill: 'forwards' }, m))
    }
    return () => list.forEach((a) => a?.cancel())
  }, [o.phase, o.mode])

  const busy = o.phase === 'releasing' || o.phase === 'turning'
  const showDots = o.mode === 'full' && !o.fallback
  const showSvg = o.mode !== 'still' && o.fallback

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ov-title"
      aria-describedby="ov-desc"
      lang="en"
      data-genre={o.genre.key}
      className="force-dark fixed inset-0 z-50 flex flex-col bg-bg text-fg"
    >
      <div className="relative z-[1] flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[1040px] flex-col justify-center px-8 py-14">
          <div ref={head} style={{ transformOrigin: '0 50%' }}>
            <span data-safe className="flex w-max items-center gap-2 text-[14px] text-muted">
              <Logo size={18} /> Sordino
            </span>
            <h1 id="ov-title" data-safe className="mt-8 max-w-[18ch] font-display text-[clamp(40px,6vw,72px)] font-medium leading-[1.05]">
              {SITE} is muted until {UNTIL}.
            </h1>
            <p id="ov-desc" data-safe className="mt-5 w-max max-w-full text-[17px] text-muted">
              Work hours, weekdays 09:00–17:00. You opened it at 11:12.
            </p>
            <p data-safe className="mt-3 flex w-max max-w-full items-center gap-3 text-[14px] text-muted">
              <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true" className="shrink-0">
                <g ref={hairpin} style={{ strokeDasharray: 1, strokeDashoffset: 0 }}>
                  <path d="M1 1.5 L29 6" pathLength={1} fill="none" stroke="var(--muted)" strokeWidth={1.3} strokeLinecap="round" />
                  <path d="M1 10.5 L29 6" pathLength={1} fill="none" stroke="var(--muted)" strokeWidth={1.3} strokeLinecap="round" />
                </g>
              </svg>
              <span ref={muteNote}>The video on this page is paused. It picks up where it was if you bypass.</span>
            </p>
          </div>
          {o.ownLine ? (
            <figure ref={words} className="mt-14 max-w-[560px]" style={{ transformOrigin: '0 50%' }}>
              <blockquote data-safe className="font-display text-[30px] leading-snug text-fg">
                {o.ownLine}
              </blockquote>
              <figcaption data-safe className="mt-2 w-max text-[14px] text-muted">
                Your line
              </figcaption>
            </figure>
          ) : (
            <figure ref={words} className="mt-14 max-w-[520px]" style={{ transformOrigin: '0 50%' }}>
              <blockquote data-safe className="font-display text-[24px] italic leading-snug text-fg/90">
                “{quote.text}”
              </blockquote>
              <figcaption data-safe className="mt-2 w-max max-w-full text-[14px] text-muted">
                — {quote.author}, <cite className="not-italic">{quote.source}</cite>
              </figcaption>
            </figure>
          )}
        </div>
      </div>
      <div ref={bar} className="relative z-[1] border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-4 px-8 py-5">
          <button
            ref={turnBack}
            type="button"
            onClick={() => !busy && o.onTurnBack()}
            className="inline-flex h-[60px] min-w-[200px] items-center justify-center rounded-xl bg-brass px-5 text-[16px] font-medium text-on-brass hover:brightness-105"
          >
            Turn back
          </button>
          {/* 2 · The count lives on the control that is waiting; the stage performs it. */}
          <button
            type="button"
            aria-disabled={!o.ready}
            aria-describedby="ov-budget"
            onClick={() => o.ready && !busy && o.onBypass()}
            className={`relative inline-flex h-[60px] items-center gap-4 rounded-xl border border-control px-5 text-[15px] font-medium ${
              showDots || showSvg ? 'min-w-[260px]' : 'min-w-[180px] justify-center'
            } ${o.ready ? 'text-fg hover:bg-surface-2' : 'cursor-default text-muted'}`}
          >
            <span ref={edge} aria-hidden className="pointer-events-none absolute inset-[-1px] rounded-xl border border-brass opacity-0" />
            {showDots && <BeatDots p={o.p} t0={o.t0} frozen={o.phase === 'turning'} />}
            {showSvg && (
              <Metronome beats={o.p.beats} beatMs={o.p.beatMs} mode={o.mode} motif={0} phase={o.phase === 'turning' ? 'turn' : o.phase === 'releasing' ? 'release' : 'wait'} t0={o.t0} />
            )}
            <span className="tnum whitespace-nowrap">{o.ready ? `Bypass for ${bypass.minutes} min` : `Bypass in ${o.remaining}`}</span>
          </button>
          <p id="ov-budget" className="min-w-[220px] flex-1 text-[14px] leading-relaxed text-muted sm:pl-2">
            {o.spent
              ? `Today's ${bypass.budget} bypasses are used. You can still bypass after a ${bypass.spentWait}‑second wait.`
              : `${bypass.budget - bypass.used} of ${bypass.budget} bypasses left today`}
          </p>
          <span className="sr-only" aria-live="polite">
            {o.ready ? `Bypass is available. A bypass lasts ${bypass.minutes} minutes.` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

// ================================================================ perf
interface PerfView extends Partial<StagePerf> {
  heapMB: number | null
  chunkKB: number | null
  fallback: boolean
}

function stageChunkKB() {
  const e = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).find((r) => /\/engine-[\w-]+\.js(\?|$)/.test(r.name))
  return e && e.decodedBodySize ? e.decodedBodySize / 1024 : null
}

function heapMB() {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
  return m ? m.usedJSHeapSize / 1048576 : null
}

// ================================================================ prototype monitor
function Monitor(p: {
  player: PagePlayer
  genre: Genre
  plan: Plan
  phase: Phase
  userMode: UserMode
  effMode: Mode
  osReduced: boolean
  rotate: boolean
  nogl: boolean
  elapsed: number
  total: number
  state: string
  ownLine: string
  log: string[]
  perf: PerfView
  onReplay: () => void
  onMode: (m: UserMode) => void
  onGenre: (k: string) => void
  onState: (s: string) => void
  onRotate: (v: boolean) => void
  onNogl: (v: boolean) => void
  scale: number
  onScale: (v: number) => void
  onOwnLine: (v: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [notes, setNotes] = useState(false)
  const b = 'rounded-md bg-slate-700 px-2 py-1 hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-sky-400'
  const sel = 'rounded-md border border-slate-600 bg-slate-800 px-1.5 py-1 text-slate-100'
  const seg = (on: boolean) =>
    `px-2 py-1 focus-visible:outline-2 focus-visible:outline-sky-400 ${on ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 hover:bg-slate-700'}`
  const f = p.perf
  return (
    <div
      role="region"
      aria-label="Prototype stage monitor"
      data-proto-monitor
      className="fixed right-3 top-[68px] z-[2147483646] max-h-[calc(100vh-80px)] w-[310px] overflow-y-auto rounded-2xl bg-slate-900/95 p-3 font-mono text-[11px] leading-snug text-slate-200 shadow-[0_8px_30px_rgba(2,6,23,0.45)] ring-1 ring-slate-700"
    >
      <div className="flex items-center justify-between">
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
          stage · {p.genre.key} {p.genre.name}
        </span>
        <button type="button" className="text-slate-400 hover:text-slate-100" onClick={() => setOpen(!open)}>
          {open ? 'hide' : 'show'}
        </button>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <Meter player={p.player} bars={24} className="flex h-[18px] flex-1 items-end gap-[2px]" barClass="block h-full flex-1 bg-amber-400" />
        <span className="w-[86px] text-right text-slate-300">
          video <Readout player={p.player} kind="state" />
          <br />
          level <Readout player={p.player} kind="level" />
        </span>
      </div>
      <p className="mt-1 text-slate-400">
        phase <b className="text-slate-100">{p.phase}</b>
        {p.phase !== 'prelude' && (
          <>
            {' '}
            · wait <span className="tnum">{(Math.min(p.elapsed, p.total) / 1000).toFixed(1)}</span>/{p.total / 1000} s
          </>
        )}
        <br />
        {p.plan.marking}
        <br />
        motion <b className="text-slate-100">{p.effMode}</b> · OS reduce {p.osReduced ? 'on' : 'off'}
      </p>
      <p className="mt-1 rounded bg-slate-800 px-2 py-1 text-slate-300" data-perf>
        {f.fallback ? (
          <>renderer: none (SVG fallback)</>
        ) : (
          <>
            stage <b className="text-slate-100">{f.state ?? 'loading'}</b> · {f.fps ?? 0} fps · {(f.frameMs ?? 0).toFixed(2)} ms/frame JS
            <br />
            frames {f.frames ?? 0} · heap {f.heapMB != null ? `${f.heapMB.toFixed(1)} MB` : 'n/a'} · chunk {f.chunkKB != null ? `${f.chunkKB.toFixed(0)} KB` : 'n/a (dev)'}
            <br />
            <span className="text-slate-400">{f.renderer ? f.renderer.slice(0, 44) : ''}</span>
          </>
        )}
      </p>
      {open && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={b} onClick={p.onReplay}>
              ↻ replay arrival
            </button>
            <label className="flex items-center gap-1">
              <span className="text-slate-400">genre</span>
              <select className={sel} value={p.genre.key} onChange={(e) => p.onGenre(e.target.value)}>
                {GENRES.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.key} {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-2 flex items-center gap-1">
            <span className="text-slate-400">state</span>
            <select className={`${sel} flex-1`} value={p.state} onChange={(e) => p.onState(e.target.value)}>
              {stageStates.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 flex overflow-hidden rounded-md ring-1 ring-slate-600" role="group" aria-label="Motion mode">
            {(
              [
                ['full', 'full'],
                ['still', 'Stillness'],
                ['reduced', 'OS reduced (sim)'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={p.userMode === k} className={`${seg(p.userMode === k)} flex-1`} onClick={() => p.onMode(k)}>
                {l}
              </button>
            ))}
          </div>
          <label className="mt-1.5 flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={p.rotate} onChange={(e) => p.onRotate(e.target.checked)} />
            rotate genre on each arrival (repertoire)
          </label>
          <label className="mt-1 flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={p.nogl} onChange={(e) => p.onNogl(e.target.checked)} />
            simulate no WebGL (fallback)
          </label>
          <label className="mt-1 flex items-center gap-2 text-slate-300">
            <span className="text-slate-400">render scale</span>
            <select className={sel} value={p.scale} onChange={(e) => p.onScale(Number(e.target.value))}>
              <option value={1}>1× (CSS px)</option>
              <option value={0.75}>0.75×</option>
              <option value={0.5}>0.5×</option>
            </select>
          </label>
          {p.state === 'own' && (
            <label className="mt-2 block text-slate-400">
              own line
              <input
                className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
                value={p.ownLine}
                maxLength={80}
                onChange={(e) => p.onOwnLine(e.target.value)}
              />
            </label>
          )}
          <button type="button" className="mt-2 text-sky-300 underline" onClick={() => setNotes(!notes)}>
            {notes ? 'hide' : 'show'} score notes
          </button>
          {notes && (
            <dl className="mt-1 space-y-1 text-slate-300">
              <dt className="text-slate-400">1 mute going in</dt>
              <dd>{p.genre.events.inn}</dd>
              <dt className="text-slate-400">2 the wait</dt>
              <dd>{p.genre.events.wait}</dd>
              <dt className="text-slate-400">3 release</dt>
              <dd>{p.genre.events.release}</dd>
              <dt className="text-slate-400">4 turn back</dt>
              <dd>{p.genre.events.turn}</dd>
              <dt className="text-slate-400">portable to raw shader</dt>
              <dd>{p.genre.portable}</dd>
            </dl>
          )}
          <ol className="mt-2 space-y-0.5 border-t border-slate-700 pt-2 text-slate-300">
            {p.log.slice(-8).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

// ================================================================ the surface
interface Nav {
  setVariant: (v: string, extra?: string) => void
  setState: (s: string) => void
}

function StageSurface({ genre, state, extra, onExtra, nav }: { genre: Genre; state: string; extra?: string; onExtra?: (x: string) => void; nav?: Nav }) {
  const init = useMemo(() => parseExtra(extra), []) // eslint-disable-line react-hooks/exhaustive-deps
  const player = useMemo(() => new PagePlayer(), [])
  const [userMode, setUserMode] = useState<UserMode>(init.mode)
  const [rotate, setRotate] = useState(init.rot)
  const [nogl, setNogl] = useState(init.nogl)
  const [scale, setScale] = useState(init.scale)
  const [ownLine, setOwnLine] = useState('Practice the Bach first.')
  const osReduced = useOsReduced()
  const mode: Mode = userMode === 'still' ? 'still' : userMode === 'reduced' || osReduced ? 'reduced' : 'full'

  const spent = state === 'spent'
  const p = useMemo(() => makePlan(genre, spent), [genre, spent])
  const total = p.beats * p.beatMs

  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<Phase>('prelude')
  const [t0, setT0] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [stage, setStage] = useState<Stage | null>(null)
  const [fallback, setFallback] = useState(false)
  const [perf, setPerf] = useState<PerfView>({ heapMB: null, chunkKB: null, fallback: false })
  const stageRef = useRef<Stage | null>(null)
  const t0Ref = useRef(0)
  const timers = useRef<number[]>([])

  const note = (msg: string) => {
    const t = t0Ref.current ? (performance.now() - t0Ref.current) / 1000 : 0
    const stamp = t0Ref.current ? `${t >= 0 ? '+' : ''}${t.toFixed(2)}s` : 'prelude'
    setLog((l) => [...l, `${stamp}  ${msg}`])
  }
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  const disposeStage = (why: string) => {
    const s = stageRef.current
    if (!s) return
    s.dispose()
    const pf = s.perf()
    note(`stage disposed (${why}): ${pf.frames} frames, context lost ${pf.contextLost}`)
  }

  useEffect(() => {
    player.start()
    return () => player.stop()
  }, [player])

  useEffect(() => {
    onExtra?.(serializeExtra(userMode, rotate, nogl, scale))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMode, rotate, nogl, scale])

  // Each run: the page is already playing; the stage compiles during that prelude so the
  // first beat is not spent compiling a shader; then the mute goes in.
  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    t0Ref.current = 0
    player.reset()
    setPhase('prelude')
    setElapsed(0)
    setLog([])
    setStage(null)
    setFallback(false)
    note('page playing (prelude)')
    let alive = true
    let made: Stage | null = null
    const cfg = { genre: genre.key, onsets: p.onsets, beats: p.beats, beatMs: p.beatMs, spent, settleMs: genre.settleMs, renderScale: scale }
    const goFallback = (why: string) => {
      if (!alive) return
      setFallback(true)
      note(`no stage (${why}): SVG metronome`)
    }
    if (nogl) goFallback('simulated')
    else {
      const a = performance.now()
      import('./engine')
        .then((m) => {
          if (!alive) return
          try {
            made = m.createStage(cfg)
            stageRef.current = made
            setStage(made)
            note(`stage compiled in ${Math.round(performance.now() - a)} ms`)
          } catch (e) {
            goFallback(String((e as Error).message ?? e).slice(0, 40))
          }
        })
        .catch(() => goFallback('chunk failed to load'))
    }
    later(() => {
      const now = performance.now()
      t0Ref.current = now
      setT0(now)
      setPhase('muted')
      note(`mute going in: cover, settle ${T.standard}ms, decrescendo ${T.slow}ms`)
      player.fadeTo(0, T.slow, () => {
        player.pause()
        note('video paused')
      })
    }, PRELUDE_MS)
    return () => {
      alive = false
      timers.current.forEach(clearTimeout)
      made?.dispose()
      stageRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, mode, nogl, scale])

  // The countdown reads the same clock (t0) as the stage and the beat dots.
  useEffect(() => {
    if (phase !== 'muted') return
    const id = window.setInterval(() => setElapsed(performance.now() - t0Ref.current), 100)
    return () => clearInterval(id)
  }, [phase])

  // Perf readout (and a hook for the capture script).
  useEffect(() => {
    let lastState = ''
    const id = window.setInterval(() => {
      const s = stageRef.current
      const pf = s?.perf()
      const v: PerfView = { ...(pf ?? {}), heapMB: heapMB(), chunkKB: stageChunkKB(), fallback }
      setPerf(v)
      ;(window as unknown as { __stagePerf: unknown }).__stagePerf = { ...v, genre: genre.key, mode, phase, scale }
      if (pf && pf.state === 'still' && lastState === 'running') note(`cadence settled: stage still after ${pf.frames} frames; rendering stopped`)
      if (pf) lastState = pf.state
    }, 250)
    ;(window as unknown as { __stageProbe: unknown }).__stageProbe = (t: number, still?: boolean) => stageRef.current?.probe(t, still) ?? null
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback, genre.key, mode, phase, scale])

  const ready = phase !== 'prelude' && elapsed >= total
  const remaining = Math.max(1, Math.ceil((total - elapsed) / 1000))
  const wasReady = useRef(false)
  useEffect(() => {
    if (ready && !wasReady.current) note(`final beat: Bypass enabled (${genre.events.release.split(':')[0]})`)
    wasReady.current = ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const exitMs = mode === 'still' ? 0 : mode === 'reduced' ? COVER_DELAY + T.standard / 2 : COVER_DELAY + T.standard

  const onBypass = () => {
    setPhase('releasing')
    stageRef.current?.freeze()
    note(`release: the mute lifts, crescendo ${T.slow}ms, video resumes`)
    player.play()
    player.fadeTo(1, T.slow)
    later(() => {
      setPhase('released')
      window.setTimeout(() => disposeStage('release'), 0)
    }, exitMs)
  }
  const onTurnBack = () => {
    // Navigation first, at +0 ms. The cadence only fills the commit time.
    note('turn back: navigation started (+0 ms)')
    setPhase('turning')
    stageRef.current?.turn()
    later(() => {
      // The next page commits first; GL teardown happens after, in its own task. (On
      // SwiftShader a forceContextLoss with queued frames blocked the thread ~2 s; in the
      // extension the unload frees the context and no teardown sits on this path.)
      flushSync(() => setPhase('turned'))
      player.silence()
      note(`page committed (+${NAV_COMMIT_MS} ms)`)
      stageRef.current?.freeze()
      window.setTimeout(() => disposeStage('turn back, after commit'), 600)
    }, NAV_COMMIT_MS)
  }
  const nextGenre = () => GENRES[(GENRES.findIndex((g) => g.key === genre.key) + 1) % GENRES.length].key
  const replay = () => {
    if (rotate && nav) nav.setVariant(nextGenre())
    else setRun((r) => r + 1)
  }

  const monitor = (
    <Monitor
      player={player}
      genre={genre}
      plan={p}
      phase={phase}
      userMode={userMode}
      effMode={mode}
      osReduced={osReduced}
      rotate={rotate}
      nogl={nogl}
      elapsed={elapsed}
      total={total}
      state={state}
      ownLine={ownLine}
      log={log}
      perf={{ ...perf, fallback }}
      onReplay={replay}
      onMode={setUserMode}
      onGenre={(k) => nav?.setVariant(k)}
      onState={(s) => nav?.setState(s)}
      onRotate={setRotate}
      onNogl={setNogl}
      scale={scale}
      onScale={setScale}
      onOwnLine={setOwnLine}
    />
  )

  if (phase === 'turned')
    return (
      <>
        <div className="grid min-h-screen place-items-center bg-[#f3f3f3] p-8 text-center text-[#333]">
          <div>
            <p className="text-[15px]">
              Turned back. Navigation started at +0 ms; the page committed at +{NAV_COMMIT_MS} ms. In 2.0 the tab returns to where you came from, or to a new tab.
            </p>
            <button type="button" onClick={replay} className="mt-4 rounded bg-[#333] px-3 py-1.5 text-[13px] text-white">
              Prototype: replay arrival
            </button>
          </div>
        </div>
        {monitor}
      </>
    )

  return (
    <div className="relative">
      <HostFeed lead={<LeadVideo player={player} />} />
      {(phase === 'muted' || phase === 'releasing' || phase === 'turning') && (
        <StageOverlay
          key={`${run}-${t0}`}
          genre={genre}
          p={p}
          mode={mode}
          phase={phase}
          t0={t0}
          remaining={remaining}
          ready={ready}
          spent={spent}
          ownLine={state === 'own' ? ownLine || ' ' : null}
          stage={stage}
          fallback={fallback}
          onTurnBack={onTurnBack}
          onBypass={onBypass}
        />
      )}
      {phase === 'released' && (
        <div className="fixed bottom-4 left-4 z-40 rounded-lg bg-slate-900 px-3 py-2 font-mono text-[12px] text-slate-100 shadow-lg">
          Bypassed: {SITE} open for {bypass.minutes} min (toolbar badge in 2.0).{' '}
          <button type="button" onClick={replay} className="underline">
            replay arrival
          </button>
        </div>
      )}
      {monitor}
    </div>
  )
}

const make = (g: Genre) =>
  function GenreStage(props: { state: string; extra?: string; onExtra?: (x: string) => void; nav?: Nav }) {
    return <StageSurface genre={g} state={props.state || 'normal'} extra={props.extra} onExtra={props.onExtra} nav={props.nav} />
  }

export const stageVariants = GENRES.map((g) => ({
  key: g.key,
  label: g.name,
  Component: make(genreByKey(g.key)),
}))
