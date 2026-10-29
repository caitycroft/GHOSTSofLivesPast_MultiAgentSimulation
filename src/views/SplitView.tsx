import { useState } from 'react'
import { CLOCK, INDUSTRIES } from '../data/eras'
import { PLACE_BY_ID } from '../data/places'
import { SELVES, SELF_BY_ID } from '../data/selves'
import { useYear } from '../lib/clock'
import type { LandData } from '../lib/geo'
import type { SimResult } from '../sim/engine'
import { MapView } from './MapView'

// The split (PRD 4.2, idea 4): two selves on one clock, two halves of a doorway.

function Half({ id, setId, sim, land, year }: { id: string; setId: (v: string) => void; sim: SimResult; land: LandData | null; year: number }) {
  const s = SELF_BY_ID[id]
  const rows = sim.canonical.paths[id]
  const row = rows[Math.min(rows.length - 1, year - CLOCK.start)]
  const industry = INDUSTRIES.find((i) => i.id === row.industry)!.label
  return (
    <section className="half" style={{ ['--c' as string]: s.color }}>
      <select value={id} onChange={(e) => setId(e.target.value)}>
        {SELVES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <div className="half-map"><MapView sim={sim} land={land} selves={[id]} compact /></div>
      <div className="half-now">
        <div className="half-year">{year}, age {row.age}</div>
        <div className="half-place">{PLACE_BY_ID[row.place].city}</div>
        <div className="half-role">{row.role}{row.role.toLowerCase().includes(industry.toLowerCase()) ? '' : `, ${industry.toLowerCase()}`}</div>
        <p className="half-line" key={`${id}-${year}`}>{row.narrative}</p>
        <div className="half-stats">
          <div><span>Income band</span><b>{'●'.repeat(row.incomeBand)}{'○'.repeat(5 - row.incomeBand)}</b></div>
          <div><span>Network</span><b>{row.network}</b></div>
          <div><span>Craft</span><b>{row.craft.toFixed(1)}</b></div>
        </div>
      </div>
    </section>
  )
}

export function SplitView({ sim, land }: { sim: SimResult; land: LandData | null }) {
  const year = useYear()
  const [a, setA] = useState('real')
  const [b, setB] = useState(SELVES[1].id)
  return (
    <div className="split">
      <Half id={a} setId={setA} sim={sim} land={land} year={year} />
      <div className="door" />
      <Half id={b} setId={setB} sim={sim} land={land} year={year} />
    </div>
  )
}
