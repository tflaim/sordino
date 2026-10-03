// PROTOTYPE — throwaway. Motion study for the 2.0 overlay (decisions 26–29, 31).
// Question: which bypass-wait gesture (F Fermata, M Metronome, R Measure) carries the
// four musical events best: the mute going in, the bypass wait, the release, the
// turn back? Built on Overlay C (sentence + action bar) over the light host feed,
// which now has a playing video so the literal mute (decision 28) is visible.
//
// Motion identity (Premium): signature easing cubic-bezier(0.4,0,0.2,1); durations
// 350 / 500 / 800 ms; 0 % overshoot. WAAPI + CSS only (ADR-0003). Every animation is
// gated: OS reduced-motion (real or simulated) → opacity only; Stillness → none.
// "Bypass in N" is always the source of truth.
//
// URL: #motion.<F|M|R>.dark.<normal|spent|own>[.<full|still|reduced>.<motif 1-3>]
import { useEffect, useMemo, useRef, useState } from 'react'
import { HostFeed } from '../overlay/HostFeed'
import { Logo } from '../ui'
import { bypass, quote } from '../data'
import { EASE, T, play, type Mode } from './tokens'
import { PagePlayer } from './player'
import { LeadVideo, Meter, Readout } from './FakeVideo'
import { families, type GestureFamily, type GesturePhase } from './gestures'

export const motionStates = [
  { key: 'normal', label: 'normal (5 s wait)' },
  { key: 'spent', label: 'budget spent (30 s wait)' },
  { key: 'own', label: 'own line' },
]

const SITE = 'reddit.com'
const UNTIL = '17:00'
const PRELUDE_MS = 1400
const COVER_DELAY = 250 // release: the cover starts clearing once the words are nearly gone
type UserMode = 'full' | 'still' | 'reduced'
type Phase = 'prelude' | 'muted' | 'releasing' | 'released' | 'turning' | 'turned'

