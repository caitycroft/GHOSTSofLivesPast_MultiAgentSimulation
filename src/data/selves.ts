// SELF table (PRD 3.1). One thread is the life that happened. Every other
// thread is a ghost: the same person, with the same background, who stayed in
// a place she actually lived at the moment she was there. Ghosts share the
// real thread until their fork, then the simulation takes over.
// Sentences are drafts, to be rewritten in Caity's voice.

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
    sentence: 'I learned that stories move industries, then I went and built the worlds they move through.',
  },
  {
    id: 'la', name: 'The Los Angeles self', fork: { year: 2014, place: 'la', note: 'stayed in Los Angeles instead of touring' }, color: '#ff9ccf', neon: '#ff2fd0',
    sentence: 'I stayed in Los Angeles when the tour called, and found out what that city does with a storyteller.',
  },
  {
    id: 'sto', name: 'The Stockholm self', fork: { year: 2016, place: 'sto', note: 'stayed in Stockholm' }, color: '#7cc4ff', neon: '#38f3ff',
    sentence: 'I stayed for the long summer light and let the city decide what I would make.',
  },
  {
    id: 'utah', name: 'The Utah self', fork: { year: 2021, place: 'utah', note: 'stayed in the mountains' }, color: '#9ad7ff', neon: '#3dff7a',
    sentence: 'I stayed in the mountains and let the work come to me.',
  },
  {
    id: 'hnl', name: 'The Hawaii self', fork: { year: 2021, place: 'hnl', note: 'stayed on the island' }, color: '#62d6ff', neon: '#ffd23d',
    sentence: 'I stayed on the island and built a life around the ocean.',
  },
  {
    id: 'lon', name: 'The London self', fork: { year: 2023, place: 'lon', note: 'stayed in London' }, color: '#5aa9ff', neon: '#b98cff',
    sentence: 'I stayed in London and found my place between its music and its money.',
  },
  {
    id: 'ber', name: 'The Berlin self', fork: { year: 2023, place: 'ber', note: 'stayed in Berlin' }, color: '#4d8cff', neon: '#ff5f5f',
    sentence: 'I stayed in Berlin, where the club was the lab.',
  },
  {
    id: 'nyc', name: 'The New York self', fork: { year: 2024, place: 'nyc', note: 'stayed in New York after the program' }, color: '#a8b8ff', neon: '#5f8bff',
    sentence: 'I stayed in New York and built the thing everyone in the program was talking about.',
  },
  {
    id: 'osl', name: 'The Oslo self', fork: { year: 2024, place: 'osl', note: 'stayed in Oslo' }, color: '#8ec9ff', neon: '#7dfff0',
    sentence: 'I stayed in Oslo, where the long view is a national habit.',
  },
  {
    id: 'sha', name: 'The Shanghai self', fork: { year: 2024, place: 'sha', note: 'stayed in Shanghai after graduating' }, color: '#3f7fe6', neon: '#c8ff3d',
    sentence: 'I stayed in Shanghai, where the future ships first.',
  },
]

export const SELF_BY_ID: Record<string, Self> = Object.fromEntries(SELVES.map((s) => [s.id, s]))
export const GHOSTS = SELVES.filter((s) => !s.real)
