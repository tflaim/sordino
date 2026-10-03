// PROTOTYPE — the fake playing video on the host page, plus a level meter that
// reads the PagePlayer every frame (direct DOM writes, no React re-render).
// This is the *page's* UI, so its own motion is not Sordino motion.
import { useEffect, useRef } from 'react'
import { barHeight, timecode, type PagePlayer } from './player'

const DURATION = 14 * 60 + 5

/** A row of bars whose height = page level × a moving waveform. */
export function Meter({
  player,
  bars,
  className,
  barClass,
}: {
  player: PagePlayer
  bars: number
  className: string
  barClass: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(
    () =>
      player.subscribe((s) => {
        const kids = ref.current?.children
        if (!kids) return
        for (let i = 0; i < kids.length; i++) {
          const h = Math.max(0.04, s.level * barHeight(i, s.time))
          ;(kids[i] as HTMLElement).style.transform = `scaleY(${h.toFixed(3)})`
        }
      }),
    [player],
  )
  return (
    <div ref={ref} className={className} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className={barClass} style={{ transformOrigin: 'bottom' }} />
      ))}
    </div>
  )
}

/** Small text readout (state / time / level) that follows the player. */
export function Readout({ player, kind }: { player: PagePlayer; kind: 'time' | 'state' | 'level' }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(
    () =>
      player.subscribe((s) => {
        if (!ref.current) return
        ref.current.textContent =
          kind === 'time'
            ? `${timecode(s.time)} / ${timecode(DURATION)}`
            : kind === 'state'
              ? s.playing
                ? 'playing'
                : 'paused'
              : `${Math.round(s.level * 100)}%`
      }),
    [player, kind],
  )
  return <span ref={ref} className="tnum" />
}

export function LeadVideo({ player }: { player: PagePlayer }) {
  const light = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const icon = useRef<HTMLSpanElement>(null)
  useEffect(
    () =>
      player.subscribe((s) => {
        // The "picture": a stage light drifting while the video plays, frozen when paused.
        if (light.current) light.current.style.transform = `translateX(${Math.sin(s.time * 0.6) * 120}px)`
        if (progress.current) progress.current.style.transform = `scaleX(${(s.time / DURATION).toFixed(4)})`
        if (icon.current) icon.current.textContent = s.playing ? '❚❚' : '▶'
      }),
    [player],
  )
  return (
    <article className="flex overflow-hidden rounded border border-[#ccc] bg-white">
      <div className="flex w-10 flex-col items-center bg-[#f8f9fa] py-2 text-[12px] font-bold">
        <span className="text-[#ff4500]">▲</span>
        6.4k
        <span className="text-[#7193ff]">▼</span>
      </div>
      <div className="flex-1 p-2">
        <div className="text-[12px] text-[#787c7e]">
          <b className="text-[#1c1c1c]">r/classicalmusic</b> · Posted by u/second_violin 40m ago
        </div>
        <h3 className="my-1 text-[18px] font-medium leading-snug">
          Our quartet's first full run of Op. 131, rehearsal room recording
        </h3>
        <div className="relative my-2 h-[300px] overflow-hidden rounded bg-[#15110e]">
          <div
            ref={light}
            className="absolute left-1/2 top-[-40px] h-[340px] w-[360px] rounded-full"
            style={{
              marginLeft: -180,
              background: 'radial-gradient(closest-side, rgba(255,214,150,0.55), rgba(255,214,150,0) 70%)',
            }}
          />
          <div className="absolute inset-x-0 bottom-[78px] flex justify-center gap-10 opacity-80">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="block h-[86px] w-[34px] rounded-t-full bg-[#2b221b]" />
            ))}
          </div>
          {/* Page's own audio meter: the literal mute is visible here. */}
          <Meter
            player={player}
            bars={48}
            className="absolute inset-x-6 bottom-[40px] flex h-[34px] items-end gap-[3px]"
            barClass="block h-full flex-1 rounded-sm bg-[#ffb35c]"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-black/55 px-3 py-2 text-[12px] text-white">
            <span ref={icon} className="w-4 text-center text-[11px]">
              ❚❚
            </span>
            <div className="relative h-[4px] flex-1 overflow-hidden rounded bg-white/25">
              <div ref={progress} className="absolute inset-0 origin-left bg-[#ff4500]" />
            </div>
            <Readout player={player} kind="time" />
            <span aria-hidden>🔊</span>
            <Readout player={player} kind="level" />
          </div>
        </div>
        <div className="flex gap-4 text-[12px] font-bold text-[#878a8c]">
          <span>💬 214 Comments</span>
          <span>Share</span>
          <span>Save</span>
        </div>
      </div>
    </article>
  )
}