function parseExtra(extra = '') {
  const [m, n] = extra.split('.')
  const mode: UserMode = m === 'still' || m === 'reduced' ? m : 'full'
  const motif = Math.min(2, Math.max(0, (parseInt(n ?? '1', 10) || 1) - 1))
  return { mode, motif }
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

// ================================================================ overlay (C)
interface OverlayProps {
  family: GestureFamily
  motif: number
  mode: Mode
  phase: Phase
  t0: number
  beats: number
  beatMs: number
  remaining: number
  ready: boolean
  spent: boolean
  ownLine: string | null
  onTurnBack: () => void
  onBypass: () => void
}

function MotionOverlay(p: OverlayProps) {
  const root = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const words = useRef<HTMLElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const hairpin = useRef<SVGGElement>(null)
  const muteNote = useRef<HTMLSpanElement>(null)
  const edge = useRef<HTMLSpanElement>(null)
  const turnBack = useRef<HTMLButtonElement>(null)
  const total = p.beats * p.beatMs
  const { Gesture } = p.family

  // 1 · Mute going in. The dark cover is already opaque on the first frame (no
  // flash of the page); only the content settles. The hairpin draws over the same
  // 800 ms as the page's decrescendo, then says what happened to the video.
  useEffect(() => {
    turnBack.current?.focus({ preventScroll: true })
    const m = p.mode
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
      // The Bypass control's brass edge lands exactly when the wait ends.
      play(edge.current, [{ opacity: 0 }, { opacity: 1 }], { duration: T.quick, delay: total - (m === 'full' ? T.quick : T.quick / 2), easing: EASE, fill: 'both' }, m),
    ]
    list.forEach((a) => a && (a.startTime = p.t0))
    return () => list.forEach((a) => a?.cancel())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.t0, p.mode])

  // 3 · Release and 4 · Turn back.
  useEffect(() => {
    const m = p.mode
    const list: (Animation | null)[] = []
    if (p.phase === 'releasing') {
      // The mute lifts: the words recede first (quick), then the cover clears
      // (standard), ending with the page's 800 ms crescendo. No double exposure.
      const out = [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.98)' },
      ]
      list.push(play(head.current, out, { duration: T.quick, easing: EASE, fill: 'forwards' }, m))
      list.push(play(words.current, out, { duration: T.quick, easing: EASE, fill: 'forwards' }, m))
      list.push(play(bar.current, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }], { duration: T.quick, easing: EASE, fill: 'forwards' }, m))
      list.push(play(root.current, [{ opacity: 1 }, { opacity: 0 }], { duration: T.standard, delay: COVER_DELAY, easing: EASE, fill: 'forwards' }, m))
    }
    if (p.phase === 'turning') {
      // A falling cadence: the words settle down and out while the gesture resolves.
      const down = [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(6px)' },
      ]
      list.push(play(head.current, down, { duration: T.quick, easing: EASE, fill: 'forwards' }, m))
      list.push(play(words.current, down, { duration: T.quick, easing: EASE, fill: 'forwards' }, m))
    }
    return () => list.forEach((a) => a?.cancel())
  }, [p.phase, p.mode])

  const gPhase: GesturePhase = p.phase === 'turning' ? 'turn' : p.phase === 'releasing' ? 'release' : 'wait'
  const busy = p.phase === 'releasing' || p.phase === 'turning'

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ov-title"
      aria-describedby="ov-desc"
      lang="en"
      className="force-dark fixed inset-0 z-50 flex flex-col bg-bg text-fg"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[1040px] flex-col justify-center px-8 py-14">
          <div ref={head} style={{ transformOrigin: '0 50%' }}>
            <span className="flex items-center gap-2 text-[14px] text-muted">
              <Logo size={18} /> Sordino
            </span>
            <h1 id="ov-title" className="mt-8 max-w-[18ch] font-display text-[clamp(40px,6vw,72px)] font-medium leading-[1.05]">
              {SITE} is muted until {UNTIL}.
            </h1>
            <p id="ov-desc" className="mt-5 text-[17px] text-muted">
              Work hours, weekdays 09:00–17:00. You opened it at 11:12.
            </p>
            {/* The literal mute, said once: a decrescendo hairpin and a plain line. */}
            <p className="mt-3 flex items-center gap-3 text-[14px] text-muted">
              <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true" className="shrink-0">
                <g ref={hairpin} style={{ strokeDasharray: 1, strokeDashoffset: 0 }}>
                  <path d="M1 1.5 L29 6" pathLength={1} fill="none" stroke="var(--muted)" strokeWidth={1.3} strokeLinecap="round" />
                  <path d="M1 10.5 L29 6" pathLength={1} fill="none" stroke="var(--muted)" strokeWidth={1.3} strokeLinecap="round" />
                </g>
              </svg>
              <span ref={muteNote}>The video on this page is paused. It picks up where it was if you bypass.</span>
            </p>
          </div>
          {p.ownLine ? (
            <figure ref={words} className="mt-14 max-w-[560px]" style={{ transformOrigin: '0 50%' }}>
              <blockquote className="font-display text-[30px] leading-snug text-fg">{p.ownLine}</blockquote>
              <figcaption className="mt-2 text-[14px] text-muted">Your line</figcaption>
            </figure>
          ) : (
            <figure ref={words} className="mt-14 max-w-[520px]" style={{ transformOrigin: '0 50%' }}>
              <blockquote className="font-display text-[24px] italic leading-snug text-fg/90">“{quote.text}”</blockquote>
              <figcaption className="mt-2 text-[14px] text-muted">
                — {quote.author}, <cite className="not-italic">{quote.source}</cite>
              </figcaption>
            </figure>
          )}
        </div>
      </div>
      <div ref={bar} className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-4 px-8 py-5">
          <button
            ref={turnBack}
            type="button"
            onClick={() => !busy && p.onTurnBack()}
            className="inline-flex h-[60px] min-w-[200px] items-center justify-center rounded-xl bg-brass px-5 text-[16px] font-medium text-on-brass hover:brightness-105"
          >
            Turn back
          </button>
          {/* 2 · The bypass wait lives on the control that is waiting. */}
          <button
            type="button"
            aria-disabled={!p.ready}
            aria-describedby="ov-budget"
            onClick={() => p.ready && !busy && p.onBypass()}
            className={`relative inline-flex h-[60px] items-center gap-4 rounded-xl border border-control px-4 text-[15px] font-medium ${
              p.mode === 'still' ? 'min-w-[180px] justify-center' : 'min-w-[320px]'
            } ${p.ready ? 'text-fg hover:bg-surface-2' : 'cursor-default text-muted'}`}
          >
            <span ref={edge} aria-hidden className="pointer-events-none absolute inset-[-1px] rounded-xl border border-brass opacity-0" />
            {p.mode !== 'still' && (
              <Gesture beats={p.beats} beatMs={p.beatMs} mode={p.mode} motif={p.motif} phase={gPhase} t0={p.t0} />
            )}
            <span className="tnum whitespace-nowrap">{p.ready ? `Bypass for ${bypass.minutes} min` : `Bypass in ${p.remaining}`}</span>
          </button>
          <p id="ov-budget" className="min-w-[220px] flex-1 text-[14px] leading-relaxed text-muted sm:pl-2">
            {p.spent
              ? `Today's ${bypass.budget} bypasses are used. You can still bypass after a ${bypass.spentWait}\u2011second wait.`
              : `${bypass.budget - bypass.used} of ${bypass.budget} bypasses left today`}
          </p>
          <span className="sr-only" aria-live="polite">
            {p.ready ? `Bypass is available. A bypass lasts ${bypass.minutes} minutes.` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

// ================================================================ prototype monitor
// Cool slate + monospace like the switcher, so it never reads as Sordino design.
// It mirrors the page's meter (hidden under the cover) and logs every event.
function Monitor(p: {
  player: PagePlayer
  family: GestureFamily
  phase: Phase
  userMode: UserMode
  effMode: Mode
  osReduced: boolean
  motif: number
  rotate: boolean
  elapsed: number
  total: number
  tempo: string
  state: string
  ownLine: string
  log: string[]
  sound: boolean
  onReplay: () => void
  onMode: (m: UserMode) => void
  onMotif: (d: number) => void
  onRotate: (v: boolean) => void
  onOwnLine: (v: string) => void
  onSound: () => void
}) {
  const [open, setOpen] = useState(true)
  const b = 'rounded-md bg-slate-700 px-2 py-1 hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-sky-400'
  const seg = (on: boolean) =>
    `px-2 py-1 focus-visible:outline-2 focus-visible:outline-sky-400 ${on ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 hover:bg-slate-700'}`
  return (
    <div
      role="region"
      aria-label="Prototype motion monitor"
      data-proto-monitor
      className="fixed right-3 top-[68px] z-[2147483646] w-[300px] rounded-2xl bg-slate-900/95 p-3 font-mono text-[11px] leading-snug text-slate-200 shadow-[0_8px_30px_rgba(2,6,23,0.45)] ring-1 ring-slate-700"
    >
      <div className="flex items-center justify-between">
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
          motion · {p.family.key} {p.family.name}
        </span>
        <button type="button" className="text-slate-400 hover:text-slate-100" onClick={() => setOpen(!open)}>
          {open ? 'hide' : 'show'}
        </button>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <Meter player={p.player} bars={24} className="flex h-[22px] flex-1 items-end gap-[2px]" barClass="block h-full flex-1 bg-amber-400" />
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
        tempo {p.tempo} · motion <b className="text-slate-100">{p.effMode}</b> · OS reduce {p.osReduced ? 'on' : 'off'}
      </p>
      {open && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={b} onClick={p.onReplay}>
              ↻ replay arrival
            </button>
            <button type="button" className={b} onClick={p.onSound} title="Starts a quiet WebAudio tone (needs a click)">
              sound: {p.sound ? 'on' : 'off'}
            </button>
          </div>
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
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-slate-400">motif</span>
            <button type="button" className={b} aria-label="Previous motif" onClick={() => p.onMotif(-1)}>
              ‹
            </button>
            <span className="flex-1 text-center">
              {p.motif + 1}/3 {p.family.motifs[p.motif]}
            </span>
            <button type="button" className={b} aria-label="Next motif" onClick={() => p.onMotif(1)}>
              ›
            </button>
          </div>
          <label className="mt-1.5 flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={p.rotate} onChange={(e) => p.onRotate(e.target.checked)} />
            rotate motif on each arrival (repertoire)
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
          <ol className="mt-2 space-y-0.5 border-t border-slate-700 pt-2 text-slate-300">
            {p.log.slice(-7).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

// ================================================================ stage
function MotionStage({
  family,
  state,
  extra,
  onExtra,
}: {
  family: GestureFamily
  state: string
  extra?: string
  onExtra?: (x: string) => void
}) {
  const init = useMemo(() => parseExtra(extra), []) // eslint-disable-line react-hooks/exhaustive-deps
  const player = useMemo(() => new PagePlayer(), [])
  const [userMode, setUserMode] = useState<UserMode>(init.mode)
  const [motif, setMotif] = useState(init.motif)
  const [rotate, setRotate] = useState(false)
  const [ownLine, setOwnLine] = useState('Practice the Bach first.')
  const [sound, setSound] = useState(false)
  const osReduced = useOsReduced()
  const mode: Mode = userMode === 'still' ? 'still' : userMode === 'reduced' || osReduced ? 'reduced' : 'full'

  const spent = state === 'spent'
  const plan = family.plan(spent)
  const total = plan.beats * plan.beatMs

  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<Phase>('prelude')
  const [t0, setT0] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [log, setLog] = useState<string[]>([])
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

  useEffect(() => {
    player.start()
    return () => player.stop()
  }, [player])

  useEffect(() => {
    onExtra?.(userMode === 'full' && motif === 0 ? '' : `${userMode}.${motif + 1}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMode, motif])

  // Each run: the page is already playing (a schedule just started, say), then the
  // mute goes in. On real navigations the cover would be there before first paint.
  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    t0Ref.current = 0
    player.reset()
    setPhase('prelude')
    setElapsed(0)
    setLog([])
    note('page playing (prelude)')
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
    return () => timers.current.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, mode, motif])

  // The countdown reads the same clock (t0) the gesture's WAAPI startTime uses.
  useEffect(() => {
    if (phase !== 'muted') return
    const id = window.setInterval(() => setElapsed(performance.now() - t0Ref.current), 100)
    return () => clearInterval(id)
  }, [phase])

  const ready = phase !== 'prelude' && elapsed >= total
  const remaining = Math.max(1, Math.ceil((total - elapsed) / 1000))
  const wasReady = useRef(false)
  useEffect(() => {
    if (ready && !wasReady.current) note('bypass wait over: Bypass enabled')
    wasReady.current = ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const exitMs = mode === 'still' ? 0 : mode === 'reduced' ? COVER_DELAY + T.standard / 2 : COVER_DELAY + T.standard
  const cadenceMs = mode === 'still' ? 0 : mode === 'reduced' ? T.quick / 2 : T.quick

  const onBypass = () => {
    setPhase('releasing')
    note(`release: overlay recedes, crescendo ${T.slow}ms, video resumes`)
    player.play()
    player.fadeTo(1, T.slow)
    later(() => setPhase('released'), exitMs)
  }
  const onTurnBack = () => {
    setPhase('turning')
    note(`turn back: cadence ${cadenceMs}ms, then leave`)
    later(() => {
      player.silence()
      setPhase('turned')
    }, cadenceMs)
  }
  const replay = () => {
    if (rotate) setMotif((m) => (m + 1) % 3)
    else setRun((r) => r + 1)
  }

  const monitor = (
    <Monitor
      player={player}
      family={family}
      phase={phase}
      userMode={userMode}
      effMode={mode}
      osReduced={osReduced}
      motif={motif}
      rotate={rotate}
      elapsed={elapsed}
      total={total}
      tempo={plan.tempo}
      state={state}
      ownLine={ownLine}
      log={log}
      sound={sound}
      onReplay={replay}
      onMode={setUserMode}
      onMotif={(d) => setMotif((m) => (m + d + 3) % 3)}
      onRotate={setRotate}
      onOwnLine={setOwnLine}
      onSound={() => {
        if (player.soundOn) player.disableSound()
        else player.enableSound()
        setSound(player.soundOn)
      }}
    />
  )

  if (phase === 'turned')
    return (
      <>
        <div className="grid min-h-screen place-items-center bg-[#f3f3f3] p-8 text-center text-[#333]">
          <div>
            <p className="text-[15px]">Turned back. In 2.0 the tab returns to where you came from, or to a new tab.</p>
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
        <MotionOverlay
          key={`${run}-${t0}`}
          family={family}
          motif={motif}
          mode={mode}
          phase={phase}
          t0={t0}
          beats={plan.beats}
          beatMs={plan.beatMs}
          remaining={remaining}
          ready={ready}
          spent={spent}
          ownLine={state === 'own' ? ownLine || ' ' : null}
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

const make = (family: GestureFamily) =>
  function MotionSurface(props: { state: string; extra?: string; onExtra?: (x: string) => void }) {
    return <MotionStage family={family} state={props.state || 'normal'} extra={props.extra} onExtra={props.onExtra} />
  }

export const motionVariants = families.map((f) => ({
  key: f.key,
  label: f.name,
  Component: make(f),
}))
