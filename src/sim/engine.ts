import { INDUSTRY_BY_ID, NOW_YEAR, YEARS, eraAt, type IndustryId } from '../data/eras'
import { DECISION_YEARS, LAST_LIVED, LIVED_BY_YEAR } from '../data/lived'
import { narrate } from '../data/narrative'
import { PLACES, PLACE_BY_ID, haversineKm, pathsAt, type CareerPath } from '../data/places'
import { SELVES, START_ATTRS, type Self } from '../data/selves'
import type { Receipt } from '../live/sources'
import { connectionAt, localMacro, type LiveSignals, type WeatherTable } from './weather'

// The agent layer. The real thread replays the life that happened. Every
// ghost shares it until its fork, then becomes an agent of its own: at each
// fork in the road it weighs the career paths open where it is (or a move)
// by fit, industry weather, the local economy, risk appetite and the pull of
// other selves nearby, and chooses with some randomness (PRD 3.2).

export interface PathRow {
  year: number
  place: string // the base for the year
  route: string[] // every place the year passed through, in order
  role: string
  industry: IndustryId
  pathId: string
  incomeBand: 1 | 2 | 3 | 4 | 5
  network: number // 0 to 100
  craft: number
  capital: number
  narrative: string
  lived: boolean // true while the row is the life that happened
  projected: boolean // later than this year
  event?: { kind: 'decision' | 'fork' | 'pivot'; label: string; glyph: string }
}

export interface Choice { year: number; pathId: string; place: string; label: string; glyph: string; lived: boolean }
export interface Crossing { year: number; place: string; selves: string[] }

export interface WorldRun {
  paths: Record<string, PathRow[]>
  choices: Record<string, Choice[]>
  crossings: Crossing[]
}

export interface SimResult {
  canonical: WorldRun
  runs: number
  // Per self: how often each sequence of unlived choices came up
  pathCounts: Record<string, Record<string, number>>
  // Per self, per year: how many runs placed the self in each city (the ghost cloud)
  presence: Record<string, Record<number, Record<string, number>>>
  bandIn2031: Record<string, number[]>
  industryIn2031: Record<string, Partial<Record<IndustryId, number>>>
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
  music: ['xr', 'platforms', 'ai'],
  platforms: ['ai', 'web3'],
  venture: ['ai'],
  xr: ['worldmodels', 'ai'],
  web3: ['ai', 'worldmodels'],
  ai: ['worldmodels'],
  worldmodels: ['ai'],
  local: ['platforms'],
}

const GLYPHS = ['△', '◇', '✶', '⬡', '✦', '✧']
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const MOVABLE = PLACES.filter((p) => p.kind !== 'waypoint')

function softmaxPick(scores: number[], temp: number, rnd: () => number): number {
  const m = Math.max(...scores)
  const ex = scores.map((s) => Math.exp((s - m) / temp))
  let r = rnd() * ex.reduce((a, b) => a + b, 0)
  for (let i = 0; i < ex.length; i++) {
    r -= ex[i]
    if (r <= 0) return i
  }
  return ex.length - 1
}

interface Agent {
  self: Self
  place: string
  route: string[]
  industry: IndustryId
  role: string
  pathId: string
  craft: number
  network: number
  capital: number
  free: boolean // past its fork (or, for the real thread, past the lived years)
  choices: Choice[]
}

export type Forced = Record<string, { pathId: string; place: string }[]>

const roleFor = (path: CareerPath) => path.role || INDUSTRY_BY_ID[path.industry].role
const labelFor = (path: CareerPath, placeId: string) =>
  path.role ? path.label : `${INDUSTRY_BY_ID[path.industry].label} in ${PLACE_BY_ID[placeId].city}`

