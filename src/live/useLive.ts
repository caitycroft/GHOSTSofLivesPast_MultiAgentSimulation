import { useEffect, useMemo, useState } from 'react'
import { PLACES } from '../data/places'
import { WIKI_TOPICS, type LiveSignals } from '../sim/weather'
import {
  cached, fetchCityWeather, fetchISS, fetchQuakes, fetchWikiYearly, fetchWorldBank, subsolarPoint,
  ISS_URL, QUAKE_URL, meteoUrl, wbUrl, wikiUrl,
  type CityWeather, type ISS, type Quake, type Series, type SourceStatus,
} from './sources'

export interface SourceInfo { id: string; label: string; status: SourceStatus; url: string; at?: number; note?: string }

export interface Live {
  sun: { lat: number; lon: number }
  quakes: Quake[]
  iss?: ISS
  cities: CityWeather[]
  signals: LiveSignals
  sources: SourceInfo[]
}

const DAY = 86400000
const ISO3 = Array.from(new Set(PLACES.map((p) => p.iso3)))

export function useLive(): Live {
  const [sun, setSun] = useState(subsolarPoint())
  const [quakes, setQuakes] = useState<Quake[]>([])
  const [iss, setIss] = useState<ISS>()
  const [cities, setCities] = useState<CityWeather[]>([])
  const [wiki, setWiki] = useState<Partial<Record<string, Series>>>({})
  const [gdp, setGdp] = useState<Series>()
  const [internet, setInternet] = useState<Record<string, Series>>({})
  const [sources, setSources] = useState<Record<string, SourceInfo>>({
    sun: { id: 'sun', label: 'Subsolar point (computed, NOAA solar position)', status: 'live', url: 'https://gml.noaa.gov/grad/solcalc/solareqns.PDF', at: Date.now() },
    quakes: { id: 'quakes', label: 'USGS earthquakes, past day, M2.5+', status: 'loading', url: QUAKE_URL },
    iss: { id: 'iss', label: 'ISS position (wheretheiss.at)', status: 'loading', url: ISS_URL },
    meteo: { id: 'meteo', label: 'Open-Meteo current conditions, every cast city', status: 'loading', url: meteoUrl(PLACES) },
    wiki: { id: 'wiki', label: 'Wikimedia pageviews, attention per industry', status: 'loading', url: wikiUrl('Artificial_intelligence') },
    gdp: { id: 'gdp', label: 'World Bank world GDP growth', status: 'loading', url: wbUrl('WLD', 'NY.GDP.MKTP.KD.ZG') },
    internet: { id: 'internet', label: 'World Bank internet users by country', status: 'loading', url: wbUrl(ISO3.join(';'), 'IT.NET.USER.ZS') },
  })
  const mark = (id: string, patch: Partial<SourceInfo>) => setSources((s) => ({ ...s, [id]: { ...s[id], ...patch } }))

  useEffect(() => {
    const t = setInterval(() => setSun(subsolarPoint()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchQuakes()
        .then((q) => alive && (setQuakes(q), mark('quakes', { status: 'live', at: Date.now(), note: `${q.length} events` })))
        .catch(() => alive && mark('quakes', { status: 'offline' }))
    load()
    const t = setInterval(load, 5 * 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  useEffect(() => {
    let alive = true
    let fails = 0
    const load = () =>
      fetchISS()
        .then((p) => { if (!alive) return; fails = 0; setIss(p); mark('iss', { status: 'live', at: Date.now() }) })
        .catch(() => { fails++; if (alive && fails > 1) mark('iss', { status: 'offline' }) })
    load()
    const t = setInterval(load, 5000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchCityWeather(PLACES)
        .then((c) => alive && (setCities(c), mark('meteo', { status: 'live', at: Date.now() })))
        .catch(() => alive && mark('meteo', { status: 'offline' }))
    load()
    const t = setInterval(load, 15 * 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  useEffect(() => {
    let alive = true
    const topics = Object.values(WIKI_TOPICS).flat()
    Promise.allSettled(topics.map((tp) => cached(`wiki:${tp}`, DAY, () => fetchWikiYearly(tp)).then((r) => ({ tp, r }))))
      .then((res) => {
        if (!alive) return
        const out: Partial<Record<string, Series>> = {}
        let ok = 0
        let fromCache = 0
        for (const r of res) if (r.status === 'fulfilled') { out[r.value.tp] = r.value.r.data; ok++; if (r.value.r.status === 'cached') fromCache++ }
        setWiki(out)
        mark('wiki', { status: ok === 0 ? 'offline' : fromCache === ok ? 'cached' : 'live', at: Date.now(), note: `${ok} of ${topics.length} topics` })
      })
    cached('wb:gdp', DAY, () => fetchWorldBank(['WLD'], 'NY.GDP.MKTP.KD.ZG'))
      .then((r) => alive && (setGdp(r.data.WLD), mark('gdp', { status: r.status, at: r.at })))
      .catch(() => alive && mark('gdp', { status: 'offline' }))
    cached('wb:internet', DAY, () => fetchWorldBank(ISO3, 'IT.NET.USER.ZS'))
      .then((r) => alive && (setInternet(r.data), mark('internet', { status: r.status, at: r.at })))
      .catch(() => alive && mark('internet', { status: 'offline' }))
    return () => { alive = false }
  }, [])

  const signals = useMemo<LiveSignals>(() => ({ wiki, gdpGrowth: gdp, internet }), [wiki, gdp, internet])
  return { sun, quakes, iss, cities, signals, sources: Object.values(sources) }
}
