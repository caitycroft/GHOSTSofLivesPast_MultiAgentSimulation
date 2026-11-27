// Dumps what each agent's life looks like in the canonical run, year by year,
// with the eras and the World Bank numbers, for the Thanksgiving graphics
// (media/thanksgiving/agents.json). Same simulation and snapshot as the app.
import { readFileSync, writeFileSync } from 'node:fs'
import { ERAS, INDUSTRIES, INDUSTRY_BY_ID } from '../src/data/eras'
import { PLACE_BY_ID } from '../src/data/places'
import { SELVES } from '../src/data/selves'
import { simulate } from '../src/sim/engine'
import { buildWeather, type LiveSignals } from '../src/sim/weather'

const snap = JSON.parse(readFileSync('public/data/snapshot.json', 'utf8'))
const signals: LiveSignals = { wiki: snap.wiki, gdpGrowth: snap.worldBank.gdp?.WLD, gdp: snap.worldBank.gdp ?? {}, inflation: snap.worldBank.inflation ?? {}, internet: snap.worldBank.internet ?? {}, asOf: snap.asOf }
const sim = simulate(buildWeather(signals), signals, 100, true)
const agents = SELVES.map((s) => ({
  id: s.id, name: s.name, color: s.color, neon: s.neon, real: !!s.real,
  fork: s.fork ? { year: s.fork.year, place: s.fork.place, city: PLACE_BY_ID[s.fork.place].city } : null,
  rows: sim.canonical.paths[s.id].map((r) => ({
    year: r.year, place: r.place, city: PLACE_BY_ID[r.place].city, country: PLACE_BY_ID[r.place].country, iso: PLACE_BY_ID[r.place].iso3,
    lat: PLACE_BY_ID[r.place].lat, lon: PLACE_BY_ID[r.place].lon, role: r.role, industry: r.industry, industryLabel: INDUSTRY_BY_ID[r.industry].short,
    industryColor: INDUSTRY_BY_ID[r.industry].color, band: r.incomeBand, network: r.network, lived: r.lived, projected: r.projected, event: r.event?.label ?? null,
  })),
  ends: sim.industryIn2031[s.id],
}))
const eras = ERAS.map((e) => ({ id: e.id, label: e.label, start: e.start, end: e.end, line: e.line, trends: e.trends, accent: e.neon.accent }))
writeFileSync('media/thanksgiving/agents.json', JSON.stringify({ agents, eras, industries: Object.fromEntries(INDUSTRIES.map((i) => [i.id, { short: i.short, color: i.color }])), gdp: snap.worldBank.gdp, inflation: snap.worldBank.inflation }))
for (const a of agents) console.log(a.id.padEnd(5), [2016, 2020, 2023, 2026, 2031].map((y) => { const r = a.rows.find((x) => x.year === y)!; return `${y} ${r.city}: ${r.role}` }).join(' | '))
for (const e of eras) console.log(e.start, e.end, e.label, '|', e.trends.join('; '))
