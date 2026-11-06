import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CLOCK, INDUSTRY_BY_ID, eraAt, eraBlend, type IndustryId } from '../data/eras'
import { EVENTS, EVENT_KINDS } from '../data/events'
import { PLACE_BY_ID } from '../data/places'
import { SELVES, SELF_BY_ID } from '../data/selves'
import type { SimResult } from '../sim/engine'
import { placeAt } from '../sim/route'
import { localMacro, type LiveSignals, type WeatherTable } from '../sim/weather'
import { FinishShader, RetroShader, type VisualStyle } from '../globe/GlobeScene'

// The City: the simulation as a world you fly through. Time is distance (one
// year is L units of street), the street becomes whatever city the focused
// life is in, gantries mark the years, billboards carry the world's events
// and the data receipts, and every self is a hover ship. Ships share the
// street while their lives share a city; when lives part, a ship peels off.
// A diorama camera rises into an isometric view of the current city.

export type CityCam = 'street' | 'diorama' | 'auto'

const L = 120
const CHUNK = 30
const AHEAD = 22 // chunks generated ahead of the camera
const BEHIND = 3
const zOf = (t: number) => -(t - CLOCK.start) * L
const tOf = (z: number) => CLOCK.start - z / L
const PIXEL = '"Press Start 2P", monospace'

type Palette = { bg: string; fog: string; fill: string; streak: string; edge: string; edge2: string; grid: string; gridOff: string; border: string; rail: string; window: string; text: string; sign: string; signBg: string; band: string }

function palette(style: VisualStyle, t: number): Palette {
  const { a, b, k } = eraBlend(t)
  const era = k < 0.5 ? a : b
  if (style === 'arcade')
    return { bg: '#000000', fog: era.neon.sky, fill: '#0b0730', streak: '#3a2fb0', edge: '#ff2fd0', edge2: '#38f3ff', grid: '#3dff7a', gridOff: '#123a22', border: '#ff2fd0', rail: '#38f3ff', window: '#ffffff', text: '#38f3ff', sign: era.neon.accent, signBg: '#05010d', band: '#7dfff0' }
  if (style === 'void') {
    const p = era.retro.palette
    return { bg: '#000000', fog: '#000000', fill: p[1], streak: p[2], edge: p[3], edge2: p[2], grid: p[2], gridOff: p[1], border: p[3], rail: p[2], window: p[3], text: p[3], sign: p[3], signBg: '#000000', band: p[3] }
  }
  return { bg: '#040a1a', fog: '#06102a', fill: '#0b1838', streak: '#1b3a72', edge: '#cfe6ff', edge2: '#7cc4ff', grid: '#5aa9ff', gridOff: '#10264a', border: era.light.key, rail: '#9fd8ff', window: '#ffe2b0', text: '#e9f1ff', sign: era.light.key, signBg: '#06102a', band: '#9fd8ff' }
}

// Deterministic randomness per chunk and building
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0

type Kind = 'stage' | 'rings' | 'glass' | 'spire' | 'house'
const KIND_OF: Record<IndustryId, Kind> = { film: 'stage', music: 'rings', platforms: 'glass', venture: 'glass', ai: 'glass', web3: 'glass', xr: 'spire', worldmodels: 'spire', local: 'house' }

interface Built { fills: THREE.BufferGeometry[]; edges: number[]; bands: THREE.BufferGeometry[]; windows: number[] }

function scaleUV(g: THREE.BufferGeometry, u: number, v: number) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v)
  return g
}

function addPart(out: Built, g: THREE.BufferGeometry, uvScale: [number, number]) {
  out.fills.push(scaleUV(g, uvScale[0], uvScale[1]))
  const e = new THREE.EdgesGeometry(g, 25)
  out.edges.push(...(e.getAttribute('position').array as Float32Array))
  e.dispose()
}

function box(out: Built, w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y + h / 2, z)
  addPart(out, g, [Math.max(1, w / 5), Math.max(1, h / 5)])
}

function cylinder(out: Built, r: number, h: number, x: number, y: number, z: number, seg = 14) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1)
  g.translate(x, y + h / 2, z)
  addPart(out, g, [Math.max(1, r), Math.max(1, h / 5)])
}

function windowsOn(out: Built, x: number, faceX: number, y0: number, y1: number, z0: number, z1: number, rnd: () => number) {
  for (let y = y0 + 2; y < y1 - 1; y += 2.2) {
    if (rnd() < 0.25) continue
    for (let z = z0 + 1; z < z1 - 0.5; z += 1.6) if (rnd() < 0.7) out.windows.push(faceX, y, z)
  }
  void x
}

