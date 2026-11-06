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
  asOf?: string
}

interface Snapshot {
  asOf: string
  worldBank: { gdp?: Record<string, Series>; inflation?: Record<string, Series>; internet?: Record<string, Series> }
  wiki: Record<string, Series>
  quakes: Quake[]
  iss: ISS | null
  weather: CityWeather[]
}

const DAY = 86400000
const ISO3 = Array.from(new Set(PLACES.map((p) => p.iso3)))
// Video capture runs on the snapshot alone, so every frame is reproducible
const CAPTURE = new URLSearchParams(window.location.search).has('capture')

export function useLive(): Live {
  const [sun, setSun] = useState(subsolarPoint())
  const [quakes, setQuakes] = useState<Quake[]>([])
  const [iss, setIss] = useState<ISS>()
  const [cities, setCities] = useState<CityWeather[]>([])
  const [wiki, setWiki] = useState<Partial<Record<string, Series>>>({})
  const [gdp, setGdp] = useState<Record<string, Series>>({})
  const [inflation, setInflation] = useState<Record<string, Series>>({})
  const [internet, setInternet] = useState<Record<string, Series>>({})
  const [asOf, setAsOf] = useState<string>()
  const [snapshotDone, setSnapshotDone] = useState(false)
  const [sources, setSources] = useState<Record<string, SourceInfo>>({
    sun: { id: 'sun', label: 'Subsolar point (computed, NOAA solar position)', status: 'live', url: 'https://gml.noaa.gov/grad/solcalc/solareqns.PDF', at: Date.now() },
    quakes: { id: 'quakes', label: 'USGS earthquakes, past day, M2.5+', status: 'loading', url: QUAKE_URL },
    iss: { id: 'iss', label: 'ISS position (wheretheiss.at)', status: 'loading', url: ISS_URL },
    meteo: { id: 'meteo', label: 'Open-Meteo current conditions, every lived city', status: 'loading', url: meteoUrl(PLACES.filter((p) => p.kind === 'lived')) },
    wiki: { id: 'wiki', label: 'Wikimedia pageviews, attention per industry', status: 'loading', url: wikiUrl('Artificial_intelligence') },
    gdp: { id: 'gdp', label: 'World Bank GDP growth, world and by country', status: 'loading', url: wbUrl(['WLD', ...ISO3].join(';'), 'NY.GDP.MKTP.KD.ZG') },
    inflation: { id: 'inflation', label: 'World Bank inflation by country', status: 'loading', url: wbUrl(ISO3.join(';'), 'FP.CPI.TOTL.ZG') },
    internet: { id: 'internet', label: 'World Bank internet users by country', status: 'loading', url: wbUrl(ISO3.join(';'), 'IT.NET.USER.ZS') },
  })
  const mark = (id: string, patch: Partial<SourceInfo>) => setSources((s) => ({ ...s, [id]: { ...s[id], ...patch } }))

  useEffect(() => {
    const t = setInterval(() => setSun(subsolarPoint()), 30000)
    return () => clearInterval(t)
  }, [])

  // 1. The dated snapshot: real numbers, available offline and on first paint
  useEffect(() => {
    let alive = true
    fetch(`${import.meta.env.BASE_URL}data/snapshot.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Snapshot>) : Promise.reject(new Error(String(r.status)))))
      .then((s) => {
        if (!alive) return
        const at = Date.parse(s.asOf)
        const day = s.asOf.slice(0, 10)
        setAsOf(s.asOf)
        if (s.worldBank.gdp) { setGdp(s.worldBank.gdp); mark('gdp', { status: 'snapshot', at, note: `snapshot ${day}` }) }
        if (s.worldBank.inflation) { setInflation(s.worldBank.inflation); mark('inflation', { status: 'snapshot', at, note: `snapshot ${day}` }) }
        if (s.worldBank.internet) { setInternet(s.worldBank.internet); mark('internet', { status: 'snapshot', at, note: `snapshot ${day}` }) }
        if (Object.keys(s.wiki).length) { setWiki(s.wiki); mark('wiki', { status: 'snapshot', at, note: `${Object.keys(s.wiki).length} topics, snapshot ${day}` }) }
        if (s.quakes.length) { setQuakes(s.quakes); mark('quakes', { status: 'snapshot', at, note: `${s.quakes.length} events, snapshot ${day}` }) }
        if (s.iss) { setIss(s.iss); mark('iss', { status: 'snapshot', at, note: `snapshot ${day}` }) }
        if (s.weather.length) { setCities(s.weather); mark('meteo', { status: 'snapshot', at, note: `snapshot ${day}` }) }
      })
      .catch(() => { /* no snapshot: live sources below fill in */ })
      .finally(() => alive && setSnapshotDone(true))
    return () => { alive = false }
  }, [])

  // 2. Real time feeds, refreshed while the page is open
  useEffect(() => {
    if (CAPTURE) return
    let alive = true
    const load = () =>
      fetchQuakes()
        .then((q) => alive && (setQuakes(q), mark('quakes', { status: 'live', at: Date.now(), note: `${q.length} events` })))
        .catch(() => { /* keep the snapshot values */ })
    load()
    const t = setInterval(load, 5 * 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  useEffect(() => {
    if (CAPTURE) return
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
    if (CAPTURE) return
    let alive = true
    const lived = PLACES.filter((p) => p.kind === 'lived')
    const load = () =>
      fetchCityWeather(lived)
        .then((c) => alive && (setCities(c), mark('meteo', { status: 'live', at: Date.now() })))
        .catch(() => { /* keep the snapshot values */ })
    load()
    const t = setInterval(load, 15 * 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  // 3. Slow sources: only fetched live when the snapshot is missing them
  useEffect(() => {
    if (!snapshotDone || CAPTURE) return
    let alive = true
    if (!Object.keys(wiki).length) {
      const topics = Object.values(WIKI_TOPICS).flat()
      Promise.allSettled(topics.map((tp) => cached(`wiki:${tp}`, DAY, () => fetchWikiYearly(tp)).then((r) => ({ tp, r }))))
        .then((res) => {
          if (!alive) return
          const out: Partial<Record<string, Series>> = {}
          let ok = 0
          for (const r of res) if (r.status === 'fulfilled') { out[r.value.tp] = r.value.r.data; ok++ }
          setWiki(out)
          mark('wiki', { status: ok ? 'live' : 'offline', at: Date.now(), note: `${ok} of ${topics.length} topics` })
        })
    }
    const wb = (key: string, code: string, set: (d: Record<string, Series>) => void, countries: string[]) =>
      cached(`wb:${key}`, DAY, () => fetchWorldBank(countries, code))
        .then((r) => alive && (set(r.data), mark(key, { status: r.status, at: r.at })))
        .catch(() => alive && mark(key, { status: 'offline' }))
    if (!Object.keys(gdp).length) wb('gdp', 'NY.GDP.MKTP.KD.ZG', setGdp, ['WLD', ...ISO3])
    if (!Object.keys(inflation).length) wb('inflation', 'FP.CPI.TOTL.ZG', setInflation, ISO3)
    if (!Object.keys(internet).length) wb('internet', 'IT.NET.USER.ZS', setInternet, ISO3)
    return () => { alive = false }
  }, [snapshotDone])

  const signals = useMemo<LiveSignals>(
    () => ({ wiki, gdpGrowth: gdp.WLD, gdp, inflation, internet, asOf }),
    [wiki, gdp, inflation, internet, asOf],
  )
  return { sun, quakes, iss, cities, signals, sources: Object.values(sources), asOf }
}
