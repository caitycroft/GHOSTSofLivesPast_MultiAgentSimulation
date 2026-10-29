import { BRANCHES, BRANCH_BY_ID, DECISION_AGES, branchesAt, type Branch, type DecisionAge } from '../data/branches'
import { INDUSTRIES, YEARS, eraAt, type IndustryId } from '../data/eras'
import { narrate } from '../data/narrative'
import { PLACES, PLACE_BY_ID, haversineKm } from '../data/places'
import { BIRTH_YEAR, SELVES, type Self } from '../data/selves'
import type { Receipt } from '../live/sources'
import { connectionAt, type LiveSignals, type WeatherTable } from './weather'

// The agent layer. Each self is an agent; all selves share one clock and one
// world, so they meet in cities and pull on each other's choices (PRD 3.2).

export interface PathRow {
  year: number
  age: number
  place: string
  role: string
  industry: IndustryId
  incomeBand: 1 | 2 | 3 | 4 | 5
  network: number // 0 to 100
  craft: number
  capital: number
  narrative: string
  event?: { kind: 'decision' | 'pivot'; label: string; glyph: string }
}

export interface Crossing { year: number; place: string; selves: string[] }

export interface WorldRun {
  paths: Record<string, PathRow[]>
  choices: Record<string, { branch: string; place: string }[]>
  crossings: Crossing[]
}