function building(out: Built, kind: Kind, side: number, x0: number, z0: number, depth: number, scale: number, rnd: () => number) {
  const w = 6 + rnd() * 10
  const x = side * (x0 + w / 2)
  const zc = z0 - depth / 2
  const face = side * x0
  if (kind === 'stage') {
    // Soundstage: long low hall with a curved roof hint and a marquee block
    const h = (6 + rnd() * 5) * scale
    box(out, w, h, depth * 0.95, x, 0, zc)
    box(out, w * 0.6, 1.2, depth * 0.6, x, h, zc)
    if (rnd() < 0.5) box(out, 2.5, h * 1.8, 2.5, x - side * w * 0.3, 0, zc - depth * 0.3)
  } else if (kind === 'rings') {
    // Music: round towers with glowing bands
    const r = 1.8 + rnd() * 2
    const h = (14 + rnd() * 26) * scale
    cylinder(out, r, h, x, 0, zc)
    const n = 2 + Math.floor(rnd() * 3)
    for (let i = 0; i < n; i++) {
      const g = new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.9, 16, 1, true)
      g.translate(x, h * (0.3 + 0.5 * (i / n)) + rnd() * 2, zc)
      out.bands.push(g)
    }
    if (rnd() < 0.6) cylinder(out, r * 0.7, h * 0.65, x + side * r * 1.6, 0, zc - r * 1.2)
  } else if (kind === 'glass') {
    // Towers with setbacks and window grids
    const h = (18 + rnd() * 34) * scale
    box(out, w, h, depth * 0.85, x, 0, zc)
    box(out, w * 0.7, h * 0.35, depth * 0.6, x, h, zc)
    if (rnd() < 0.5) box(out, w * 0.4, h * 0.2, depth * 0.4, x, h * 1.35, zc)
    windowsOn(out, x, face - side * 0.05, 0, h, zc - depth * 0.42, zc + depth * 0.42, rnd)
  } else if (kind === 'spire') {
    // XR and world models: stacked, offset blocks and a needle
    let y = 0
    let ww = w * 0.8
    const tiers = 3 + Math.floor(rnd() * 3)
    for (let i = 0; i < tiers; i++) {
      const h = (6 + rnd() * 8) * scale
      box(out, ww, h, ww, x + (rnd() - 0.5) * 1.5, y, zc)
      y += h
      ww *= 0.75
    }
    box(out, 0.4, 8 * scale, 0.4, x, y, zc)
    windowsOn(out, x, face - side * 0.05, 0, y * 0.5, zc - 2, zc + 2, rnd)
  } else {
    // Local: low houses with pitched roofs
    const h = 4 + rnd() * 3
    box(out, w * 0.8, h, depth * 0.7, x, 0, zc)
    const roof = new THREE.CylinderGeometry(0.01, w * 0.55, 2.4, 4, 1)
    roof.rotateY(Math.PI / 4)
    roof.translate(x, h + 1.2, zc)
    addPart(out, roof, [1, 1])
  }
}

function canvasSign(lines: { text: string; size: number; color: string }[], w: number, h: number, bg: string, border: string, pixel: boolean) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.strokeStyle = border
  g.lineWidth = Math.max(4, h * 0.03)
  g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2)
  let y = h * 0.12
  for (const l of lines) {
    g.fillStyle = l.color
    g.font = pixel ? `${l.size}px ${PIXEL}` : `bold ${l.size}px Arial, sans-serif`
    g.textBaseline = 'top'
    // shrink to fit
    let size = l.size
    while (g.measureText(l.text).width > w * 0.9 && size > 8) {
      size -= 2
      g.font = pixel ? `${size}px ${PIXEL}` : `bold ${size}px Arial, sans-serif`
    }
    g.fillText(l.text, w * 0.05, y)
    y += size * 1.45
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const floorVert = /* glsl */ `
  varying vec3 vW;
  #include <fog_pars_vertex>
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`
const floorFrag = /* glsl */ `
  uniform vec3 uGrid;
  uniform vec3 uGridOff;
  uniform vec3 uBorder;
  uniform vec3 uRail;
  uniform float uTile;
  uniform vec3 uTileCenter;
  varying vec3 vW;
  #include <fog_pars_fragment>
  float gridLine(vec2 p, float spacing, float width) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
    vec2 fw = fwidth(p);
    vec2 l = 1.0 - smoothstep(vec2(0.0), fw * width, g);
    return max(l.x, l.y);
  }
  void main() {
    float street = 1.0 - step(10.0, abs(vW.x));
    float g = gridLine(vW.xz, 4.0, 1.5);
    vec3 col = mix(uGridOff, uGrid, street) * g;
    float edge = 1.0 - smoothstep(0.0, 0.35, abs(abs(vW.x) - 10.0));
    float walk = 1.0 - smoothstep(0.0, 0.25, abs(abs(vW.x) - 12.0));
    col += uBorder * edge * 1.6 + uRail * walk * 0.9;
    // Diorama tile: a bordered square around the current city
    vec2 d = abs(vW.xz - uTileCenter.xz);
    float tile = (1.0 - smoothstep(0.0, 0.5, abs(max(d.x, d.y) - 70.0))) * uTile;
    col += uBorder * tile * 1.8;
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`

const glowTex = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.25, 'rgba(255,255,255,0.6)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
})()

