// Real world data. Every fetcher is keyless and CORS friendly so the piece runs
// as a static site. Slow moving sources are cached in localStorage for a day.
// When a source is unreachable the piece falls back and says so on screen.

export type SourceStatus = 'idle' | 'loading' | 'live' | 'cached' | 'offline'

export interface Receipt {
  label: string
  source: string
  url: string
  fetchedAt?: string
}

async function getJSON<T>(url: string, timeoutMs = 12000): Promise<T> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

function readCache<T>(key: string, maxAgeMs: number): { data: T; at: number } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: T; at: number }
    if (Date.now() - parsed.at > maxAgeMs) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, at: Date.now() }))
  } catch {
    /* storage can be full or blocked; the piece still runs */
  }
}

export async function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<{ data: T; status: SourceStatus; at: number }> {
  const hit = readCache<T>(key, maxAgeMs)
  if (hit) return { data: hit.data, status: 'cached', at: hit.at }
  const data = await load()
  writeCache(key, data)
  return { data, status: 'live', at: Date.now() }
}

// ---------------------------------------------------------------------------
// Sun: real subsolar point, computed (NOAA low precision solar position)
// ---------------------------------------------------------------------------
export function subsolarPoint(date = new Date()): { lat: number; lon: number } {
  const rad = Math.PI / 180
  const jd = date.getTime() / 86400000 + 2440587.5
  const n = jd - 2451545.0
  const L = (280.46 + 0.9856474 * n) % 360
  const g = ((357.528 + 0.9856003 * n) % 360) * rad
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad
  const epsilon = (23.439 - 0.0000004 * n) * rad
  const decl = Math.asin(Math.sin(epsilon) * Math.sin(lambda))
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda))
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24
  let lon = (ra / rad - gmst * 15) % 360
  if (lon < -180) lon += 360
  if (lon > 180) lon -= 360
  return { lat: decl / rad, lon }
}

// ---------------------------------------------------------------------------
// USGS earthquakes, past day, magnitude 2.5 and up
// ---------------------------------------------------------------------------
export interface Quake { id: string; lat: number; lon: number; mag: number; place: string; time: number }
export const QUAKE_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'

export async function fetchQuakes(): Promise<Quake[]> {
  type F = { features: { id: string; properties: { mag: number; place: string; time: number }; geometry: { coordinates: [number, number, number] } }[] }
  const j = await getJSON<F>(QUAKE_URL)
  return j.features.map((f) => ({
    id: f.id,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    mag: f.properties.mag ?? 0,
    place: f.properties.place ?? '',
    time: f.properties.time,
  }))
}

// ---------------------------------------------------------------------------
// International Space Station position
// ---------------------------------------------------------------------------
export interface ISS { lat: number; lon: number; altKm: number; velocityKmh: number; at: number }
export const ISS_URL = 'https://api.wheretheiss.at/v1/satellites/25544'

export async function fetchISS(): Promise<ISS> {
  const j = await getJSON<{ latitude: number; longitude: number; altitude: number; velocity: number; timestamp: number }>(ISS_URL, 6000)
  return { lat: j.latitude, lon: j.longitude, altKm: j.altitude, velocityKmh: j.velocity, at: j.timestamp * 1000 }
}

// ---------------------------------------------------------------------------
// Open-Meteo current conditions for every city in the cast
// ---------------------------------------------------------------------------
export interface CityWeather { id: string; tempC: number; code: number; isDay: boolean; cloud: number; windKmh: number }

export function meteoUrl(points: { lat: number; lon: number }[]) {
  const lat = points.map((p) => p.lat.toFixed(2)).join(',')
  const lon = points.map((p) => p.lon.toFixed(2)).join(',')
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day,cloud_cover,wind_speed_10m`
}

export async function fetchCityWeather(points: { id: string; lat: number; lon: number }[]): Promise<CityWeather[]> {
  type C = { current: { temperature_2m: number; weather_code: number; is_day: number; cloud_cover: number; wind_speed_10m: number } }
  const j = await getJSON<C | C[]>(meteoUrl(points))
  const arr = Array.isArray(j) ? j : [j]
  return arr.map((c, i) => ({
    id: points[i].id,
    tempC: c.current.temperature_2m,
    code: c.current.weather_code,
    isDay: c.current.is_day === 1,
    cloud: c.current.cloud_cover,
    windKmh: c.current.wind_speed_10m,
  }))
}

// ---------------------------------------------------------------------------
// World Bank indicators: macro weather and how connected each country is
// ---------------------------------------------------------------------------
export type Series = Record<number, number>
export const wbUrl = (countries: string, indicator: string) =>
  `https://api.worldbank.org/v2/country/${countries}/indicator/${indicator}?format=json&date=2008:2026&per_page=1000`

export async function fetchWorldBank(countries: string[], indicator: string): Promise<Record<string, Series>> {
  type Row = { countryiso3code: string; date: string; value: number | null }
  const j = await getJSON<[unknown, Row[] | null]>(wbUrl(countries.join(';'), indicator))
  const out: Record<string, Series> = {}
  for (const r of j[1] ?? []) {
    if (r.value == null) continue
    const k = r.countryiso3code || 'WLD'
    ;(out[k] ??= {})[Number(r.date)] = r.value
  }
  return out
}

// ---------------------------------------------------------------------------
// Wikipedia attention: yearly pageviews per topic, the narrative signal
// ---------------------------------------------------------------------------
export const wikiUrl = (article: string) =>
  `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article)}/monthly/2015070100/2026123100`

export async function fetchWikiYearly(article: string): Promise<Series> {
  const j = await getJSON<{ items: { timestamp: string; views: number }[] }>(wikiUrl(article))
  const sums: Record<number, { v: number; n: number }> = {}
  for (const it of j.items) {
    const y = Number(it.timestamp.slice(0, 4))
    const s = (sums[y] ??= { v: 0, n: 0 })
    s.v += it.views
    s.n += 1
  }
  // Monthly average, so partial years (2015, the current year) compare fairly
  const out: Series = {}
  for (const [y, s] of Object.entries(sums)) out[Number(y)] = s.v / s.n
  return out
}