export interface SimResult {
  canonical: WorldRun
  runs: number
  // Per self: how often each of the 27 branch triples came up
  pathCounts: Record<string, Record<string, number>>
  // Per self, per year: how many runs placed the self in each city (the ghost cloud)
  presence: Record<string, Record<number, Record<string, number>>>
  bandIn2031: Record<string, number[]>
  connection: Record<string, Record<number, { value: number; receipts: Receipt[] }>>
}

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PIVOTS: Record<IndustryId, IndustryId[]> = {
  film: ['xr', 'ai', 'worldmodels'],
  platforms: ['ai', 'web3'],
  xr: ['worldmodels', 'ai'],
  web3: ['ai', 'worldmodels'],
  ai: ['worldmodels'],
  worldmodels: ['ai'],
  local: ['platforms'],
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function softmaxPick<T>(items: T[], scores: number[], temp: number, rnd: () => number): number {
  const m = Math.max(...scores)
  const ex = scores.map((s) => Math.exp((s - m) / temp))
  const sum = ex.reduce((a, b) => a + b, 0)
  let r = rnd() * sum
  for (let i = 0; i < items.length; i++) {
    r -= ex[i]
    if (r <= 0) return i
  }
  return items.length - 1
}

interface Agent {
  self: Self
  place: string
  industry: IndustryId
  role: string
  craft: number
  network: number
  capital: number
  choices: { branch: string; place: string }[]
}

export type Forced = Record<string, { branch: string; place?: string }[]>

export function runWorld(
  seed: number,
  weather: WeatherTable,
  conn: SimResult['connection'],
  forced: Forced = {},
  allowPivots = true,
): WorldRun {
  const rnd = mulberry32(seed)
  const agents: Agent[] = SELVES.map((s) => ({
    self: s,
    place: s.home,
    industry: 'local',
    role: 'Kid from ' + PLACE_BY_ID[s.home].city,
    craft: s.attrs.craft,
    network: s.attrs.network,
    capital: s.attrs.capital,
    choices: [],
  }))
  const paths: Record<string, PathRow[]> = Object.fromEntries(SELVES.map((s) => [s.id, []]))
  const crossings: Crossing[] = []

  for (const year of YEARS) {
    const age = year - BIRTH_YEAR
    const row = weather[year]
    const occupancy: Record<string, number> = {}
    for (const a of agents) occupancy[a.place] = (occupancy[a.place] ?? 0) + 1
    const events: Record<string, PathRow['event']> = {}

    // 1. Decisions
    if ((DECISION_AGES as number[]).includes(age)) {
      const decisionIdx = DECISION_AGES.indexOf(age as DecisionAge)
      for (const a of agents) {
        const options = branchesAt(age as DecisionAge)
        const force = forced[a.self.id]?.[decisionIdx]
        let pick: Branch
        if (force) {
          pick = BRANCH_BY_ID[force.branch]
        } else if (a.self.real && a.self.lived) {
          pick = BRANCH_BY_ID[a.self.lived[age as 18 | 25 | 30]]
        } else {
          const scores = options.map((b) => {
            const ind = b.industry === '$current' ? a.industry : b.industry
            const fit = -0.6 * (Math.max(0, b.requires.craft - a.craft) + Math.max(0, b.requires.network - a.network) + Math.max(0, b.requires.capital - a.capital))
            const wx = 0.9 * row[ind].value
            const risk = 0.5 * b.risk * ((a.self.attrs.risk - 3) / 2)
            const target = resolvePlaceCandidates(b, a)
            const social = 0.2 * Math.max(...target.map((p) => (occupancy[p] ?? 0) - (p === a.place ? 1 : 0)))
            return fit + wx + risk + social
          })
          pick = options[softmaxPick(options, scores, 0.7, rnd)]
        }
        const candidates = resolvePlaceCandidates(pick, a)
        let place: string
        if (force?.place && candidates.includes(force.place)) place = force.place
        else {
          const here = PLACE_BY_ID[a.place]
          const scores = candidates.map((p) => {
            const dist = haversineKm(here, PLACE_BY_ID[p]) / 5000
            return conn[p][year].value * 0.8 - dist * (1.1 - a.self.attrs.risk * 0.15) + (occupancy[p] ?? 0) * 0.15
          })
          place = candidates[softmaxPick(candidates, scores, 0.5, rnd)]
        }
        a.place = place
        a.industry = pick.industry === '$current' ? a.industry : pick.industry
        a.role = pick.role
        if (pick.id === 'build') a.role = `Founder, ${INDUSTRIES.find((i) => i.id === a.industry)!.label.toLowerCase()}`
        a.choices.push({ branch: pick.id, place })
        events[a.self.id] = { kind: 'decision', label: pick.label, glyph: pick.glyph }
      }
    } else if (allowPivots && age > 30) {
      // 2. Drift: between decisions an agent can pivot when its weather turns
      for (const a of agents) {
        if (row[a.industry].value > -0.15) continue
        const options = PIVOTS[a.industry].filter((i) => row[i].value > 0.45)
        if (!options.length || rnd() > 0.4) continue
        const next = options.sort((x, y) => row[y].value - row[x].value)[0]
        a.industry = next
        a.role = `${a.role.split(',')[0]}, now in ${INDUSTRIES.find((i) => i.id === next)!.label.toLowerCase()}`
        events[a.self.id] = { kind: 'pivot', label: `Pivoted to ${INDUSTRIES.find((i) => i.id === next)!.label.toLowerCase()}`, glyph: '↻' }
      }
    }

    // 3. Crossings: selves in the same city in the same year
    const byPlace: Record<string, Agent[]> = {}
    for (const a of agents) (byPlace[a.place] ??= []).push(a)
    for (const [place, group] of Object.entries(byPlace)) {
      if (group.length < 2) continue
      crossings.push({ year, place, selves: group.map((g) => g.self.id) })
      for (const g of group) g.network += 0.06 * (group.length - 1)
    }

    // 4. Yearly drift of attributes along the branch
    for (const a of agents) {
      const ind = INDUSTRIES.find((i) => i.id === a.industry)!
      const wx = row[a.industry].value
      const p = PLACE_BY_ID[a.place]
      a.craft = clamp(a.craft + (ind.craft ? 0.1 : 0.04) + (rnd() - 0.5) * 0.05, 0.5, 5)
      a.network = clamp(a.network + (conn[a.place][year].value - 3.3) * 0.07 + (rnd() - 0.5) * 0.08, 0.5, 5)
      const founder = a.role.startsWith('Founder') ? 1.8 : 1
      a.capital = clamp(a.capital + wx * 0.32 * founder - (p.costBand - 3) * 0.05 + (rnd() - 0.5) * 0.12 * founder, 0.5, 5)
      const score = a.capital * 0.6 + a.craft * 0.25 + a.network * 0.15
      const band = clamp(Math.round(score - 0.4), 1, 5) as PathRow['incomeBand']
      const seedN = Math.floor(rnd() * 1000)
      paths[a.self.id].push({
        year,
        age,
        place: a.place,
        role: a.role,
        industry: a.industry,
        incomeBand: band,
        network: Math.round((a.network / 5) * 100),
        craft: a.craft,
        capital: a.capital,
        narrative: narrate(a.industry, eraAt(year).id, p.city, a.role, seedN),
        event: events[a.self.id],
      })
    }
  }

  return { paths, choices: Object.fromEntries(agents.map((a) => [a.self.id, a.choices])), crossings }
}

function resolvePlaceCandidates(b: Branch, a: Agent): string[] {
  if (b.place === '$home') return [a.self.home]
  if (b.place === '$current') return [a.place]
  return b.place
}

export function simulate(weather: WeatherTable, live: LiveSignals, runs = 100, allowPivots = true): SimResult {
  const connection: SimResult['connection'] = {}
  for (const p of PLACES) {
    connection[p.id] = {}
    for (const y of YEARS) connection[p.id][y] = connectionAt(p.id, y, weather, live)
  }

  const pathCounts: SimResult['pathCounts'] = {}
  const fullCounts: Record<string, Record<string, number>> = {}
  const presence: SimResult['presence'] = {}
  const bandIn2031: SimResult['bandIn2031'] = {}
  for (const s of SELVES) {
    pathCounts[s.id] = {}
    fullCounts[s.id] = {}
    presence[s.id] = {}
    bandIn2031[s.id] = [0, 0, 0, 0, 0]
    for (const y of YEARS) presence[s.id][y] = {}
  }

  for (let r = 0; r < runs; r++) {
    const w = runWorld(1000 + r * 7919, weather, connection, {}, allowPivots)
    for (const s of SELVES) {
      const ch = w.choices[s.id]
      const key = ch.map((c) => c.branch).join('>')
      pathCounts[s.id][key] = (pathCounts[s.id][key] ?? 0) + 1
      const full = ch.map((c) => `${c.branch}@${c.place}`).join('>')
      fullCounts[s.id][full] = (fullCounts[s.id][full] ?? 0) + 1
      for (const row of w.paths[s.id]) {
        const pr = presence[s.id][row.year]
        pr[row.place] = (pr[row.place] ?? 0) + 1
      }
      bandIn2031[s.id][w.paths[s.id][w.paths[s.id].length - 1].incomeBand - 1]++
    }
  }

  // The canonical world: every self replays its most common path
  const forced: Forced = {}
  for (const s of SELVES) {
    // Most common branch triple first, then its most common set of cities
    const triple = Object.entries(pathCounts[s.id]).sort((a, b) => b[1] - a[1])[0][0]
    const modal = Object.entries(fullCounts[s.id])
      .filter(([k]) => k.replace(/@[a-z]+/g, '') === triple)
      .sort((a, b) => b[1] - a[1])[0][0]
    forced[s.id] = modal.split('>').map((part) => {
      const [branch, place] = part.split('@')
      return { branch, place }
    })
  }
  const canonical = runWorld(42, weather, connection, forced, allowPivots)
  return { canonical, runs, pathCounts, presence, bandIn2031, connection }
}

export const ALL_TRIPLES: string[] = (() => {
  const a = branchesAt(18), b = branchesAt(25), c = branchesAt(30)
  const out: string[] = []
  for (const x of a) for (const y of b) for (const z of c) out.push(`${x.id}>${y.id}>${z.id}`)
  return out
})()

export const BRANCH_COUNT = BRANCHES.length
