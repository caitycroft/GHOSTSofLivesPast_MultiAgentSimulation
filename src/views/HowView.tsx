import { CLOCK, ERAS, INDUSTRIES } from '../data/eras'
import { EVENTS } from '../data/events'
import { DECISION_YEARS, LIVED } from '../data/lived'
import { PLACES, PLACE_BY_ID } from '../data/places'
import { GHOSTS, SELVES, SELF_BY_ID } from '../data/selves'
import { useYear } from '../lib/clock'
import type { Live } from '../live/useLive'
import type { SimResult } from '../sim/engine'
import { WIKI_TOPICS } from '../sim/weather'

// How it works, in one screen: what goes in, what the agents do, what comes
// out. Every count on this page is read from the data, not typed in.

export function HowView({ sim, live, focusId }: { sim: SimResult; live: Live; focusId: string | null }) {
  const year = Math.min(CLOCK.end, useYear())
  const self = SELF_BY_ID[focusId ?? 'real']
  const row = sim.canonical.paths[self.id][year - CLOCK.start]
  const lived = PLACES.filter((p) => p.kind === 'lived')
  const paths = lived.reduce((n, p) => n + p.paths.length, 0)
  const countries = new Set(PLACES.map((p) => p.iso3)).size
  const topics = Object.values(WIKI_TOPICS).flat().length
  const years = CLOCK.end - CLOCK.start + 1
  const rowsPerRun = SELVES.length * years
  const wb = live.sources.filter((s) => ['gdp', 'inflation', 'internet'].includes(s.id))
  const asOf = live.asOf?.slice(0, 10)

  return (
    <div className="how">
      <div className="how-cols">
        <section className="how-col in">
          <h3>Inputs</h3>
          <div className="how-card">
            <h4>The life that happened</h4>
            <p>{LIVED.length} lived years, {lived.length} cities, {DECISION_YEARS.length - 1} real forks in the road: USC, touring, venture, NYU ITP and IMA, spatial worlds.</p>
          </div>
          <div className="how-card">
            <h4>Places and careers</h4>
            <p>{lived.length} lived places with {paths} career paths that were open there, {PLACES.length - lived.length} waypoints and hubs, {INDUSTRIES.length} industries.</p>
          </div>
          <div className="how-card">
            <h4>Eras and events</h4>
            <p>{ERAS.length} eras from {CLOCK.start} to {CLOCK.end}, {EVENTS.filter((e) => e.kind !== 'life').length} macro, geopolitical, tech and culture events, each with a receipt.</p>
          </div>
          <div className="how-card data">
            <h4>Real data{asOf ? `, snapshot ${asOf}` : ''}</h4>
            <ul>
              <li>World Bank GDP growth, inflation and internet use, {countries} countries {wb.every((s) => s.status !== 'offline') ? '' : '(partly offline)'}</li>
              <li>Wikipedia attention, {topics} topics, 2015 on</li>
              <li>USGS earthquakes, past day</li>
              <li>ISS position, Open-Meteo city weather</li>
              <li>Sun position, computed</li>
            </ul>
          </div>
        </section>

        <div className="how-flow" aria-hidden><i /><i /><i /><i /><i /></div>

        <section className="how-col model">
          <h3>The model</h3>
          <div className="how-card">
            <h4>{SELVES.length} agents, one clock</h4>
            <p>The real thread replays the lived timeline. {GHOSTS.length} ghosts copy it until their fork, then each stays where she was and decides for itself.</p>
          </div>
          <div className="how-card formula">
            <h4>At every fork</h4>
            <code>score = fit + 0.9 &times; weather + 0.4 &times; local economy + risk + pull of others &minus; distance + stay</code>
            <p>Weather is the industry's growth that year: the era baseline bent by attention and GDP. Choices are drawn with a softmax, so the same self can live differently on another run.</p>
          </div>
          <div className="how-card">
            <h4>Between forks</h4>
            <p>Craft, network and capital drift with the industry and the city. Selves in the same city raise each other's network. When an industry turns, a self can pivot.</p>
          </div>
          <div className="how-card">
            <h4>{sim.runs} runs</h4>
            <p>Each run is a whole world. The drawn path is the most common one, chosen step by step; the faint clouds are everywhere the others went.</p>
          </div>
        </section>

        <div className="how-flow" aria-hidden><i /><i /><i /><i /><i /></div>

        <section className="how-col out">
          <h3>Outputs</h3>
          <div className="how-card">
            <h4>The PATH table</h4>
            <p>{rowsPerRun} rows per run, {(rowsPerRun * sim.runs).toLocaleString()} in all: place, role, industry, income band (1 to 5, never dollars), network (0 to 100), one line of narrative.</p>
          </div>
          <div className="how-card sample" style={{ ['--c' as string]: self.color }}>
            <h4>{self.name}, {year}</h4>
            <pre>{JSON.stringify({
              year,
              place: PLACE_BY_ID[row.place].city,
              role: row.role,
              industry: row.industry,
              incomeBand: row.incomeBand,
              network: row.network,
              lived: row.lived,
              line: row.narrative,
            }, null, 2)}</pre>
          </div>
          <div className="how-card">
            <h4>Distributions</h4>
            <p>For every ghost: how often each unlived path came up, where it ended in {CLOCK.end}, and {sim.canonical.crossings.length} crossings where two lives shared a city.</p>
          </div>
        </section>
      </div>
    </div>
  )
}
