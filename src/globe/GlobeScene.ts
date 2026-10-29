import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { CLOCK, eraBlend } from '../data/eras'
import { PLACES, PLACE_BY_ID } from '../data/places'
import { SELVES } from '../data/selves'
import type { SimResult } from '../sim/engine'
import type { ISS, Quake } from '../live/sources'
import { latLonToVec3, type LandData } from '../lib/geo'
import { buildThreadGeometry, radiusAt, threadPoint } from './threads'

export type CameraMode = 'orbit' | 'follow' | 'tour'

const CYANOTYPE = new THREE.Color('#3b7dff')

// ---------------------------------------------------------------- shaders
const landVert = /* glsl */ `
  attribute float aLand;
  attribute float aRand;
  attribute float aDelay;
  attribute vec3 aScatter;
  uniform float uBuild;
  uniform float uTime;
  uniform float uPixel;
  uniform vec3 uSun;
  varying float vLight;
  varying float vLand;
  varying float vFront;
  varying float vAlpha;
  void main() {
    vec3 p = normalize(position);
    float k = smoothstep(aDelay, aDelay + 0.22, uBuild);
    float e = 1.0 - pow(1.0 - k, 3.0);
    vec3 start = p * (1.4 + aRand * 2.6) + aScatter * 1.6;
    vec3 pos = mix(start, p, e);
    // a slow breathing so the planet never sits perfectly still
    pos *= 1.0 + 0.0025 * sin(uTime * 0.8 + aRand * 40.0) * aLand;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = dot(p, normalize(uSun));
    vLight = smoothstep(-0.18, 0.35, d);
    vLand = aLand;
    vFront = exp(-pow((uBuild - aDelay - 0.11) * 9.0, 2.0)) * (1.0 - step(0.999, uBuild));
    vAlpha = k;
    float size = mix(1.1, 2.1, aLand) * (0.85 + aRand * 0.4);
    gl_PointSize = size * uPixel * (3.2 / -mv.z);
  }
`
const landFrag = /* glsl */ `
  uniform vec3 uKey;
  uniform vec3 uFill;
  varying float vLight;
  varying float vLand;
  varying float vFront;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, r);
    vec3 day = mix(uFill, uKey, 0.55 + 0.45 * vLight);
    vec3 night = uFill * 0.38;
    vec3 col = mix(night, day, vLight);
    col = mix(uFill * 0.22 * (0.4 + vLight), col, vLand);
    col += vec3(1.0) * vFront * 1.6;
    float a = soft * vAlpha * mix(0.22, 0.72, vLand) * (0.55 + 0.45 * vLight);
    gl_FragColor = vec4(col * (0.55 + 0.45 * vLand), a);
  }
`

const threadVert = /* glsl */ `
  attribute float aYear;
  varying float vYear;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vYear = aYear;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`
const threadFrag = /* glsl */ `
  uniform float uYear;
  uniform vec3 uColor;
  uniform float uFocus;
  uniform float uReal;
  varying float vYear;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    if (vYear > uYear) discard;
    float age = uYear - vYear;
    float core = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
    float trail = 0.3 + 0.7 * exp(-age * 0.28);
    float head = 2.6 * exp(-age * 7.0);
    vec3 col = uColor * (trail + head) * (0.35 + 0.9 * core);
    col += vec3(1.0) * head * 0.35 * core;
    gl_FragColor = vec4(col * uFocus, (0.25 + 0.75 * core) * uFocus);
  }
`

const ghostVert = /* glsl */ `
  attribute float aYear;
  attribute float aWeight;
  uniform float uYear;
  uniform float uPixel;
  uniform float uTime;
  varying float vA;
  void main() {
    float visible = smoothstep(aYear - 0.05, aYear + 0.6, uYear);
    vA = visible * aWeight * (0.75 + 0.25 * sin(uTime * 1.3 + aYear * 3.0));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.0 + 9.0 * sqrt(aWeight)) * uPixel * (3.2 / -mv.z);
  }
`
const ghostFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFocus;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(uColor * 0.9, a * a * vA * 0.55 * uFocus);
  }
