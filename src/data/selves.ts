// SELF table (PRD 3.1). One thread is the life that happened. Every other
// thread is a ghost: the same person, with the same background, who stayed in
// a place she actually lived at the moment she was there. Ghosts share the
// real thread until their fork, then the simulation takes over.
// The real thread speaks in the first person; ghosts in the third ("she").

export interface Self {
  id: string
  name: string
  real?: boolean
  fork?: { year: number; place: string; note: string }
  color: string // classic and void
  neon: string // arcade
  sentence: string
}

export const START_ATTRS = { craft: 3, network: 2, risk: 4, capital: 2 } // 1 to 5, in 2010

export const SELVES: Self[] = [
  {
    id: 'real', name: 'The one who lived it', real: true, color: '#ffb36b', neon: '#ff9a3d',
    sentence: 'I studied film, toured as a DJ, invested in startups, then learned to build worlds myself.',
  },
  {
    id: 'la', name: 'The Los Angeles self', fork: { year: 2014, place: 'la', note: 'stays in Los Angeles instead of touring' }, color: '#ff9ccf', neon: '#ff2fd0',
    sentence: 'She stays in Los Angeles in 2014 instead of touring, and builds on her studio internships.',
  },
  {
    id: 'sto', name: 'The Stockholm self', fork: { year: 2016, place: 'sto', note: 'stays in Stockholm' }, color: '#7cc4ff', neon: '#38f3ff',
    sentence: 'She stays in Stockholm in 2016, home to Spotify, King, Mojang and a world class pop scene.',
  },
  {
    id: 'utah', name: 'The Utah self', fork: { year: 2021, place: 'utah', note: 'stays in Utah' }, color: '#9ad7ff', neon: '#3dff7a',
    sentence: 'She stays in Utah in 2021, between the Silicon Slopes tech scene and the mountains.',
  },
  {
    id: 'hnl', name: 'The Hawaii self', fork: { year: 2021, place: 'hnl', note: 'stays in Hawaii' }, color: '#62d6ff', neon: '#ffd23d',
    sentence: 'She stays in Hawaii in 2021 and builds a life around the ocean.',
  },
  {
    id: 'lon', name: 'The London self', fork: { year: 2023, place: 'lon', note: 'stays in London' }, color: '#5aa9ff', neon: '#b98cff',
    sentence: 'She stays in London in 2023, a capital of music, media and finance.',
  },
  {
    id: 'ber', name: 'The Berlin self', fork: { year: 2023, place: 'ber', note: 'stays in Berlin' }, color: '#4d8cff', neon: '#ff5f5f',
    sentence: 'She stays in Berlin in 2023, in the middle of its club and techno scene.',
  },
  {
    id: 'nyc', name: 'The New York self', fork: { year: 2024, place: 'nyc', note: 'stays in New York after the program' }, color: '#a8b8ff', neon: '#5f8bff',
    sentence: 'She stays in New York in 2024, after NYU ITP, in the middle of the AI boom.',
  },
  {
    id: 'osl', name: 'The Oslo self', fork: { year: 2024, place: 'osl', note: 'stays in Oslo' }, color: '#8ec9ff', neon: '#7dfff0',
    sentence: 'She stays in Oslo in 2024, in a small, wealthy and very online country.',
  },
  {
    id: 'sha', name: 'The Shanghai self', fork: { year: 2024, place: 'sha', note: 'stays in Shanghai after graduating' }, color: '#3f7fe6', neon: '#c8ff3d',
    sentence: 'She stays in Shanghai after graduating in 2024, in China’s biggest business city.',
  },
]

export const SELF_BY_ID: Record<string, Self> = Object.fromEntries(SELVES.map((s) => [s.id, s]))
export const GHOSTS = SELVES.filter((s) => !s.real)
