// Verifies every event receipt resolves to a real Wikipedia article and prints
// the article's own description, so dates and claims can be spot checked.
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/data/events.ts', import.meta.url), 'utf8')
const titles = [...new Set([...src.matchAll(/wiki: '([^']+)'/g)].map((m) => m[1]))]
let bad = 0
for (const t of titles) {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}`, { headers: { 'User-Agent': 'GhostsOfLivesPast/0.2 (event receipt check)' } })
  if (!res.ok) { bad++; console.log(`MISSING ${t} (${res.status})`); continue }
  const j = await res.json()
  console.log(`ok  ${t.padEnd(58)} ${(j.description ?? '').slice(0, 70)}`)
  await new Promise((r) => setTimeout(r, 120))
}
console.log(bad ? `${bad} missing` : 'all receipts resolve')