`

const glowVert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixel;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixel * (3.2 / -mv.z);
  }
`
const glowFrag = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float core = exp(-r * r * 18.0);
    float halo = exp(-r * 3.2) * 0.55;
    gl_FragColor = vec4(vColor * (core * 2.4 + halo) + vec3(core), core + halo);
  }
`

const quakeVert = /* glsl */ `
  attribute float aMag;
  attribute float aPhase;
  uniform float uPixel;
  varying float vMag;
  varying float vPhase;
  void main() {
    vMag = aMag;
    vPhase = aPhase;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (6.0 + pow(aMag, 2.0) * 2.4) * uPixel * (3.2 / -mv.z);
  }
`
const quakeFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying float vMag;
  varying float vPhase;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float w = fract(uTime * 0.28 + vPhase);
    float ring = exp(-pow((r - w) * 14.0, 2.0)) * (1.0 - w);
    float dot = exp(-r * r * 60.0);
    gl_FragColor = vec4(uColor * (ring * 1.4 + dot * 1.8), (ring + dot) * clamp(vMag / 6.0, 0.25, 1.0));
  }
`

const atmoVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vP;
  void main() {
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vP = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`
const atmoFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vN;
  varying vec3 vP;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 3.2);
    gl_FragColor = vec4(uColor * f * uStrength, f * uStrength);
  }
`

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.08 },
    uTint: { value: new THREE.Color('#ffffff') },
    uAberration: { value: 0.0018 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform vec3 uTint;
    uniform float uAberration;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float d = length(c);
      vec2 off = c * uAberration * d * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      col *= mix(vec3(1.0), uTint, 0.22);
      float vig = smoothstep(0.85, 0.2, d);
      col *= 0.55 + 0.45 * vig;
      float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime * 7.0) * 100.0) - 0.5;
      col += g * uGrain * (0.25 + 0.75 * dot(col, vec3(0.333)));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

// ---------------------------------------------------------------- scene
interface ThreadObj {
  selfId: string
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  ghosts: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  label: HTMLDivElement
  focus: number
}

export class GlobeScene {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  composer: EffectComposer
  bloom: UnrealBloomPass
  finish: ShaderPass
  world = new THREE.Group()
  overlay: HTMLDivElement

  private land?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  private coast?: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
  private core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  private atmo: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>
  private grat: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
  private threads: ThreadObj[] = []
  private heads: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  private rings: { id: string; mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; label: HTMLDivElement; glow: number }[] = []
  private quakes?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  private iss: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  private issTrail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>
  private issHistory: { lat: number; lon: number; alt: number; at: number }[] = []
  private issLabel: HTMLDivElement
  private sunDir = new THREE.Vector3(1, 0.2, 0.3).normalize()
  private sunSprite: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>

  private sim?: SimResult
  private build = 0
  private buildStart = performance.now()
  private intro = 0
  private introStart = performance.now()
  private year = CLOCK.start
  private raf = 0
  private clock = new THREE.Clock()
  private pixel = Math.min(window.devicePixelRatio, 2)
  private ro: ResizeObserver
  private pointerDown = false
  private active = true

  mode: CameraMode = 'orbit'
  focusId: string | null = null
  onSelect?: (id: string) => void

  private camGoal = new THREE.Vector3()
  private lookGoal = new THREE.Vector3()
  private look = new THREE.Vector3()

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(this.pixel)
    this.renderer.setClearColor(0x000000, 1)
    host.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.display = 'block'

