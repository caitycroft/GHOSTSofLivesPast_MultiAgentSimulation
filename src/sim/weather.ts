import { ERAS, eraAt, INDUSTRIES, YEARS, type IndustryId } from '../data/eras'
import { PLACES } from '../data/places'
import type { Series, Receipt } from '../live/sources'
import { wbUrl, wikiUrl } from '../live/sources'

// Industry weather: one number per industry per year, -1 to 1, plus the
// receipts for how it was made. Baseline comes from the authored era table;
// live attention and macro data bend it where they exist (PRD 3.2, receipts).

export const WIKI_TOPICS: Record<Exclude<IndustryId, 'local'>, string[]> = {
  film: ['Film_industry', 'Box_office'],
  platforms: ['Social_media', 'Startup_company'],
  xr: ['Virtual_reality', 'Augmented_reality'],
  web3: ['Non-fungible_token', 'Metaverse'],
  ai: ['Artificial_intelligence', 'ChatGPT'],
  worldmodels: ['Digital_twin', 'Gaussian_splatting'],
}

export interface LiveSignals {
  wiki: Partial<Record<string, Series>>
  gdpGrowth?: Series // world, annual percent
  internet: Record<string, Series> // iso3 to percent of population online
}

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

export function buildWeather(live: LiveSignals, nowYear = new Date().getFullYear()): WeatherTable {
  const table: WeatherTable = {}
  for (const y of YEARS) {
    const era = eraAt(y)
    // Overlapping eras: average every era that contains this year
    const containing = ERAS.filter((e) => y >= e.start && y <= e.end)
    const row = {} as Record<IndustryId, WeatherCell>
    for (const ind of INDUSTRIES) {
      const baseline = containing.length
        ? containing.reduce((s, e) => s + e.weather[ind.id], 0) / containing.length
        : era.weather[ind.id]
      const receipts: Receipt[] = [
        { label: `Baseline ${baseline.toFixed(2)} from ${containing.map((e) => e.label).join(' + ') || era.label}`, source: 'Authored era timeline (PRD Part 2)', url: '#eras' },
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
          receipts.push({ label: `Attention growth ${(g * 100).toFixed(0)}% year over year (${topics.join(', ').replaceAll('_', ' ')})`, source: 'Wikimedia pageviews API', url: wikiUrl(topics[0]) })
        }
      }

      const gdp = live.gdpGrowth?.[y]
      if (gdp !== undefined && !projected) {
        // World growth near 3% is neutral; a contraction pulls everything down
        macro = clamp((gdp - 3) / 6, -0.6, 0.4)
        const sensitivity = ind.id === 'local' || ind.id === 'film' ? 0.6 : 0.25
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

// How connected a place is to the scene in a given year (1 to 5). Base value,
// plus the weather of the industries it hosts, plus how online its country is.
export function connectionAt(placeId: string, year: number, w: WeatherTable, live: LiveSignals): { value: number; receipts: Receipt[] } {
  const p = PLACES.find((x) => x.id === placeId)!
  const row = w[Math.min(Math.max(year, YEARS[0]), YEARS[YEARS.length - 1])]
  let pull = 0
  for (const [ind, strength] of Object.entries(p.industries) as [IndustryId, number][]) pull += strength * row[ind].value
  const receipts: Receipt[] = [{ label: `Base connection ${p.connection}, industry pull ${pull.toFixed(2)}`, source: 'Place table + industry weather', url: '#places' }]
  const net = live.internet[p.iso3]
  let online = 0
  if (net) {
    const known = Object.keys(net).map(Number).filter((k) => k <= year)
    const yr = known.length ? Math.max(...known) : undefined
    if (yr !== undefined) {
      online = (net[yr] - 80) / 40
      receipts.push({ label: `${p.country}: ${net[yr].toFixed(0)}% online (${yr})`, source: 'World Bank IT.NET.USER.ZS', url: wbUrl(p.iso3, 'IT.NET.USER.ZS') })
    }
  }
  return { value: Math.max(1, Math.min(5, p.connection + pull * 0.9 + online)), receipts }
}
