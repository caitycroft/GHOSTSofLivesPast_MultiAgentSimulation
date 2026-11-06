import type { IndustryId } from './eras'

// PLACE table (PRD 3.1). Lived places carry the career paths that were open
// there (the menu each ghost chooses from), a one line portrait of the local
// economy, and which industries are present (0 to 1 strength).
// Waypoints are trips and events on the real path; hubs are cities a ghost
// might move to later. Connection to the scene is computed per year in
// sim/weather.ts from the industry weather and how online the country is.

export type PlaceKind = 'lived' | 'waypoint' | 'hub'

export interface CareerPath {
  id: string
  label: string
  role: string
  industry: IndustryId
  requires: { craft: number; network: number; capital: number }
  risk: number // rewards risk appetite (positive) or caution (negative)
  same?: string // id of a lived path this one repeats; ghosts skip it at their fork
}

export interface Place {
  id: string
  city: string
  country: string
  iso3: string
  lat: number
  lon: number
  kind: PlaceKind
  industries: Partial<Record<IndustryId, number>>
  costBand: 1 | 2 | 3 | 4 | 5
  connection: number
  blurb?: string
  lived?: string
  paths: CareerPath[]
}

const p = (id: string, label: string, role: string, industry: IndustryId, craft: number, network: number, capital: number, risk: number, same?: string): CareerPath =>
  ({ id, label, role, industry, requires: { craft, network, capital }, risk, same })

