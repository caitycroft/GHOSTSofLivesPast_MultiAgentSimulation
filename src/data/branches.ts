import type { IndustryId } from './eras'

// BRANCH table (PRD 3.1). Three decision points, three branches each.
// `place` is either a city id, '$home', '$current', or a list of hubs; a list
// resolves to the hub nearest the self at that moment (sim/engine.ts).
export type DecisionAge = 18 | 25 | 30

export interface Branch {
  id: string
  age: DecisionAge
  label: string
  glyph: string
  industry: IndustryId | '$current'
  role: string
  place: '$home' | '$current' | string[]
  requires: { craft: number; network: number; capital: number }
  // How much the branch rewards risk appetite (positive) or caution (negative)
  risk: number
}

export const BRANCHES: Branch[] = [
  // Eighteen: stay or leave; which school or trade
  { id: 'stay', age: 18, label: 'Stay and work', glyph: '○', industry: 'local', role: 'Apprentice', place: '$home', requires: { craft: 1, network: 1, capital: 1 }, risk: -0.6 },
  { id: 'filmschool', age: 18, label: 'Leave for film school', glyph: '△', industry: 'film', role: 'Film student', place: ['la', 'nyc', 'lon', 'tor', 'sel', 'tyo', 'par', 'mex'], requires: { craft: 3, network: 2, capital: 3 }, risk: 0.5 },
  { id: 'techschool', age: 18, label: 'Leave for engineering school', glyph: '□', industry: 'platforms', role: 'Engineering student', place: ['sf', 'bos', 'tor', 'lon', 'tyo', 'sel', 'ber', 'sin'], requires: { craft: 2, network: 2, capital: 3 }, risk: 0.3 },

  // Twenty five: which industry; which city
  { id: 'entertainment', age: 25, label: 'Go into film and entertainment', glyph: '◇', industry: 'film', role: 'Producer', place: ['la', 'nyc', 'lon', 'sel', 'tor', 'mex'], requires: { craft: 3, network: 3, capital: 1 }, risk: 0.4 },
  { id: 'platforms', age: 25, label: 'Join the platform companies', glyph: '◈', industry: 'platforms', role: 'Product lead', place: ['sf', 'nyc', 'lon', 'ber', 'sin', 'sea'], requires: { craft: 2, network: 3, capital: 1 }, risk: 0.1 },
  { id: 'xrgames', age: 25, label: 'Build worlds in XR and games', glyph: '⬡', industry: 'xr', role: 'World builder', place: ['la', 'sf', 'sea', 'tyo', 'ber', 'sel'], requires: { craft: 3, network: 2, capital: 1 }, risk: 0.6 },

  // Thirty: build, join, or allocate
  { id: 'build', age: 30, label: 'Build something of my own', glyph: '✦', industry: '$current', role: 'Founder', place: '$current', requires: { craft: 4, network: 3, capital: 2 }, risk: 0.9 },
  { id: 'join', age: 30, label: 'Join a frontier lab', glyph: '✧', industry: 'ai', role: 'Partnerships lead', place: ['sf', 'sea', 'lon', 'nyc', 'tor', 'par'], requires: { craft: 3, network: 4, capital: 1 }, risk: -0.2 },
  { id: 'allocate', age: 30, label: 'Allocate capital to the new wave', glyph: '✶', industry: 'web3', role: 'Allocator', place: ['nyc', 'lis', 'sin', 'lon', 'ber'], requires: { craft: 2, network: 4, capital: 4 }, risk: 0.5 },
]

export const DECISION_AGES: DecisionAge[] = [18, 25, 30]
export const branchesAt = (age: DecisionAge) => BRANCHES.filter((b) => b.age === age)
export const BRANCH_BY_ID: Record<string, Branch> = Object.fromEntries(BRANCHES.map((b) => [b.id, b]))
