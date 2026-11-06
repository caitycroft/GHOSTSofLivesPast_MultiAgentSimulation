import { ERAS, eraAt, INDUSTRIES, NOW_YEAR, YEARS, type IndustryId } from '../data/eras'
import { PLACES } from '../data/places'
import type { Series, Receipt } from '../live/sources'
import { wbUrl, wikiUrl } from '../live/sources'

// Industry weather: one number per industry per year, -1 to 1, plus the
// receipts for how it was made. Baseline comes from the authored era table;
// Wikipedia attention and World Bank macro data bend it where they exist.

export const WIKI_TOPICS: Record<Exclude<IndustryId, 'local'>, string[]> = {
  film: ['Film_industry', 'Box_office'],
  music: ['Electronic_dance_music', 'Music_festival'],
  platforms: ['Social_media', 'TikTok'],
  venture: ['Venture_capital', 'Startup_company'],
  xr: ['Virtual_reality', 'Augmented_reality'],
  web3: ['Non-fungible_token', 'Metaverse'],
  ai: ['Artificial_intelligence', 'ChatGPT'],
  worldmodels: ['Digital_twin', 'Gaussian_splatting'],
}

export interface LiveSignals {
  wiki: Partial<Record<string, Series>>
  gdpGrowth?: Series // world, annual percent
  gdp: Record<string, Series> // iso3 to annual GDP growth percent
  inflation: Record<string, Series> // iso3 to annual consumer price inflation percent
  internet: Record<string, Series> // iso3 to percent of population online
  asOf?: string // when the slow sources were fetched
}

export const EMPTY_SIGNALS: LiveSignals = { wiki: {}, gdp: {}, inflation: {}, internet: {} }

export interface WeatherCell {
  value: number
  baseline: number
  attention?: number
  macro?: number
  projected: boolean
  receipts: Receipt[]
}

export type WeatherTable = Record<number, Record<IndustryId, WeatherCell>>

const clamp = (v: number, a = -1, b = 1) => Math.max(a, Math.min(b, v))

function attentionGrowth(series: Series[], year: number): number | undefined {
  // Log growth of combined monthly average attention, year over year
  const now = series.reduce((s, x) => s + (x[year] ?? 0), 0)
  const prev = series.reduce((s, x) => s + (x[year - 1] ?? 0), 0)
  if (!now || !prev) return undefined
  return Math.log(now / prev)
}

// The latest value at or before a year, so 2026 can lean on 2024 data
export function latest(series: Series | undefined, year: number): { year: number; value: number } | undefined {
  if (!series) return undefined
  let best: { year: number; value: number } | undefined
  for (const [k, v] of Object.entries(series)) {
    const y = Number(k)
    if (y <= year && (!best || y > best.year)) best = { year: y, value: v }
  }
  return best
}

export function buildWeather(live: LiveSignals, nowYear = NOW_YEAR): WeatherTable {
  const table: WeatherTable = {}
  for (const y of YEARS) {
    const era = eraAt(y)
    const containing = ERAS.filter((e) => y >= e.start && y <= e.end)
    const row = {} as Record<IndustryId, WeatherCell>
    for (const ind of INDUSTRIES) {
      const baseline = containing.length ? containing.reduce((s, e) => s + e.weather[ind.id], 0) / containing.length : era.weather[ind.id]
      const receipts: Receipt[] = [
        { label: `Baseline ${baseline.toFixed(2)} from ${containing.map((e) => e.label).join(' + ') || era.label}`, source: 'Authored era timeline', url: '#eras' },
      ]
      let value = baseline
      let attention: number | undefined
      let macro: number | undefined
      const projected = y > nowYear

      if (ind.id !== 'local' && !projected) {
        const topics = WIKI_TOPICS[ind.id]
        const series = topics.map((t) => live.wiki[t]).filter(Boolean) as Series[]
        const g = series.length ? attentionGrowth(series, y) : undefined
        if (g !== undefined) {
          attention = clamp(Math.tanh(g * 1.6))
          value = 0.55 * baseline + 0.45 * attention
          receipts.push({ label: `Attention ${g >= 0 ? 'up' : 'down'} ${Math.abs(g * 100).toFixed(0)}% on ${y - 1} (${topics.join(', ').replaceAll('_', ' ')})`, source: 'Wikimedia pageviews API', url: wikiUrl(topics[0]) })
        }
      }

      const gdp = live.gdpGrowth?.[y]
      if (gdp !== undefined && !projected) {
        // World growth near 3% is neutral; a contraction pulls everything down
        macro = clamp((gdp - 3) / 6, -0.6, 0.4)
        const sensitivity = ind.id === 'local' || ind.id === 'film' || ind.id === 'music' ? 0.6 : 0.25
        value += macro * sensitivity
        receipts.push({ label: `World GDP growth ${gdp.toFixed(1)}%`, source: 'World Bank NY.GDP.MKTP.KD.ZG', url: wbUrl('WLD', 'NY.GDP.MKTP.KD.ZG') })
      }

      if (projected) receipts.push({ label: 'Projected year: baseline only', source: 'Authored era timeline', url: '#eras' })
      row[ind.id] = { value: clamp(value), baseline, attention, macro, projected, receipts }
    }
    table[y] = row
  }
  return table
}

// The local economy of a country in a year, with receipts (for pop-ups and the sim)
export function localMacro(iso3: string, year: number, live: LiveSignals) {
  const gdp = latest(live.gdp[iso3], year)
  const inflation = latest(live.inflation[iso3], year)
  const online = latest(live.internet[iso3], year)
  const receipts: Receipt[] = []
  if (gdp) receipts.push({ label: `GDP growth ${gdp.value.toFixed(1)}% (${gdp.year})`, source: 'World Bank NY.GDP.MKTP.KD.ZG', url: wbUrl(iso3, 'NY.GDP.MKTP.KD.ZG') })
  if (inflation) receipts.push({ label: `Inflation ${inflation.value.toFixed(1)}% (${inflation.year})`, source: 'World Bank FP.CPI.TOTL.ZG', url: wbUrl(iso3, 'FP.CPI.TOTL.ZG') })
  if (online) receipts.push({ label: `${online.value.toFixed(0)}% online (${online.year})`, source: 'World Bank IT.NET.USER.ZS', url: wbUrl(iso3, 'IT.NET.USER.ZS') })
  // Growth near 2% is neutral for a rich economy
  const pressure = gdp ? clamp((gdp.value - 2) / 5, -0.8, 0.6) : 0
  return { gdp, inflation, online, pressure, receipts }
}

// How connected a place is to the scene in a given year (1 to 5): base value,
// the weather of the industries it hosts, how online and how fast growing its country is.
export function connectionAt(placeId: string, year: number, w: WeatherTable, live: LiveSignals): { value: number; receipts: Receipt[] } {
  const p = PLACES.find((x) => x.id === placeId)!
  const row = w[Math.min(Math.max(year, YEARS[0]), YEARS[YEARS.length - 1])]
  let pull = 0
  for (const [ind, strength] of Object.entries(p.industries) as [IndustryId, number][]) pull += strength * row[ind].value
  const m = localMacro(p.iso3, year, live)
  const online = m.online ? (m.online.value - 80) / 40 : 0
  const receipts: Receipt[] = [{ label: `Base connection ${p.connection}, industry pull ${pull.toFixed(2)}`, source: 'Place table + industry weather', url: '#places' }, ...m.receipts]
  return { value: Math.max(1, Math.min(5, p.connection + pull * 0.8 + online + m.pressure * 0.4)), receipts }
}