export const PLACES: Place[] = [
  // ---------------------------------------------------------------- lived
  {
    id: 'la', city: 'Los Angeles', country: 'United States', iso3: 'USA', lat: 34.05, lon: -118.24, kind: 'lived', costBand: 4, connection: 4.6,
    industries: { film: 1, music: 0.9, platforms: 0.5, xr: 0.6, venture: 0.5, ai: 0.4, worldmodels: 0.5, web3: 0.3, local: 0.5 },
    blurb: 'Hollywood studios, record labels, the creator economy and a deep electronic music scene.',
    lived: '2010 to 2021, and again since 2025',
    paths: [
      p('la_studio', 'Studio development, from the Warner Bros. and MGM internships', 'Development executive', 'film', 3, 3, 1, -0.2),
      p('la_dj', 'Touring DJ and producer', 'DJ and producer', 'music', 3, 2, 1, 0.7, 'touring'),
      p('la_creator', 'Creator economy and social video', 'Creative director', 'platforms', 2, 3, 1, 0.3),
      p('la_xr', 'XR and games studio', 'World builder', 'xr', 3, 2, 1, 0.5),
    ],
  },
  {
    id: 'sto', city: 'Stockholm', country: 'Sweden', iso3: 'SWE', lat: 59.33, lon: 18.07, kind: 'lived', costBand: 4, connection: 3.9,
    industries: { music: 0.9, platforms: 0.8, xr: 0.6, venture: 0.4, ai: 0.3, film: 0.3, web3: 0.3, local: 0.5 },
    blurb: 'Spotify, Klarna, King and Mojang, plus one of the world’s most productive pop songwriting scenes.',
    lived: '2015 to 2019, between Los Angeles and Stockholm',
    paths: [
      p('sto_pop', 'Pop producer in the Swedish songwriting scene', 'Producer and songwriter', 'music', 3, 2, 1, 0.5),
      p('sto_stream', 'Product design at a streaming scale up', 'Product designer', 'platforms', 2, 2, 1, 0.0),
      p('sto_games', 'Game art in the Stockholm games cluster', 'Game artist', 'xr', 3, 1, 1, 0.3),
    ],
  },
  {
    id: 'utah', city: 'Utah', country: 'United States', iso3: 'USA', lat: 40.76, lon: -111.89, kind: 'lived', costBand: 3, connection: 2.8,
    industries: { platforms: 0.6, venture: 0.4, film: 0.4, local: 0.8, music: 0.2, ai: 0.3 },
    blurb: 'The Silicon Slopes tech corridor, the Sundance Film Festival, and a big outdoor industry.',
    lived: '2020 to 2022, between Los Angeles, Hawaii and Utah',
    paths: [
      p('utah_outdoor', 'Creative director for an outdoor brand', 'Creative director', 'local', 2, 2, 1, -0.2),
      p('utah_slopes', 'Silicon Slopes startup', 'Startup operator', 'platforms', 2, 2, 1, 0.3),
      p('utah_sundance', 'Film festival programming', 'Programmer', 'film', 3, 3, 1, 0.1),
      p('utah_vc', 'Venture capital', 'Investor', 'venture', 2, 3, 2, 0.2, 'vc'),
    ],
  },
  {
    id: 'hnl', city: 'Hawaii', country: 'United States', iso3: 'USA', lat: 21.31, lon: -157.86, kind: 'lived', costBand: 5, connection: 2.4,
    industries: { local: 1, film: 0.4, venture: 0.2, music: 0.3, platforms: 0.1 },
    blurb: 'An economy led by tourism and the military, with film and TV production and remote work on the rise.',
    lived: '2020 to 2022, between Los Angeles, Hawaii and Utah',
    paths: [
      p('hnl_hosp', 'Hospitality and ocean tourism', 'Founder, boutique hospitality', 'local', 2, 2, 2, 0.2),
      p('hnl_film', 'Film and TV production in the islands', 'Producer', 'film', 3, 2, 1, 0.2),
      p('hnl_climate', 'Ocean and climate ventures', 'Climate investor', 'venture', 2, 3, 2, 0.3),
      p('hnl_music', 'Island music and festivals', 'Festival producer', 'music', 3, 2, 1, 0.4),
    ],
  },
  {
    id: 'nyc', city: 'New York', country: 'United States', iso3: 'USA', lat: 40.71, lon: -74.0, kind: 'lived', costBand: 5, connection: 5,
    industries: { platforms: 0.7, venture: 0.8, music: 0.7, film: 0.6, ai: 0.6, web3: 0.6, xr: 0.5, worldmodels: 0.4, local: 0.5 },
    blurb: 'Media, finance, fashion and advertising, and the creative technology scene around NYU ITP.',
    lived: '2022 to 2024 at NYU, and again since 2025',
    paths: [
      p('nyc_lab', 'Creative technologist at a media lab', 'Creative technologist', 'xr', 3, 3, 1, 0.2, 'itp'),
      p('nyc_ai', 'AI startup founder', 'Founder', 'ai', 3, 3, 2, 0.8),
      p('nyc_seed', 'Seed stage venture', 'Partner', 'venture', 2, 4, 2, 0.2),
      p('nyc_brand', 'Brand experience studio', 'Experience director', 'platforms', 3, 3, 1, 0.1),
      p('nyc_label', 'Independent label in Brooklyn', 'Label founder', 'music', 3, 3, 1, 0.6),
    ],
  },
  {
    id: 'lon', city: 'London', country: 'United Kingdom', iso3: 'GBR', lat: 51.51, lon: -0.13, kind: 'lived', costBand: 5, connection: 5,
    industries: { venture: 0.8, platforms: 0.6, music: 0.8, film: 0.6, ai: 0.8, web3: 0.5, xr: 0.5, worldmodels: 0.5, local: 0.5 },
    blurb: 'Global finance and fintech, music and broadcasting, and Google DeepMind’s home base.',
    lived: '2023, a stint during NYU',
    paths: [
      p('lon_immersive', 'Creative director at an immersive studio', 'Creative director', 'xr', 3, 3, 1, 0.4),
      p('lon_lab', 'AI research lab partnerships', 'Partnerships lead', 'ai', 3, 4, 1, 0.0),
      p('lon_ar', 'Music label A&R', 'A&R', 'music', 3, 3, 1, 0.3),
      p('lon_fintech', 'Fintech product', 'Product lead', 'platforms', 2, 3, 1, 0.0),
    ],
  },
  {
    id: 'ber', city: 'Berlin', country: 'Germany', iso3: 'DEU', lat: 52.52, lon: 13.4, kind: 'lived', costBand: 3, connection: 3.8,
    industries: { music: 0.9, platforms: 0.6, xr: 0.5, web3: 0.6, venture: 0.4, ai: 0.4, local: 0.6 },
    blurb: 'Techno and club culture, a startup scene, and studios working in XR and media art.',
    lived: '2023, a stint during NYU',
    paths: [
      p('ber_techno', 'Techno DJ and label owner', 'DJ and label owner', 'music', 3, 2, 1, 0.7),
      p('ber_media', 'XR and media art studio', 'Media artist', 'xr', 3, 2, 1, 0.5),
      p('ber_startup', 'Startup operator', 'Operator', 'platforms', 2, 2, 1, 0.2),
    ],
  },
  {
    id: 'osl', city: 'Oslo', country: 'Norway', iso3: 'NOR', lat: 59.91, lon: 10.75, kind: 'lived', costBand: 5, connection: 3.4,
    industries: { local: 0.8, venture: 0.5, music: 0.4, platforms: 0.4, xr: 0.3, ai: 0.3, film: 0.2, worldmodels: 0.3 },
    blurb: 'Energy, maritime and design, and the home of the world’s largest sovereign wealth fund.',
    lived: '2023 and 2024, before and after Shanghai',
    paths: [
      p('osl_climate', 'Climate tech startup', 'Founder', 'local', 2, 2, 2, 0.4),
      p('osl_design', 'Design and architecture studio', 'Design director', 'local', 3, 2, 1, 0.0),
      p('osl_fund', 'Sovereign wealth and impact investing', 'Analyst', 'venture', 2, 3, 1, -0.4),
      p('osl_festival', 'Festival and live music production', 'Festival producer', 'music', 2, 3, 1, 0.3),
    ],
  },
  {
    id: 'sha', city: 'Shanghai', country: 'China', iso3: 'CHN', lat: 31.23, lon: 121.47, kind: 'lived', costBand: 4, connection: 4.2,
    industries: { platforms: 0.7, ai: 0.7, xr: 0.7, film: 0.5, venture: 0.5, local: 0.7, music: 0.3, worldmodels: 0.4 },
    blurb: 'Finance, manufacturing and electronics supply chains, major game and AI studios, and NYU Shanghai.',
    lived: '2024, graduation at NYU Shanghai',
    paths: [
      p('sha_games', 'World builder at a major game studio', 'World builder', 'xr', 3, 2, 1, 0.3),
      p('sha_ai', 'AI product in the Shanghai AI cluster', 'Product lead', 'ai', 3, 2, 1, 0.3),
      p('sha_brand', 'Film and brand work for global launches', 'Director', 'film', 3, 3, 1, 0.3),
      p('sha_vc', 'Cross border venture', 'Investor', 'venture', 2, 3, 2, 0.2),
    ],
  },
  {
    id: 'sf', city: 'San Francisco', country: 'United States', iso3: 'USA', lat: 37.77, lon: -122.42, kind: 'lived', costBand: 5, connection: 4.6,
    industries: { ai: 1, platforms: 0.9, venture: 1, worldmodels: 1, xr: 0.5, web3: 0.5, music: 0.3, film: 0.2 },
    blurb: 'Frontier AI labs, venture capital, and the companies building world models.',
    lived: 'Since 2025, between LA, New York and San Francisco',
    paths: [
      p('sf_lab', 'Frontier lab partnerships', 'Partnerships lead', 'ai', 3, 4, 1, -0.1),
      p('sf_wm', 'World models and spatial computing', 'Creative technologist', 'worldmodels', 3, 3, 1, 0.5, 'spatial'),
      p('sf_founder', 'Founder', 'Founder', 'ai', 3, 3, 2, 0.9),
    ],
  },

  // ---------------------------------------------------------------- waypoints
  { id: 'brc', city: 'Burning Man', country: 'United States', iso3: 'USA', lat: 40.79, lon: -119.2, kind: 'waypoint', costBand: 2, connection: 2, industries: { music: 0.6 }, blurb: 'Black Rock City, Nevada. Played in 2015.', paths: [] },
  { id: 'lib', city: 'Lightning in a Bottle', country: 'United States', iso3: 'USA', lat: 35.8, lon: -120.9, kind: 'waypoint', costBand: 2, connection: 2, industries: { music: 0.6 }, blurb: 'Central California. Played in 2015.', paths: [] },
  { id: 'hoga', city: 'High Coast (Höga Kusten)', country: 'Sweden', iso3: 'SWE', lat: 62.95, lon: 18.25, kind: 'waypoint', costBand: 2, connection: 1, industries: { local: 0.6 }, blurb: 'A trip from Stockholm during the touring years.', paths: [] },
  { id: 'mal', city: 'Mallorca', country: 'Spain', iso3: 'ESP', lat: 39.57, lon: 2.65, kind: 'waypoint', costBand: 3, connection: 2, industries: { local: 0.8, music: 0.4 }, blurb: 'A trip during the touring years.', paths: [] },
  { id: 'svb', city: 'Svalbard', country: 'Norway', iso3: 'NOR', lat: 78.22, lon: 15.65, kind: 'waypoint', costBand: 4, connection: 1, industries: { local: 0.5 }, blurb: 'Ski marathon in the Arctic, April 2024.', paths: [] },

  // ---------------------------------------------------------------- hubs a ghost might move to
  { id: 'lv', city: 'Las Vegas', country: 'United States', iso3: 'USA', lat: 36.17, lon: -115.14, kind: 'hub', costBand: 3, connection: 2.8, industries: { music: 0.9, local: 0.8, xr: 0.3 }, paths: [] },
  { id: 'tyo', city: 'Tokyo', country: 'Japan', iso3: 'JPN', lat: 35.68, lon: 139.69, kind: 'hub', costBand: 4, connection: 4.5, industries: { xr: 0.8, film: 0.6, music: 0.6, platforms: 0.4, worldmodels: 0.4 }, paths: [] },
  { id: 'sel', city: 'Seoul', country: 'South Korea', iso3: 'KOR', lat: 37.57, lon: 126.98, kind: 'hub', costBand: 3, connection: 4, industries: { film: 0.8, music: 0.9, xr: 0.6, platforms: 0.5 }, paths: [] },
  { id: 'par', city: 'Paris', country: 'France', iso3: 'FRA', lat: 48.86, lon: 2.35, kind: 'hub', costBand: 4, connection: 4.2, industries: { film: 0.6, ai: 0.6, music: 0.5, local: 0.5 }, paths: [] },
  { id: 'lis', city: 'Lisbon', country: 'Portugal', iso3: 'PRT', lat: 38.72, lon: -9.14, kind: 'hub', costBand: 2, connection: 2.6, industries: { web3: 0.8, platforms: 0.3, local: 0.7 }, paths: [] },
  { id: 'sin', city: 'Singapore', country: 'Singapore', iso3: 'SGP', lat: 1.35, lon: 103.82, kind: 'hub', costBand: 5, connection: 4, industries: { web3: 0.8, venture: 0.7, platforms: 0.5, ai: 0.4 }, paths: [] },
  { id: 'tor', city: 'Toronto', country: 'Canada', iso3: 'CAN', lat: 43.65, lon: -79.38, kind: 'hub', costBand: 4, connection: 3.6, industries: { ai: 0.7, film: 0.6, platforms: 0.4, music: 0.4 }, paths: [] },
]

