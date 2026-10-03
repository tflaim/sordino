// PROTOTYPE — the genre stage renderer (round 3). Lazily imported, so three.js and the
// shaders land in their own chunk (engine-*.js) and the perf readout can weigh it.
//
// three.js is used as plumbing only: one WebGLRenderer, one full-screen quad, one
// RawShaderMaterial per genre. All choreography lives in the fragment shader as a
// pure function of the arrival clock, so each genre could be lifted into a ~3 KB raw
// WebGL2 program unchanged (see the "portable" notes in score.ts).
//
// Lifecycle: created during the prelude on an engine-owned canvas (so the shader
// compiles before the mute goes in), attached to the overlay at t0, renders at most
// 60 fps while the measure plays, renders one last frame when the cadence has
// settled and then STOPS (no ambient loop), pauses while the tab is hidden, and
// disposes its context on release and on turn back.
import { GLSL3, Mesh, OrthographicCamera, PlaneGeometry, RawShaderMaterial, Scene, WebGLRenderer } from 'three'
import { FRAGMENTS, VERT } from './shaders'
import type { GenreKey } from './score'

export interface StageConfig {
  genre: GenreKey
  onsets: number[] // ms
  beats: number
  beatMs: number
  spent: boolean
  settleMs: number
  /** Drawing-buffer scale (1 = one buffer pixel per CSS pixel). */
  renderScale: number
}

export type StageState = 'ready' | 'running' | 'hidden' | 'still' | 'turning' | 'disposed'

export interface StagePerf {
  state: StageState
  fps: number
  frameMs: number // JS time inside render(), mean of recent frames
  frames: number
  renderer: string
  contextLost: boolean
}

const MAX_SAFE = 8
const FRAME_MIN = 1000 / 60 - 2 // 60 fps cap (skips frames on 120 Hz displays)

export class Stage {
  readonly canvas: HTMLCanvasElement
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private mat: RawShaderMaterial
  private geo = new PlaneGeometry(2, 2)
  private cfg: StageConfig
  private t0 = 0
  private turnAt = 0
  private raf = 0
  private last = 0
  private stamps: number[] = []
  private costs: number[] = []
  private frames = 0
  private state: StageState = 'ready'
  private barTop = 0
  private safe = new Float32Array(MAX_SAFE * 4)
  private onVis = () => this.visibility()
  private ro: ResizeObserver | null = null
  private pr = 1
  readonly rendererName: string

