import { useEffect, useRef } from 'react'
import { CLOCK, eraBlend } from '../data/eras'
import { PLACES, PLACE_BY_ID } from '../data/places'
import { SELVES, SELF_BY_ID } from '../data/selves'
import { clock } from '../lib/clock'
import type { LandData } from '../lib/geo'
import type { Live } from '../live/useLive'
import type { PathRow, SimResult } from '../sim/engine'
import { hideTip, showTip, Receipts } from '../ui/tooltip'
import { INDUSTRIES } from '../data/eras'
import type { VisualStyle } from '../globe/GlobeScene'

const PIXEL_FONT = '"Press Start 2P", monospace'
const voidName = (id: string) => (SELF_BY_ID[id].real ? 'P1' : SELF_BY_ID[id].name.replace(/^The /, '').replace(/ self$/, '').toUpperCase())

// The loom (PRD 4.2, idea 1): every self is a thread across a dotted world.
// Time spirals outward around each city like rings in a tree, so a self that
// stays somewhere draws a growing coil and two selves in one city braid.

interface Props {
  sim: SimResult
  land: LandData | null
  live?: Live
  selves?: string[]
  focusId?: string | null
  onSelect?: (id: string) => void
  compact?: boolean
  style?: VisualStyle
}

const LAT_TOP = 78
const LAT_BOTTOM = -58

