import { CLOCK, INDUSTRIES, YEARS } from '../data/eras'
import { PLACES, PLACE_BY_ID } from '../data/places'
import { SELVES } from '../data/selves'
import { useClock, useYear } from '../lib/clock'
import type { Live } from '../live/useLive'
import type { Series } from '../live/sources'
import type { SimResult } from '../sim/engine'
import { WIKI_TOPICS, type WeatherTable } from '../sim/weather'
import { hideTip, showTip, Receipts } from '../ui/tooltip'
import { PathDistribution } from './CardsView'

// Dashboards: live Earth, the industry weather with its receipts, the raw
// signals, and what the simulation did with them.

const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Showers', 81: 'Showers', 82: 'Storms', 95: 'Thunder', 96: 'Thunder', 99: 'Thunder',
}

function Panel({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={'panel' + (wide ? ' wide' : '')}>
      <h4>{title}</h4>
      {children}
    </section>
  )
}

function Clock() {
  const now = useClock(() => Math.floor(Date.now() / 1000))
  return <span>{new Date(now * 1000).toISOString().slice(11, 19)} UTC</span>
}

function cellColor(v: number) {
  if (v >= 0) return `rgba(255, 210, 154, ${0.08 + v * 0.85})`
  return `rgba(79, 141, 255, ${0.08 + -v * 0.7})`
}

function Heatmap({ weather, year }: { weather: WeatherTable; year: number }) {
  return (
    <div className="heat">
      <div className="heat-row head">
        <span />
        {YEARS.map((y) => <span key={y} className={y === year ? 'cur' : ''}>{y % 5 === 0 ? y : ''}</span>)}
      </div>
      {INDUSTRIES.map((ind) => (
        <div key={ind.id} className="heat-row">
          <span className="lbl">{ind.label}</span>
          {YEARS.map((y) => {
            const c = weather[y][ind.id]
            return (
              <span
                key={y}
                className={'cell' + (y === year ? ' cur' : '') + (c.projected ? ' proj' : '')}
                style={{ background: cellColor(c.value) }}
                onPointerMove={(e) => showTip(e.clientX, e.clientY, (
                  <div>
                    <div className="tip-title">{ind.label}, {y}</div>
                    <div className="tip-row"><span>Weather</span><b>{c.value.toFixed(2)}</b></div>
                    <Receipts items={c.receipts} />
                  </div>
                ))}
                onPointerLeave={hideTip}
              />
            )
          })}
        </div>
      ))}
      <div className="legend"><i style={{ background: cellColor(-1) }} /> shrinking <i style={{ background: cellColor(1) }} /> growing <i className="proj-swatch" /> projected</div>
    </div>
  )
}

function Lines({ series, year, height = 90, labels }: { series: { name: string; data: Series; color: string }[]; year: number; height?: number; labels?: boolean }) {
  const W = 420
  const H = height
  const all = series.flatMap((s) => Object.values(s.data))
  if (!all.length) return <div className="empty">Waiting on live data. Running on the authored baseline.</div>
  const x = (y: number) => ((y - CLOCK.start) / (CLOCK.end - CLOCK.start)) * W
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="lines">
      {[2010, 2015, 2020, 2025, 2030].map((y) => (
        <g key={y}><line x1={x(y)} x2={x(y)} y1={0} y2={H} stroke="currentColor" strokeOpacity="0.08" /><text x={x(y)} y={H + 11} textAnchor="middle">{y}</text></g>
      ))}
      <line x1={x(year)} x2={x(year)} y1={0} y2={H} stroke="var(--key)" strokeOpacity="0.6" />
      {series.map((s) => {
        const vals = Object.entries(s.data).map(([k, v]) => [Number(k), v] as const).sort((a, b) => a[0] - b[0])
        const max = Math.max(...vals.map((v) => v[1]))
        const min = Math.min(0, ...vals.map((v) => v[1]))
        const yy = (v: number) => H - ((v - min) / (max - min || 1)) * (H - 6) - 3
        const d = vals.map(([k, v], i) => `${i ? 'L' : 'M'}${x(k).toFixed(1)},${yy(v).toFixed(1)}`).join(' ')
        const last = vals[vals.length - 1]
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="1.4" />
            {labels && last && <text x={x(last[0]) + 3} y={yy(last[1]) + 3} fill={s.color} className="lbl">{s.name}</text>}
          </g>
        )
      })}
    </svg>
  )
}