export function runWorld(
  seed: number,
  weather: WeatherTable,
  conn: SimResult['connection'],
  live: LiveSignals,
  forced: Forced = {},
  allowPivots = true,
): WorldRun {
  const rnd = mulberry32(seed)
  const agents: Agent[] = SELVES.map((s) => ({
    self: s, place: 'la', route: ['la'], industry: 'film', role: '', pathId: 'usc',
    craft: START_ATTRS.craft, network: START_ATTRS.network, capital: START_ATTRS.capital, free: false, choices: [],
  }))
  const real = agents[0]
  const paths: Record<string, PathRow[]> = Object.fromEntries(SELVES.map((s) => [s.id, []]))
  const crossings: Crossing[] = []
  const forcedIdx: Record<string, number> = {}

  const choose = (a: Agent, year: number, options: { path: CareerPath; place: string; stay: boolean }[], occupancy: Record<string, number>) => {
    const queue = forced[a.self.id]
    const i = forcedIdx[a.self.id] ?? 0
    if (queue && queue[i]) {
      forcedIdx[a.self.id] = i + 1
      const hit = options.find((o) => o.path.id === queue[i].pathId && o.place === queue[i].place)
      if (hit) return hit
    }
    const here = PLACE_BY_ID[a.place]
    const scores = options.map((o) => {
      const req = o.path.requires
      const fit = -0.55 * (Math.max(0, req.craft - a.craft) + Math.max(0, req.network - a.network) + Math.max(0, req.capital - a.capital))
      const wx = 0.9 * weather[Math.min(year, YEARS[YEARS.length - 1])][o.path.industry].value
      const macro = 0.4 * localMacro(PLACE_BY_ID[o.place].iso3, year, live).pressure
      const risk = (0.5 * o.path.risk * (START_ATTRS.risk - 3)) / 2
      const social = 0.15 * (occupancy[o.place] ?? 0)
      const dist = o.place === a.place ? 0 : 0.9 + haversineKm(here, PLACE_BY_ID[o.place]) / 6000
      // Ghosts are the selves who stayed: deepening the current path is easy,
      // switching locally is possible, leaving is a big decision
      const stay = o.stay ? 1.1 : o.place === a.place ? 0.25 : 0
      return fit + wx + macro + risk + social - dist + stay
    })
    return options[softmaxPick(scores, 0.7, rnd)]
  }

  for (const year of YEARS) {
    const row = weather[year]
    const lived = LIVED_BY_YEAR[year]
    const occupancy: Record<string, number> = {}
    for (const a of agents) if (a.free) occupancy[a.place] = (occupancy[a.place] ?? 0) + 1
    const events: Record<string, PathRow['event']> = {}
    const narrative: Record<string, string> = {}

    for (const a of agents) {
      const fork = a.self.fork
      const isFreeYear = a.self.real ? year > LAST_LIVED : !!fork && year >= fork.year

      if (!isFreeYear) {
        // Still the life that happened: copy it
        if (a.self.real) {
          a.place = lived.home
          a.route = lived.route
          a.industry = lived.industry
          a.role = lived.role
          a.pathId = lived.path
          if (lived.decision) a.choices.push({ year, pathId: lived.path, place: lived.home, label: lived.decision.label, glyph: lived.decision.glyph, lived: true })
          if (lived.decision) events[a.self.id] = { kind: 'decision', ...lived.decision }
          narrative[a.self.id] = lived.line
        } else {
          Object.assign(a, { place: real.place, route: real.route, industry: real.industry, role: real.role, pathId: real.pathId, craft: real.craft, network: real.network, capital: real.capital })
          a.choices = real.choices.map((c) => ({ ...c }))
          events[a.self.id] = events[real.self.id]
          narrative[a.self.id] = narrative[real.self.id]
        }
        continue
      }

      if (!a.free) {
        a.free = true
        if (fork && !a.self.real) {
          // The fork: stay where she was, and take a path she did not take
          const livedPath = LIVED_BY_YEAR[Math.min(year, LAST_LIVED)].path
          const options = pathsAt(fork.place)
            .filter((p) => p.id !== livedPath && p.same !== livedPath)
            .map((path) => ({ path, place: fork.place, stay: true }))
          const pick = choose(a, year, options, occupancy)
          a.place = pick.place
          a.route = [pick.place]
          a.industry = pick.path.industry
          a.role = roleFor(pick.path)
          a.pathId = pick.path.id
          a.choices.push({ year, pathId: pick.path.id, place: pick.place, label: labelFor(pick.path, pick.place), glyph: '†', lived: false })
          events[a.self.id] = { kind: 'fork', label: `Stays in ${PLACE_BY_ID[fork.place].city}: ${labelFor(pick.path, pick.place)}`, glyph: '†' }
          continue
        }
      }

      if (DECISION_YEARS.includes(year)) {
        // A fork in the road: deepen, switch locally, or move
        const options: { path: CareerPath; place: string; stay: boolean }[] = []
        for (const path of pathsAt(a.place)) options.push({ path, place: a.place, stay: path.id === a.pathId })
        const homes = a.self.real ? ['la', 'nyc', 'sf'] : MOVABLE.map((p) => p.id)
        for (const pid of homes) {
          if (pid === a.place) continue
          for (const path of pathsAt(pid)) options.push({ path, place: pid, stay: false })
        }
        const pick = choose(a, year, options, occupancy)
        const moved = pick.place !== a.place
        const changed = pick.path.id !== a.pathId || moved
        a.place = pick.place
        a.route = [pick.place]
        a.industry = pick.path.industry
        a.role = roleFor(pick.path)
        a.pathId = pick.path.id
        const glyph = GLYPHS[DECISION_YEARS.indexOf(year)]
        a.choices.push({ year, pathId: pick.path.id, place: pick.place, label: labelFor(pick.path, pick.place), glyph, lived: false })
        if (changed) events[a.self.id] = { kind: 'decision', label: moved ? `Moves to ${PLACE_BY_ID[pick.place].city}: ${labelFor(pick.path, pick.place)}` : labelFor(pick.path, pick.place), glyph }
      } else if (allowPivots) {
        // Drift: between forks an agent can pivot when its weather turns
        if (row[a.industry].value < -0.15) {
          const options = PIVOTS[a.industry].filter((i) => row[i].value > 0.45)
          if (options.length && rnd() < 0.4) {
            const next = options.sort((x, y) => row[y].value - row[x].value)[0]
            a.industry = next
            a.role = `${a.role.split(',')[0]}, now in ${INDUSTRY_BY_ID[next].label.toLowerCase()}`
            events[a.self.id] = { kind: 'pivot', label: `Pivots to ${INDUSTRY_BY_ID[next].label.toLowerCase()}`, glyph: '↻' }
          }
        }
      }
    }

    // Crossings: diverged selves in the same city in the same year
    const byPlace: Record<string, Agent[]> = {}
    for (const a of agents) (byPlace[a.place] ??= []).push(a)
    for (const [place, group] of Object.entries(byPlace)) {
      const freeOnes = group.filter((g) => g.free)
      if (group.length < 2 || !freeOnes.length) continue
      // Ghosts still on the real thread count once, as the real thread
      const members = group.filter((g) => g.free || g.self.real)
      if (members.length < 2) continue
      crossings.push({ year, place, selves: members.map((g) => g.self.id) })
      for (const g of freeOnes) g.network += 0.06 * (members.length - 1)
    }

    // Yearly drift of attributes along the path
    for (const a of agents) {
      if (!a.free && !a.self.real) {
        // a ghost on the real thread mirrors it exactly
        paths[a.self.id].push({ ...paths.real[paths.real.length - 1] })
        continue
      }
      const ind = INDUSTRY_BY_ID[a.industry]
      const wx = row[a.industry].value
      const p = PLACE_BY_ID[a.place]
      const macro = localMacro(p.iso3, year, live).pressure
      a.craft = clamp(a.craft + (ind.craft ? 0.1 : 0.04) + (rnd() - 0.5) * 0.05, 0.5, 5)
      a.network = clamp(a.network + (conn[a.place][year].value - 3.3) * 0.07 + (rnd() - 0.5) * 0.08, 0.5, 5)
      const founder = /Founder|founder/.test(a.role) ? 1.8 : 1
      a.capital = clamp(a.capital + wx * 0.3 * founder + macro * 0.15 - (p.costBand - 3) * 0.05 + (rnd() - 0.5) * 0.12 * founder, 0.5, 5)
      const score = a.capital * 0.6 + a.craft * 0.25 + a.network * 0.15
      const band = clamp(Math.round(score - 0.4), 1, 5) as PathRow['incomeBand']
      const seedN = Math.floor(rnd() * 1000)
      paths[a.self.id].push({
        year,
        place: a.place,
        route: a.route,
        role: a.role,
        industry: a.industry,
        pathId: a.pathId,
        incomeBand: band,
        network: Math.round((a.network / 5) * 100),
        craft: a.craft,
        capital: a.capital,
        narrative: narrative[a.self.id] ?? narrate(a.industry, eraAt(year).id, p.city, a.role, seedN),
        lived: !a.free,
        projected: year > NOW_YEAR,
        event: events[a.self.id],
      })
    }
  }

  return { paths, choices: Object.fromEntries(agents.map((a) => [a.self.id, a.choices])), crossings }
}

