// ERA table (PRD 3.1) and the industries the eras act on.
// Baseline weather is the authored timeline. Live data in sim/weather.ts bends
// it year by year (attention, GDP by country), and every number has a receipt.

export type IndustryId = 'film' | 'music' | 'platforms' | 'venture' | 'xr' | 'web3' | 'ai' | 'worldmodels' | 'local'

export const INDUSTRIES: { id: IndustryId; label: string; short: string; craft: boolean; color: string; role: string }[] = [
  { id: 'film', label: 'Film and entertainment', short: 'Film', craft: true, color: '#ffb36b', role: 'Producer' },
  { id: 'music', label: 'Music and live events', short: 'Music', craft: true, color: '#ff5fd2', role: 'DJ and producer' },
  { id: 'platforms', label: 'Platforms and startups', short: 'Platforms', craft: false, color: '#7cc4ff', role: 'Product lead' },
  { id: 'venture', label: 'Venture capital', short: 'Venture', craft: false, color: '#ffd23d', role: 'Investor' },
  { id: 'xr', label: 'XR, games and creative tech', short: 'XR', craft: true, color: '#38f3ff', role: 'World builder' },
  { id: 'web3', label: 'Decentralized and metaverse', short: 'Web3', craft: false, color: '#b98cff', role: 'Protocol founder' },
  { id: 'ai', label: 'AI', short: 'AI', craft: true, color: '#f5f8ff', role: 'AI product lead' },
  { id: 'worldmodels', label: 'World models and spatial computing', short: 'World models', craft: true, color: '#3dff9a', role: 'Creative technologist' },
  { id: 'local', label: 'Local economy (tourism, energy, outdoor)', short: 'Local', craft: false, color: '#9aa6b8', role: 'Local business owner' },
]
export const INDUSTRY_BY_ID = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i])) as Record<IndustryId, (typeof INDUSTRIES)[number]>

export interface Era {
  id: string
  label: string
  start: number
  end: number
  line: string
  trends: string[]
  // Classic light: the whole scene is tinted by these (PRD 4.1, weather as light)
  light: { key: string; fill: string; ground: string; grain: number }
  // Void mode: a console generation with a four colour palette, darkest to brightest
  retro: { name: string; palette: [string, string, string, string] }
  // Arcade mode: the neon accent this stage glows in
  neon: { name: string; accent: string; sky: string }
  // Baseline growth per industry, -1 (shrinking) to 1 (growing)
  weather: Record<IndustryId, number>
}

