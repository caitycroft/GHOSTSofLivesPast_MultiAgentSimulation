import type { IndustryId } from './eras'

// The life that happened, year by year, from Caity's own timeline.
// `route` is every place the year passed through, in order; the thread visits
// each in turn. `home` is the base used for the numbers. Lines are first
// person, present tense, short enough to read before the year turns over.

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
  { year: 2010, home: 'la', route: ['la'], role: 'USC student, film intern and DJ', industry: 'film', path: 'usc', line: 'I start film school at USC, with a camera always on me.', decision: { label: 'USC: Cinematic Arts, Narrative Studies, Photography', glyph: '△' } },
  { year: 2011, home: 'la', route: ['la'], role: 'USC student, film intern and DJ', industry: 'film', path: 'usc', line: 'Studio internships by day, DJing as Parker + Barrow by night.' },
  { year: 2012, home: 'la', route: ['la'], role: 'USC student, film intern and DJ', industry: 'film', path: 'usc', line: 'I intern at Warner Bros., De Line Pictures and MGM.' },
  { year: 2013, home: 'la', route: ['la'], role: 'USC student, film intern and DJ', industry: 'film', path: 'usc', line: 'Film school by day, and bigger DJ bookings every month.' },
  { year: 2014, home: 'la', route: ['la'], role: 'DJ and producer, Parker + Barrow', industry: 'music', path: 'touring', line: 'I graduate from USC and book EDC on the same day.', decision: { label: 'Tour as a DJ and producer', glyph: '◇' } },
  { year: 2015, home: 'la', route: ['la', 'lib', 'brc', 'la', 'sto'], role: 'DJ and producer, Parker + Barrow', industry: 'music', path: 'touring', line: 'Lightning in a Bottle and Burning Man, then on to Stockholm.' },
  { year: 2016, home: 'sto', route: ['sto', 'la', 'sto'], role: 'DJ and producer, touring', industry: 'music', path: 'touring', line: 'Touring and living between Los Angeles and Stockholm.' },
  { year: 2017, home: 'la', route: ['la', 'sto', 'la'], role: 'DJ and producer, touring', industry: 'music', path: 'touring', line: 'Shows and trips to the High Coast, Mallorca and Utah.' },
  { year: 2018, home: 'sto', route: ['sto', 'la', 'sto'], role: 'DJ and producer, touring', industry: 'music', path: 'touring', line: 'Touring and producing, and learning how music scenes become industries.' },
  { year: 2019, home: 'la', route: ['la', 'sto', 'la'], role: 'DJ and producer, touring', industry: 'music', path: 'touring', line: 'Still touring and living between Los Angeles and Stockholm.' },
  { year: 2020, home: 'la', route: ['la', 'hnl', 'utah'], role: 'Venture capital', industry: 'venture', path: 'vc', line: 'COVID lockdowns close the clubs, and I move into venture capital.', decision: { label: 'Move into venture capital', glyph: '✶' } },
  { year: 2021, home: 'utah', route: ['utah', 'hnl', 'la', 'utah'], role: 'Venture capital', industry: 'venture', path: 'vc', line: 'Investing between LA, Hawaii and Utah while rates sit near zero.' },
  { year: 2022, home: 'nyc', route: ['utah', 'la', 'nyc'], role: 'NYU ITP and IMA, creative technology', industry: 'xr', path: 'itp', line: 'I start at NYU ITP and IMA to learn to build worlds myself.', decision: { label: 'NYU ITP and IMA, creative technology', glyph: '⬡' } },
  { year: 2023, home: 'nyc', route: ['nyc', 'lon', 'ber', 'osl', 'nyc'], role: 'NYU ITP and IMA, creative technology', industry: 'xr', path: 'itp', line: 'Study and work stints in London, Berlin and Oslo.' },
  { year: 2024, home: 'sha', route: ['sha', 'svb', 'sha', 'osl'], role: 'NYU graduate, creative technologist', industry: 'xr', path: 'itp', line: 'I ski the Svalbard Ski Marathon in April and graduate in Shanghai in June.', decision: { label: 'Build spatial worlds and music', glyph: '✦' } },
  { year: 2025, home: 'la', route: ['osl', 'la', 'nyc', 'sf'], role: 'Creative technologist and music artist', industry: 'worldmodels', path: 'spatial', line: 'Building spatial worlds and music between LA, New York and San Francisco.' },
  { year: 2026, home: 'sf', route: ['sf', 'la', 'nyc', 'sf'], role: 'Creative technologist and music artist', industry: 'worldmodels', path: 'spatial', line: 'In San Francisco, building with AI and simulating the lives I didn’t live.' },
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
