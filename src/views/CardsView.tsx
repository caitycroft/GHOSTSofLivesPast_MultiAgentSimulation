import { useState } from 'react'
import { CLOCK, INDUSTRY_BY_ID, NOW_YEAR } from '../data/eras'
import { PLACE_BY_ID, pathLabel } from '../data/places'
import { SELVES, SELF_BY_ID, type Self } from '../data/selves'
import { useYear } from '../lib/clock'
import type { SimResult } from '../sim/engine'

// The life card (PRD 4.2, idea 5): one card per self, tarot meets ID card.

const band = (n: number) => '●'.repeat(n) + '○'.repeat(5 - n)
const industryLabel = (id: string) => INDUSTRY_BY_ID[id as keyof typeof INDUSTRY_BY_ID].label

function RouteGlyph({ self, sim, year }: { self: Self; sim: SimResult; year: number }) {
  const rows = sim.canonical.paths[self.id]
  const W = 220, H = 96
  const x = (lon: number) => ((lon + 180) / 360) * W
  const y = (lat: number) => ((80 - lat) / 140) * H
  const stops = rows.filter((r) => r.year <= year).flatMap((r) => r.route.map((p) => ({ p: PLACE_BY_ID[p], lived: r.lived })))
  const seg = (lived: boolean) => {
    let d = ''
    stops.forEach((s, i) => {
      if (i === 0) return
      const a = stops[i - 1]
      if (s.lived !== lived && a.lived !== lived) return
      d += `M${x(a.p.lon).toFixed(1)},${y(a.p.lat).toFixed(1)}L${x(s.p.lon).toFixed(1)},${y(s.p.lat).toFixed(1)}`
    })
    return d
  }
  const visited = Array.from(new Set(rows.flatMap((r) => r.route))).map((id) => PLACE_BY_ID[id])
  const last = stops[stops.length - 1]?.p
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="route">
      <rect x="0" y="0" width={W} height={H} fill="none" stroke="currentColor" strokeOpacity="0.12" />
      {visited.map((p) => <circle key={p.id} cx={x(p.lon)} cy={y(p.lat)} r="3.5" fill="none" stroke="currentColor" strokeOpacity="0.35" />)}
      <path d={seg(true)} fill="none" stroke={SELF_BY_ID.real.color} strokeOpacity={self.real ? 1 : 0.35} strokeWidth="1.2" />
      {!self.real && <path d={seg(false)} fill="none" stroke={self.color} strokeWidth="1.8" />}
      {last && <circle cx={x(last.lon)} cy={y(last.lat)} r="3" fill="#fff" />}
    </svg>
  )
}

function NetworkLine({ self, sim, year }: { self: Self; sim: SimResult; year: number }) {
  const rows = sim.canonical.paths[self.id]
  const W = 220, H = 34
  const pts = rows.map((r, i) => `${(i / (rows.length - 1)) * W},${H - (r.network / 100) * H}`)
  const cut = ((year - CLOCK.start) / (CLOCK.end - CLOCK.start)) * W
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark">
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeOpacity="0.2" />
      <clipPath id={`clip-${self.id}`}><rect x="0" y="0" width={cut} height={H} /></clipPath>
      <polyline points={pts.join(' ')} fill="none" stroke={self.color} strokeWidth="1.5" clipPath={`url(#clip-${self.id})`} />
    </svg>
  )
}

export function forkOdds(sim: SimResult, selfId: string): { first: string; count: number } {
  const counts = sim.pathCounts[selfId]
  const canon = sim.canonical.choices[selfId].find((c) => !c.lived)
  if (!canon) return { first: '', count: 0 }
  let count = 0
  for (const [k, v] of Object.entries(counts)) if (k.split('>')[0] === canon.pathId) count += v
  return { first: canon.pathId, count }
}

