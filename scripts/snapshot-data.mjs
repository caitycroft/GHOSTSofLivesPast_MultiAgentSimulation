// Pulls every real data source the simulation uses and writes a dated
// snapshot to public/data/snapshot.json. The app loads it first, so the piece
// runs on real numbers offline, then refreshes the live feeds in the browser.
//
//   npm run snapshot
//
// Behind a proxy on Node 22: NODE_USE_ENV_PROXY=1 npm run snapshot

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const UA = { 'User-Agent': 'GhostsOfLivesPast/0.2 (data snapshot for an art and research piece)' }
const ISO = ['WLD', 'USA', 'SWE', 'GBR', 'DEU', 'NOR', 'CHN', 'ESP', 'JPN', 'KOR', 'FRA', 'PRT', 'SGP', 'CAN']
const INDICATORS = { gdp: 'NY.GDP.MKTP.KD.ZG', inflation: 'FP.CPI.TOTL.ZG', internet: 'IT.NET.USER.ZS' }
const TOPICS = [
  'Film_industry', 'Box_office', 'Electronic_dance_music', 'Music_festival', 'Social_media', 'TikTok',
  'Venture_capital', 'Startup_company', 'Virtual_reality', 'Augmented_reality', 'Non-fungible_token', 'Metaverse',
  'Artificial_intelligence', 'ChatGPT', 'Digital_twin', 'Gaussian_splatting',
]
const CITIES = [
  ['la', 34.05, -118.24], ['sto', 59.33, 18.07], ['utah', 40.76, -111.89], ['hnl', 21.31, -157.86], ['nyc', 40.71, -74.0],
  ['lon', 51.51, -0.13], ['ber', 52.52, 13.4], ['osl', 59.91, 10.75], ['sha', 31.23, 121.47], ['sf', 37.77, -122.42],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function getJSON(url, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: UA })
      if (res.status === 429 && i < tries) { await sleep(1500 * (i + 1)); continue }
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return await res.json()
    } catch (e) {
      if (i >= tries) throw e
      await sleep(1000 * (i + 1))
    }
  }
}

const out = { asOf: new Date().toISOString(), sources: [], worldBank: {}, wiki: {}, quakes: [], iss: null, weather: [] }
// Anything a source refuses this time falls back to the previous snapshot
const previous = existsSync(new URL('../public/data/snapshot.json', import.meta.url))
  ? JSON.parse(readFileSync(new URL('../public/data/snapshot.json', import.meta.url), 'utf8'))
  : null
const note = (id, label, url, status, extra = '') => { out.sources.push({ id, label, url, status, extra }); console.log(`${status.padEnd(7)} ${label} ${extra}`) }

// World Bank: growth, inflation and internet use per country, 2008 on
for (const [key, code] of Object.entries(INDICATORS)) {
  const url = `https://api.worldbank.org/v2/country/${ISO.join(';')}/indicator/${code}?format=json&date=2008:2026&per_page=2000`
  try {
    const j = await getJSON(url)
    const series = {}
    for (const r of j[1] ?? []) {
      if (r.value == null) continue
      ;(series[r.countryiso3code || 'WLD'] ??= {})[Number(r.date)] = r.value
    }
    out.worldBank[key] = series
    const latest = Math.max(...Object.values(series).flatMap((s) => Object.keys(s).map(Number)))
    note(`wb-${key}`, `World Bank ${code}`, url, 'ok', `${Object.keys(series).length} countries, latest ${latest}`)
  } catch (e) {
    note(`wb-${key}`, `World Bank ${code}`, url, 'failed', e.message)
  }
}

// Wikimedia: monthly pageviews per topic, averaged per year
const end = new Date()
const endStamp = `${end.getUTCFullYear()}${String(end.getUTCMonth() + 1).padStart(2, '0')}0100`
let wikiOk = 0
for (const t of TOPICS) {
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(t)}/monthly/2015070100/${endStamp}`
  try {
    const j = await getJSON(url)
    const sums = {}
    for (const it of j.items) {
      const y = Number(it.timestamp.slice(0, 4))
      ;(sums[y] ??= { v: 0, n: 0 }).v += it.views
      sums[y].n += 1
    }
    out.wiki[t] = Object.fromEntries(Object.entries(sums).map(([y, s]) => [y, Math.round(s.v / s.n)]))
    wikiOk++
  } catch (e) {
    if (previous?.wiki?.[t]) { out.wiki[t] = previous.wiki[t]; wikiOk++; console.log(`  wiki ${t}: kept previous snapshot`) }
    else console.log(`  wiki ${t} failed: ${e.message}`)
  }
  await sleep(600)
}
note('wiki', 'Wikimedia pageviews, monthly average per year', 'https://wikimedia.org/api/rest_v1/', wikiOk ? 'ok' : 'failed', `${wikiOk} of ${TOPICS.length} topics`)

// USGS: earthquakes in the past day, magnitude 2.5 and up
try {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'
  const j = await getJSON(url)
  out.quakes = j.features.map((f) => ({ id: f.id, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], mag: f.properties.mag ?? 0, place: f.properties.place ?? '', time: f.properties.time }))
  note('quakes', 'USGS earthquakes, past day, M2.5+', url, 'ok', `${out.quakes.length} events`)
} catch (e) { note('quakes', 'USGS earthquakes', '', 'failed', e.message) }

// ISS: where the station is right now
try {
  const url = 'https://api.wheretheiss.at/v1/satellites/25544'
  const j = await getJSON(url)
  out.iss = { lat: j.latitude, lon: j.longitude, altKm: j.altitude, velocityKmh: j.velocity, at: j.timestamp * 1000 }
  note('iss', 'ISS position', url, 'ok')
} catch (e) { note('iss', 'ISS position', '', 'failed', e.message) }

// Open-Meteo: current conditions in every lived city
try {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${CITIES.map((c) => c[1]).join(',')}&longitude=${CITIES.map((c) => c[2]).join(',')}&current=temperature_2m,weather_code,is_day,cloud_cover,wind_speed_10m`
  const j = await getJSON(url, 6)
  const arr = Array.isArray(j) ? j : [j]
  out.weather = arr.map((c, i) => ({ id: CITIES[i][0], tempC: c.current.temperature_2m, code: c.current.weather_code, isDay: c.current.is_day === 1, cloud: c.current.cloud_cover, windKmh: c.current.wind_speed_10m }))
  note('meteo', 'Open-Meteo current conditions', url, 'ok', `${out.weather.length} cities`)
} catch (e) {
  if (previous?.weather?.length) { out.weather = previous.weather; note('meteo', 'Open-Meteo current conditions', '', 'kept', `previous snapshot (${e.message.slice(0, 3)})`) }
  else note('meteo', 'Open-Meteo current conditions', '', 'failed', e.message)
}

mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
writeFileSync(new URL('../public/data/snapshot.json', import.meta.url), JSON.stringify(out))
console.log(`wrote public/data/snapshot.json (${out.asOf})`)
