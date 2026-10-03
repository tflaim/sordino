// PROTOTYPE — the three bypass-wait gestures (decision 27), each with three motifs
// (the rotating repertoire, decision 29). Every gesture is one-shot and clock-locked:
// all animations share the arrival timestamp `t0` as their WAAPI startTime, so the
// gesture and the "Bypass in N" number read the same clock, and every resolve
// *lands* at the end of the wait rather than starting there. Never looping.
// In Stillness the gesture is not rendered at all; the number is the whole story.
import { useEffect, useId, useRef, type ComponentType } from 'react'
import { EASE, T, play, type Mode } from './tokens'

export type GesturePhase = 'wait' | 'release' | 'turn'

export interface GestureProps {
  beats: number
  beatMs: number
  mode: Mode
  motif: number
  phase: GesturePhase
  t0: number
}

export interface GestureFamily {
  key: 'F' | 'M' | 'R'
  name: string
  motifs: string[]
  /** Normal wait: N beats of 1 s. Spent: same gesture, slower tempo, never louder. */
  plan: (spent: boolean) => { beats: number; beatMs: number; tempo: string }
  Gesture: ComponentType<GestureProps>
}

const W = 120
const H = 40
const GHOST = { stroke: 'var(--muted)', opacity: 0.45 }

function Svg({ children, rootRef }: { children: React.ReactNode; rootRef?: React.Ref<SVGSVGElement> }) {
  return (
    <svg ref={rootRef} width={W * 1.2} height={H * 1.2} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="shrink-0 overflow-visible">
      {children}
    </svg>
  )
}

const box = (origin: string) => ({ transformBox: 'fill-box' as const, transformOrigin: origin })