export function LifeCard({ self, sim, year, onOpen }: { self: Self; sim: SimResult; year: number; onOpen?: () => void }) {
  const rows = sim.canonical.paths[self.id]
  const choices = sim.canonical.choices[self.id]
  const now = rows[NOW_YEAR - CLOCK.start]
  const end = rows[rows.length - 1]
  const cur = rows[Math.min(rows.length - 1, Math.max(0, year - CLOCK.start))]
  const odds = forkOdds(sim, self.id)
  return (
    <article className={'card' + (self.real ? ' real' : '')} style={{ ['--c' as string]: self.color }} onClick={onOpen}>
      <header>
        <div className="card-kicker">{self.real ? 'The life that happened' : `A life not lived · forks ${self.fork!.year}`}</div>
        <h3>{self.name}</h3>
        <div className="card-home">{self.real ? 'USC in 2010, then everywhere below' : `Shares the real life until ${self.fork!.year}, then ${self.fork!.note}`}</div>
      </header>
      <RouteGlyph self={self} sim={sim} year={year} />
      <div className="choices">
        {choices.map((c, i) => (
          <div key={i} className={'choice' + (c.year <= year ? ' made' : '') + (c.lived && !self.real ? ' shared' : '') + (!c.lived ? ' unlived' : '')}>
            <span className="glyph">{c.glyph}</span>
            <span className="age">{c.year}</span>
            <span className="lbl">{c.label}</span>
            <span className="where">{PLACE_BY_ID[c.place].city}</span>
          </div>
        ))}
      </div>
      <div className="card-now">
        <div><span>{cur.year}</span>{PLACE_BY_ID[cur.place].city}, {cur.role}</div>
        <div className="band" title="Income band, 1 to 5">{band(cur.incomeBand)}</div>
      </div>
      <NetworkLine self={self} sim={sim} year={year} />
      <dl className="card-meta">
        <dt>Now, {NOW_YEAR}</dt><dd>{PLACE_BY_ID[now.place].city}, {industryLabel(now.industry)}</dd>
        <dt>Heading, {CLOCK.end}</dt><dd>{PLACE_BY_ID[end.place].city}, {end.role}</dd>
        <dt>Odds</dt><dd>{self.real ? `Lived to ${NOW_YEAR}; next move in ${odds.count} of ${sim.runs} runs` : `This fork in ${odds.count} of ${sim.runs} runs`}</dd>
      </dl>
      <p className="sentence">{self.sentence}</p>
    </article>
  )
}

export function CardsView({ sim }: { sim: SimResult }) {
  const year = Math.min(CLOCK.end, useYear())
  const [open, setOpen] = useState<string | null>(null)
  const self = open ? SELF_BY_ID[open] : null
  return (
    <div className="cards-view">
      <div className="cards">
        {SELVES.map((s) => <LifeCard key={s.id} self={s} sim={sim} year={year} onOpen={() => setOpen(s.id)} />)}
      </div>
      {self && (
        <div className="drawer" onClick={() => setOpen(null)}>
          <div className="drawer-body" onClick={(e) => e.stopPropagation()} style={{ ['--c' as string]: self.color }}>
            <button className="close" onClick={() => setOpen(null)}>Close</button>
            <h2>{self.name}</h2>
            <p className="sentence">{self.sentence}</p>
            <ol className="timeline">
              {sim.canonical.paths[self.id].map((r) => (
                <li key={r.year} className={(r.year === year ? 'cur ' : '') + (r.event ? 'evt ' : '') + (r.lived && !self.real ? 'shared' : '')}>
                  <span className="y">{r.year}</span>
                  <span className="g">{r.event?.glyph ?? '·'}</span>
                  <span className="p">{r.route.map((p) => PLACE_BY_ID[p].city).filter((c, i, a) => a.indexOf(c) === i).join(', ')}</span>
                  <span className="r">{r.event ? r.event.label : r.role}</span>
                  <span className="b">{band(r.incomeBand)}</span>
                  <span className="n">{r.narrative}</span>
                </li>
              ))}
            </ol>
            <PathDistribution sim={sim} selfId={self.id} />
          </div>
        </div>
      )}
    </div>
  )
}

export function PathDistribution({ sim, selfId }: { sim: SimResult; selfId: string }) {
  const counts = Object.entries(sim.pathCounts[selfId]).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const max = counts[0]?.[1] ?? 1
  const canon = sim.canonical.choices[selfId].filter((c) => !c.lived).map((c) => c.pathId).join('>')
  return (
    <div className="dist">
      <div className="dist-title">Unlived paths across {sim.runs} runs</div>
      {counts.map(([k, v]) => {
        const steps = k.split('>').filter((s, i, a) => i === 0 || s !== a[i - 1])
        return (
          <div key={k} className={'dist-row' + (k === canon ? ' canon' : '')}>
            <span className="lbl" title={steps.map(pathLabel).join(' then ')}>{steps.map(pathLabel).join(' → ')}</span>
            <span className="bar"><i style={{ width: `${(v / max) * 100}%` }} /></span>
            <span className="v">{v}</span>
          </div>
        )
      })}
    </div>
  )
}