  constructor(cfg: StageConfig) {
    this.cfg = cfg
    this.canvas = document.createElement('canvas')
    this.canvas.setAttribute('aria-hidden', 'true')
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'
    // Throws when WebGL2 is unavailable; the caller falls back to the SVG metronome.
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'low-power' })
    this.pr = cfg.renderScale
    this.renderer.setPixelRatio(this.pr)
    this.renderer.setClearColor(0x1c1917, 1)
    this.renderer.autoClear = false
    const gl = this.renderer.getContext()
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    this.rendererName = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    const on = new Array(17).fill(0)
    cfg.onsets.forEach((ms, i) => (on[i] = ms / 1000))
    this.mat = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAGMENTS[cfg.genre],
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uRes: { value: [1, 1] },
        uFocus: { value: [0, 0] },
        uScale: { value: 280 },
        uT: { value: 0 },
        uTotal: { value: (cfg.beats * cfg.beatMs) / 1000 },
        uN: { value: cfg.beats },
        uBeat: { value: cfg.beatMs / 1000 },
        uOn: { value: on },
        uTurn: { value: -1 },
        uDyn: { value: cfg.spent ? 0.8 : 1 },
        uStill: { value: 0 },
        uSpent: { value: cfg.spent ? 1 : 0 },
        uSafe: { value: this.safe },
        uBarY: { value: 0 },
      },
    })
    const mesh = new Mesh(this.geo, this.mat)
    mesh.frustumCulled = false
    this.scene.add(mesh)
    this.resize(1280, 800)
    this.renderer.compile(this.scene, this.camera)
    this.renderer.clear()
  }

  get total() {
    return (this.cfg.beats * this.cfg.beatMs) / 1000
  }

  /** Mount into the overlay. Layout follows the canvas' own size. */
  attach(parent: HTMLElement, barTop: number) {
    parent.prepend(this.canvas)
    this.barTop = barTop
    this.ro = new ResizeObserver(() => {
      this.resize(this.canvas.clientWidth, this.canvas.clientHeight)
      if (this.state === 'still' || this.state === 'ready') this.draw(this.mat.uniforms.uT.value)
    })
    this.ro.observe(this.canvas)
    this.resize(this.canvas.clientWidth || innerWidth, this.canvas.clientHeight || innerHeight)
  }

  setBarTop(y: number) {
    this.barTop = y
    this.layout()
  }

  private resize(w: number, h: number) {
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.mat.uniforms.uRes.value = [w * this.pr, h * this.pr]
    this.layout()
  }

  /** The stage's focal point sits right of the text column on wide screens, centred on narrow ones. */
  private layout() {
    const pr = this.pr
    const [bw, bh] = this.mat.uniforms.uRes.value as number[]
    const w = bw / pr
    const h = bh / pr
    const stageH = this.barTop > 0 ? Math.min(h, this.barTop) : h - 100
    const wide = w >= 900
    const fx = wide ? w * 0.76 : w * 0.5
    const fyTop = stageH * (wide ? 0.48 : 0.42)
    this.mat.uniforms.uFocus.value = [fx * pr, (h - fyTop) * pr]
    this.mat.uniforms.uBarY.value = (h - stageH) * pr
    this.mat.uniforms.uScale.value = pr * (wide ? Math.min(w * 0.22, stageH * 0.42) : Math.min(w * 0.42, stageH * 0.36))
  }

  /** Text rectangles (CSS px, viewport) behind which the stage's luminance is capped for AA contrast. */
  setSafe(rects: { left: number; top: number; right: number; bottom: number }[]) {
    const c = this.canvas.getBoundingClientRect()
    const h = c.height || innerHeight
    this.safe.fill(0)
    const pr = this.pr
    rects.slice(0, MAX_SAFE).forEach((r, i) => {
      const pad = 10
      this.safe[i * 4 + 0] = (r.left - c.left - pad) * pr
      this.safe[i * 4 + 1] = (h - (r.bottom - c.top) - pad) * pr
      this.safe[i * 4 + 2] = (r.right - c.left + pad) * pr
      this.safe[i * 4 + 3] = (h - (r.top - c.top) + pad) * pr
    })
    if (this.state === 'still' || this.state === 'ready') this.draw(this.mat.uniforms.uT.value)
  }

  private draw(tSec: number) {
    const a = performance.now()
    this.mat.uniforms.uT.value = tSec
    this.renderer.render(this.scene, this.camera)
    this.costs.push(performance.now() - a)
    if (this.costs.length > 30) this.costs.shift()
    this.frames++
  }

  /** Start the measure, locked to the arrival clock. */
  start(t0: number) {
    this.t0 = t0
    this.state = 'running'
    document.addEventListener('visibilitychange', this.onVis)
    this.loop(performance.now())
  }

  /** Stillness / reduced motion: one composed frame, then nothing. */
  renderStill() {
    this.mat.uniforms.uStill.value = 1
    this.draw(this.total + this.cfg.settleMs / 1000)
    this.state = 'still'
  }

  private loop = (now: number) => {
    if (this.state !== 'running' && this.state !== 'turning') return
    this.raf = requestAnimationFrame(this.loop)
    if (now - this.last < FRAME_MIN) return
    this.last = now
    this.stamps.push(now)
    while (this.stamps.length && now - this.stamps[0] > 1000) this.stamps.shift()
    if (this.state === 'turning') {
      this.mat.uniforms.uTurn.value = (now - this.turnAt) / 1000
      this.draw((this.turnAt - this.t0) / 1000)
      return
    }
    const t = (now - this.t0) / 1000
    const end = this.total + this.cfg.settleMs / 1000
    if (t >= end) {
      // The cadence has settled: draw its exact final frame and stop. The canvas keeps it.
      this.draw(end)
      cancelAnimationFrame(this.raf)
      this.state = 'still'
      this.stamps = []
      return
    }
    this.draw(t)
  }

  private visibility() {
    if (document.hidden && this.state === 'running') {
      cancelAnimationFrame(this.raf)
      this.state = 'hidden'
    } else if (!document.hidden && this.state === 'hidden') {
      this.state = 'running' // the clock is absolute, so the stage rejoins the count where it is
      this.loop(performance.now())
    }
  }

  /** Bypass taken: freeze (the cover fades with the canvas in it); dispose after. */
  freeze() {
    cancelAnimationFrame(this.raf)
    if (this.state !== 'disposed') this.state = 'still'
  }

  /** Turn back: the cadence plays only inside the navigation's own commit time. */
  turn() {
    if (this.state === 'disposed') return
    cancelAnimationFrame(this.raf)
    this.turnAt = performance.now()
    if (this.mat.uniforms.uStill.value === 1) return // Stillness: nothing moves
    this.state = 'turning'
    this.loop(performance.now())
  }

  perf(): StagePerf {
    const lost = this.state === 'disposed' ? this.renderer.getContext().isContextLost() : false
    return {
      state: this.state,
      fps: this.state === 'running' || this.state === 'turning' ? this.stamps.length : 0,
      frameMs: this.costs.length ? this.costs.reduce((a, b) => a + b, 0) / this.costs.length : 0,
      frames: this.frames,
      renderer: this.rendererName,
      contextLost: lost,
    }
  }

  /**
   * Debug hook for the contrast check: render the frame at time t (or the still frame)
   * and return the max linear luminance inside each text rectangle (unpadded).
   */
  probe(tSec: number, still = false): number[] {
    const prevStill = this.mat.uniforms.uStill.value
    this.mat.uniforms.uStill.value = still ? 1 : 0
    this.mat.uniforms.uT.value = tSec
    this.renderer.render(this.scene, this.camera)
    const gl = this.renderer.getContext()
    const w = gl.drawingBufferWidth
    const h = gl.drawingBufferHeight
    const px = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
    this.mat.uniforms.uStill.value = prevStill
    const lin = (c: number) => {
      const s = c / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    const out: number[] = []
    const pad = 10 * this.pr
    for (let i = 0; i < MAX_SAFE; i++) {
      const x0 = Math.max(0, Math.floor(this.safe[i * 4] + pad))
      const y0 = Math.max(0, Math.floor(this.safe[i * 4 + 1] + pad))
      const x1 = Math.min(w, Math.ceil(this.safe[i * 4 + 2] - pad))
      const y1 = Math.min(h, Math.ceil(this.safe[i * 4 + 3] - pad))
      if (x1 <= x0 || y1 <= y0) continue
      let m = 0
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const o = (y * w + x) * 4
          const L = 0.2126 * lin(px[o]) + 0.7152 * lin(px[o + 1]) + 0.0722 * lin(px[o + 2])
          if (L > m) m = L
        }
      out.push(m)
    }
    return out
  }

  dispose() {
    if (this.state === 'disposed') return
    cancelAnimationFrame(this.raf)
    document.removeEventListener('visibilitychange', this.onVis)
    this.ro?.disconnect()
    this.geo.dispose()
    this.mat.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.state = 'disposed'
  }
}

export function createStage(cfg: StageConfig) {
  return new Stage(cfg)
}