interface Ship { id: string; group: THREE.Group; edges: LineMaterial; flame: THREE.SpriteMaterial; label: HTMLDivElement; p: number; pos: THREE.Vector3; split: boolean }
interface Chunk { index: number; group: THREE.Group; dispose: () => void }

export class CityScene {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000)
  composer: EffectComposer
  bloom: UnrealBloomPass
  finish: ShaderPass
  retro: ShaderPass
  overlay: HTMLDivElement
  style: VisualStyle = 'arcade'
  cam: CityCam = 'auto'
  focusId = 'real'
  onPlace?: (placeId: string) => void
  onDiorama?: (on: boolean) => void

  private sim?: SimResult
  private weather?: WeatherTable
  private signals?: LiveSignals
  private chunks = new Map<number, Chunk>()
  private ships: Ship[] = []
  private floor: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private lineMats: LineMaterial[] = []
  private t = CLOCK.start
  private raf = 0
  private ro: ResizeObserver
  private clock = new THREE.Clock()
  private pixel = Math.min(window.devicePixelRatio, 2)
  private active = true
  private ready = false
  private place = ''
  private dio = 0
  private dioShown = false
  private camPos = new THREE.Vector3(0, 8, 20)
  private camLook = new THREE.Vector3(0, 4, -40)
  private styleKey = ''
  private minFrameMs = new URLSearchParams(window.location.search).has('capture') ? 25 : 0
  private lastRender = -Infinity
  private camStart = performance.now()

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(this.pixel)
    host.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.display = 'block'
    this.overlay = document.createElement('div')
    this.overlay.className = 'globe-overlay city-overlay'
    host.appendChild(this.overlay)

    this.scene.fog = new THREE.FogExp2(0x000000, 0.0045)
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 2400),
      new THREE.ShaderMaterial({
        vertexShader: floorVert,
        fragmentShader: floorFrag,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          { uGrid: { value: new THREE.Color() }, uGridOff: { value: new THREE.Color() }, uBorder: { value: new THREE.Color() }, uRail: { value: new THREE.Color() }, uTile: { value: 0 }, uTileCenter: { value: new THREE.Vector3() } },
        ]),
        fog: true,
      }),
    )
    this.floor.rotation.x = -Math.PI / 2
    this.scene.add(this.floor)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.1, 0.5, 0.08)
    this.composer.addPass(this.bloom)
    this.finish = new ShaderPass(FinishShader)
    this.composer.addPass(this.finish)
    this.retro = new ShaderPass(RetroShader)
    this.retro.enabled = false
    this.composer.addPass(this.retro)
    this.composer.addPass(new OutputPass())

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.resize()
    document.fonts.load(`32px ${PIXEL}`).finally(() => {
      this.ready = true
      this.rebuild()
    })
    this.loop()
  }

  // ------------------------------------------------------------ inputs
  setData(sim: SimResult, weather: WeatherTable, signals: LiveSignals) {
    this.sim = sim
    this.weather = weather
    this.signals = signals
    this.rebuild()
  }

  setStyle(style: VisualStyle) {
    if (style === this.style) return
    this.style = style
    this.rebuild()
  }

  setFocus(id: string | null) {
    const next = id ?? 'real'
    if (next === this.focusId) return
    this.focusId = next
    this.rebuild()
  }

  setCam(cam: CityCam) {
    this.cam = cam
    this.camStart = performance.now()
  }

  setYear(t: number) {
    this.t = t
  }

  setActive(on: boolean) {
    this.active = on
    this.clock.getDelta()
  }

  // ------------------------------------------------------------ building
  private lineMat(color: string, width: number, opacity = 1) {
    const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: opacity < 1, opacity, fog: true } as never)
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    m.resolution.set(size.x, size.y)
    this.lineMats.push(m)
    return m
  }

  private rebuild() {
    if (!this.ready || !this.sim) return
    for (const c of this.chunks.values()) c.dispose()
    this.chunks.clear()
    for (const s of this.ships) {
      this.scene.remove(s.group)
      s.label.remove()
      s.group.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        ;(m.material as THREE.Material | undefined)?.dispose?.()
      })
    }
    this.ships = []
    this.lineMats = []
    this.styleKey = ''
    this.buildShips()
  }

  private paletteNow() {
    return palette(this.style, this.t)
  }

  private buildChunk(index: number): Chunk {
    const sim = this.sim!
    const pal = palette(this.style, tOf(-index * CHUNK))
    const rows = sim.canonical.paths[this.focusId]
    const z0 = -index * CHUNK
    const tMid = tOf(z0 - CHUNK / 2)
    const group = new THREE.Group()
    const disposables: { dispose: () => void }[] = []
    const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x)
    const pixel = this.style !== 'cyanotype'

    if (tMid >= CLOCK.start && tMid <= CLOCK.end + 1) {
      const placeId = placeAt(rows, Math.min(tMid, CLOCK.end + 0.99))
      const place = PLACE_BY_ID[placeId]
      const year = Math.min(CLOCK.end, Math.floor(tMid))
      const conn = sim.connection[placeId]?.[year]?.value ?? 2.5
      const scale = 0.55 + conn * 0.22
      const inds = (Object.entries(place.industries) as [IndustryId, number][]).filter(([, v]) => v > 0)
      const total = inds.reduce((s, [, v]) => s + v, 0) || 1
      const rnd = rng(hash(`${placeId}:${index}`))
      const pick = (): Kind => {
        let r = rnd() * total
        for (const [id, v] of inds) { r -= v; if (r <= 0) return KIND_OF[id] }
        return 'glass'
      }
      const out: Built = { fills: [], edges: [], bands: [], windows: [] }
      for (const side of [-1, 1]) {
        let z = z0
        while (z > z0 - CHUNK) {
          const depth = 6 + rnd() * 8
          if (rnd() < 0.12) { z -= depth * 0.6; continue } // an alley
          building(out, place.kind === 'waypoint' ? 'house' : pick(), side, 12.5 + rnd() * 3, z, depth, scale, rnd)
          z -= depth + 1.5
        }
      }
      if (out.fills.length) {
        const fill = keep(mergeGeometries(out.fills.map((g) => (g.index ? g.toNonIndexed() : g)), false)!)
        out.fills.forEach((g) => g.dispose())
        const tex = keep(streakTexture(pal.fill, pal.streak))
        const fm = keep(new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }))
        group.add(new THREE.Mesh(fill, fm))
        const lg = keep(new LineSegmentsGeometry().setPositions(out.edges))
        group.add(new LineSegments2(lg, this.lineMat(pal.edge, this.style === 'cyanotype' ? 1.2 : 1.8)))
      }
      if (out.bands.length) {
        const bg = keep(mergeGeometries(out.bands.map((g) => g.toNonIndexed()), false)!)
        out.bands.forEach((g) => g.dispose())
        group.add(new THREE.Mesh(bg, keep(new THREE.MeshBasicMaterial({ color: pal.band, side: THREE.DoubleSide, fog: true }))))
      }
      if (out.windows.length) {
        const wg = keep(new THREE.BufferGeometry())
        wg.setAttribute('position', new THREE.Float32BufferAttribute(out.windows, 3))
        group.add(new THREE.Points(wg, keep(new THREE.PointsMaterial({ color: pal.window, size: 0.35, sizeAttenuation: true, fog: true }))))
      }

      // A gantry at every year line, with the year, the city and the era
      const yearLine = Math.ceil(tOf(z0))
      if (zOf(yearLine) <= z0 && zOf(yearLine) > z0 - CHUNK && yearLine <= CLOCK.end) this.gantry(group, keep, yearLine, rows, pal, pixel)

      // Billboards for the world's events, placed by month
      for (const e of EVENTS) {
        if (e.kind === 'life') continue
        const te = e.year + ((e.month ?? 6) - 1) / 12
        const ze = zOf(te)
        if (ze > z0 || ze <= z0 - CHUNK) continue
        const side = hash(e.label) % 2 ? 1 : -1
        const kind = EVENT_KINDS.find((k) => k.id === e.kind)!
        const tex = keep(canvasSign([
          { text: `${kind.label.toUpperCase()} · ${e.year}`, size: 30, color: kind.color },
          { text: e.label.toUpperCase(), size: 54, color: pal.text },
        ], 1024, 300, pal.signBg, kind.color, pixel))
        this.billboard(group, keep, tex, side * 10.6, 8.5, ze, 9.5, 2.8, pal)
      }

      // The receipts, as billboards: the local economy and the industry weather
      if (this.signals && this.weather) {
        const zr = zOf(year + 0.45)
        if (zr <= z0 && zr > z0 - CHUNK) {
          const m = localMacro(place.iso3, year, this.signals)
          const lines = [{ text: `${place.country.toUpperCase()} \u00b7 ${year}`, size: 30, color: pal.sign }]
          if (m.gdp) lines.push({ text: `GDP ${m.gdp.value >= 0 ? '+' : ''}${m.gdp.value.toFixed(1)}%  (${m.gdp.year})`, size: 46, color: pal.text })
          if (m.inflation) lines.push({ text: `INFLATION ${m.inflation.value.toFixed(1)}%`, size: 36, color: pal.text })
          lines.push({ text: 'SOURCE: WORLD BANK', size: 24, color: pal.edge2 })
          if (m.gdp || m.inflation) this.billboard(group, keep, keep(canvasSign(lines, 1024, 420, pal.signBg, pal.edge2, pixel)), 24, 21, zr, 11, 4.5, pal, true)
        }
        const zw = zOf(year + 0.72)
        if (zw <= z0 && zw > z0 - CHUNK) {
          const wrow = this.weather[year]
          const top = [...inds].sort((a, b) => b[1] - a[1]).slice(0, 3)
          const wl = [{ text: `INDUSTRY WEATHER \u00b7 ${place.city.toUpperCase()}`, size: 28, color: pal.sign }]
          for (const [id] of top) wl.push({ text: `${INDUSTRY_BY_ID[id].short.toUpperCase()} ${wrow[id].value >= 0 ? '\u25b2' : '\u25bc'} ${wrow[id].value >= 0 ? '+' : ''}${wrow[id].value.toFixed(2)}`, size: 42, color: INDUSTRY_BY_ID[id].color })
          this.billboard(group, keep, keep(canvasSign(wl, 1024, 420, pal.signBg, pal.edge, pixel)), -24, 21, zw, 11, 4.5, pal, true)
        }
      }

      // Fork signs: where a ghost leaves this street
      for (const g of SELVES) {
        if (!g.fork || this.focusId !== 'real') continue
        const zf = zOf(g.fork.year + 0.08 + (hash(g.id) % 5) * 0.05)
        if (zf > z0 || zf <= z0 - CHUNK) continue
        const tex = keep(canvasSign([
          { text: `FORK · ${g.fork.year}`, size: 30, color: g.neon },
          { text: g.name.replace(/^The /, '').toUpperCase(), size: 50, color: pixel ? g.neon : '#ffffff' },
          { text: g.fork.note.toUpperCase(), size: 28, color: pal.text },
        ], 1024, 340, pal.signBg, g.neon, pixel))
        this.billboard(group, keep, tex, (hash(g.id) % 2 ? 1 : -1) * 15, 3.6, zf, 8, 2.7, pal)
      }
    }

    this.scene.add(group)
    return {
      index,
      group,
      dispose: () => {
        this.scene.remove(group)
        group.traverse((o) => {
          const l = o as LineSegments2
          if (l.isLineSegments2) {
            const i = this.lineMats.indexOf(l.material as LineMaterial)
            if (i > -1) this.lineMats.splice(i, 1)
            ;(l.material as LineMaterial).dispose()
          }
        })
        disposables.forEach((d) => d.dispose())
      },
    }
  }

  private billboard(group: THREE.Group, keep: <T extends { dispose: () => void }>(x: T) => T, tex: THREE.Texture, x: number, y: number, z: number, w: number, h: number, pal: Palette, onWall = false) {
    const plane = keep(new THREE.PlaneGeometry(w, h))
    const mesh = new THREE.Mesh(plane, keep(new THREE.MeshBasicMaterial({ map: tex, fog: true, side: THREE.DoubleSide })))
    mesh.position.set(x, y, z)
    if (onWall) mesh.rotation.y = x > 0 ? -0.55 : 0.55
    group.add(mesh)
    if (!onWall) {
      const pole = keep(new LineSegmentsGeometry().setPositions([x, 0, z, x, y - h / 2, z]))
      group.add(new LineSegments2(pole, this.lineMat(pal.rail, 1.5)))
    }
  }

  private gantry(group: THREE.Group, keep: <T extends { dispose: () => void }>(x: T) => T, year: number, rows: SimResult['canonical']['paths'][string], pal: Palette, pixel: boolean) {
    const z = zOf(year)
    const out: Built = { fills: [], edges: [], bands: [], windows: [] }
    box(out, 1.2, 15, 1.2, -11, 0, z)
    box(out, 1.2, 15, 1.2, 11, 0, z)
    box(out, 24, 1.3, 1.6, 0, 15, z)
    box(out, 24, 0.5, 0.8, 0, 12.6, z)
    const fill = keep(mergeGeometries(out.fills.map((g) => g.toNonIndexed()), false)!)
    out.fills.forEach((g) => g.dispose())
    group.add(new THREE.Mesh(fill, keep(new THREE.MeshBasicMaterial({ color: pal.fill, fog: true }))))
    group.add(new LineSegments2(keep(new LineSegmentsGeometry().setPositions(out.edges)), this.lineMat(pal.rail, 2)))
    const row = rows[Math.min(rows.length - 1, year - CLOCK.start)]
    const era = eraAt(year)
    const cities = row.route.map((p) => PLACE_BY_ID[p].city).filter((c, i, a) => a.indexOf(c) === i).join(' → ')
    const tex = keep(canvasSign([
      { text: `${year}${row.projected ? ' · PROJECTED' : ''}`, size: 64, color: pal.sign },
      { text: cities.toUpperCase(), size: 40, color: pal.text },
      { text: era.label.toUpperCase(), size: 26, color: pal.edge2 },
    ], 1400, 360, pal.signBg, pal.sign, pixel))
    const sign = new THREE.Mesh(keep(new THREE.PlaneGeometry(19, 4.9)), keep(new THREE.MeshBasicMaterial({ map: tex, fog: true, side: THREE.DoubleSide })))
    sign.position.set(0, 18.4, z)
    group.add(sign)
    // signal lights on the pillars
    for (const x of [-11, 11]) {
      const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color: x < 0 ? '#3dff7a' : '#ff5f5f', blending: THREE.AdditiveBlending, depthWrite: false, fog: true })))
      s.position.set(x, 9, z + 0.8)
      s.scale.setScalar(1.6)
      group.add(s)
    }
  }

  private buildShips() {
    for (const self of SELVES) {
      const color = this.style === 'arcade' ? self.neon : this.style === 'void' ? this.paletteNow().edge : self.color
      const out: Built = { fills: [], edges: [], bands: [], windows: [] }
      const body = new THREE.CylinderGeometry(1.7, 2.3, 0.8, 18, 1)
      addPart(out, body, [1, 1])
      const dome = new THREE.SphereGeometry(1.0, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2)
      dome.translate(0, 0.4, 0)
      addPart(out, dome, [1, 1])
      for (const x of [-2.9, 2.9]) {
        const pod = new THREE.CylinderGeometry(0.6, 0.6, 2.6, 12, 1)
        pod.rotateX(Math.PI / 2)
        pod.translate(x, 0, 0.2)
        addPart(out, pod, [1, 1])
        const arm = new THREE.BoxGeometry(1.4, 0.2, 0.9)
        arm.translate(x * 0.72, 0, 0)
        addPart(out, arm, [1, 1])
      }
      const group = new THREE.Group()
      const fill = mergeGeometries(out.fills.map((g) => g.toNonIndexed()), false)!
      group.add(new THREE.Mesh(fill, new THREE.MeshBasicMaterial({ color: this.style === 'cyanotype' ? '#0b1838' : '#0a0618', fog: true })))
      const edges = this.lineMat(color, self.real ? 2.6 : 2)
      group.add(new LineSegments2(new LineSegmentsGeometry().setPositions(out.edges), edges))
      const flame = new THREE.SpriteMaterial({ map: glowTex, color: self.real ? '#ffb36b' : color, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })
      for (const x of [-2.9, 2.9]) {
        const s = new THREE.Sprite(flame)
        s.position.set(x, 0, 1.7)
        s.scale.setScalar(2.4)
        group.add(s)
      }
      group.scale.setScalar(self.real ? 0.75 : 0.6)
      this.scene.add(group)
      const label = document.createElement('div')
      label.className = 'label label-self' + (self.real ? ' real' : '')
      label.textContent = self.name
      label.style.setProperty('--c', this.style === 'arcade' ? self.neon : self.color)
      this.overlay.appendChild(label)
      this.ships.push({ id: self.id, group, edges, flame, label, p: self.id === this.focusId ? 1 : 0, pos: new THREE.Vector3(), split: false })
    }
  }

  // ------------------------------------------------------------ frame
  private resize() {
    const w = this.host.clientWidth || 1
    const h = this.host.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.composer.setSize(w, h)
    this.bloom.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    for (const m of this.lineMats) m.resolution.set(size.x, size.y)
  }

  private project(el: HTMLElement, p: THREE.Vector3, visible: boolean) {
    const v = p.clone().project(this.camera)
    const show = visible && v.z < 1 && v.z > -1
    el.style.opacity = show ? '' : '0'
    el.style.transform = `translate(${((v.x + 1) / 2) * this.host.clientWidth}px, ${((1 - v.y) / 2) * this.host.clientHeight}px)`
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    if (!this.active) return
    const nowMs = performance.now()
    if (nowMs - this.lastRender < this.minFrameMs) return
    this.lastRender = nowMs
    const dt = Math.min(0.05, this.clock.getDelta())
    const time = this.clock.elapsedTime
    if (!this.sim || !this.ready) return

    const t = Math.max(CLOCK.start, Math.min(CLOCK.end + 0.98, this.t))
    const pal = this.paletteNow()
    const isVoid = this.style === 'void'
    const isNeon = this.style === 'arcade'
    const key = `${this.style}:${pal.edge}:${pal.grid}`
    if (key !== this.styleKey) {
      this.styleKey = key
      this.renderer.setClearColor(pal.bg)
      ;(this.scene.fog as THREE.FogExp2).color.set(pal.fog)
      const u = this.floor.material.uniforms
      u.uGrid.value.set(pal.grid)
      u.uGridOff.value.set(pal.gridOff)
      u.uBorder.value.set(pal.border)
      u.uRail.value.set(pal.rail)
      this.finish.enabled = !isVoid
      this.retro.enabled = isVoid
      this.bloom.strength = isNeon ? 0.62 : isVoid ? 0.45 : 0.5
      this.bloom.threshold = isNeon ? 0.3 : 0.32
      this.bloom.radius = 0.3
      this.finish.uniforms.uScan.value = isNeon ? 0.14 : 0
      this.finish.uniforms.uGrain.value = isNeon ? 0.015 : 0.03
      this.finish.uniforms.uTint.value.set('#ffffff')
      if (isVoid) {
        const p = eraAt(t).retro.palette
        ;['uP0', 'uP1', 'uP2', 'uP3'].forEach((k2, i) => this.retro.uniforms[k2].value.set(p[i]))
      }
    }
    this.finish.uniforms.uTime.value = time
    if (isVoid) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
      this.retro.uniforms.uRes.value.copy(size)
      this.retro.uniforms.uBlock.value = Math.max(2, Math.round(3 * this.pixel))
      this.retro.uniforms.uTime.value = time
    }

    // Stream chunks around the focused ship
    const shipZ = zOf(t)
    const cur = Math.floor(-shipZ / CHUNK)
    for (let i = cur - BEHIND; i <= cur + AHEAD; i++) {
      if (i < -2) continue
      if (!this.chunks.has(i)) this.chunks.set(i, this.buildChunk(i))
    }
    for (const [i, c] of this.chunks) if (i < cur - BEHIND - 1 || i > cur + AHEAD + 1) { c.dispose(); this.chunks.delete(i) }
    this.floor.position.z = shipZ - 300

    // Ships: in formation while their lives share the focused city, peeling off when they part
    const rows = this.sim.canonical.paths
    const here = placeAt(rows[this.focusId], t)
    if (here !== this.place) {
      this.place = here
      this.onPlace?.(here)
    }
    // A ghost is hidden inside the real ship until its fork, then splits off.
    // After that it shares the street only while its life shares the city.
    const forked = (id: string) => {
      const self = SELF_BY_ID[id]
      return self.real || !self.fork || t >= self.fork.year
    }
    const present = this.ships.filter((s) => s.id !== this.focusId && forked(s.id) && placeAt(rows[s.id], t) === here)
    const focusShip = this.ships.find((s) => s.id === this.focusId)
    let slot = 0
    for (const s of this.ships) {
      const isFocus = s.id === this.focusId
      const isPresent = present.includes(s)
      const target = isFocus || isPresent ? 1 : 0
      if (!isFocus && !forked(s.id)) { s.p = 0; s.split = true }
      s.p += (target - s.p) * (1 - Math.exp(-dt * (target ? 1.4 : 0.9)))
      const k = isFocus ? 0 : isPresent ? ++slot : slot + 2
      const side = k % 2 ? 1 : -1
      const lane = Math.ceil(k / 2)
      const bob = Math.sin(time * 1.7 + k) * 0.25
      // Formation flies ahead of and around the focused ship, never between it and the camera
      const sx = isFocus ? 0 : side * (3.2 + lane * 2.2)
      const sy = (isFocus ? 4.2 : 5.2 + (k % 3) * 1.3) + bob
      const sz = shipZ - (isFocus ? 0 : 6 + lane * 5)
      const e = s.p * s.p * (3 - 2 * s.p)
      const exitSide = hash(s.id) % 2 ? 1 : -1
      if (s.split && focusShip && !isFocus) {
        // Emerging from the real ship at the fork
        s.pos.set(sx, sy, sz).lerp(focusShip.pos, 1 - e)
        if (s.p > 0.98 || target === 0) s.split = false
      } else {
        s.pos.set(sx + (1 - e) * exitSide * 70, sy + (1 - e) * 22, sz + (1 - e) * 4)
      }
      s.group.position.copy(s.pos)
      s.group.rotation.z = (1 - e) * exitSide * -0.6 + Math.sin(time * 1.3 + k) * 0.05
      s.group.rotation.y = (1 - e) * exitSide * 0.5
      s.group.visible = s.p > 0.02
      s.flame.opacity = 0.6 + 0.4 * Math.sin(time * 18 + k)
      this.project(s.label, s.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), (isFocus || s.p > 0.3) && this.dio < 0.5)
      if (isVoid) s.edges.color.set(pal.edge)
    }

    // Camera: street chase, diorama, or the director cycling between them
    let dioTarget = this.cam === 'diorama' ? 1 : 0
    if (this.cam === 'auto') {
      const c = ((performance.now() - this.camStart) / 1000) % 13
      dioTarget = c > 7.5 && c < 11.5 ? 1 : 0
    }
    this.dio += (dioTarget - this.dio) * (1 - Math.exp(-dt * 1.3))
    const d = this.dio * this.dio * (3 - 2 * this.dio)
    const portrait = this.host.clientHeight > this.host.clientWidth
    const sway = Math.sin(time * 0.35) * 1.5
    const streetPos = new THREE.Vector3(sway, 7.2, shipZ + 16)
    const streetLook = new THREE.Vector3(sway * 0.3, 5, shipZ - 40)
    const dioPos = new THREE.Vector3(portrait ? 95 : 120, portrait ? 150 : 120, shipZ + (portrait ? 70 : 95))
    const dioLook = new THREE.Vector3(0, 6, shipZ - 25)
    this.camPos.copy(streetPos).lerp(dioPos, d)
    this.camLook.copy(streetLook).lerp(dioLook, d)
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camLook)
    const streetFov = portrait ? 78 : 62
    const dioFov = portrait ? 34 : 26
    this.camera.fov = streetFov + (dioFov - streetFov) * d
    this.camera.updateProjectionMatrix()
    ;(this.scene.fog as THREE.FogExp2).density = 0.0055 - 0.0038 * d
    this.floor.material.uniforms.uTile.value = d
    this.floor.material.uniforms.uTileCenter.value.set(0, 0, shipZ - 25)
    const showDio = d > 0.6
    if (showDio !== this.dioShown) {
      this.dioShown = showDio
      this.onDiorama?.(showDio)
    }

    this.composer.render(dt)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    for (const c of this.chunks.values()) c.dispose()
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.overlay.remove()
  }
}

function streakTexture(base: string, streak: string) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, 64, 128)
  const r = rng(7)
  g.strokeStyle = streak
  for (let i = 0; i < 26; i++) {
    g.globalAlpha = 0.25 + r() * 0.55
    g.lineWidth = 1 + r() * 2
    const x = r() * 64
    g.beginPath()
    g.moveTo(x, r() * 40)
    g.lineTo(x + (r() - 0.5) * 3, 128 - r() * 40)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export const cityPlaceAt = (sim: SimResult, selfId: string, t: number) => placeAt(sim.canonical.paths[selfId], t)
export const SELF_COLOR = (id: string, style: VisualStyle) => (style === 'arcade' ? SELF_BY_ID[id].neon : SELF_BY_ID[id].color)
