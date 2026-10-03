// PROTOTYPE — a fake page media player. Stands in for the <video>/<audio> elements
// the 2.0 content script would find on a muted site (decision 28, "the literal mute").
// It owns a 0..1 level that the fake video's meter, the prototype monitor and an
// optional WebAudio tone all read every frame. The real overlay would ramp
// media.volume (or a GainNode) the same way; this is page audio, not overlay motion.
import { easeFn } from './tokens'

export interface PlayerSnapshot {
  level: number
  playing: boolean
  time: number // seconds into the fake video
}

type Listener = (s: PlayerSnapshot) => void

export class PagePlayer {
  level = 1
  playing = true
  time = 72 // starts at 1:12
  private fade: { from: number; to: number; start: number; dur: number; done?: () => void } | null = null
  private listeners = new Set<Listener>()
  private raf = 0
  private last = 0
  private audio: { ctx: AudioContext; gain: GainNode } | null = null

  start() {
    const loop = (now: number) => {
      const dt = this.last ? (now - this.last) / 1000 : 0
      this.last = now
      if (this.playing) this.time += dt
      if (this.fade) {
        const f = this.fade
        const k = f.dur <= 0 ? 1 : Math.min(1, (now - f.start) / f.dur)
        this.level = f.from + (f.to - f.from) * easeFn(k)
        if (k >= 1) {
          this.fade = null
          f.done?.()
        }
      }
      if (this.audio) this.audio.gain.gain.setTargetAtTime(this.playing ? 0.05 * this.level : 0, this.audio.ctx.currentTime, 0.015)
      const snap = this.snapshot()
      this.listeners.forEach((l) => l(snap))
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.audio?.ctx.close()
    this.audio = null
  }

  snapshot(): PlayerSnapshot {
    return { level: this.level, playing: this.playing, time: this.time }
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  /** Reset to "already playing at full level" (the prelude of every run). */
  reset() {
    this.fade = null
    this.level = 1
    this.playing = true
  }

  fadeTo(to: number, ms: number, done?: () => void) {
    this.fade = { from: this.level, to, start: performance.now(), dur: ms, done }
  }

  play() {
    this.playing = true
  }

  pause() {
    this.playing = false
  }

  /** Halt for good (the tab navigated away after Turn back). */
  silence() {
    this.fade = null
    this.level = 0
    this.playing = false
  }

  get soundOn() {
    return this.audio !== null
  }

  /** Must be called from a click: browsers block audible autoplay without a gesture. */
  enableSound() {
    if (this.audio) return
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.gain.value = 0
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    // A quiet open fifth (A3 + E4), the fake "string quartet".
    for (const [f, g] of [
      [220, 0.6],
      [329.63, 0.35],
      [440, 0.12],
    ]) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = g
      o.connect(og).connect(lp)
      o.start()
    }
    lp.connect(gain).connect(ctx.destination)
    this.audio = { ctx, gain }
  }

  disableSound() {
    this.audio?.ctx.close()
    this.audio = null
  }
}

/** Smooth pseudo-random bar heights for the meter; frozen when time stops. */
export function barHeight(i: number, time: number) {
  const a = Math.sin(time * 5.1 + i * 1.7) * 0.5 + 0.5
  const b = Math.sin(time * 2.3 + i * 0.63 + 1.3) * 0.5 + 0.5
  const c = Math.sin(time * 9.7 + i * 2.9) * 0.5 + 0.5
  return 0.25 + 0.75 * (0.45 * a + 0.35 * b + 0.2 * c)
}

export function timecode(s: number) {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}
