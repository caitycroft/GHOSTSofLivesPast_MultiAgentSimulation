import { CLOCK, INDUSTRY_BY_ID, type IndustryId } from '../data/eras'
import { LIVED_BY_YEAR } from '../data/lived'
import { PLACE_BY_ID } from '../data/places'
import { GHOSTS, SELF_BY_ID } from '../data/selves'
import type { VisualStyle } from '../globe/GlobeScene'
import type { SimResult } from '../sim/engine'
import { localMacro, type LiveSignals, type WeatherTable } from '../sim/weather'

// A pop-up for one place in one year: what the local economy looked like,
// which careers were open there, and which ghost took which one.

interface Props {
  placeId: string
  year: number
  sim: SimResult
  weather: WeatherTable
  signals: LiveSignals
  style: VisualStyle
}

const KIND = { lived: 'Lived here', waypoint: 'Waypoint', hub: 'A city a ghost moved to' }

export function PlaceCard({ placeId, year, sim, weather, signals, style }: Props) {
  const place = PLACE_BY_ID[placeId]
  const y = Math.max(CLOCK.start, Math.min(CLOCK.end, year))
  const row = weather[y]
  const macro = localMacro(place.iso3, Math.min(y, new Date().getFullYear()), signals)
  const color = (id: string) => (style === 'arcade' ? SELF_BY_ID[id].neon : SELF_BY_ID[id].color)
  const industries = (Object.entries(place.industries) as [IndustryId, number][])
    .map(([id, strength]) => ({ id, strength, wx: row[id].value, score: strength * (0.65 + 0.35 * row[id].value) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
  const stayer = GHOSTS.find((g) => g.fork?.place === placeId)
  const stayerRows = stayer ? sim.canonical.paths[stayer.id] : null
  const takers = (pathId: string) => GHOSTS.filter((g) => sim.canonical.choices[g.id].some((c) => !c.lived && c.pathId === pathId))
  const lived = LIVED_BY_YEAR[Math.min(y, 2026)]

  return (
    <div className={`place-card kind-${place.kind}`}>
      <div className="pc-kicker">{KIND[place.kind]}{place.lived ? ` · ${place.lived}` : ''}</div>
      <div className="pc-city">{place.city}<span>{place.country}</span></div>
      {place.blurb && <p className="pc-blurb">{place.blurb}</p>}
      {place.kind !== 'waypoint' && (
        <>
          <div className="pc-sec">Industries here in {y}</div>
          {industries.map((i) => (
            <div key={i.id} className="pc-bar">
              <span>{INDUSTRY_BY_ID[i.id].short}</span>
              <i><b style={{ width: `${Math.max(6, i.score * 100)}%`, background: INDUSTRY_BY_ID[i.id].color }} /></i>
              <em className={i.wx >= 0 ? 'up' : 'down'}>{i.wx >= 0 ? '▲' : '▼'}</em>
            </div>
          ))}
        </>
      )}
      {place.paths.length > 0 && (
        <>
          <div className="pc-sec">Lives that were open here</div>
          {place.paths.map((p) => {
            const who = takers(p.id)
            const real = p.id === lived?.path || p.same === lived?.path
            return (
              <div key={p.id} className={'pc-path' + (who.length || real ? ' taken' : '')}>
                <span className="dots">
                  {real && <i style={{ background: color('real') }} title="The life that happened" />}
                  {who.map((g) => <i key={g.id} style={{ background: color(g.id) }} title={g.name} />)}
                </span>
                <span>{p.label}</span>
              </div>
            )
          })}
        </>
      )}
      {macro.receipts.length > 0 && (
        <div className="pc-macro">
          {macro.gdp && <span>GDP {macro.gdp.value >= 0 ? '+' : ''}{macro.gdp.value.toFixed(1)}%</span>}
          {macro.inflation && <span>Inflation {macro.inflation.value.toFixed(1)}%</span>}
          {macro.online && <span>{macro.online.value.toFixed(0)}% online</span>}
          <em>World Bank, {place.country}, {macro.gdp?.year ?? macro.online?.year}</em>
        </div>
      )}
      {stayer && stayerRows && (
        <div className="pc-ghost" style={{ ['--c' as string]: color(stayer.id) }}>
          <b>{stayer.name}</b> forks here in {stayer.fork!.year}
          {y >= stayer.fork!.year ? `: ${stayerRows[y - CLOCK.start].role} in ${PLACE_BY_ID[stayerRows[y - CLOCK.start].place].city}` : ''}
          {', heading to '}{stayerRows[stayerRows.length - 1].role.toLowerCase()} by {CLOCK.end}.
        </div>
      )}
    </div>
  )
}