type Reg = (a: Animation | null) => void
function useClock(fn: (reg: Reg) => void, deps: unknown[]) {
  useEffect(() => {
    const list: (Animation | null)[] = []
    fn((a) => list.push(a))
    return () => list.forEach((a) => a?.cancel())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Turn back: the gesture stops where it is before its cadence plays. */
function freeze(svg: SVGSVGElement | null) {
  svg?.getAnimations({ subtree: true }).forEach((a) => a.pause())
}

/** Lock an animation to the arrival clock. */
function at(a: Animation | null, t0: number) {
  if (a) a.startTime = t0
  return a
}

/** Duration of a per-beat landing: quick normally, slow when the tempo is slow. */
const landing = (beatMs: number) => (beatMs >= 3000 ? T.slow : T.quick)

// ================================================================ F · Fermata
// A held note under a fermata. The note's shape is revealed left to right at the
// speed of the clock (linear: the reveal IS the countdown); the shape itself carries
// the swell and the decay. On the last beat it lands in brass.
const F_SHAPES = [
  // Messa di voce: hairpins open to ~35 %, then close to nothing.
  { d: 'M6 30 L46 23 L114 30 M6 30 L46 37 L114 30', w: 1.6, glyph: true },
  // Arc: the fermata itself, traced as it is held.
  { d: 'M12 36 A48 29 0 0 1 108 36', w: 2.2, glyph: false },
  // Diminuendo: starts open and thins away.
  { d: 'M6 23 L114 30 M6 37 L114 30', w: 1.6, glyph: true },
]

function FermataGlyph({ color }: { color: string }) {
  return (
    <g>
      <path d="M50 15.5 A10 8.5 0 0 1 70 15.5" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={60} cy={13} r={1.7} fill={color} />
    </g>
  )
}

function Fermata({ beats, beatMs, mode, motif, phase, t0 }: GestureProps) {
  const shape = F_SHAPES[motif % F_SHAPES.length]
  const id = 'fm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const sweep = useRef<SVGRectElement>(null)
  const segs = useRef<(SVGRectElement | null)[]>([])
  const held = useRef<SVGGElement>(null)
  const done = useRef<SVGGElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const total = beats * beatMs

  useClock(
    (reg) => {
      if (mode === 'full') {
        reg(at(sweep.current!.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: total, easing: 'linear', fill: 'both' }), t0))
      } else {
        // Reduced: the same note, lit one segment per beat by opacity alone.
        const d = T.quick / 2
        segs.current.forEach((s, i) =>
          reg(at(play(s, [{ opacity: 0 }, { opacity: 1 }], { duration: T.quick, delay: (i + 1) * beatMs - d, easing: EASE, fill: 'both' }, mode), t0)),
        )
      }
      const dq = mode === 'full' ? T.quick : T.quick / 2
      reg(at(play(done.current, [{ opacity: 0 }, { opacity: 1 }], { duration: T.quick, delay: total - dq, easing: EASE, fill: 'both' }, mode), t0))
    },
    [mode, beats, beatMs, t0],
  )

  // Turn back: the conductor's cut-off. The held note lets go; the fermata stays.
  useEffect(() => {
    if (phase !== 'turn') return
    freeze(svg.current)
    const a = play(held.current, [{ opacity: 1 }, { opacity: 0 }], { duration: T.quick, easing: EASE, fill: 'forwards' }, mode)
    return () => a?.cancel()
  }, [phase, mode])

  const paint = (color: string, ghost = false) => ({
    fill: 'none',
    stroke: color,
    strokeWidth: shape.w,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    opacity: ghost ? 0.35 : 1,
  })

  return (
    <Svg rootRef={svg}>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
          {mode === 'full' ? (
            <rect ref={sweep} x={0} y={0} width={W} height={H} fill="white" style={box('0% 50%')} />
          ) : (
            Array.from({ length: beats }, (_, i) => (
              <rect
                key={i}
                ref={(el) => {
                  segs.current[i] = el
                }}
                x={6 + (i * 108) / beats}
                y={0}
                width={108 / beats + 0.6}
                height={H}
                fill="white"
              />
            ))
          )}
        </mask>
      </defs>
      {shape.glyph && <FermataGlyph color="var(--muted)" />}
      <path d={shape.d} {...paint('var(--muted)', true)} />
      <g ref={held}>
        <path d={shape.d} mask={`url(#${id})`} {...paint('var(--fg)')} />
        <g ref={done} opacity={0}>
          <path d={shape.d} {...paint('var(--brass)')} />
          {shape.glyph ? <FermataGlyph color="var(--brass)" /> : <circle cx={60} cy={30} r={2.6} fill="var(--brass)" />}
        </g>
      </g>
    </Svg>
  )
}

// ================================================================ M · Metronome
// N slow beats. The last beat does not tick: the arm comes to rest at centre,
// which is the moment Bypass is enabled.
function beatX(i: number, n: number, x0: number, x1: number) {
  return n === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (n - 1)
}

function Metronome({ beats, beatMs, mode, motif, phase, t0 }: GestureProps) {
  const m = motif % 3
  const arm = useRef<SVGGElement>(null)
  const marks = useRef<(SVGElement | null)[]>([])
  const walker = useRef<SVGCircleElement>(null)
  const bar = useRef<SVGGElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const total = beats * beatMs
  const A = 24 // swing amplitude, degrees

  useClock(
    (reg) => {
      const D = landing(beatMs)
      const d = mode === 'full' ? D : D / 2
      // Marks land on each beat (dots, ticks, or the walker's trail).
      marks.current.forEach((el, i) =>
        reg(
          at(
            play(
              el,
              m === 1
                ? [{ opacity: 0, transform: 'scaleY(0.15)' }, { opacity: 1, transform: 'scaleY(1)' }]
                : [{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)' }],
              { duration: D, delay: (i + 1) * beatMs - d, easing: EASE, fill: 'both' },
              mode,
            ),
            t0,
          ),
        ),
      )
      if (m === 0 && mode === 'full' && arm.current) {
        // N-1 full swings, then the last beat swings home to centre.
        if (beats > 1)
          reg(at(arm.current.animate([{ transform: `rotate(${-A}deg)` }, { transform: `rotate(${A}deg)` }], { duration: beatMs, iterations: beats - 1, direction: 'alternate', easing: EASE, fill: 'backwards' }), t0))
        const from = beats - 1 === 0 ? -A : (beats - 1) % 2 === 1 ? A : -A
        reg(at(arm.current.animate([{ transform: `rotate(${from}deg)` }, { transform: 'rotate(0deg)' }], { duration: beatMs, delay: (beats - 1) * beatMs, easing: EASE, fill: 'forwards' }), t0))
      }
      if (m === 2 && mode === 'full' && walker.current) {
        // The walker steps one station per beat, arriving on the beat.
        const frames: Keyframe[] = [{ offset: 0, transform: 'translateX(0px)' }]
        for (let i = 0; i < beats; i++) {
          const x0 = (i * 96) / beats
          const x1 = ((i + 1) * 96) / beats
          frames.push({ offset: Math.max(0, ((i + 1) * beatMs - D) / total), transform: `translateX(${x0}px)`, easing: EASE })
          frames.push({ offset: ((i + 1) * beatMs) / total, transform: `translateX(${x1}px)` })
        }
        reg(at(walker.current.animate(frames, { duration: total, fill: 'both' }), t0))
      }
      if (m !== 0)
        reg(at(play(bar.current, [{ opacity: 0 }, { opacity: 1 }], { duration: T.quick, delay: total - (mode === 'full' ? T.quick : T.quick / 2), easing: EASE, fill: 'both' }, mode), t0))
    },
    [mode, beats, beatMs, m, t0],
  )

  // Turn back: whatever is moving comes to rest (the arm returns to centre).
  useEffect(() => {
    if (phase !== 'turn') return
    freeze(svg.current)
    if (!arm.current || mode !== 'full') return
    const el = arm.current
    const cur = getComputedStyle(el).transform
    el.getAnimations().forEach((a) => a.cancel())
    const a = el.animate([{ transform: cur === 'none' ? 'rotate(0deg)' : cur }, { transform: 'rotate(0deg)' }], { duration: T.quick, easing: EASE, fill: 'forwards' })
    return () => a.cancel()
  }, [phase, mode])

  const dense = beats > 6
  return (
    <Svg rootRef={svg}>
      {m === 0 && (
        <>
          <path d="M8 37 L14 5 L22 5 L28 37 Z" fill="none" strokeWidth={1.2} strokeLinejoin="round" {...GHOST} />
          <g ref={arm} style={{ transformBox: 'view-box', transformOrigin: '18px 32px' }}>
            <line x1={18} y1={32} x2={18} y2={7} stroke="var(--fg)" strokeWidth={1.6} strokeLinecap="round" />
            <rect x={15.5} y={12} width={5} height={4} rx={1} fill="var(--fg)" />
          </g>
          {Array.from({ length: beats }, (_, i) => {
            const x = beatX(i, beats, 42, 112)
            const r = dense ? 2.1 : 2.8
            return (
              <g key={i}>
                <circle cx={x} cy={21} r={r} fill="none" strokeWidth={1} {...GHOST} />
                <circle
                  ref={(el) => {
                    marks.current[i] = el
                  }}
                  cx={x}
                  cy={21}
                  r={r}
                  fill={i === beats - 1 ? 'var(--brass)' : 'var(--fg)'}
                  opacity={0}
                  style={box('50% 50%')}
                />
              </g>
            )
          })}
        </>
      )}
      {m === 1 && (
        <>
          <line x1={4} y1={35} x2={104} y2={35} strokeWidth={1} {...GHOST} />
          {Array.from({ length: beats }, (_, i) => {
            const x = beatX(i, beats, 8, 98)
            return (
              <g key={i}>
                <line x1={x} y1={33} x2={x} y2={11} strokeWidth={dense ? 1.6 : 2} strokeLinecap="round" stroke="var(--muted)" opacity={0.3} />
                <line
                  ref={(el) => {
                    marks.current[i] = el
                  }}
                  x1={x}
                  y1={33}
                  x2={x}
                  y2={11}
                  strokeWidth={dense ? 1.6 : 2}
                  strokeLinecap="round"
                  stroke="var(--fg)"
                  opacity={0}
                  style={box('50% 100%')}
                />
              </g>
            )
          })}
        </>
      )}
      {m === 2 && (
        <>
          <line x1={10} y1={24} x2={106} y2={24} strokeWidth={1} {...GHOST} />
          {Array.from({ length: beats }, (_, i) => {
            const x = 10 + ((i + 1) * 96) / beats
            return (
              <circle
                key={i}
                ref={(el) => {
                  marks.current[i] = el
                }}
                cx={x}
                cy={24}
                r={1.6}
                fill="var(--fg)"
                opacity={0}
                style={box('50% 50%')}
              />
            )
          })}
          <circle ref={walker} cx={10} cy={24} r={3.4} fill="var(--fg)" style={{ opacity: mode === 'full' ? 1 : 0 }} />
        </>
      )}
      {m !== 0 && (
        <g>
          <line x1={110} y1={13} x2={110} y2={35} strokeWidth={1} {...GHOST} />
          <line x1={113.5} y1={13} x2={113.5} y2={35} strokeWidth={2.4} {...GHOST} />
          <g ref={bar} opacity={0}>
            <line x1={110} y1={13} x2={110} y2={35} stroke="var(--brass)" strokeWidth={1} />
            <line x1={113.5} y1={13} x2={113.5} y2={35} stroke="var(--brass)" strokeWidth={2.4} />
          </g>
        </g>
      )}
    </Svg>
  )
}

// ================================================================ R · Measure
// A bar of N rests. Beat by beat each rest becomes a note; the final double bar
// line closes the measure as Bypass is enabled.
const STAFF = [8, 14, 20, 26, 32]

function pitches(motif: number, n: number): number[] {
  const step = (i: number) => Math.round((i * 4) / Math.max(1, n - 1)) * 3
  if (motif === 1) return Array.from({ length: n }, (_, i) => 29 - step(i)) // rising
  if (motif === 2) return Array.from({ length: n }, (_, i) => 17 + step(i)) // falling to rest
  return Array.from({ length: n }, () => 20) // repeated note
}

function Note({ y, color }: { y: number; color: string }) {
  const down = y <= 20
  return (
    <g transform={`translate(0 ${y})`}>
      <ellipse cx={0} cy={0} rx={3.4} ry={2.4} transform="rotate(-20)" fill={color} />
      <line x1={down ? -3.1 : 3.1} y1={down ? 0.8 : -0.8} x2={down ? -3.1 : 3.1} y2={down ? 13 : -13} stroke={color} strokeWidth={1.1} />
    </g>
  )
}

function Measure({ beats, beatMs, mode, motif, phase, t0 }: GestureProps) {
  const ys = pitches(motif % 3, beats)
  const rests = useRef<(SVGGElement | null)[]>([])
  const notes = useRef<(SVGGElement | null)[]>([])
  const bar = useRef<SVGGElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const total = beats * beatMs

  useClock(
    (reg) => {
      const D = landing(beatMs)
      const d = mode === 'full' ? D : D / 2
      for (let i = 0; i < beats; i++) {
        const delay = (i + 1) * beatMs - d
        if (mode === 'full') {
          // The pending rest is held: it dims slowly across its own beat (linear,
          // the clock), then gives way to the note. Matters most at the slow tempo.
          const k = (beatMs - D) / beatMs
          reg(at(rests.current[i]!.animate([{ opacity: 1, easing: 'linear' }, { opacity: 0.4, offset: k, easing: EASE }, { opacity: 0 }], { duration: beatMs, delay: i * beatMs, fill: 'both' }), t0))
        } else {
          reg(at(play(rests.current[i], [{ opacity: 1 }, { opacity: 0 }], { duration: D, delay, easing: EASE, fill: 'both' }, mode), t0))
        }
        reg(at(play(notes.current[i], [{ opacity: 0, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: D, delay, easing: EASE, fill: 'both' }, mode), t0))
      }
      const dq = mode === 'full' ? T.quick : T.quick / 2
      reg(at(play(bar.current, [{ opacity: 0, transform: 'scaleY(0.2)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: T.quick, delay: total - dq, easing: EASE, fill: 'both' }, mode), t0))
    },
    [mode, beats, beatMs, motif, t0],
  )

  // Turn back: the bar closes where it is (final double bar), a short cadence.
  useEffect(() => {
    if (phase !== 'turn') return
    const el = bar.current
    if (!el) return
    freeze(svg.current)
    el.getAnimations().forEach((a) => a.cancel())
    const a = play(el, [{ opacity: 0, transform: 'scaleY(0.2)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: T.quick, easing: EASE, fill: 'forwards' }, mode)
    return () => a?.cancel()
  }, [phase, mode])

  const xs = Array.from({ length: beats }, (_, i) => 10 + ((i + 0.5) * 98) / beats)
  return (
    <Svg rootRef={svg}>
      {STAFF.map((y) => (
        <line key={y} x1={2} y1={y} x2={117} y2={y} stroke="var(--muted)" strokeWidth={0.8} opacity={0.55} />
      ))}
      <line x1={2} y1={8} x2={2} y2={32} stroke="var(--muted)" strokeWidth={1} opacity={0.7} />
      {xs.map((x, i) => (
        <g key={i} transform={`translate(${x} 0)`}>
          <g
            ref={(el) => {
              rests.current[i] = el
            }}
          >
            {/* Quarter rest */}
            <path
              d="M-1.6 11.5 L2.4 16 L-1.2 19.6 L2.6 24.2 C-0.6 22.8 -2.4 25 0.4 28.4"
              fill="none"
              stroke="var(--muted)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <g
            ref={(el) => {
              notes.current[i] = el
            }}
            opacity={0}
          >
            <Note y={ys[i]} color="var(--fg)" />
          </g>
        </g>
      ))}
      <line x1={113.5} y1={8} x2={113.5} y2={32} stroke="var(--muted)" strokeWidth={0.9} opacity={0.35} />
      <g ref={bar} opacity={0} style={box('50% 50%')}>
        <line x1={113.5} y1={8} x2={113.5} y2={32} stroke="var(--brass)" strokeWidth={1} />
        <line x1={117} y1={8} x2={117} y2={32} stroke="var(--brass)" strokeWidth={2.4} />
      </g>
    </Svg>
  )
}

export const families: GestureFamily[] = [
  {
    key: 'F',
    name: 'Fermata',
    motifs: ['Messa di voce', 'Arc', 'Diminuendo'],
    plan: (spent) => (spent ? { beats: 10, beatMs: 3000, tempo: 'held three times as long' } : { beats: 5, beatMs: 1000, tempo: 'held for the wait' }),
    Gesture: Fermata,
  },
  {
    key: 'M',
    name: 'Metronome',
    motifs: ['Pendulum', 'Ticks', 'Walk'],
    plan: (spent) => (spent ? { beats: 10, beatMs: 3000, tempo: '20 bpm' } : { beats: 5, beatMs: 1000, tempo: '60 bpm' }),
    Gesture: Metronome,
  },
  {
    key: 'R',
    name: 'Measure',
    motifs: ['Repeated note', 'Rising', 'Falling'],
    plan: (spent) => (spent ? { beats: 5, beatMs: 6000, tempo: '10 bpm' } : { beats: 5, beatMs: 1000, tempo: '60 bpm' }),
    Gesture: Measure,
  },
]
