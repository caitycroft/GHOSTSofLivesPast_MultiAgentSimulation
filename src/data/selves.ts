// SELF table (PRD 3.1). DRAFT CAST: the places, years and real choices below
// are placeholders until the notebook lines in PRD Part 6 are filled in.
// Edit this file (or replace it with JSON) and every view updates.

export interface Self {
  id: string
  name: string
  home: string // place id
  real?: boolean
  attrs: { craft: number; network: number; risk: number; capital: number } // 1 to 5
  // For the real self only: the choices that actually happened, by age
  lived?: { 18: string; 25: string; 30: string }
  color: string
  sentence: string
}

export const BIRTH_YEAR = 1990 // eighteen in 2008, the first frame of the clock

export const SELVES: Self[] = [
  {
    id: 'real', name: 'The one who lived it', home: 'la', real: true,
    attrs: { craft: 4, network: 3, risk: 4, capital: 2 },
    lived: { 18: 'filmschool', 25: 'xrgames', 30: 'build' },
    color: '#ffb36b',
    sentence: 'I learned that stories move industries, then I went and built the worlds they move through.',
  },
  {
    id: 'toronto', name: 'The Toronto self', home: 'tor',
    attrs: { craft: 3, network: 3, risk: 2, capital: 3 },
    color: '#7cc4ff',
    sentence: 'I stayed close to the lake and let the work come north to me.',
  },
  {
    id: 'london', name: 'The London self', home: 'lon',
    attrs: { craft: 3, network: 4, risk: 3, capital: 3 },
    color: '#5aa9ff',
    sentence: 'I learned to speak in rooms where the money listened.',
  },
  {
    id: 'berlin', name: 'The Berlin self', home: 'ber',
    attrs: { craft: 4, network: 2, risk: 5, capital: 2 },
    color: '#4d8cff',
    sentence: 'I bet on every new world early and kept the receipts.',
  },
  {
    id: 'tokyo', name: 'The Tokyo self', home: 'tyo',
    attrs: { craft: 5, network: 2, risk: 2, capital: 2 },
    color: '#9ad7ff',
    sentence: 'I made one thing very well for a very long time.',
  },
  {
    id: 'seoul', name: 'The Seoul self', home: 'sel',
    attrs: { craft: 4, network: 3, risk: 3, capital: 2 },
    color: '#6fb7ff',
    sentence: 'I watched my city become the whole world’s screen.',
  },
  {
    id: 'sydney', name: 'The Sydney self', home: 'syd',
    attrs: { craft: 3, network: 2, risk: 4, capital: 3 },
    color: '#3f7fe6',
    sentence: 'I was always a day ahead and a year behind.',
  },
  {
    id: 'mexico', name: 'The Mexico City self', home: 'mex',
    attrs: { craft: 4, network: 3, risk: 3, capital: 1 },
    color: '#8ec9ff',
    sentence: 'I made films with what we had and the world came to see them.',
  },
]

export const SELF_BY_ID: Record<string, Self> = Object.fromEntries(SELVES.map((s) => [s.id, s]))