// The unlived part of a self's choices, as a key for counting
const keyOf = (choices: Choice[], withPlace: boolean) =>
  choices.filter((c) => !c.lived).map((c) => (withPlace ? `${c.pathId}@${c.place}` : c.pathId)).join('>')

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
  const industryIn2031: SimResult['industryIn2031'] = {}
  for (const s of SELVES) {
    pathCounts[s.id] = {}
    fullCounts[s.id] = {}
    presence[s.id] = {}
    bandIn2031[s.id] = [0, 0, 0, 0, 0]
    industryIn2031[s.id] = {}
    for (const y of YEARS) presence[s.id][y] = {}
  }

  for (let r = 0; r < runs; r++) {
    const w = runWorld(1000 + r * 7919, weather, connection, live, {}, allowPivots)
    for (const s of SELVES) {
      const ch = w.choices[s.id]
      const key = keyOf(ch, false)
      pathCounts[s.id][key] = (pathCounts[s.id][key] ?? 0) + 1
      const full = keyOf(ch, true)
      fullCounts[s.id][full] = (fullCounts[s.id][full] ?? 0) + 1
      for (const row of w.paths[s.id]) {
        if (row.lived) continue
        const pr = presence[s.id][row.year]
        pr[row.place] = (pr[row.place] ?? 0) + 1
      }
      const last = w.paths[s.id][w.paths[s.id].length - 1]
      bandIn2031[s.id][last.incomeBand - 1]++
      industryIn2031[s.id][last.industry] = (industryIn2031[s.id][last.industry] ?? 0) + 1
    }
  }

  // The canonical world: every self replays its most common unlived path,
  // chosen step by step (the most common first choice, then the most common
  // next choice among runs that made it, and so on)
  const forced: Forced = {}
  for (const s of SELVES) {
    let pool = Object.entries(fullCounts[s.id]).map(([k, v]) => ({ steps: k ? k.split('>') : [], v }))
    const out: string[] = []
    for (let i = 0; pool.some((x) => x.steps.length > i); i++) {
      const tally: Record<string, number> = {}
      for (const x of pool) if (x.steps[i]) tally[x.steps[i]] = (tally[x.steps[i]] ?? 0) + x.v
      const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]
      out.push(best)
      pool = pool.filter((x) => x.steps[i] === best)
    }
    forced[s.id] = out.map((part) => { const [pathId, place] = part.split('@'); return { pathId, place } })
  }
  const canonical = runWorld(42, weather, connection, live, forced, allowPivots)
  return { canonical, runs, pathCounts, presence, bandIn2031, industryIn2031, connection }
}

export function forkYearOf(selfId: string): number | undefined {
  return SELVES.find((s) => s.id === selfId)?.fork?.year
}
