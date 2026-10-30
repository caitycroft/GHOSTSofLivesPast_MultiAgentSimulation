import { useCallback, useEffect, useMemo, useState } from 'react'
import { CLOCK, ERAS, INDUSTRIES, eraAt, eraBlend } from './data/eras'
import { PLACE_BY_ID } from './data/places'
import { SELVES, SELF_BY_ID } from './data/selves'
import { clock, useClock, useYear } from './lib/clock'
import { loadLand, type LandData } from './lib/geo'
import { useLive } from './live/useLive'
import { simulate } from './sim/engine'
import { buildWeather } from './sim/weather'
import { Scrubber } from './ui/Scrubber'
import { Tooltip } from './ui/tooltip'
import type { CameraMode, VisualStyle } from './globe/GlobeScene'
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

const params = new URLSearchParams(window.location.search)

function readStyle(): VisualStyle {
  const q = params.get('style')
  if (q === 'void' || q === 'cyanotype') return q
  try {
    return localStorage.getItem('glp:style') === 'void' ? 'void' : 'cyanotype'
  } catch {
    return 'cyanotype'
  }
}

function useEraTheme() {
  const t = useClock((s) => Math.round(s.t * 20) / 20)
  useEffect(() => {
    const { a, b, k } = eraBlend(t)
    const pal = (k < 0.5 ? a : b).retro.palette
    pal.forEach((c, i) => document.documentElement.style.setProperty(`--v${i}`, c))
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

// Void mode types each line out like a game dialogue box
function Typewriter({ text, cps = 38 }: { text: string; cps?: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 1000 / cps)
    return () => clearInterval(id)
  }, [text, cps])
  return <>{text.slice(0, n)}<span className="cursor">{'\u2588'}</span></>
}

function Chorus({ sim, focusId, style }: { sim: ReturnType<typeof simulate>; focusId: string | null; style: VisualStyle }) {
  const year = Math.min(CLOCK.end, useYear())
  const self = SELF_BY_ID[focusId ?? 'real']
  const row = sim.canonical.paths[self.id][year - CLOCK.start]
  const era = eraAt(year)
  if (style === 'void') {
    const stage = ERAS.indexOf(era) + 1
    const line = (row.event ? `${row.event.label.toUpperCase()}. ` : '') + row.narrative
    return (
      <div className="chorus void" style={{ ['--c' as string]: self.color }}>
        <div className="chorus-era" key={era.id}>STAGE {stage} {'\u00b7'} {era.label.replace(/^The /, '').toUpperCase()} {'\u00b7'} {era.retro.name.toUpperCase()}</div>
        <div className="hud">
          <span className="who">{self.real ? 'P1' : 'GHOST'} {self.name.replace(/^The /, '').toUpperCase()}</span>
          <span>LV {row.age}</span>
          <span>{PLACE_BY_ID[row.place].city.toUpperCase()}</span>
          <span>{row.role.toUpperCase()}</span>
          <span title="Income band, 1 to 5">{'\u25a0'.repeat(row.incomeBand)}{'\u25a1'.repeat(5 - row.incomeBand)}</span>
          <span>NET {String(row.network).padStart(3, '0')}</span>
        </div>
        <p className="chorus-line"><Typewriter text={line} key={`${self.id}-${year}`} /></p>
      </div>
    )
  }
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
  const [style, setStyle] = useState<VisualStyle>(readStyle)
  const [cinema, setCinema] = useState(params.get('cinema') === '1')
  useEraTheme()

  useEffect(() => {
    try { localStorage.setItem('glp:style', style) } catch { /* private mode */ }
  }, [style])

  // URL hooks for capture: ?view=loom&mode=tour&speed=0.3&cinema=1&style=void
  useEffect(() => {
    const v = params.get('view') as View | null
    if (v && VIEWS.some((x) => x.id === v)) setView(v)
    const m = params.get('mode') as CameraMode | null
    if (m === 'orbit' || m === 'follow' || m === 'tour') setMode(m)
    const sp = Number(params.get('speed'))
    if (sp > 0) clock.set({ speed: sp })
  }, [])

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
      if (e.key === 'v' || e.key === 'V') setStyle((s) => (s === 'void' ? 'cyanotype' : 'void'))
      if (e.key === 'h' || e.key === 'H') setCinema((c) => !c)
      if (e.key === 'o') setMode('orbit')
      if (e.key === 'f') setMode('follow')
      if (e.key === 't') setMode('tour')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const liveCount = live.sources.filter((s) => s.status === 'live' || s.status === 'cached').length

  return (
    <div className={`app view-${view}` + (style === 'void' ? ' void' : '') + (cinema ? ' cinema' : '')}>
      <div className="stage">
        <div className="layer" style={{ visibility: view === 'globe' ? 'visible' : 'hidden' }}>
          <GlobeView sim={sim} land={land} live={live} mode={mode} focusId={focusId} active={view === 'globe'} onSelect={select} style={style} />
        </div>
        {view === 'loom' && <div className="layer"><MapView sim={sim} land={land} live={live} focusId={focusId} onSelect={select} style={style} /></div>}
        {view === 'cards' && <div className="layer scroll"><CardsView sim={sim} /></div>}
        {view === 'split' && <div className="layer"><SplitView sim={sim} land={land} style={style} /></div>}
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
        <div className="top-right">
          <button className={'void-toggle' + (style === 'void' ? ' on' : '')} onClick={() => setStyle((s) => (s === 'void' ? 'cyanotype' : 'void'))} title="Retro void mode (V)">
            <i />Void
          </button>
          <div className="status" onClick={() => setView('dash')} title="Live sources">
            <i className={'pulse' + (liveCount ? ' on' : '')} />
            {liveCount} of {live.sources.length} live
          </div>
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

      {(view === 'globe' || view === 'loom') && <Chorus sim={sim} focusId={focusId} style={style} />}

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
            <p>Void mode (V) swaps the cyanotype light for a retro console look: pixel blocks, ordered dithering and scanlines, with each era given its own four colour palette like a new stage.</p>
            <p className="keys">Space plays and pauses. Arrow keys step a year. Keys 1 to 5 switch views. V toggles void mode. O, F and T pick the camera. H hides the interface for capture. Escape clears focus.</p>
          </div>
        </div>
      )}
    </div>
  )
}