    this.overlay = document.createElement('div')
    this.overlay.className = 'globe-overlay'
    host.appendChild(this.overlay)

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200)
    this.camera.position.set(0, 2.2, 10)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.rotateSpeed = 0.5
    this.controls.minDistance = 1.6
    this.controls.maxDistance = 12
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.35
    this.controls.enablePan = false
    this.controls.enabled = false
    this.renderer.domElement.addEventListener('pointerdown', () => (this.pointerDown = true))
    window.addEventListener('pointerup', this.onUp)

    this.scene.add(this.world)

    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.992, 96, 64), new THREE.MeshBasicMaterial({ color: 0x05070c }))
    this.world.add(this.core)

    this.atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.16, 96, 64),
      new THREE.ShaderMaterial({
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        uniforms: { uColor: { value: new THREE.Color('#4f8dff') }, uStrength: { value: 0 } },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    )
    this.world.add(this.atmo)

    this.grat = this.makeGraticule()
    this.world.add(this.grat)
    this.scene.add(this.makeStars())

    // Sun glow, far out along the real subsolar direction
    this.sunSprite = this.makeGlowPoints(1)
    this.scene.add(this.sunSprite)

    this.heads = this.makeGlowPoints(SELVES.length)
    this.world.add(this.heads)

    this.iss = this.makeGlowPoints(1)
    this.world.add(this.iss)
    this.issTrail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }))
    this.world.add(this.issTrail)
    this.issLabel = this.makeLabel('ISS live', 'label label-iss')

    this.makeCityRings()

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.6, 0.18)
    this.composer.addPass(this.bloom)
    this.finish = new ShaderPass(FinishShader)
    this.composer.addPass(this.finish)
    this.composer.addPass(new OutputPass())

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.resize()
    this.loop()
  }

  private onUp = () => (this.pointerDown = false)

  // ------------------------------------------------------------ builders
  setLand(land: LandData) {
    const N = 120000
    const pos: number[] = []
    const isLandArr: number[] = []
    const rand: number[] = []
    const delay: number[] = []
    const scatter: number[] = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    const v = new THREE.Vector3()
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const th = golden * i
      const x = Math.cos(th) * r
      const z = Math.sin(th) * r
      const lat = Math.asin(y) * (180 / Math.PI)
      const lon = Math.atan2(z, -x) * (180 / Math.PI) - 180
      const lonN = ((lon + 540) % 360) - 180
      const onLand = land.isLand(lat, lonN)
      if (!onLand && i % 7 !== 0) continue
      latLonToVec3(lat, lonN, 1, v)
      pos.push(v.x, v.y, v.z)
      isLandArr.push(onLand ? 1 : 0)
      const rr = Math.random()
      rand.push(rr)
      // The reconstruction sweeps west to east, with land arriving before sea
      delay.push(((lonN + 180) / 360) * 0.55 + rr * 0.18 + (onLand ? 0 : 0.12))
      const s = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      scatter.push(s.x, s.y, s.z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aLand', new THREE.Float32BufferAttribute(isLandArr, 1))
    g.setAttribute('aRand', new THREE.Float32BufferAttribute(rand, 1))
    g.setAttribute('aDelay', new THREE.Float32BufferAttribute(delay, 1))
    g.setAttribute('aScatter', new THREE.Float32BufferAttribute(scatter, 3))
    const m = new THREE.ShaderMaterial({
      vertexShader: landVert,
      fragmentShader: landFrag,
      uniforms: {
        uBuild: { value: 0 },
        uTime: { value: 0 },
        uPixel: { value: this.pixel },
        uSun: { value: this.sunDir },
        uKey: { value: new THREE.Color('#ffcf8a') },
        uFill: { value: new THREE.Color('#4f8dff') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.land = new THREE.Points(g, m)
    this.world.add(this.land)

    // Coastlines in thin white ink, drawn in after the dots land
    const seg: number[] = []
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    for (const line of land.coast) {
      for (let i = 0; i < line.length - 1; i++) {
        const [lo1, la1] = line[i]
        const [lo2, la2] = line[i + 1]
        if (Math.abs(lo1 - lo2) > 180) continue
        latLonToVec3(la1, lo1, 1.0015, a)
        latLonToVec3(la2, lo2, 1.0015, b)
        seg.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    const cg = new THREE.BufferGeometry()
    cg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
    this.coast = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
    this.world.add(this.coast)

    this.buildStart = performance.now()
  }

  setSim(sim: SimResult) {
    this.sim = sim
    for (const t of this.threads) {
      this.world.remove(t.mesh, t.ghosts)
      t.mesh.geometry.dispose()
      t.mesh.material.dispose()
      t.ghosts.geometry.dispose()
      t.ghosts.material.dispose()
      t.label.remove()
    }
    this.threads = []
    SELVES.forEach((s, i) => {
      const rows = sim.canonical.paths[s.id]
      const color = s.real ? new THREE.Color(s.color) : new THREE.Color(s.color).lerp(CYANOTYPE, 0.35)
      const geo = buildThreadGeometry(rows, i, s.real ? 0.0042 : 0.0026)
      const mat = new THREE.ShaderMaterial({
        vertexShader: threadVert,
        fragmentShader: threadFrag,
        uniforms: { uYear: { value: this.year }, uColor: { value: color }, uFocus: { value: 1 }, uReal: { value: s.real ? 1 : 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const mesh = new THREE.Mesh(geo, mat)
      this.world.add(mesh)

      // Ghost cloud: where this self ended up across all the runs
      const gp: number[] = []
      const gy: number[] = []
      const gw: number[] = []
      const tmp = new THREE.Vector3()
      for (const [yStr, places] of Object.entries(sim.presence[s.id])) {
        const y = Number(yStr)
        for (const [pid, count] of Object.entries(places)) {
          const p = PLACE_BY_ID[pid]
          const r = radiusAt(y)
          latLonToVec3(p.lat + (Math.random() - 0.5) * 0.8, p.lon + (Math.random() - 0.5) * 0.8, r, tmp)
          gp.push(tmp.x, tmp.y, tmp.z)
          gy.push(y)
          gw.push(count / sim.runs)
        }
      }
      const gg = new THREE.BufferGeometry()
      gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3))
      gg.setAttribute('aYear', new THREE.Float32BufferAttribute(gy, 1))
      gg.setAttribute('aWeight', new THREE.Float32BufferAttribute(gw, 1))
      const gm = new THREE.ShaderMaterial({
        vertexShader: ghostVert,
        fragmentShader: ghostFrag,
        uniforms: { uYear: { value: this.year }, uColor: { value: color }, uPixel: { value: this.pixel }, uTime: { value: 0 }, uFocus: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const ghosts = new THREE.Points(gg, gm)
      this.world.add(ghosts)

      const label = this.makeLabel(s.name, s.real ? 'label label-self real' : 'label label-self')
      label.style.setProperty('--c', s.color)
      label.addEventListener('click', () => this.onSelect?.(s.id))
      this.threads.push({ selfId: s.id, mesh, ghosts, label, focus: 1 })
    })
    const colors = this.heads.geometry.getAttribute('aColor') as THREE.BufferAttribute
    const sizes = this.heads.geometry.getAttribute('aSize') as THREE.BufferAttribute
    SELVES.forEach((s, i) => {
      const c = s.real ? new THREE.Color(s.color) : new THREE.Color(s.color).lerp(CYANOTYPE, 0.35)
      colors.setXYZ(i, c.r, c.g, c.b)
      sizes.setX(i, s.real ? 30 : 20)
    })
    colors.needsUpdate = true
    sizes.needsUpdate = true
  }

  setQuakes(list: Quake[]) {
    if (this.quakes) {
      this.world.remove(this.quakes)
      this.quakes.geometry.dispose()
      this.quakes.material.dispose()
    }
    const pos: number[] = []
    const mag: number[] = []
    const phase: number[] = []
    const v = new THREE.Vector3()
    for (const q of list) {
      latLonToVec3(q.lat, q.lon, 1.003, v)
      pos.push(v.x, v.y, v.z)
      mag.push(q.mag)
      phase.push(Math.random())
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aMag', new THREE.Float32BufferAttribute(mag, 1))
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1))
    this.quakes = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        vertexShader: quakeVert,
        fragmentShader: quakeFrag,
        uniforms: { uTime: { value: 0 }, uPixel: { value: this.pixel }, uColor: { value: new THREE.Color('#ff7a4d') } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    this.world.add(this.quakes)
  }

  setISS(iss: ISS) {
    this.issHistory.push({ lat: iss.lat, lon: iss.lon, alt: iss.altKm, at: iss.at })
    if (this.issHistory.length > 120) this.issHistory.shift()
    const pts = this.issHistory.map((h) => latLonToVec3(h.lat, h.lon, 1 + h.alt / 6371))
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    this.issTrail.geometry.dispose()
    this.issTrail.geometry = g
    const p = pts[pts.length - 1]
    const attr = this.iss.geometry.getAttribute('position') as THREE.BufferAttribute
    attr.setXYZ(0, p.x, p.y, p.z)
    attr.needsUpdate = true
    ;(this.iss.geometry.getAttribute('aSize') as THREE.BufferAttribute).setX(0, 14)
    ;(this.iss.geometry.getAttribute('aColor') as THREE.BufferAttribute).setXYZ(0, 1, 1, 1)
    this.iss.geometry.getAttribute('aSize').needsUpdate = true
    this.iss.geometry.getAttribute('aColor').needsUpdate = true
  }

  setSun(lat: number, lon: number) {
    latLonToVec3(lat, lon, 1, this.sunDir).normalize()
    const p = this.sunDir.clone().multiplyScalar(60)
    const attr = this.sunSprite.geometry.getAttribute('position') as THREE.BufferAttribute
    attr.setXYZ(0, p.x, p.y, p.z)
    attr.needsUpdate = true
    ;(this.sunSprite.geometry.getAttribute('aSize') as THREE.BufferAttribute).setX(0, 1300)
    ;(this.sunSprite.geometry.getAttribute('aColor') as THREE.BufferAttribute).setXYZ(0, 1, 0.85, 0.65)
    this.sunSprite.geometry.getAttribute('aSize').needsUpdate = true
    this.sunSprite.geometry.getAttribute('aColor').needsUpdate = true
  }

  setActive(on: boolean) {
    if (on === this.active) return
    this.active = on
    this.clock.getDelta()
    if (on) this.resize()
  }

  setYear(t: number) {
    this.year = t
  }

  setMode(mode: CameraMode, focusId: string | null) {
    this.mode = mode
    this.focusId = focusId
    // Any deliberate camera choice ends the opening dolly
    if (mode !== 'orbit' || focusId) this.introStart = -Infinity
  }

  private makeGlowPoints(n: number) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    return new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        vertexShader: glowVert,
        fragmentShader: glowFrag,
        uniforms: { uPixel: { value: this.pixel } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
  }

  private makeGraticule() {
    const seg: number[] = []
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    for (let lat = -75; lat <= 75; lat += 15) {
      for (let lon = -180; lon < 180; lon += 2) {
        latLonToVec3(lat, lon, 1.001, a)
        latLonToVec3(lat, lon + 2, 1.001, b)
        seg.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    for (let lon = -180; lon < 180; lon += 15) {
      for (let lat = -88; lat < 88; lat += 2) {
        latLonToVec3(lat, lon, 1.001, a)
        latLonToVec3(lat + 2, lon, 1.001, b)
        seg.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x6f9cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
  }

  private makeStars() {
    const n = 2600
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const col = new Float32Array(n * 3)
    const v = new THREE.Vector3()
    for (let i = 0; i < n; i++) {
      v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(40 + Math.random() * 30)
      pos.set([v.x, v.y, v.z], i * 3)
      size[i] = 6 + Math.random() ** 6 * 60
      const w = 0.35 + Math.random() * 0.4
      col.set([w * 0.8, w * 0.9, w], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    return new THREE.Points(
      g,
      new THREE.ShaderMaterial({ vertexShader: glowVert, fragmentShader: glowFrag, uniforms: { uPixel: { value: this.pixel * 0.25 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
  }

  private makeCityRings() {
    for (const p of PLACES) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 1, 64),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
      )
      const d = latLonToVec3(p.lat, p.lon, 1.004)
      mesh.position.copy(d)
      mesh.lookAt(d.clone().multiplyScalar(2))
      this.world.add(mesh)
      const label = this.makeLabel(p.city, 'label label-city')
      this.rings.push({ id: p.id, mesh, label, glow: 0 })
    }
  }

  private makeLabel(text: string, cls: string) {
    const el = document.createElement('div')
    el.className = cls
    el.textContent = text
    this.overlay.appendChild(el)
    return el
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
  }

  private occluded(p: THREE.Vector3) {
    // Ray from the camera to the point: does it pass through the planet first?
    const o = this.camera.position
    const d = new THREE.Vector3().subVectors(p, o)
    const len = d.length()
    d.divideScalar(len)
    const b = o.dot(d)
    const c = o.lengthSq() - 0.99 * 0.99
    const disc = b * b - c
    if (disc < 0) return false
    const tHit = -b - Math.sqrt(disc)
    return tHit > 0 && tHit < len
  }

  private place(el: HTMLElement, p: THREE.Vector3, visible: boolean) {
    const v = p.clone().applyMatrix4(this.world.matrixWorld).project(this.camera)
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    const show = visible && v.z < 1 && !this.occluded(p.clone().applyMatrix4(this.world.matrixWorld))
    el.style.opacity = show ? '' : '0'
    el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    if (!this.active) return
    const dt = Math.min(0.05, this.clock.getDelta())
    const time = this.clock.elapsedTime
    const t = this.year

    // Reconstruction of the planet: points converge from noise to surface
    this.build = Math.min(1, (performance.now() - this.buildStart) / 6500)
    this.intro = Math.min(1, (performance.now() - this.introStart) / 7000)
    const buildEase = this.build
    if (this.land) {
      const u = this.land.material.uniforms
      u.uBuild.value = buildEase * 1.02
      u.uTime.value = time
    }
    if (this.coast) this.coast.material.opacity = Math.max(0, (this.build - 0.6) / 0.4) * 0.28

    // Era light
    const { a, b, k } = eraBlend(t)
    const key = new THREE.Color(a.light.key).lerp(new THREE.Color(b.light.key), k)
    const fill = new THREE.Color(a.light.fill).lerp(new THREE.Color(b.light.fill), k)
    const ground = new THREE.Color(a.light.ground).lerp(new THREE.Color(b.light.ground), k)
    if (this.land) {
      this.land.material.uniforms.uKey.value.copy(key)
      this.land.material.uniforms.uFill.value.copy(fill)
    }
    this.atmo.material.uniforms.uColor.value.copy(fill)
    this.atmo.material.uniforms.uStrength.value = 0.6 * this.build
    this.core.material.color.copy(ground)
    this.renderer.setClearColor(ground.clone().multiplyScalar(0.35))
    this.grat.material.opacity = 0.05 * this.build
    this.grat.material.color.copy(fill)
    this.finish.uniforms.uTime.value = time
    this.finish.uniforms.uGrain.value = (a.light.grain * (1 - k) + b.light.grain * k) * 0.35
    this.finish.uniforms.uTint.value.copy(key)

    // Threads, ghosts, heads
    const year = Math.floor(t)
    const headPos = this.heads.geometry.getAttribute('position') as THREE.BufferAttribute
    const occupied = new Map<string, number>()
    const tmp = new THREE.Vector3()
    let focusHead: THREE.Vector3 | null = null
    let focusTan: THREE.Vector3 | null = null
    const reveal = Math.max(0, (this.build - 0.75) / 0.25)
    if (this.sim) {
      this.threads.forEach((th, i) => {
        const rows = this.sim!.canonical.paths[th.selfId]
        const target = this.focusId && this.focusId !== th.selfId ? 0.18 : 1
        th.focus += (target - th.focus) * (1 - Math.exp(-dt * 3))
        const f = th.focus * reveal
        th.mesh.material.uniforms.uYear.value = t
        th.mesh.material.uniforms.uFocus.value = f
        th.ghosts.material.uniforms.uYear.value = t
        th.ghosts.material.uniforms.uTime.value = time
        th.ghosts.material.uniforms.uFocus.value = f
        threadPoint(rows, i, t, tmp)
        headPos.setXYZ(i, tmp.x, tmp.y, tmp.z)
        this.place(th.label, tmp, f > 0.5)
        const row = rows[Math.min(rows.length - 1, year - CLOCK.start)]
        occupied.set(row.place, (occupied.get(row.place) ?? 0) + 1)
        if (th.selfId === this.focusId || (!this.focusId && SELVES[i].real)) {
          focusHead = tmp.clone()
          focusTan = threadPoint(rows, i, Math.min(CLOCK.end, t + 0.35)).sub(threadPoint(rows, i, Math.max(CLOCK.start, t - 0.35))).normalize()
        }
      })
      headPos.needsUpdate = true
    }
    ;(this.heads.material as THREE.ShaderMaterial).visible = reveal > 0

    // Glass rings: scale with connection, glow while a self is there
    for (const r of this.rings) {
      const conn = this.sim?.connection[r.id]?.[Math.min(CLOCK.end, Math.max(CLOCK.start, year))]?.value ?? 2.5
      const s = 0.012 + conn * 0.0075
      r.mesh.scale.setScalar(s)
      const target = occupied.has(r.id) ? 0.7 : 0.16
      r.glow += (target - r.glow) * (1 - Math.exp(-dt * 4))
      r.mesh.material.opacity = r.glow * reveal
      r.mesh.material.color.copy(key).lerp(new THREE.Color('#ffffff'), 0.5)
      r.label.classList.toggle('on', occupied.has(r.id))
      this.place(r.label, r.mesh.position, reveal > 0.5 && (occupied.has(r.id) || this.camera.position.length() < 2.6))
    }

    if (this.quakes) {
      this.quakes.material.uniforms.uTime.value = time
      this.quakes.material.visible = this.build > 0.9
    }
    if (this.issHistory.length) {
      const last = this.issHistory[this.issHistory.length - 1]
      this.place(this.issLabel, latLonToVec3(last.lat, last.lon, 1 + last.alt / 6371), this.build > 0.9)
    } else this.issLabel.style.opacity = '0'

    // Camera
    const introEase = 1 - Math.pow(1 - this.intro, 3)
    if (this.intro < 1 && !this.pointerDown) {
      const ang = time * 0.12 + 0.6
      const dist = 10 - introEase * 6.2
      this.camera.position.set(Math.sin(ang) * dist, 0.9 + (1 - introEase) * 2.2, Math.cos(ang) * dist)
      this.camera.lookAt(0, 0, 0)
      this.controls.target.set(0, 0, 0)
    } else if (this.mode === 'orbit' || !focusHead) {
      if (!this.controls.enabled) {
        this.controls.enabled = true
        this.look.copy(this.controls.target)
      }
      this.controls.target.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.exp(-dt * 2))
      this.controls.update()
    } else {
      this.controls.enabled = false
      const h = focusHead as THREE.Vector3
      const tan = focusTan as unknown as THREE.Vector3
      const outward = h.clone().normalize()
      const side = new THREE.Vector3().crossVectors(outward, tan).normalize()
      // Chase camera: behind and above the head, looking along the thread
      this.camGoal.copy(h).addScaledVector(outward, 1.35).addScaledVector(tan, -1.0).addScaledVector(side, 0.45)
      this.lookGoal.copy(h).addScaledVector(tan, 0.25).lerp(new THREE.Vector3(0, 0, 0), 0.35)
      const kk = 1 - Math.exp(-dt * 1.4)
      this.camera.position.lerp(this.camGoal, kk)
      this.look.lerp(this.lookGoal, kk)
      this.camera.lookAt(this.look)
      this.controls.target.copy(this.look)
    }

    this.composer.render(dt)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    window.removeEventListener('pointerup', this.onUp)
    this.controls.dispose()
    this.composer.dispose()
    this.renderer.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.renderer.domElement.remove()
    this.overlay.remove()
  }
}