export const ERAS: Era[] = [
  {
    id: 'recovery', label: 'The recovery and the app economy', start: 2010, end: 2012,
    line: 'Money was nearly free, the phone became the front door, and the studios still set the weather.',
    trends: ['Post crisis recovery and quantitative easing', 'Eurozone debt crisis', 'Smartphones and the app store', 'The Arab Spring'],
    light: { key: '#ffcf8a', fill: '#ff9a52', ground: '#120a06', grain: 0.11 },
    retro: { name: 'Amber monitor', palette: ['#000000', '#3d1f00', '#c47a00', '#ffc23d'] },
    neon: { name: 'Sunset strip', accent: '#ff9a3d', sky: '#2a0a1a' },
    weather: { film: 0.5, music: 0.3, platforms: 0.6, venture: 0.3, xr: -0.4, web3: -0.7, ai: -0.4, worldmodels: -0.9, local: -0.1 },
  },
  {
    id: 'festival', label: 'The festival and streaming boom', start: 2012, end: 2015,
    line: 'Dance music filled stadiums, streaming ate the record store, and VR got a second life on Kickstarter.',
    trends: ['Electronic music festival boom', 'Streaming replaces downloads', 'Deep learning breakthrough', 'VR returns'],
    light: { key: '#ffb3e6', fill: '#ff5fd2', ground: '#14060f', grain: 0.09 },
    retro: { name: 'Arcade cabinet', palette: ['#000000', '#5a0b4b', '#ff3fb8', '#ffd0f0'] },
    neon: { name: 'Main stage', accent: '#ff2fd0', sky: '#1a0628' },
    weather: { film: 0.3, music: 0.8, platforms: 0.6, venture: 0.4, xr: 0.2, web3: -0.4, ai: -0.1, worldmodels: -0.7, local: 0.1 },
  },
  {
    id: 'platform', label: 'The platform years', start: 2015, end: 2020,
    line: 'The feed became the stage, the map split at the ballot box, and attention became the economy.',
    trends: ['Social platforms and the attention economy', 'Brexit and the 2016 US election', 'ICO boom', 'US China trade war'],
    light: { key: '#9fd8ff', fill: '#4f8dff', ground: '#040914', grain: 0.07 },
    retro: { name: 'CGA', palette: ['#000000', '#7a1fa2', '#22c7d6', '#f4f4ff'] },
    neon: { name: 'Feed city', accent: '#38f3ff', sky: '#04102a' },
    weather: { film: 0.0, music: 0.1, platforms: 0.8, venture: 0.6, xr: 0.3, web3: 0.2, ai: 0.3, worldmodels: -0.4, local: 0.1 },
  },
  {
    id: 'pandemic', label: 'The pandemic and zero rates', start: 2020, end: 2022,
    line: 'Every room closed, rates hit zero, and capital poured into anything digital.',
    trends: ['COVID 19 pandemic', 'Zero interest rates and stimulus', 'Record venture funding', 'NFTs and the metaverse rename'],
    light: { key: '#c9ccd1', fill: '#8b9097', ground: '#0a0b0d', grain: 0.16 },
    retro: { name: 'Handheld', palette: ['#000000', '#1f3b1f', '#7fa31a', '#c8e89a'] },
    neon: { name: 'Lockdown grid', accent: '#3dff7a', sky: '#03140a' },
    weather: { film: -0.6, music: -0.8, platforms: 0.6, venture: 0.9, xr: 0.4, web3: 0.8, ai: 0.3, worldmodels: -0.1, local: -0.7 },
  },
  {
    id: 'reset', label: 'The reset', start: 2022, end: 2023,
    line: 'War in Ukraine, inflation and rate hikes popped the bubble, then a chatbot changed the subject.',
    trends: ['Russia invades Ukraine', 'Inflation and rate hikes', 'Crypto winter and tech layoffs', 'ChatGPT'],
    light: { key: '#ff6bff', fill: '#38f3ff', ground: '#0b0418', grain: 0.09 },
    retro: { name: 'Synth grid', palette: ['#000000', '#4b0f7a', '#ff2fd0', '#38f3ff'] },
    neon: { name: 'Synth grid', accent: '#b98cff', sky: '#12052a' },
    weather: { film: -0.4, music: 0.5, platforms: -0.4, venture: -0.6, xr: -0.2, web3: -0.9, ai: 0.8, worldmodels: 0.1, local: 0.2 },
  },
  {
    id: 'ai', label: 'The AI years', start: 2023, end: 2026,
    line: 'Models learned to talk, see and code, and the compute buildout became the economy’s engine.',
    trends: ['Generative AI and the compute buildout', 'Spatial computing ships', 'Rate cuts begin', 'Tariffs and trade realignment'],
    light: { key: '#f2f7ff', fill: '#b9d4ff', ground: '#05070c', grain: 0.05 },
    retro: { name: 'White phosphor', palette: ['#000000', '#262c38', '#9aa6b8', '#f5f8ff'] },
    neon: { name: 'White hot', accent: '#f5f8ff', sky: '#0a0a18' },
    weather: { film: -0.3, music: 0.2, platforms: -0.1, venture: 0.3, xr: -0.2, web3: -0.2, ai: 1.0, worldmodels: 0.6, local: 0.0 },
  },
  {
    id: 'worldmodels', label: 'The world model and simulation years', start: 2026, end: 2031,
    line: 'Machines learn to build places, and the map and the model start to merge.',
    trends: ['World models and generated 3D worlds', 'Simulation as a tool', 'Spatial interfaces', 'Projected, not yet lived'],
    light: { key: '#ffe2d4', fill: '#ffb3c7', ground: '#0c0710', grain: 0.06 },
    retro: { name: 'Green phosphor', palette: ['#000000', '#063d22', '#2fe07f', '#d9ffe9'] },
    neon: { name: 'Dawn render', accent: '#3dff9a', sky: '#06140f' },
    weather: { film: 0.1, music: 0.2, platforms: 0.0, venture: 0.3, xr: 0.5, web3: -0.2, ai: 0.7, worldmodels: 1.0, local: 0.1 },
  },
]

export const CLOCK = { start: 2010, end: 2031 }
export const NOW_YEAR = Math.min(CLOCK.end, new Date().getFullYear())
export const YEARS: number[] = Array.from({ length: CLOCK.end - CLOCK.start + 1 }, (_, i) => CLOCK.start + i)

// Eras overlap. The active era for a year is the latest one that has started,
// which keeps the light continuous.
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
  const k = Math.max(0, Math.min(1, t - (b.start - 1)))
  return { a, b, k: k * k * (3 - 2 * k) }
}
