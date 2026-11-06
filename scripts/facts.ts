// Runs the same simulation the app runs, on the same data snapshot, and
// writes the facts the video captions quote (media/facts.json). Captions
// never state an outcome the simulation did not produce.
import { readFileSync, writeFileSync } from 'node:fs'
import { CLOCK } from '../src/data/eras'
import { PLACE_BY_ID, pathLabel } from '../src/data/places'
import { SELVES } from '../src/data/selves'
import { simulate } from '../src/sim/engine'
import { buildWeather, type LiveSignals } from '../src/sim/weather'

const snap = JSON.parse(readFileSync('public/data/snapshot.json', 'utf8'))
const signals: LiveSignals = { wiki: snap.wiki, gdpGrowth: snap.worldBank.gdp?.WLD, gdp: snap.worldBank.gdp ?? {}, inflation: snap.worldBank.inflation ?? {}, internet: snap.worldBank.internet ?? {}, asOf: snap.asOf }
const weather = buildWeather(signals)
const sim = simulate(weather, signals, 100, true)

const selves = Object.fromEntries(SELVES.map((s) => {
  const rows = sim.canonical.paths[s.id]
  const unlived = sim.canonical.choices[s.id].filter((c) => !c.lived)
  const r2026 = rows[2026 - CLOCK.start]
  const r2031 = rows[rows.length - 1]
  const first = unlived[0]
  let firstCount = 0
  for (const [k, v] of Object.entries(sim.pathCounts[s.id])) if (first && k.split('>')[0] === first.pathId) firstCount += v
  return [s.id, {
    name: s.name,
    fork: s.fork ? { year: s.fork.year, city: PLACE_BY_ID[s.fork.place].city, note: s.fork.note } : null,
    firstChoice: first ? { year: first.year, label: pathLabel(first.pathId), city: PLACE_BY_ID[first.place].city, odds: firstCount } : null,
    in2026: { city: PLACE_BY_ID[r2026.place].city, role: r2026.role, band: r2026.incomeBand },
    in2031: { city: PLACE_BY_ID[r2031.place].city, role: r2031.role, band: r2031.incomeBand, industry: r2031.industry },
    pivots: rows.filter((r) => r.event?.kind === 'pivot').map((r) => `${r.year}: ${r.event!.label}`),
  }]
}))

const gdp = (iso: string, y: number) => snap.worldBank.gdp?.[iso]?.[y]
const facts = {
  asOf: snap.asOf,
  runs: sim.runs,
  rows: SELVES.length * (CLOCK.end - CLOCK.start + 1) * sim.runs,
  crossings: sim.canonical.crossings.length,
  selves,
  data: {
    ukGdp2020: gdp('GBR', 2020), deGdp2023: gdp('DEU', 2023), cnGdp2021: gdp('CHN', 2021), seGdp2016: gdp('SWE', 2016), usGdp2021: gdp('USA', 2021), worldGdp2020: gdp('WLD', 2020),
    usInfl2022: snap.worldBank.inflation?.USA?.[2022], gbInfl2022: snap.worldBank.inflation?.GBR?.[2022],
  },
}
writeFileSync('media/facts.json', JSON.stringify(facts, null, 2))
console.log(JSON.stringify(facts, null, 1).slice(0, 4000))