export const PLACE_BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((x) => [x.id, x]))
export const LIVED_PLACES = PLACES.filter((x) => x.kind === 'lived')

// Hubs and waypoints have no authored menu: offer their two strongest industries
export function pathsAt(placeId: string): CareerPath[] {
  const place = PLACE_BY_ID[placeId]
  if (place.paths.length) return place.paths
  return (Object.entries(place.industries) as [IndustryId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([ind]) => p(`${placeId}_${ind}`, `${ind} in ${place.city}`, '', ind, 2, 2, 1, 0.3))
}

export function haversineKm(a: Place, b: Place): number {
  const R = 6371
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLon = (b.lon - a.lon) * toRad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const PATH_BY_ID: Record<string, { path: CareerPath; place: string }> = {}
for (const pl of PLACES) for (const path of pathsAt(pl.id)) PATH_BY_ID[path.id] = { path, place: pl.id }

// Human label for any path id, including generated hub paths and lived ones
export function pathLabel(id: string): string {
  const hit = PATH_BY_ID[id]
  if (!hit) return { usc: 'USC, cinema and narrative', touring: 'Touring DJ and producer', vc: 'Venture capital', itp: 'NYU ITP and IMA', spatial: 'Spatial worlds and music' }[id] ?? id
  return hit.path.role ? hit.path.label : `${hit.path.industry} in ${PLACE_BY_ID[hit.place].city}`
}
