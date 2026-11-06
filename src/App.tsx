import { useCallback, useEffect, useMemo, useState } from 'react'
import { CLOCK, ERAS, INDUSTRY_BY_ID, eraAt, eraBlend } from './data/eras'
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
import { CityView } from './views/CityView'
import { MapView } from './views/MapView'
import { TimelineView } from './views/TimelineView'
import { CardsView } from './views/CardsView'
import { SplitView } from './views/SplitView'
import { HowView } from './views/HowView'
import { DashboardView } from './views/DashboardView'

type View = 'globe' | 'city' | 'loom' | 'timeline' | 'cards' | 'split' | 'how' | 'dash'
const VIEWS: { id: View; label: string }[] = [
  { id: 'globe', label: 'Globe' },
  { id: 'city', label: 'City' },
  { id: 'loom', label: 'Loom' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'cards', label: 'Lives' },
  { id: 'split', label: 'Split' },
  { id: 'how', label: 'How it works' },
  { id: 'dash', label: 'Data' },
]
const STYLES: { id: VisualStyle; label: string }[] = [
  { id: 'cyanotype', label: 'Classic' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'void', label: 'Void' },
]

const params = new URLSearchParams(window.location.search)

function readStyle(): VisualStyle {
  const q = params.get('style')
  if (q === 'void' || q === 'cyanotype' || q === 'arcade') return q
  try {
    const s = localStorage.getItem('glp:style')
    return s === 'void' || s === 'arcade' ? s : 'cyanotype'
  } catch {
    return 'cyanotype'
  }
}