function lerpHex(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ch = (s: number) => [(s >> 16) & 255, (s >> 8) & 255, s & 255]
  const A = ch(pa), B = ch(pb)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`
}

export function loomPoint(rows: PathRow[], idx: number, t: number): [number, number] {
  const f = Math.max(0, Math.min(rows.length - 1, t - CLOCK.start))
  const i = Math.min(rows.length - 2, Math.floor(f))
  const s = f - i
  const a = PLACE_BY_ID[rows[i].place]
  const b = PLACE_BY_ID[rows[i + 1].place]
  let lon: number, lat: number
  if (a === b) {
    lon = a.lon
    lat = a.lat
  } else {
    const k = s * s * (3 - 2 * s)
    let dLon = b.lon - a.lon
    if (dLon > 180) dLon -= 360
    if (dLon < -180) dLon += 360
    lon = a.lon + dLon * k
    lat = a.lat + (b.lat - a.lat) * k
    const dist = Math.hypot(dLon, b.lat - a.lat)
    lat += Math.sin(Math.PI * k) * dist * 0.18
  }
  const phi = t * 2.4 + idx * 0.785
  const rad = 0.5 + (t - CLOCK.start) * 0.16
  return [lon + Math.cos(phi) * rad * 1.25, lat + Math.sin(phi) * rad]
}

export function MapView({ sim, land, live, selves, focusId, onSelect, compact, style = 'cyanotype' }: Props) {
  const cv = useRef<HTMLCanvasElement>(null)
  const dots = useRef<{ white: HTMLCanvasElement; tinted: HTMLCanvasElement; tint: string; style: VisualStyle } | null>(null)
  const heads = useRef<{ id: string; x: number; y: number }[]>([])
  const propsRef = useRef({ sim, land, live, selves, focusId, style })
  propsRef.current = { sim, land, live, selves, focusId, style }

  useEffect(() => {
    const canvas = cv.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const hiDpr = Math.min(window.devicePixelRatio, 2)
    // A 2x2 checker, used to dither the night side in void mode
    const checker = document.createElement('canvas')
    checker.width = checker.height = 2
    const cg = checker.getContext('2d')!
    cg.fillStyle = '#000'
    cg.fillRect(0, 0, 1, 1)
    cg.fillRect(1, 1, 1, 1)
    const nightPattern = ctx.createPattern(checker, 'repeat')!

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const { sim, land, live, selves, focusId, style } = propsRef.current
      const isVoid = style === 'void'
      // Void mode renders at half resolution and lets CSS upscale it pixelated
      const dpr = isVoid ? 0.5 : hiDpr
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      if (!W || !H) return
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
        dots.current = null
      }
      if (dots.current && dots.current.style !== style) dots.current = null
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = !isVoid
      const t = clock.get().t
      const { a, b, k } = eraBlend(t)
      const pal = (k < 0.5 ? a : b).retro.palette
      const key = isVoid ? pal[3] : lerpHex(a.light.key, b.light.key, k)
      const fill = isVoid ? pal[2] : lerpHex(a.light.fill, b.light.fill, k)
      const ground = isVoid ? '#000000' : lerpHex(a.light.ground, b.light.ground, k)

      // Fit the map: full longitude, cropped latitude
      const mapAspect = 360 / (LAT_TOP - LAT_BOTTOM)
      let mw = W, mh = W / mapAspect
      if (mh > H) { mh = H; mw = H * mapAspect }
      const ox = (W - mw) / 2, oy = (H - mh) / 2
      const px = (lon: number) => ox + ((lon + 180) / 360) * mw
      const py = (lat: number) => oy + ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * mh

      ctx.fillStyle = ground
      ctx.fillRect(0, 0, W, H)
      if (!isVoid) {
        const grd = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.7)
        grd.addColorStop(0, fill.replace('rgb', 'rgba').replace(')', ',0.10)'))
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grd
        ctx.fillRect(0, 0, W, H)
      }

      // Dot matrix land: rasterized once per size, re-tinted when the era light moves
      if (land && !dots.current) {
        const c = document.createElement('canvas')
        c.width = Math.round(mw * dpr)
        c.height = Math.round(mh * dpr)
        const g = c.getContext('2d')!
        const step = isVoid ? 6 : compact ? 5 : 4.2
        g.fillStyle = '#fff'
        for (let y = 0; y < mh; y += step) {
          for (let x = 0; x < mw; x += step) {
            const lon = (x / mw) * 360 - 180
            const lat = LAT_TOP - (y / mh) * (LAT_TOP - LAT_BOTTOM)
            if (!land.isLand(lat, lon)) continue
            if (isVoid) {
              g.globalAlpha = 0.85
              g.fillRect(Math.round(x * dpr), Math.round(y * dpr), 1, 1)
              continue
            }
            g.globalAlpha = 0.35 + 0.25 * Math.sin(x * 0.13 + y * 0.07) ** 2
            g.beginPath()
            g.arc(x * dpr, y * dpr, 0.85 * dpr, 0, Math.PI * 2)
            g.fill()
          }
        }
        const tinted = document.createElement('canvas')
        tinted.width = c.width
        tinted.height = c.height
        dots.current = { white: c, tinted, tint: '', style }
      }
      if (dots.current && dots.current.tint !== fill) {
        const g = dots.current.tinted.getContext('2d')!
        g.globalCompositeOperation = 'source-over'
        g.clearRect(0, 0, dots.current.tinted.width, dots.current.tinted.height)
        g.drawImage(dots.current.white, 0, 0)
        g.globalCompositeOperation = 'source-in'
        g.fillStyle = fill
        g.fillRect(0, 0, dots.current.tinted.width, dots.current.tinted.height)
        dots.current.tint = fill
      }
      if (dots.current) ctx.drawImage(dots.current.tinted, ox, oy, mw, mh)

      // Real night side, from the live subsolar point
      if (live) {
        const { lat: sLat, lon: sLon } = live.sun
        const tanD = Math.tan((sLat * Math.PI) / 180) || 1e-6
        ctx.beginPath()
        for (let lon = -180; lon <= 180; lon += 3) {
          const lat = (Math.atan(-Math.cos(((lon - sLon) * Math.PI) / 180) / tanD) * 180) / Math.PI
          const X = px(lon), Y = py(Math.max(LAT_BOTTOM, Math.min(LAT_TOP, lat)))
          if (lon === -180) ctx.moveTo(X, Y)
          else ctx.lineTo(X, Y)
        }
        const nightBelow = sLat > 0
        ctx.lineTo(px(180), nightBelow ? py(LAT_BOTTOM) : py(LAT_TOP))
        ctx.lineTo(px(-180), nightBelow ? py(LAT_BOTTOM) : py(LAT_TOP))
        ctx.closePath()
        ctx.fillStyle = isVoid ? nightPattern : 'rgba(0,0,0,0.42)'
        if (isVoid) nightPattern.setTransform(new DOMMatrix().scale(1 / dpr))
        ctx.fill()
      }

      // Glass rings for cities, sized by how connected they are this year
      const year = Math.floor(t)
      const yi = Math.min(CLOCK.end, Math.max(CLOCK.start, year))
      const list = (selves ?? SELVES.map((s) => s.id)).map((id) => SELF_BY_ID[id])
      const occupied = new Set(list.map((s) => sim.canonical.paths[s.id][yi - CLOCK.start].place))
      for (const p of PLACES) {
        const conn = sim.connection[p.id][yi].value
        const r = (compact ? 3 : 4) + conn * (compact ? 1.6 : 2.6)
        const on = occupied.has(p.id)
        ctx.beginPath()
        if (isVoid) {
          // Hexagon rings, drawn like vector arcade sprites
          for (let i = 0; i <= 6; i++) {
            const ang = (i / 6) * Math.PI * 2
            const X = px(p.lon) + Math.cos(ang) * r, Y = py(p.lat) + Math.sin(ang) * r
            if (i) ctx.lineTo(X, Y)
            else ctx.moveTo(X, Y)
          }
        } else ctx.arc(px(p.lon), py(p.lat), r, 0, Math.PI * 2)
        ctx.strokeStyle = on ? key : fill
        ctx.globalAlpha = on ? 0.85 : isVoid ? 0.35 : 0.22
        ctx.lineWidth = isVoid ? 2 : on ? 1.4 : 0.8
        ctx.stroke()
        if (on && !compact && !isVoid) {
          ctx.globalAlpha = 0.75
          ctx.fillStyle = '#e9f1ff'
          ctx.font = '10px Arial'
          ctx.fillText(p.city.toUpperCase(), px(p.lon) + r + 4, py(p.lat) + 3)
        }
      }
      ctx.globalAlpha = 1

      // Live quakes and the station
      if (live && !compact) {
        for (const q of live.quakes) {
          const w = ((now / 1000) * 0.28 + (q.time % 1000) / 1000) % 1
          ctx.beginPath()
          ctx.arc(px(q.lon), py(q.lat), 1 + w * q.mag * 3, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255,122,77,${(1 - w) * 0.7})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
        if (live.iss) {
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(px(live.iss.lon), py(live.iss.lat), 2.2, 0, Math.PI * 2)
          ctx.fill()
          ctx.font = '9px Arial'
          ctx.globalAlpha = 0.6
          ctx.fillText('ISS LIVE', px(live.iss.lon) + 5, py(live.iss.lat) - 4)
          ctx.globalAlpha = 1
        }
      }

      // Threads. Each segment gets a dark under-stroke, so later threads pass
      // over earlier ones and the crossings read as a weave.
      heads.current = []
      const steps = 10
      ctx.lineCap = isVoid ? 'square' : 'round'
      ctx.lineJoin = isVoid ? 'miter' : 'round'
      list.forEach((s) => {
        const idx = SELVES.indexOf(s)
        const rows = sim.canonical.paths[s.id]
        const dim = focusId && focusId !== s.id ? 0.18 : 1
        const total = Math.floor((t - CLOCK.start) * steps)
        let prev = loomPoint(rows, idx, CLOCK.start)
        for (let n = 1; n <= total + 1; n++) {
          const tt = Math.min(t, CLOCK.start + n / steps)
          const cur = loomPoint(rows, idx, tt)
          if (Math.abs(cur[0] - prev[0]) < 90) {
            const age = t - tt
            const alpha = (0.25 + 0.75 * Math.exp(-age * 0.3)) * dim
            const width = isVoid ? (s.real ? 6 : 4) : (s.real ? 2.2 : 1.4) * (compact ? 0.8 : 1)
            ctx.strokeStyle = ground
            ctx.globalAlpha = 0.85 * dim
            ctx.lineWidth = width + 2.4
            ctx.beginPath()
            ctx.moveTo(px(prev[0]), py(prev[1]))
            ctx.lineTo(px(cur[0]), py(cur[1]))
            ctx.stroke()
            ctx.strokeStyle = s.color
            ctx.globalAlpha = alpha
            ctx.lineWidth = width
            ctx.stroke()
          }
          prev = cur
        }
        const [hx, hy] = loomPoint(rows, idx, t)
        const X = px(hx), Y = py(hy)
        heads.current.push({ id: s.id, x: X, y: Y })
        ctx.globalAlpha = dim
        if (isVoid) {
          const sz = s.real ? 10 : 8
          ctx.fillStyle = s.color
          ctx.fillRect(Math.round(X - sz / 2), Math.round(Y - sz / 2), sz, sz)
          ctx.fillStyle = '#fff'
          ctx.fillRect(Math.round(X - 2), Math.round(Y - 2), 4, 4)
          if (!compact) {
            ctx.fillStyle = s.color
            ctx.font = `16px ${PIXEL_FONT}`
            ctx.fillText(voidName(s.id), Math.round((X + 10) * dpr) / dpr, Math.round((Y - 10) * dpr) / dpr)
          }
          ctx.globalAlpha = 1
          return
        }
        const glow = ctx.createRadialGradient(X, Y, 0, X, Y, s.real ? 16 : 11)
        glow.addColorStop(0, '#ffffff')
        glow.addColorStop(0.25, s.color)
        glow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(X, Y, s.real ? 16 : 11, 0, Math.PI * 2)
        ctx.fill()
        if (!compact) {
          ctx.fillStyle = s.color
          ctx.font = (s.real ? 'bold ' : '') + '11px Arial'
          ctx.fillText(s.name, X + 10, Y - 9)
        }
        ctx.globalAlpha = 1
      })
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [compact])

  const nearest = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    let best: { id: string; d: number } | null = null
    for (const h of heads.current) {
      const d = Math.hypot(h.x - x, h.y - y)
      if (d < 18 && (!best || d < best.d)) best = { id: h.id, d }
    }
    return best?.id
  }

  const onMove = (e: React.PointerEvent) => {
    const id = nearest(e)
    if (!id) return hideTip()
    const s = SELF_BY_ID[id]
    const year = Math.min(CLOCK.end, Math.floor(clock.get().t))
    const row = sim.canonical.paths[id][year - CLOCK.start]
    const conn = sim.connection[row.place][year]
    showTip(e.clientX, e.clientY, (
      <div>
        <div className="tip-title" style={{ color: s.color }}>{s.name}, {year}</div>
        <div className="tip-row"><span>{PLACE_BY_ID[row.place].city}</span><b>{row.role}</b></div>
        <div className="tip-row"><span>Industry</span><b>{INDUSTRIES.find((i) => i.id === row.industry)!.label}</b></div>
        <div className="tip-row"><span>Income band</span><b>{'●'.repeat(row.incomeBand)}{'○'.repeat(5 - row.incomeBand)}</b></div>
        <div className="tip-row"><span>Network</span><b>{row.network}</b></div>
        <p className="tip-line">{row.narrative}</p>
        <Receipts items={conn.receipts} />
      </div>
    ))
  }

  return (
    <canvas
      ref={cv}
      className={'loom' + (style === 'void' ? ' void' : '')}
      onPointerMove={onMove}
      onPointerLeave={hideTip}
      onClick={(e) => { const id = nearest(e as unknown as React.PointerEvent); if (id) onSelect?.(id) }}
    />
  )
}
