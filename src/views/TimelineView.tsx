import { useEffect, useRef, useState } from 'react'
import { CLOCK, ERAS, YEARS, eraAt } from '../data/eras'
import { EVENTS, EVENT_KINDS, wikiLink, type EventKind } from '../data/events'
import { LIVED_BY_YEAR } from '../data/lived'
import { PLACE_BY_ID } from '../data/places'
import { GHOSTS } from '../data/selves'
import type { VisualStyle } from '../globe/GlobeScene'
import { clock, useYear } from '../lib/clock'
import type { SimResult } from '../sim/engine'
import { hideTip, showTip } from '../ui/tooltip'

// The timeline as a ribbon that scrolls past a fixed playhead: the eras, the
// world events (macro, geopolitics, technology, culture), the life that
// happened, where it was each year, and where each ghost leaves the thread.

const LANES: { id: EventKind | 'where' | 'forks'; label: string; color: string }[] = [
  ...EVENT_KINDS.map((k) => ({ id: k.id, label: k.label, color: k.color })),
  { id: 'where', label: 'Where', color: '#9aa6b8' },
  { id: 'forks', label: 'Ghosts fork', color: '#7cc4ff' },
]

export function TimelineView({ sim, style }: { sim: SimResult; style: VisualStyle }) {
  const ribbon = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1200)
  const year = Math.min(CLOCK.end, useYear())
  const ppy = Math.max(240, Math.min(420, width / 4.2))

  useEffect(() => {
    const ro = new ResizeObserver(() => setWidth(frame.current?.clientWidth ?? 1200))
    if (frame.current) ro.observe(frame.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const move = () => {
      if (!ribbon.current || !frame.current) return
      const t = clock.get().t
      ribbon.current.style.transform = `translateX(${frame.current.clientWidth * 0.42 - (t - CLOCK.start) * ppy}px)`
    }
    move()
    const off = clock.subscribe(move)
    return () => { off() }
  }, [ppy])

  const era = eraAt(year)
  const x = (y: number, month = 1) => (y - CLOCK.start + (month - 1) / 12) * ppy
  const near = (y: number, month = 1) => Math.abs(y + (month - 1) / 12 - clock.get().t) < 0.75
  const thisYear = EVENTS.filter((e) => e.year === year)
  const lived = LIVED_BY_YEAR[year]

  return (
    <div className={`timeline-view tl-${style}`}>
      <div className="tl-head">
        <div className="tl-era" key={era.id}>
          <div className="tl-era-kicker">{era.start} to {era.end}{era.end > 2026 ? ', projected' : ''}</div>
          <h2>{era.label}</h2>
          <p>{era.line}</p>
          <ul>{era.trends.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="tl-year">
          <div className="tl-year-n">{year}</div>
          {lived && <div className="tl-year-life">{lived.line}</div>}
          <ul>{thisYear.filter((e) => e.kind !== 'life').map((e) => <li key={e.label} style={{ ['--k' as string]: EVENT_KINDS.find((k) => k.id === e.kind)!.color }}>{e.detail}</li>)}</ul>
        </div>
      </div>

      <div className="tl-frame" ref={frame}>
        <div className="tl-lane-labels">
          {LANES.map((l) => <div key={l.id} style={{ color: l.color }}>{l.label}</div>)}
        </div>
        <div className="tl-ribbon" ref={ribbon} style={{ width: (YEARS.length + 1) * ppy }}>
          {ERAS.map((e) => (
            <div key={e.id} className="tl-band" style={{ left: x(e.start), width: (e.end - e.start + 1) * ppy, ['--e' as string]: style === 'arcade' ? e.neon.accent : e.light.fill }}>
              <span>{e.label}</span>
            </div>
          ))}
          {YEARS.map((y) => (
            <div key={y} className={'tl-year-col' + (y === year ? ' cur' : '') + (y > 2026 ? ' proj' : '')} style={{ left: x(y), width: ppy }}>
              <span>{y}</span>
            </div>
          ))}
          {LANES.slice(0, 5).map((lane, li) =>
            EVENTS.filter((e) => e.kind === lane.id).map((e, i) => (
              <div
                key={`${e.label}-${i}`}
                className={'tl-ev' + (near(e.year, e.month) ? ' near' : '') + (i % 2 ? ' alt' : '')}
                style={{ left: x(e.year, e.month ?? 6), top: `calc(var(--lane-h) * ${li} + var(--lane-top))`, ['--k' as string]: lane.color }}
                onPointerMove={(ev) => showTip(ev.clientX, ev.clientY, (
                  <div>
                    <div className="tip-title">{e.label}, {e.month ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][e.month - 1]} ` : ''}{e.year}</div>
                    <p className="tip-line">{e.detail}</p>
                    {e.wiki && <div className="receipt"><div className="src">Wikipedia: {decodeURIComponent(e.wiki).replaceAll('_', ' ')}</div></div>}
                  </div>
                ))}
                onPointerLeave={hideTip}
                onClick={() => e.wiki && window.open(wikiLink(e.wiki), '_blank')}
              >
                <i />
                <b>{e.label}</b>
              </div>
            )),
          )}
          {YEARS.filter((y) => LIVED_BY_YEAR[y]).map((y) => (
            <div key={`w${y}`} className={'tl-where' + (y === year ? ' near' : '')} style={{ left: x(y), width: ppy - 12, top: `calc(var(--lane-h) * 5 + var(--lane-top))` }}>
              {LIVED_BY_YEAR[y].route.map((p) => PLACE_BY_ID[p].city).filter((c, i, a) => a.indexOf(c) === i).join(' · ')}
            </div>
          ))}
          {YEARS.filter((y) => y > 2026).map((y) => (
            <div key={`p${y}`} className="tl-where proj" style={{ left: x(y), width: ppy - 12, top: `calc(var(--lane-h) * 5 + var(--lane-top))` }}>
              {PLACE_BY_ID[sim.canonical.paths.real[y - CLOCK.start].place].city}, projected
            </div>
          ))}
          {GHOSTS.map((g, i) => (
            <div key={g.id} className={'tl-fork' + (Math.abs(g.fork!.year - clock.get().t) < 1 ? ' near' : '')} style={{ left: x(g.fork!.year, 2 + (i % 4) * 3), top: `calc(var(--lane-h) * 6 + var(--lane-top) + ${(i % 3) * 16}px)`, ['--c' as string]: style === 'arcade' ? g.neon : g.color }}>
              <i />{g.name.replace(/^The /, '').replace(/ self$/, '')}
            </div>
          ))}
        </div>
        <div className="tl-playhead" />
      </div>
    </div>
  )
}