function useEraTheme() {
  const t = useClock((s) => Math.round(s.t * 20) / 20)
  useEffect(() => {
    const { a, b, k } = eraBlend(t)
    const stage = k < 0.5 ? a : b
    const root = document.documentElement.style
    stage.retro.palette.forEach((c, i) => root.setProperty(`--v${i}`, c))
    root.setProperty('--neon-accent', stage.neon.accent)
    const mix = (x: string, y: string) => {
      const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
      const A = p(x), B = p(y)
      return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`
    }
    root.setProperty('--key', mix(a.light.key, b.light.key))
    root.setProperty('--fill', mix(a.light.fill, b.light.fill))
    root.setProperty('--ground', mix(a.light.ground, b.light.ground))
  }, [t])
}

// Void and arcade type each line out like a game dialogue box
function Typewriter({ text, cps = 38 }: { text: string; cps?: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 1000 / cps)
    return () => clearInterval(id)
  }, [text, cps])
  return <>{text.slice(0, n)}<span className="cursor">{'█'}</span></>
}

const routeText = (route: string[]) => route.map((p) => PLACE_BY_ID[p].city).filter((c, i, a) => a.indexOf(c) === i).join(' → ')

function Chorus({ sim, focusId, style }: { sim: ReturnType<typeof simulate>; focusId: string | null; style: VisualStyle }) {
  const year = Math.min(CLOCK.end, useYear())
  const self = SELF_BY_ID[focusId ?? 'real']
  const row = sim.canonical.paths[self.id][year - CLOCK.start]
  const era = eraAt(year)
  const color = style === 'arcade' ? self.neon : self.color
  if (style !== 'cyanotype') {
    const stage = ERAS.indexOf(era) + 1
    const line = (row.event ? `${row.event.label.toUpperCase()}. ` : '') + row.narrative
    return (
      <div className={`chorus ${style}`} style={{ ['--c' as string]: color }}>
        <div className="chorus-era" key={era.id}>STAGE {stage} {'·'} {era.label.replace(/^The /, '').toUpperCase()} {'·'} {(style === 'arcade' ? era.neon.name : era.retro.name).toUpperCase()}</div>
        <div className="hud">
          <span className="who">{self.real ? 'P1' : 'GHOST'} {self.name.replace(/^The /, '').toUpperCase()}</span>
          <span>{year}{row.projected ? ' PROJECTED' : ''}</span>
          <span>{routeText(row.route).toUpperCase()}</span>
          <span>{row.role.toUpperCase()}</span>
          <span title="Income band, 1 to 5">{'■'.repeat(row.incomeBand)}{'□'.repeat(5 - row.incomeBand)}</span>
          <span>NET {String(row.network).padStart(3, '0')}</span>
        </div>
        <p className="chorus-line"><Typewriter text={line} key={`${self.id}-${year}`} /></p>
      </div>
    )
  }
  return (
    <div className="chorus" style={{ ['--c' as string]: color }}>
      <div className="chorus-era" key={era.id}>{era.label}</div>
      <div className="chorus-meta">
        <span className="who">{self.name}</span>
        <span>{year}{row.projected ? ', projected' : row.lived ? ', lived' : ''}</span>
        <span>{routeText(row.route)}</span>
        <span>{row.role}</span>
        <span>{INDUSTRY_BY_ID[row.industry].label}</span>
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
  const [portrait, setPortrait] = useState(window.innerHeight > window.innerWidth)
  useEraTheme()

  useEffect(() => { loadLand().then(setLand) }, [])
  useEffect(() => {
    try { localStorage.setItem('glp:style', style) } catch { /* private mode */ }
  }, [style])
  useEffect(() => {
    const on = () => setPortrait(window.innerHeight > window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  // URL hooks for capture: ?view=city&mode=tour&speed=0.3&cinema=1&style=arcade&focus=sto
  useEffect(() => {
    const v = params.get('view') as View | null
    if (v && VIEWS.some((x) => x.id === v)) setView(v)
    const m = params.get('mode') as CameraMode | null
    if (m === 'orbit' || m === 'follow' || m === 'tour') setMode(m)
    const sp = Number(params.get('speed'))
    if (sp > 0) clock.set({ speed: sp })
    const f = params.get('focus')
    if (f && SELF_BY_ID[f]) setFocusId(f)
  }, [])

  // Capture hooks: scripts/capture.mjs drives the app directly
  useEffect(() => {
    if (!params.has('capture')) return
    ;(window as unknown as { __app: unknown }).__app = { setFocus: setFocusId, setMode, setView, setStyle, setCinema }
  }, [])

  const weather = useMemo(() => buildWeather(live.signals), [live.signals])
  const sim = useMemo(() => simulate(weather, live.signals, 100, pivots), [weather, live.signals, pivots])

  // Tour: the camera hands itself from one self to the next
  useEffect(() => {
    if (mode !== 'tour') return
    let i = 0
    setFocusId(SELVES[0].id)
    const t = setInterval(() => { i = (i + 1) % SELVES.length; setFocusId(SELVES[i].id) }, Number(params.get('tourMs')) || 7000)
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
      if (e.key === 'a' || e.key === 'A') setStyle((s) => (s === 'arcade' ? 'cyanotype' : 'arcade'))
      if (e.key === 'c' || e.key === 'C') setStyle('cyanotype')
      if (e.key === 'h' || e.key === 'H') setCinema((c) => !c)
      if (e.key === 'o') setMode('orbit')
      if (e.key === 'f') setMode('follow')
      if (e.key === 't') setMode('tour')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const liveCount = live.sources.filter((s) => s.status === 'live' || s.status === 'cached' || s.status === 'snapshot').length
  const spatial = view === 'globe' || view === 'city' || view === 'loom'

  return (
    <div className={`app view-${view} style-${style}` + (style === 'void' ? ' void' : '') + (cinema ? ' cinema' : '') + (portrait ? ' portrait' : '') + (params.get('clean') === '1' ? ' clean' : '')}>
      <div className="stage">
        <div className="layer" style={{ visibility: view === 'globe' ? 'visible' : 'hidden' }}>
          <GlobeView sim={sim} weather={weather} land={land} live={live} mode={mode} focusId={focusId} active={view === 'globe'} onSelect={select} style={style} />
        </div>
        {view === 'city' && <div className="layer"><CityView sim={sim} weather={weather} live={live} focusId={focusId} style={style} mode={mode} /></div>}
        {view === 'loom' && <div className="layer"><MapView sim={sim} land={land} live={live} focusId={focusId} onSelect={select} style={style} /></div>}
        {view === 'timeline' && <div className="layer scroll"><TimelineView sim={sim} style={style} /></div>}
        {view === 'cards' && <div className="layer scroll"><CardsView sim={sim} /></div>}
        {view === 'split' && <div className="layer"><SplitView sim={sim} land={land} style={style} /></div>}
        {view === 'how' && <div className="layer scroll"><HowView sim={sim} live={live} focusId={focusId} /></div>}
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
          <div className="style-switch" title="Look: C classic, A arcade, V void">
            {STYLES.map((s) => (
              <button key={s.id} className={style === s.id ? 'on' : ''} onClick={() => setStyle(s.id)}>{s.label}</button>
            ))}
          </div>
          <div className="status" onClick={() => setView('dash')} title={live.asOf ? `Data snapshot ${live.asOf.slice(0, 10)}` : 'Live sources'}>
            <i className={'pulse' + (liveCount ? ' on' : '')} />
            {liveCount} of {live.sources.length} sources
          </div>
        </div>
      </header>

      {spatial && (
        <aside className="selves-bar">
          {SELVES.map((s) => (
            <button key={s.id} className={(focusId === s.id ? 'on ' : '') + (s.real ? 'real' : '')} style={{ ['--c' as string]: style === 'arcade' ? s.neon : s.color }} onClick={() => select(s.id)}>
              <i />{s.real ? 'The one who lived it' : s.name.replace(/^The /, '')}
            </button>
          ))}
          {(view === 'globe' || view === 'city') && (
            <div className="cam">
              {(['orbit', 'follow', 'tour'] as CameraMode[]).map((m) => (
                <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'orbit' ? 'Orbit' : m === 'follow' ? 'Follow' : 'Tour'}</button>
              ))}
            </div>
          )}
          <label className="toggle"><input type="checkbox" checked={pivots} onChange={(e) => setPivots(e.target.checked)} /> Allow pivots between forks</label>
        </aside>
      )}

      {spatial && <Chorus sim={sim} focusId={focusId} style={style} />}

      <footer className="bottom"><Scrubber weather={weather} /></footer>
      <Tooltip />

      {about && (
        <div className="drawer" onClick={() => setAbout(false)}>
          <div className="drawer-body about" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setAbout(false)}>Close</button>
            <h2>The Unlived Lives</h2>
            <p>One thread is the life that happened: USC in 2010, studio internships and DJing, touring between Los Angeles and Stockholm, venture capital through the pandemic, NYU ITP and IMA across New York, London, Berlin, Oslo and Shanghai, and now Los Angeles, New York and San Francisco.</p>
            <p>Every other thread is a ghost: the same person, with the same background, who stayed in one of those places at the moment she was there. Each ghost is an agent. They share one clock from 2010 to 2031 and one world, so they meet in cities, pull on each other's choices, and pivot when an industry turns.</p>
            <p>The weather is data. Each industry gets one number per year, made from an authored era baseline and bent by real signals: Wikipedia attention per industry, World Bank GDP growth, inflation and internet use for every country in the story. Hover any cell or any year to see the receipts.</p>
            <p>Three looks: Classic (cyanotype light), Arcade (neon wireframe) and Void (a dithered retro console). The piece observes; it does not rank.</p>
            <p className="keys">Space plays and pauses. Arrow keys step a year. Keys 1 to 8 switch views. C, A and V pick the look. O, F and T pick the camera. H hides the interface for capture. Escape clears focus.</p>
          </div>
        </div>
      )}
    </div>
  )
}
