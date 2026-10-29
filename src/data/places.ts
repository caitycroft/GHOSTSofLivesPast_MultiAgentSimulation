import type { IndustryId } from './eras'

// PLACE table (PRD 3.1). City, country, the industries present (0 to 1 strength),
// cost of living band (1 to 5), and base connection to the global scene (1 to 5).
// Connection in a given year is computed in sim/weather.ts from the era weather
// of the industries each city hosts, so San Francisco grows through the AI years.
export interface Place {
  id: string
  city: string
  country: string
  iso3: string
  lat: number
  lon: number
  industries: Partial<Record<IndustryId, number>>
  costBand: 1 | 2 | 3 | 4 | 5
  connection: number
}

export const PLACES: Place[] = [
  { id: 'la', city: 'Los Angeles', country: 'United States', iso3: 'USA', lat: 34.05, lon: -118.24, costBand: 4, connection: 4.5, industries: { film: 1, xr: 0.6, platforms: 0.4, local: 0.5, ai: 0.3, worldmodels: 0.4 } },
  { id: 'nyc', city: 'New York', country: 'United States', iso3: 'USA', lat: 40.71, lon: -74.0, costBand: 5, connection: 5, industries: { film: 0.7, platforms: 0.7, web3: 0.8, local: 0.5, ai: 0.5 } },
  { id: 'sf', city: 'San Francisco', country: 'United States', iso3: 'USA', lat: 37.77, lon: -122.42, costBand: 5, connection: 4.5, industries: { platforms: 1, ai: 1, xr: 0.5, web3: 0.5, worldmodels: 1 } },
  { id: 'sea', city: 'Seattle', country: 'United States', iso3: 'USA', lat: 47.61, lon: -122.33, costBand: 4, connection: 3.5, industries: { platforms: 0.8, xr: 0.8, ai: 0.7, local: 0.4 } },
  { id: 'bos', city: 'Boston', country: 'United States', iso3: 'USA', lat: 42.36, lon: -71.06, costBand: 4, connection: 3.5, industries: { ai: 0.6, platforms: 0.4, local: 0.4, worldmodels: 0.5 } },
  { id: 'lv', city: 'Las Vegas', country: 'United States', iso3: 'USA', lat: 36.17, lon: -115.14, costBand: 3, connection: 2.5, industries: { film: 0.4, xr: 0.5, local: 0.8 } },
  { id: 'tor', city: 'Toronto', country: 'Canada', iso3: 'CAN', lat: 43.65, lon: -79.38, costBand: 4, connection: 3.5, industries: { film: 0.6, ai: 0.7, platforms: 0.4, local: 0.5 } },
  { id: 'lon', city: 'London', country: 'United Kingdom', iso3: 'GBR', lat: 51.51, lon: -0.13, costBand: 5, connection: 5, industries: { film: 0.7, platforms: 0.6, web3: 0.5, ai: 0.7, local: 0.5, worldmodels: 0.5 } },
  { id: 'ber', city: 'Berlin', country: 'Germany', iso3: 'DEU', lat: 52.52, lon: 13.4, costBand: 3, connection: 3.5, industries: { platforms: 0.6, xr: 0.5, web3: 0.6, local: 0.6 } },
  { id: 'par', city: 'Paris', country: 'France', iso3: 'FRA', lat: 48.86, lon: 2.35, costBand: 4, connection: 4, industries: { film: 0.6, ai: 0.6, local: 0.6 } },
  { id: 'lis', city: 'Lisbon', country: 'Portugal', iso3: 'PRT', lat: 38.72, lon: -9.14, costBand: 2, connection: 2.5, industries: { web3: 0.8, platforms: 0.3, local: 0.7 } },
  { id: 'tyo', city: 'Tokyo', country: 'Japan', iso3: 'JPN', lat: 35.68, lon: 139.69, costBand: 4, connection: 4.5, industries: { film: 0.6, xr: 0.8, platforms: 0.4, local: 0.6, worldmodels: 0.4 } },
  { id: 'sel', city: 'Seoul', country: 'South Korea', iso3: 'KOR', lat: 37.57, lon: 126.98, costBand: 3, connection: 4, industries: { film: 0.8, xr: 0.6, platforms: 0.5, local: 0.5 } },
  { id: 'sin', city: 'Singapore', country: 'Singapore', iso3: 'SGP', lat: 1.35, lon: 103.82, costBand: 5, connection: 4, industries: { web3: 0.8, platforms: 0.5, ai: 0.4, local: 0.4 } },
  { id: 'syd', city: 'Sydney', country: 'Australia', iso3: 'AUS', lat: -33.87, lon: 151.21, costBand: 4, connection: 3, industries: { film: 0.5, platforms: 0.3, local: 0.7 } },
  { id: 'mex', city: 'Mexico City', country: 'Mexico', iso3: 'MEX', lat: 19.43, lon: -99.13, costBand: 2, connection: 3, industries: { film: 0.6, local: 0.8, platforms: 0.2 } },
]

export const PLACE_BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]))

export function haversineKm(a: Place, b: Place): number {
  const R = 6371
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLon = (b.lon - a.lon) * toRad
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
