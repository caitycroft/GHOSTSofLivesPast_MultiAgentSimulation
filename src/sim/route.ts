import { CLOCK } from '../data/eras'
import type { PathRow } from './engine'

// Where a thread is at fractional time t. Each year is split evenly between
// the stops on its route; the thread dwells at a stop, then travels to the
// next one, so a year like 2024 (Shanghai, Svalbard, Shanghai, Oslo) reads as
// a set of hops and a year between two cities reads as a weave.

interface Key { t: number; place: string }
const cache = new WeakMap<PathRow[], Key[]>()
const DWELL = 0.55

function keys(rows: PathRow[]): Key[] {
  let k = cache.get(rows)
  if (!k) {
    k = []
    for (const r of rows) {
      const route = r.route.length ? r.route : [r.place]
      route.forEach((place, j) => k!.push({ t: r.year + j / route.length, place }))
    }
    k.push({ t: CLOCK.end + 1, place: k[k.length - 1].place })
    cache.set(rows, k)
  }
  return k
}

export interface Located { a: string; b: string; k: number }

export function locate(rows: PathRow[], t: number): Located {
  const k = keys(rows)
  const tt = Math.max(k[0].t, Math.min(CLOCK.end + 0.999, t))
  let lo = 0
  let hi = k.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (k[mid].t <= tt) lo = mid
    else hi = mid
  }
  const a = k[lo]
  const b = k[lo + 1] ?? a
  if (a.place === b.place) return { a: a.place, b: a.place, k: 0 }
  const s = (tt - a.t) / (b.t - a.t)
  const travel = Math.max(0, Math.min(1, (s - DWELL) / (1 - DWELL)))
  return { a: a.place, b: b.place, k: travel * travel * (3 - 2 * travel) }
}

// The place a thread is at (or nearest to) at time t
export const placeAt = (rows: PathRow[], t: number) => {
  const l = locate(rows, t)
  return l.k < 0.5 ? l.a : l.b
}
