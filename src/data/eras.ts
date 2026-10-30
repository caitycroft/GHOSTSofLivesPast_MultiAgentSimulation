// ERA table (PRD 3.1) and the industries the eras act on.
// Baseline weather is the authored timeline (PRD Part 2). Live data in
// sim/weather.ts modulates it year by year, and every number carries a source.

export type IndustryId = 'film' | 'platforms' | 'xr' | 'web3' | 'ai' | 'worldmodels' | 'local'

export const INDUSTRIES: { id: IndustryId; label: string; craft: boolean }[] = [
  { id: 'film', label: 'Film and entertainment', craft: true },
  { id: 'platforms', label: 'Platforms and startups', craft: false },
  { id: 'xr', label: 'XR and games', craft: true },
  { id: 'web3', label: 'Decentralized and metaverse', craft: false },
  { id: 'ai', label: 'AI', craft: true },
  { id: 'worldmodels', label: 'World models and simulation', craft: true },
  { id: 'local', label: 'Local economy', craft: false },
]

export interface Era {
  id: string
  label: string
  start: number
  end: number
  line: string
  // Light: the whole scene is tinted by these (PRD 4.1, weather as light)
  light: { key: string; fill: string; ground: string; grain: number }
  // Void mode: each era is a console generation with a four colour palette,
  // darkest to brightest. Palettes switch hard at era boundaries, like a stage.
  retro: { name: string; palette: [string, string, string, string] }
  // Baseline growth per industry, -1 (shrinking) to 1 (growing)
  weather: Record<IndustryId, number>
}

export const ERAS: Era[] = [
  {
    id: 'film', label: 'The film and entertainment years', start: 2008, end: 2015,
    line: 'Stories were sold by the reel and the box office still set the weather.',
    light: { key: '#ffcf8a', fill: '#ff9a52', ground: '#120a06', grain: 0.11 },
    retro: { name: 'Amber monitor', palette: ['#000000', '#3d1f00', '#c47a00', '#ffc23d'] },
    weather: { film: 0.6, platforms: 0.4, xr: -0.2, web3: -0.6, ai: -0.3, worldmodels: -0.8, local: 0.1 },
  },
  {
    id: 'platform', label: 'The platform years', start: 2015, end: 2020,
    line: 'The feed became the theater and the algorithm became the studio.',
    light: { key: '#9fd8ff', fill: '#4f8dff', ground: '#040914', grain: 0.07 },
    retro: { name: 'CGA', palette: ['#000000', '#7a1fa2', '#22c7d6', '#f4f4ff'] },
    weather: { film: 0.1, platforms: 0.8, xr: 0.3, web3: 0.0, ai: 0.2, worldmodels: -0.5, local: 0.1 },
  },
  {
    id: 'pandemic', label: 'The pandemic', start: 2020, end: 2022,
    line: 'Every room closed and every screen opened.',
    light: { key: '#c9ccd1', fill: '#8b9097', ground: '#0a0b0d', grain: 0.16 },
    retro: { name: 'Handheld', palette: ['#000000', '#1f3b1f', '#7fa31a', '#c8e89a'] },
    weather: { film: -0.7, platforms: 0.6, xr: 0.3, web3: 0.4, ai: 0.2, worldmodels: -0.3, local: -0.8 },
  },
  {
    id: 'decentral', label: 'The decentralized and metaverse wave', start: 2021, end: 2023,
    line: 'Everyone was promised a piece of a world that had not been built yet.',
    light: { key: '#ff6bff', fill: '#38f3ff', ground: '#0b0418', grain: 0.09 },
    retro: { name: 'Synth grid', palette: ['#000000', '#4b0f7a', '#ff2fd0', '#38f3ff'] },
    weather: { film: -0.1, platforms: 0.1, xr: 0.6, web3: 0.9, ai: 0.3, worldmodels: 0.0, local: 0.0 },
  },
  {
    id: 'ai', label: 'The AI years', start: 2023, end: 2026,
    line: 'Language learned to answer back and the money followed it.',
    light: { key: '#f2f7ff', fill: '#b9d4ff', ground: '#05070c', grain: 0.05 },
    retro: { name: 'White phosphor', palette: ['#000000', '#262c38', '#9aa6b8', '#f5f8ff'] },
    weather: { film: -0.3, platforms: -0.1, xr: -0.3, web3: -0.7, ai: 1.0, worldmodels: 0.5, local: 0.0 },
  },
  {
    id: 'worldmodels', label: 'The world model and simulation years', start: 2026, end: 2031,
    line: 'Machines started dreaming in places, and places started remembering people.',
    light: { key: '#ffe2d4', fill: '#ffb3c7', ground: '#0c0710', grain: 0.06 },
    retro: { name: 'Green phosphor', palette: ['#000000', '#063d22', '#2fe07f', '#d9ffe9'] },
    weather: { film: 0.1, platforms: -0.1, xr: 0.4, web3: -0.3, ai: 0.7, worldmodels: 1.0, local: 0.1 },
  },
]

export const CLOCK = { start: 2008, end: 2031 }
export const YEARS: number[] = Array.from({ length: CLOCK.end - CLOCK.start + 1 }, (_, i) => CLOCK.start + i)

// Eras overlap (pandemic and decentralized share 2021). The active era for a
// year is the latest one that has started, which keeps the light continuous.
export function eraAt(year: number): Era {
  let found = ERAS[0]
  for (const e of ERAS) if (year >= e.start) found = e
  return found
}

// Fractional era blend for smooth light transitions as the clock scrubs.
export function eraBlend(t: number): { a: Era; b: Era; k: number } {
  const a = eraAt(Math.floor(t))
  const idx = ERAS.indexOf(a)
  const b = ERAS[Math.min(idx + 1, ERAS.length - 1)]
  if (a === b) return { a, b, k: 0 }
  // Ease into the next era over the final year of the current one
  const k = Math.max(0, Math.min(1, t - (b.start - 1)))
  return { a, b, k: k * k * (3 - 2 * k) }
}
