import type { IndustryId } from './eras'

// The life that happened, year by year, from Caity's own timeline.
// `route` is every place the year passed through, in order; the thread visits
// each in turn. `home` is the base used for the numbers. Lines are first
// person drafts, to be rewritten in her voice (PRD 3.2).

export interface LivedYear {
  year: number
  home: string
  route: string[]
  role: string
  industry: IndustryId
  path: string // the career path id this year was on (ghosts skip it at their fork)
  line: string
  decision?: { label: string; glyph: string }
}

export const LIVED: LivedYear[] = [
  { year: 2010, home: 'la', route: ['la'], role: 'USC student, film intern and DJ', industry: 'film', path: 'usc', line: 'I started at USC, studying cinema and narrative, with a camera always on me.', decision: { label: 'USC: Cinematic Arts, Narrative Studies, Photography', glyph: '△' } },
  { year: 2011, home: 'la', route: ['la'], role: 'USC student, film intern and DJ', industry: 'film', path: 'usc', line: 'Studio lots by day, DJing as Parker + Barrow by night.' },
  { year: 2012, home: 'la', route: ['la'], role: 'USC student, film intern and DJ', industry: 'film', path: 'usc', line: 'Warner Bros., De Line Pictures, MGM: I learned how stories become slates.' },
  { year: 2013, home: 'la', route: ['la'], role: 'USC student, film intern and DJ', industry: 'film', path: 'usc', line: 'The sets got bigger, and so did the dance floors.' },
  { year: 2014, home: 'la', route: ['la'], role: 'DJ and producer, Parker + Barrow', industry: 'music', path: 'touring', line: 'I graduated and booked EDC on the same day.', decision: { label: 'Tour as a DJ and producer', glyph: '◇' } },
  { year: 2015, home: 'la', route: ['la', 'lib', 'brc', 'la', 'sto'], role: 'DJ and producer, Parker + Barrow', industry: 'music', path: 'touring', line: 'Lightning in a Bottle, Burning Man, and a suitcase that never fully unpacked.' },
  { year: 2016, home: 'sto', route: ['sto', 'la', 'sto'], role: 'DJ and producer, touring', industry: 'music', path: 'touring', line: 'Between Los Angeles and Stockholm, producing on planes.' },
  { year: 2017, home: 'la', route: ['la', 'sto', 'la'], role: 'DJ and producer, touring', industry: 'music', path: 'touring', line: 'The High Coast, Mallorca, Utah: the tour had a lot of horizons.' },
  { year: 2018, home: 'sto', route: ['sto', 'la', 'sto'], role: 'DJ and producer, touring', industry: 'music', path: 'touring', line: 'Touring and producing, learning how scenes turn into industries.' },
  { year: 2019, home: 'la', route: ['la', 'sto', 'la'], role: 'DJ and producer, touring', industry: 'music', path: 'touring', line: 'Another year between two cities and a lot of stages.' },
  { year: 2020, home: 'la', route: ['la', 'hnl', 'utah'], role: 'Venture capital', industry: 'venture', path: 'vc', line: 'The rooms closed, so I moved into venture, between LA, Hawaii and Utah.', decision: { label: 'Move into venture capital', glyph: '✶' } },
  { year: 2021, home: 'utah', route: ['utah', 'hnl', 'la', 'utah'], role: 'Venture capital', industry: 'venture', path: 'vc', line: 'Zero rates and endless pitches: I watched capital chase every new story.' },
  { year: 2022, home: 'nyc', route: ['utah', 'la', 'nyc'], role: 'NYU ITP and IMA, creative technology', industry: 'xr', path: 'itp', line: 'I started at NYU ITP and IMA to learn to build the worlds myself.', decision: { label: 'NYU ITP and IMA, creative technology', glyph: '⬡' } },
  { year: 2023, home: 'nyc', route: ['nyc', 'lon', 'ber', 'osl', 'nyc'], role: 'NYU ITP and IMA, creative technology', industry: 'xr', path: 'itp', line: 'London, Berlin, Oslo: the program kept moving, and so did I.' },
  { year: 2024, home: 'sha', route: ['sha', 'svb', 'sha', 'osl'], role: 'NYU graduate, creative technologist', industry: 'xr', path: 'itp', line: 'I skied the Svalbard Ski Marathon in April and graduated in Shanghai in June.', decision: { label: 'Build spatial worlds and music', glyph: '✦' } },
  { year: 2025, home: 'la', route: ['osl', 'la', 'nyc', 'sf'], role: 'Creative technologist and music artist', industry: 'worldmodels', path: 'spatial', line: 'Back between Los Angeles, New York and San Francisco, building spatial worlds and music.' },
  { year: 2026, home: 'sf', route: ['sf', 'la', 'nyc', 'sf'], role: 'Creative technologist and music artist', industry: 'worldmodels', path: 'spatial', line: 'Simulating the lives I didn’t live, with the tools I learned to build.' },
]

export const LIVED_BY_YEAR: Record<number, LivedYear> = Object.fromEntries(LIVED.map((l) => [l.year, l]))
export const LAST_LIVED = LIVED[LIVED.length - 1].year

// Real forks in the road, and one projected one for every thread
export const DECISION_YEARS = [2010, 2014, 2020, 2022, 2024, 2027]

// Trips with no exact year: drawn as waypoints, not on the yearly thread
export const TRIPS: { from: string; to: string; when: string }[] = [
  { from: 'sto', to: 'hoga', when: 'touring years' },
  { from: 'sto', to: 'mal', when: 'touring years' },
  { from: 'la', to: 'utah', when: 'touring years' },
]
