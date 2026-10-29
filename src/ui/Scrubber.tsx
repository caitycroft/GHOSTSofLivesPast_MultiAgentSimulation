import { useRef } from 'react'
import { CLOCK, ERAS, YEARS } from '../data/eras'
import { clock, useClock } from '../lib/clock'
import type { WeatherTable } from '../sim/weather'
import { INDUSTRIES } from '../data/eras'
import { hideTip, showTip, Receipts } from './tooltip'

const span = CLOCK.end - CLOCK.start
const pct = (y: number) => ((y - CLOCK.start) / span) * 100

export function Scrubber({ weather }: { weather: WeatherTable }) {
  const t = useClock((s) => s.t)
  const playing = useClock((s) => s.playing)
  const speed = useClock((s) => s.speed)
  const bar = useRef<HTMLDivElement>(null)

  const fromEvent = (x: number) => {
    const r = bar.current!.getBoundingClientRect()
    return CLOCK.start + Math.max(0, Math.min(1, (x - r.left) / r.width)) * span
  }

  const onDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    clock.set({ t: fromEvent(e.clientX), playing: false })
  }
  const onMove = (e: React.PointerEvent) => {
    if (e.buttons) clock.set({ t: fromEvent(e.clientX) })
    const y = Math.round(fromEvent(e.clientX))
    const row = weather[y]
    if (!row) return
    const ranked = INDUSTRIES.map((i) => ({ i, c: row[i.id] })).sort((a, b) => b.c.value - a.c.value)
    showTip(e.clientX, e.clientY - 200, (
      <div>
        <div className="tip-title">{y} industry weather</div>
        {ranked.map(({ i, c }) => (
          <div key={i.id} className="tip-row"><span>{i.label}</span><b style={{ color: c.value >= 0 ? 'var(--key)' : '#8b9097' }}>{c.value >= 0 ? '+' : ''}{c.value.toFixed(2)}</b></div>
        ))}
        <Receipts items={ranked[0].c.receipts} />
      </div>
    ))
  }

  return (
    <div className="scrubber">
      <button className="play" onClick={() => clock.set({ playing: !playing, t: t >= CLOCK.end ? CLOCK.start : t })} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="track" ref={bar} onPointerDown={onDown} onPointerMove={onMove} onPointerLeave={hideTip}>
        {ERAS.map((e) => (
          <div key={e.id} className="era" style={{ left: `${pct(e.start)}%`, width: `${pct(e.end) - pct(e.start)}%`, background: `linear-gradient(90deg, ${e.light.fill}55, ${e.light.key}33)` }} title={e.label} />
        ))}
        {YEARS.map((y) => (
          <div key={y} className={'tick' + (y % 5 === 0 ? ' major' : '')} style={{ left: `${pct(y)}%` }}>
            {y % 5 === 0 || y === CLOCK.end ? <span>{y}</span> : null}
          </div>
        ))}
        <div className="now-line" style={{ left: `${pct(new Date().getFullYear() + (new Date().getMonth() / 12))}%` }} title="Today" />
        <div className="head" style={{ left: `${pct(t)}%` }}><span>{Math.floor(t)}</span></div>
      </div>
      <div className="speed">
        {[0.25, 0.55, 1.2].map((s) => (
          <button key={s} className={speed === s ? 'on' : ''} onClick={() => clock.set({ speed: s })}>{s === 0.25 ? 'slow' : s === 0.55 ? 'film' : 'fast'}</button>
        ))}
      </div>
    </div>
  )
}
