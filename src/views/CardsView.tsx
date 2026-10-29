import { useState } from 'react'
import { BRANCH_BY_ID } from '../data/branches'
import { CLOCK, INDUSTRIES } from '../data/eras'
import { PLACE_BY_ID } from '../data/places'
import { SELVES, SELF_BY_ID, type Self } from '../data/selves'
import { useYear } from '../lib/clock'
import type { SimResult } from '../sim/engine'

// The life card (PRD 4.2, idea 5): one card per self, tarot meets ID card.

const NOW = Math.min(CLOCK.end, new Date().getFullYear())
const band = (n: number) => '●'.repeat(n) + '○'.repeat(5 - n)
const industryLabel = (id: string) => INDUSTRIES.find((i) => i.id === id)!.label

function RouteGlyph({ self, sim, year }: { self: Self; sim: SimResult; year: number }) {
  const rows = sim.canonical.paths[self.id]
  const W = 220, H = 96
  const x = (lon: number) => ((lon + 180) / 360) * W
  const y = (lat: number) => ((75 - lat) / 135) * H
  const upto = rows.filter((r) => r.year <= year)
  const pts = upto.map((r) => PLACE_BY_ID[r.place])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.lon).toFixed(1)},${y(p.lat).toFixed(1)}`).join(' ')
  const visited = Array.from(new Set(rows.map((r) => r.place))).map((id) => PLACE_BY_ID[id])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="route">
      <rect x="0" y="0" width={W} height={H} fill="none" stroke="currentColor" strokeOpacity="0.12" />
      {visited.map((p) => (
        <circle key={p.id} cx={x(p.lon)} cy={y(p.lat)} r="4" fill="none" stroke="currentColor" strokeOpacity="0.4" />
      ))}
      <path d={d} fill="none" stroke={self.color} strokeWidth={self.real ? 2 : 1.4} strokeLinejoin="round" />
      {pts.length > 0 && <circle cx={x(pts[pts.length - 1].lon)} cy={y(pts[pts.length - 1].lat)} r="3" fill="#fff" />}
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

export function LifeCard({ self, sim, year, onOpen }: { self: Self; sim: SimResult; year: number; onOpen?: () => void }) {
  const rows = sim.canonical.paths[self.id]
  const choices = sim.canonical.choices[self.id]
  const now = rows[NOW - CLOCK.start]
  const end = rows[rows.length - 1]
  const cur = rows[Math.min(rows.length - 1, year - CLOCK.start)]
  const triple = choices.map((c) => c.branch).join('>')
  const freq = sim.pathCounts[self.id][triple] ?? 0
  return (
    <article className={'card' + (self.real ? ' real' : '')} style={{ ['--c' as string]: self.color }} onClick={onOpen}>
      <header>
        <div className="card-kicker">{self.real ? 'The life that happened' : 'A life not lived'}</div>
        <h3>{self.name}</h3>
        <div className="card-home">Born into {PLACE_BY_ID[self.home].city}, {BIRTH_LABEL}</div>
      </header>
      <RouteGlyph self={self} sim={sim} year={year} />
      <div className="choices">
        {choices.map((c, i) => {
          const b = BRANCH_BY_ID[c.branch]
          return (
            <div key={i} className={'choice' + (cur.year >= CLOCK.start + [0, 7, 12][i] ? ' made' : '')}>
              <span className="glyph">{b.glyph}</span>
              <span className="age">{[18, 25, 30][i]}</span>
              <span className="lbl">{b.label}</span>
              <span className="where">{PLACE_BY_ID[c.place].city}</span>
            </div>
          )
        })}
      </div>
      <div className="card-now">
        <div><span>{year}</span>{PLACE_BY_ID[cur.place].city}, {cur.role}</div>
        <div className="band" title="Income band, 1 to 5">{band(cur.incomeBand)}</div>
      </div>
      <NetworkLine self={self} sim={sim} year={year} />
      <dl className="card-meta">
        <dt>Now, {NOW}</dt><dd>{PLACE_BY_ID[now.place].city}, {industryLabel(now.industry)}</dd>
        <dt>Heading, {CLOCK.end}</dt><dd>{PLACE_BY_ID[end.place].city}, {end.role}</dd>
        <dt>Odds</dt><dd>{self.real ? 'Lived, so one in one' : `This path in ${freq} of ${sim.runs} runs`}</dd>
      </dl>
      <p className="sentence">{self.sentence}</p>
    </article>
  )
}

const BIRTH_LABEL = 'eighteen in 2008'

export function CardsView({ sim }: { sim: SimResult }) {
  const year = useYear()
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
                <li key={r.year} className={(r.year === year ? 'cur ' : '') + (r.event ? 'evt' : '')}>
                  <span className="y">{r.year}</span>
                  <span className="g">{r.event?.glyph ?? '·'}</span>
                  <span className="p">{PLACE_BY_ID[r.place].city}</span>
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
  const counts = Object.entries(sim.pathCounts[selfId]).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const max = counts[0]?.[1] ?? 1
  const canon = sim.canonical.choices[selfId].map((c) => c.branch).join('>')
  return (
    <div className="dist">
      <div className="dist-title">Paths across {sim.runs} runs</div>
      {counts.map(([k, v]) => (
        <div key={k} className={'dist-row' + (k === canon ? ' canon' : '')}>
          <span className="glyphs">{k.split('>').map((b) => BRANCH_BY_ID[b].glyph).join(' ')}</span>
          <span className="lbl">{k.split('>').map((b) => BRANCH_BY_ID[b].label.replace(/^(Leave for |Go into |Join the |Build |Join a |Allocate capital to the )/, '')).join(' / ')}</span>
          <span className="bar"><i style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="v">{v}</span>
        </div>
      ))}
    </div>
  )
}
