import { useCallback, useEffect, useMemo, useState } from 'react'
import { CLOCK, INDUSTRIES, eraAt, eraBlend } from './data/eras'
import { PLACE_BY_ID } from './data/places'
import { SELVES, SELF_BY_ID } from './data/selves'
import { clock, useClock, useYear } from './lib/clock'
import { loadLand, type LandData } from './lib/geo'
import { useLive } from './live/useLive'
import { simulate } from './sim/engine'
import { buildWeather } from './sim/weather'
import { Scrubber } from './ui/Scrubber'
import { Tooltip } from './ui/tooltip'
import type { CameraMode } from './globe/GlobeScene'
import { GlobeView } from './views/GlobeView'
import { MapView } from './views/MapView'
import { CardsView } from './views/CardsView'
import { SplitView } from './views/SplitView'
import { DashboardView } from './views/DashboardView'

type View = 'globe' | 'loom' | 'cards' | 'split' | 'dash'
const VIEWS: { id: View; label: string }[] = [
  { id: 'globe', label: 'Flythrough' },
  { id: 'loom', label: 'Loom' },
  { id: 'cards', label: 'Life cards' },
  { id: 'split', label: 'Split' },
  { id: 'dash', label: 'Dashboard' },
]

function useEraTheme() {
  const t = useClock((s) => Math.round(s.t * 20) / 20)
  useEffect(() => {
    const { a, b, k } = eraBlend(t)
    const mix = (x: string, y: string) => {
      const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
      const A = p(x), B = p(y)
      return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`
    }
    const root = document.documentElement.style
    root.setProperty('--key', mix(a.light.key, b.light.key))
    root.setProperty('--fill', mix(a.light.fill, b.light.fill))
    root.setProperty('--ground', mix(a.light.ground, b.light.ground))
  }, [t])
}

function Chorus({ sim, focusId }: { sim: ReturnType<typeof simulate>; focusId: string | null }) {
  const year = Math.min(CLOCK.end, useYear())
  const self = SELF_BY_ID[focusId ?? 'real']
  const row = sim.canonical.paths[self.id][year - CLOCK.start]
  const era = eraAt(year)
  return (
    <div className="chorus" style={{ ['--c' as string]: self.color }}>
      <div className="chorus-era" key={era.id}>{era.label}</div>
      <div className="chorus-meta">
        <span className="who">{self.name}</span>
        <span>{year}, age {row.age}</span>
        <span>{PLACE_BY_ID[row.place].city}</span>
        <span>{row.role}</span>
        <span>{INDUSTRIES.find((i) => i.id === row.industry)!.label}</span>
        <span title="Income band, 1 to 5">{'●'.repeat(row.incomeBand)}{'○'.repeat(5 - row.incomeBand)}</span>
      </div>
      <p className="chorus-line" key={`${self.id}-${year}`}>{row.event ? <b className="evt">{row.event.glyph} {row.event.label}. </b> : null}{row.narrative}</p>
    </div>
  )
}

export default function App() {
  const live = useLive()
  const [land, setLand] = useState<LandData | null>(null)
  const [view, setView] = useState<View>('globe')
  const [mode, setMode] = useState<CameraMode>('orbit')
  const [focusId, setFocusId] = useState<string | null>(null)
  const [pivots, setPivots] = useState(true)
  const [about, setAbout] = useState(false)
  useEraTheme()

  useEffect(() => { loadLand().then(setLand) }, [])

  const weather = useMemo(() => buildWeather(live.signals), [live.signals])
  const sim = useMemo(() => simulate(weather, live.signals, 100, pivots), [weather, live.signals, pivots])

  // Tour: the camera hands itself from one self to the next
  useEffect(() => {
    if (mode !== 'tour') return
    let i = 0
    setFocusId(SELVES[0].id)
    const t = setInterval(() => { i = (i + 1) % SELVES.length; setFocusId(SELVES[i].id) }, 7000)
    return () => clearInterval(t)
  }, [mode])

  const select = useCallback((id: string) => {
    setFocusId((f) => (f === id ? null : id))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') return
      if (e.code === 'Space') { e.preventDefault(); const s = clock.get(); clock.set({ playing: !s.playing, t: s.t >= CLOCK.end ? CLOCK.start : s.t }) }
      if (e.key === 'ArrowRight') clock.set({ t: Math.floor(clock.get().t) + 1, playing: false })
      if (e.key === 'ArrowLeft') clock.set({ t: Math.ceil(clock.get().t) - 1, playing: false })
      const n = Number(e.key)
      if (n >= 1 && n <= VIEWS.length) setView(VIEWS[n - 1].id)
      if (e.key === 'Escape') setFocusId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const liveCount = live.sources.filter((s) => s.status === 'live' || s.status === 'cached').length

  return (
    <div className={`app view-${view}`}>
      <div className="stage">
        <div className="layer" style={{ visibility: view === 'globe' ? 'visible' : 'hidden' }}>
          <GlobeView sim={sim} land={land} live={live} mode={mode} focusId={focusId} active={view === 'globe'} onSelect={select} />
        </div>
        {view === 'loom' && <div className="layer"><MapView sim={sim} land={land} live={live} focusId={focusId} onSelect={select} /></div>}
        {view === 'cards' && <div className="layer scroll"><CardsView sim={sim} /></div>}
        {view === 'split' && <div className="layer"><SplitView sim={sim} land={land} /></div>}
        {view === 'dash' && <div className="layer scroll"><DashboardView sim={sim} weather={weather} live={live} /></div>}
      </div>

      <header className="top">
        <div className="brand" onClick={() => setAbout(true)}>
          <div className="title">Ghosts of Lives Past</div>
          <div className="subtitle">The Unlived Lives, a multi agent simulation</div>
        </div>
        <nav className="tabs">
          {VIEWS.map((v, i) => (
            <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)} title={`Key ${i + 1}`}>{v.label}</button>
          ))}
        </nav>
        <div className="status" onClick={() => setView('dash')} title="Live sources">
          <i className={'pulse' + (liveCount ? ' on' : '')} />
          {liveCount} of {live.sources.length} live sources
        </div>
      </header>

      {(view === 'globe' || view === 'loom') && (
        <aside className="selves-bar">
          {SELVES.map((s) => (
            <button key={s.id} className={(focusId === s.id ? 'on ' : '') + (s.real ? 'real' : '')} style={{ ['--c' as string]: s.color }} onClick={() => select(s.id)}>
              <i />{s.real ? 'The one who lived it' : s.name.replace(/^The /, '')}
            </button>
          ))}
          {view === 'globe' && (
            <div className="cam">
              {(['orbit', 'follow', 'tour'] as CameraMode[]).map((m) => (
                <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'orbit' ? 'Orbit' : m === 'follow' ? 'Follow' : 'Tour'}</button>
              ))}
            </div>
          )}
          <label className="toggle"><input type="checkbox" checked={pivots} onChange={(e) => setPivots(e.target.checked)} /> Allow pivots between choices</label>
        </aside>
      )}

      {(view === 'globe' || view === 'loom') && <Chorus sim={sim} focusId={focusId} />}

      <footer className="bottom"><Scrubber weather={weather} /></footer>
      <Tooltip />

      {about && (
        <div className="drawer" onClick={() => setAbout(false)}>
          <div className="drawer-body about" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setAbout(false)}>Close</button>
            <h2>The Unlived Lives</h2>
            <p>Eight versions of one person, one for each place, each making three real choices at eighteen, twenty five and thirty inside the actual timeline of the industries they lived through. Every self is an agent. They share one clock from 2008 to 2031 and one world, so they meet in cities, pull on each other's choices, and drift when the weather turns.</p>
            <p>The weather is data. Each industry gets one number per year, made from an authored era baseline and bent by live signals: Wikipedia attention per industry, World Bank world GDP growth, and how much of each country is online. Hover any cell on the dashboard or any year on the scrubber to see the receipts.</p>
            <p>The planet is live. The day and night line comes from the real position of the sun, the pulses are the last day of USGS earthquakes, the white point is the International Space Station, and the dashboard holds the current weather in every city in the cast.</p>
            <p>The bright warm thread is the life that happened. The blue threads are the others. The faint clouds are every place each self landed across a hundred runs. The piece observes; it does not rank.</p>
            <p className="keys">Space plays and pauses. Arrow keys step a year. Keys 1 to 5 switch views. Escape clears focus.</p>
          </div>
        </div>
      )}
    </div>
  )
}