export function DashboardView({ sim, weather, live }: { sim: SimResult; weather: WeatherTable; live: Live }) {
  const year = Math.min(CLOCK.end, useYear())
  const maxQ = live.quakes.reduce((m, q) => (q.mag > m.mag ? q : m), { mag: 0, place: '', lat: 0, lon: 0, id: '', time: 0 })
  const palette = ['#ffd29a', '#7cc4ff', '#ff8fd1', '#9affd6', '#c9b6ff', '#ffb36b']
  const attention = Object.entries(WIKI_TOPICS).map(([ind, topics], i) => {
    const data: Series = {}
    for (const tp of topics) for (const [y, v] of Object.entries(live.signals.wiki[tp] ?? {})) data[Number(y)] = (data[Number(y)] ?? 0) + v
    return { name: INDUSTRIES.find((x) => x.id === ind)!.label.split(' ')[0], data, color: palette[i] }
  })
  const internet = Array.from(new Set(PLACES.map((p) => p.iso3))).slice(0, 8).map((iso, i) => ({ name: iso, data: live.signals.internet[iso] ?? {}, color: palette[i % palette.length] }))

  return (
    <div className="dash">
      <Panel title="Live Earth">
        <div className="kv"><span>Now</span><b><Clock /></b></div>
        <div className="kv"><span>Sun overhead</span><b>{live.sun.lat.toFixed(1)}, {live.sun.lon.toFixed(1)}</b></div>
        <div className="kv"><span>ISS</span><b>{live.iss ? `${live.iss.lat.toFixed(1)}, ${live.iss.lon.toFixed(1)} at ${live.iss.altKm.toFixed(0)} km, ${Math.round(live.iss.velocityKmh).toLocaleString()} km/h` : 'Waiting'}</b></div>
        <div className="kv"><span>Earthquakes, 24h</span><b>{live.quakes.length ? `${live.quakes.length} events, largest M${maxQ.mag.toFixed(1)}` : live.sources.find((s) => s.id === 'quakes')?.status === 'offline' ? 'Source offline' : 'Waiting'}</b></div>
        <div className="sub">{maxQ.place}</div>
        <ul className="quakes">
          {[...live.quakes].sort((a, b) => b.time - a.time).slice(0, 5).map((q) => (
            <li key={q.id}><b>M{q.mag.toFixed(1)}</b> {q.place} <span>{Math.round((Date.now() - q.time) / 60000)} min ago</span></li>
          ))}
        </ul>
      </Panel>

      <Panel title="The cast cities, right now">
        <table className="cities">
          <tbody>
            {PLACES.map((p) => {
              const w = live.cities.find((c) => c.id === p.id)
              const here = SELVES.filter((s) => sim.canonical.paths[s.id][year - CLOCK.start].place === p.id)
              return (
                <tr key={p.id} className={here.length ? 'on' : ''}>
                  <td>{p.city}</td>
                  <td>{w ? `${Math.round(w.tempC)}°C` : '·'}</td>
                  <td>{w ? WMO[w.code] ?? `Code ${w.code}` : ''}</td>
                  <td>{w ? (w.isDay ? 'Day' : 'Night') : ''}</td>
                  <td className="dots">{here.map((s) => <i key={s.id} style={{ background: s.color }} title={s.name} />)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>

      <Panel title="Industry weather, 2008 to 2031 (hover for receipts)" wide>
        <Heatmap weather={weather} year={year} />
      </Panel>

      <Panel title="Attention: Wikipedia monthly pageviews by industry">
        <Lines series={attention} year={year} labels />
      </Panel>

      <Panel title="Macro: world GDP growth and share of each country online">
        <Lines series={[{ name: 'GDP %', data: live.signals.gdpGrowth ?? {}, color: '#ffd29a' }]} year={year} height={50} labels />
        <Lines series={internet} year={year} height={70} labels />
      </Panel>

      <Panel title={`The selves in ${year}`} wide>
        <table className="selves">
          <thead><tr><th>Self</th><th>City</th><th>Role</th><th>Band</th><th>Network</th><th>Line</th></tr></thead>
          <tbody>
            {SELVES.map((s) => {
              const r = sim.canonical.paths[s.id][year - CLOCK.start]
              return (
                <tr key={s.id}>
                  <td style={{ color: s.color }}>{s.name}</td>
                  <td>{PLACE_BY_ID[r.place].city}</td>
                  <td>{r.role}</td>
                  <td>{'●'.repeat(r.incomeBand)}{'○'.repeat(5 - r.incomeBand)}</td>
                  <td><span className="meter"><i style={{ width: `${r.network}%`, background: s.color }} /></span></td>
                  <td className="line">{r.narrative}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="sub">{sim.canonical.crossings.filter((c) => c.year === year).map((c) => `${c.selves.length} selves cross in ${PLACE_BY_ID[c.place].city}`).join('. ') || 'No crossings this year.'}</div>
      </Panel>

      {SELVES.slice(0, 4).map((s) => (
        <Panel key={s.id} title={s.name}><PathDistribution sim={sim} selfId={s.id} /></Panel>
      ))}

      <Panel title="Sources" wide>
        <ul className="sources">
          {live.sources.map((s) => (
            <li key={s.id}>
              <i className={'st ' + s.status} />
              <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
              <span>{s.status}{s.note ? `, ${s.note}` : ''}{s.at ? `, ${new Date(s.at).toLocaleTimeString()}` : ''}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
