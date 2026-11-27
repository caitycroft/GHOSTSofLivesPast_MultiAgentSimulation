// The Thanksgiving video art graphics, drawn frame by frame in Chromium on a
// transparent canvas over the simulation plates: the life tree, the big
// locator globe in each agent's colour, the photos and their labels, the
// causal tree, the agents side by side, the data cards, the ring of selves,
// the overhead race and the heart. window.draw(f) draws frame f. Frames are
// drawn in order: the globe, its jumps and the trails carry state.
(() => {
  const D = window.D
  const { W, H, FPS, L } = D
  const cv = document.getElementById('c'); cv.width = W; cv.height = H
  const g = cv.getContext('2d')
  const SANS = 'Arial, "Liberation Sans", sans-serif'
  const MONO = '"JetBrains Mono", "DejaVu Sans Mono", monospace'
  const PIX = '"Press Start 2P", monospace'
  const TAU = Math.PI * 2, rad = Math.PI / 180
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t) }
  const out3 = (t) => 1 - Math.pow(1 - clamp(t), 3)
  const lerp = (a, b, t) => a + (b - a) * t
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255] }
  const rgba = (h, a) => { const [r, gg, b] = hex(h); return `rgba(${r},${gg},${b},${clamp(a).toFixed(3)})` }
  const mix = (h1, h2, t) => { const a = hex(h1), b = hex(h2); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(t))).toString(16).padStart(2, '0')).join('') }
  let seed = 7
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const AG = Object.fromEntries(D.agents.map((a) => [a.id, a]))
  const REAL = '#ff9a3d', GOLD = '#ffd28a', WHITE = '#ffffff'
  const JUMP = 13 // frames a jump between places takes on the globe

  // photos, downscaled once (the full frame ones keep their original)
  const IMG = {}, ORIG = {}
  for (const im of document.images) {
    ORIG[im.dataset.id] = im
    const s = Math.min(1, 1500 / Math.max(im.naturalWidth, im.naturalHeight))
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s)
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
    IMG[im.dataset.id] = c
  }
  const dimsOf = (im) => [im.naturalWidth ?? im.width, im.naturalHeight ?? im.height]
  function cover(im, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) {
    const [iw, ih] = dimsOf(im)
    const s = Math.max(w / iw, h / ih) * zoom
    const sw = w / s, sh = h / s
    g.drawImage(im, (iw - sw) * fx, (ih - sh) * fy, sw, sh, x, y, w, h)
  }
  function fit(im, mw, mh, up = 1.8) {
    const [iw, ih] = dimsOf(im)
    const s = Math.min(mw / iw, mh / ih, up)
    return [Math.round(iw * s), Math.round(ih * s)]
  }
  function text(str, x, y, font, color, align = 'left', base = 'alphabetic', shadow = 0) {
    g.font = font; g.textAlign = align; g.textBaseline = base
    if (shadow) { g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = shadow; g.shadowOffsetY = 2 }
    g.fillStyle = color; g.fillText(str, x, y)
    if (shadow) { g.shadowBlur = 0; g.shadowOffsetY = 0 }
  }
  function fitFont(str, weight, size, maxw, min = 16) {
    let s = size
    for (; s > min; s -= 1) { g.font = `${weight} ${s}px ${SANS}`; if (g.measureText(str).width <= maxw) break }
    return `${weight} ${s}px ${SANS}`
  }
  function wrap(str, font, maxw) {
    g.font = font
    const out = []; let l = ''
    for (const w of str.split(' ')) { const t = l ? l + ' ' + w : w; if (g.measureText(t).width > maxw && l) { out.push(l); l = w } else l = t }
    if (l) out.push(l)
    return out
  }
  function glowLine(pts, color, width, alpha = 1, dash = null) {
    if (pts.length < 2) return
    g.lineCap = 'round'; g.lineJoin = 'round'
    const pass = (lw, a, c) => {
      g.strokeStyle = rgba(c, a * alpha); g.lineWidth = lw
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke()
    }
    g.setLineDash([])
    pass(width * 5, 0.12, color)
    pass(width * 2.4, 0.28, color)
    if (dash) g.setLineDash(dash)
    pass(width, 1, color)
    if (!dash) pass(Math.max(1, width * 0.35), 0.85, WHITE)
    g.setLineDash([])
  }
  function dotGlow(x, y, r, color, a = 1) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 4)
    gr.addColorStop(0, rgba(color, 0.55 * a)); gr.addColorStop(1, rgba(color, 0))
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 4, 0, TAU); g.fill()
    g.fillStyle = rgba(color, a); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill()
    g.fillStyle = rgba(WHITE, 0.9 * a); g.beginPath(); g.arc(x, y, r * 0.45, 0, TAU); g.fill()
  }
  const sample = (pts, s) => {
    // a point at fraction s of a polyline's length, with its heading
    const n = pts.length - 1
    if (!pts._len) { let acc = 0; pts._cum = [0]; for (let i = 1; i <= n; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); pts._cum.push(acc) } pts._len = acc }
    const d = clamp(s) * pts._len
    let i = 1; while (i < n && pts._cum[i] < d) i++
    const seg = pts._cum[i] - pts._cum[i - 1] || 1, u = (d - pts._cum[i - 1]) / seg
    const a = pts[i - 1], b = pts[i]
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), Math.atan2(b[1] - a[1], b[0] - a[0])]
  }
  const head = (pts, s) => { const n = Math.max(1, Math.round(clamp(s) * (pts.length - 1))); return pts.slice(0, n + 1) }
  const bez = (p0, p1, p2, p3, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]
  })
  const fmtLat = (v) => Math.abs(v).toFixed(2) + '°' + (v >= 0 ? 'N' : 'S'), fmtLon = (v) => Math.abs(v).toFixed(2) + '°' + (v >= 0 ? 'E' : 'W')
  const pct = (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%'

  // ------------------------------------------------------------------ globe
  const G = { x: L.globe.x, y: L.globe.y, r: L.globe.r, a: 0, lon: -100, lat: 20, cur: null, jump: null, trails: [], col: REAL }
  function proj(lon, lat, h = 0) {
    const l = (lon - G.lon) * rad, p = lat * rad, p0 = G.lat * rad
    const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)
    const R = G.r * (1 + h)
    return [G.x + R * Math.cos(p) * Math.sin(l), G.y - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), cosc]
  }
  function strokeGeo(pts) {
    g.beginPath(); let pen = false
    for (const [lo, la] of pts) {
      const [x, y, c] = proj(lo, la)
      if (c < 0) { pen = false; continue }
      if (!pen) { g.moveTo(x, y); pen = true } else g.lineTo(x, y)
    }
    g.stroke()
  }
  const MER = [], PAR = []
  for (let lo = -180; lo < 180; lo += 20) MER.push(Array.from({ length: 37 }, (_, i) => [lo, -90 + i * 5]))
  for (let la = -60; la <= 60; la += 20) PAR.push(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, la]))
  const vec = (lon, lat) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)]
  const unvec = ([x, y, z]) => [Math.atan2(y, x) / rad, Math.asin(clamp(z, -1, 1)) / rad]
  function arcPts(a, b, n = 48) {
    const A = vec(a.lon, a.lat), B = vec(b.lon, b.lat)
    const d = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1))
    return Array.from({ length: n + 1 }, (_, i) => {
      const s = i / n
      let p = A
      if (d > 1e-4) { const k1 = Math.sin((1 - s) * d) / Math.sin(d), k2 = Math.sin(s * d) / Math.sin(d); p = [A[0] * k1 + B[0] * k2, A[1] * k1 + B[1] * k2, A[2] * k1 + B[2] * k2] }
      const [lo, la] = unvec(p)
      return [lo, la, 0.22 * Math.sin(Math.PI * s) * clamp(d / 1.2, 0.25, 1)]
    })
  }
  function arcScreen(pts, upto = 1) {
    const out = []
    const m = Math.max(1, Math.round(upto * (pts.length - 1)))
    for (let i = 0; i <= m; i++) {
      const [lo, la, h] = pts[i]
      const [x, y, c] = proj(lo, la, h)
      const outside = Math.hypot(x - G.x, y - G.y) > G.r
      out.push([x, y, c > 0 || outside])
    }
    return out
  }
  function drawArc(pts, color, alpha, upto, comet) {
    const sp = arcScreen(pts, upto)
    let run = []
    const flush = () => { if (run.length > 1) glowLine(run, color, 2.6, alpha); run = [] }
    for (const p of sp) { if (p[2]) run.push(p); else flush() }
    flush()
    if (comet) { const p = sp[sp.length - 1]; if (p[2]) dotGlow(p[0], p[1], 7, color) }
  }
  function updateGlobe(f, sc) {
    const tgt = sc.globe
    if (tgt) {
      const e = 0.13
      G.x += (tgt.x - G.x) * e; G.y += (tgt.y - G.y) * e; G.r += (tgt.r - G.r) * e
    }
    G.a += ((tgt ? 1 : 0) - G.a) * 0.2
    const geo = sc.geo ? D.places[sc.geo] : null
    if (geo && G.cur?.key !== geo.key) {
      if (G.cur && G.a > 0.3) G.jump = { to: geo, f0: f, pts: arcPts(G.cur, geo) }
      G.cur = geo
    }
    if (geo) G.col = geo.color
    else if (sc.color) G.col = sc.color
    if (sc.spin != null) G.lon += sc.spin
    else if (G.cur && geo) {
      const dl = ((G.cur.lon - G.lon + 540) % 360) - 180
      G.lon += dl * 0.12; G.lat += (G.cur.lat * 0.55 - G.lat) * 0.12
    } else G.lon += 0.25
    G.lon = ((G.lon + 540) % 360) - 180
    if (G.jump && f - G.jump.f0 >= JUMP) { G.trails.push({ pts: G.jump.pts, color: G.jump.to.color, f }); G.jump = null }
    G.trails = G.trails.filter((tr) => f - tr.f < 80)
  }
  function drawGlobe(f, t, sc) {
    if (G.a < 0.02) return
    const { x, y, r } = G, acc = G.col
    g.save(); g.globalAlpha = G.a
    let gr = g.createRadialGradient(x, y, r * 0.8, x, y, r * 1.45)
    gr.addColorStop(0, rgba(acc, 0.34)); gr.addColorStop(0.35, rgba(acc, 0.12)); gr.addColorStop(1, rgba(acc, 0))
    g.fillStyle = gr; g.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3)
    gr = g.createRadialGradient(x - r * 0.3, y - r * 0.38, r * 0.05, x, y, r)
    gr.addColorStop(0, 'rgba(30,52,110,0.86)'); gr.addColorStop(0.7, 'rgba(7,12,34,0.88)'); gr.addColorStop(1, 'rgba(2,4,14,0.92)')
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill()
    g.lineWidth = 1; g.strokeStyle = rgba(acc, 0.17)
    for (const m of MER) strokeGeo(m)
    for (const p of PAR) strokeGeo(p)
    // land as a dot matrix, brighter toward the middle of the disc
    const ds = Math.max(1.5, r / 160)
    const bands = [[], [], [], []]
    for (let i = 0; i < D.dots.length; i += 2) {
      const [px, py, c] = proj(D.dots[i], D.dots[i + 1])
      if (c <= 0.03) continue
      bands[Math.min(3, (c * 4) | 0)].push(px, py)
    }
    const tint = mix('#d8ecff', acc, 0.4)
    bands.forEach((b, k) => { g.fillStyle = rgba(tint, 0.25 + k * 0.23); g.beginPath(); for (let i = 0; i < b.length; i += 2) g.rect(b[i] - ds / 2, b[i + 1] - ds / 2, ds, ds); g.fill() })
    g.strokeStyle = rgba(acc, 0.6); g.lineWidth = 1.3
    for (const ring of D.rings) strokeGeo(ring)
    g.strokeStyle = rgba(acc, 0.95); g.lineWidth = 2.4; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke()
    g.strokeStyle = rgba(WHITE, 0.22); g.lineWidth = 1; g.beginPath(); g.arc(x, y, r - 6, 0, TAU); g.stroke()
    if (r > 120) {
      g.lineWidth = 1.5
      for (let i = 0; i < 72; i++) {
        const a = i * 5 * rad, l = i % 6 === 0 ? 14 : 6
        g.strokeStyle = rgba(acc, i % 6 === 0 ? 0.85 : 0.35)
        g.beginPath(); g.moveTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12)); g.lineTo(x + Math.cos(a) * (r + 12 + l), y + Math.sin(a) * (r + 12 + l)); g.stroke()
      }
      g.lineWidth = 3.5
      for (let i = 0; i < 3; i++) { const a = t * 0.8 + i * 2.1; g.strokeStyle = rgba(i === 1 ? WHITE : acc, 0.85); g.beginPath(); g.arc(x, y, r + 38, a, a + 0.55); g.stroke() }
    }
    // every agent's home, in its colour
    for (const a of D.agents) {
      const [px, py, c] = proj(a.home.lon, a.home.lat)
      if (c < 0.05) continue
      g.fillStyle = rgba(a.neon, 0.45 + 0.55 * c); g.beginPath(); g.arc(px, py, Math.max(3, r / 75), 0, TAU); g.fill()
    }
    for (const tr of G.trails) drawArc(tr.pts, tr.color, 1 - (f - tr.f) / 80, 1, false)
    if (G.jump) drawArc(G.jump.pts, G.jump.to.color, 1, smooth((f - G.jump.f0 + 1) / JUMP), true)
    else if (G.cur && !sc.noPin) {
      const [mx, my, mc] = proj(G.cur.lon, G.cur.lat)
      if (mc > 0) {
        const col = G.cur.color
        for (let i = 0; i < 2; i++) {
          const p = ((t * 0.9) + i * 0.5) % 1
          g.strokeStyle = rgba(col, 1 - p); g.lineWidth = 2.5; g.beginPath(); g.arc(mx, my, 8 + p * r * 0.16, 0, TAU); g.stroke()
        }
        dotGlow(mx, my, Math.max(5, r / 42), col)
        if (r > 180 && !sc.noLabel) {
          const right = mx < x + r * 0.35
          const fs = Math.round(clamp(r / 11, 20, 32))
          text(G.cur.name, mx + (right ? 22 : -22), my - 10, `700 ${fs}px ${SANS}`, WHITE, right ? 'left' : 'right', 'alphabetic', 10)
          text(fmtLat(G.cur.lat) + '  ' + fmtLon(G.cur.lon), mx + (right ? 22 : -22), my + fs * 0.75, `${Math.round(fs * 0.55)}px ${MONO}`, rgba(col, 1), right ? 'left' : 'right', 'alphabetic', 8)
        }
      }
    }
    g.restore()
  }
  const pinXY = () => { if (!G.cur) return null; const [x, y, c] = proj(G.cur.lon, G.cur.lat); return c > 0 ? [x, y] : null }

  // ------------------------------------------------------------------ chrome
  const tick = Array.from({ length: 300 }, (_, i) => {
    const r = rnd()
    if (r < 0.2) return 'AGT' + String(1 + (i % 10)).padStart(2, '0') + ' P=' + rnd().toFixed(3)
    if (r < 0.32) return 'RUN ' + String(1 + Math.floor(rnd() * 100)).padStart(3, '0') + ' OK'
    return Array.from({ length: 3 }, () => Math.floor(rnd() * 65535).toString(16).toUpperCase().padStart(4, '0')).join(' ')
  })
  function chrome(f, t, sc, year) {
    const c = G.col
    g.strokeStyle = rgba(c, 0.07); g.lineWidth = 1
    const s = 72, oy = (t * 16) % s, ox = (t * 6) % s
    g.beginPath()
    for (let x = -s + ox; x < W; x += s) { g.moveTo(x, 0); g.lineTo(x, H) }
    for (let y = -s + oy; y < H; y += s) { g.moveTo(0, y); g.lineTo(W, y) }
    g.stroke()
    const sy = ((t * 0.22) % 1) * (H + 300) - 150
    const gr = g.createLinearGradient(0, sy - 110, 0, sy + 110)
    gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(0.5, rgba(c, 0.08)); gr.addColorStop(1, rgba(c, 0))
    g.fillStyle = gr; g.fillRect(0, sy - 110, W, 220)
    if (sc.noReadout) return
    const [dx, dy] = L.readout
    const run = String(1 + (Math.floor(t * 5) % 100)).padStart(3, '0')
    const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = (t % 60).toFixed(1).padStart(4, '0')
    text('GHOSTS OF LIVES PAST · SIM', dx, dy, `600 16px ${MONO}`, rgba(WHITE, 0.82), 'left', 'top')
    text('RUN ' + run + '/100   AGENTS 10', dx, dy + 22, `16px ${MONO}`, rgba(c, 0.95), 'left', 'top')
    text('YEAR ' + year + '   T+' + mm + ':' + ss, dx, dy + 44, `16px ${MONO}`, rgba(c, 0.95), 'left', 'top')
    if (sc.ticker) {
      const [tx, ty0, ty1] = L.tick, lh = 18
      const off = (t * 40) % lh, first = Math.floor((t * 40) / lh)
      g.font = `12px ${MONO}`; g.textBaseline = 'top'; g.textAlign = 'left'
      for (let y = ty0 - off, i = 0; y < ty1; y += lh, i++) {
        if (y < ty0) continue
        const edge = Math.min(1, (y - ty0) / 80, (ty1 - y) / 80)
        g.fillStyle = rgba(i % 6 === 2 ? WHITE : c, 0.4 * edge)
        g.fillText(tick[(first + i) % tick.length], tx, y)
      }
    }
  }

  // ------------------------------------------------------------------ the tree of lives
  // u runs along the life (0 in 2010, 1 now), v across it (-1 to 1); the real
  // life is the trunk, each ghost a branch that leaves it in the year she stayed
  const TIP = {
    la: [0.47, -0.82], sto: [0.62, 0.84], utah: [0.84, -0.78], hnl: [0.9, 0.62], lon: [1.0, -0.52],
    ber: [1.04, 0.9], nyc: [1.1, -0.95], osl: [1.13, 0.4], sha: [1.17, -0.22],
  }
  const trunkV = (u) => 0.07 * Math.sin(u * 6.5)
  const uOf = (yr) => (yr - 2010) / 16
  function treeMap(T, u, v) { return T.vertical ? [T.cx + v * T.hw, lerp(T.y0, T.y1, u)] : [lerp(T.x0, T.x1, u), T.cy + v * T.hh] }
  function treeGeom(T) {
    if (T._geo) return T._geo
    const trunk = Array.from({ length: 81 }, (_, i) => { const u = i / 80; return treeMap(T, u, trunkV(u)) })
    const branches = D.agents.filter((a) => !a.real).map((a) => {
      const uf = uOf(a.fork.year), [ut, vt] = TIP[a.id]
      const F = treeMap(T, uf, trunkV(uf)), C1 = treeMap(T, uf + 0.07, trunkV(uf) + vt * 0.08), C2 = treeMap(T, ut - 0.16, vt * 0.92), E = treeMap(T, ut, vt)
      return { a, uf, pts: bez(F, C1, C2, E, 36), tip: E }
    })
    const now = treeMap(T, 1, trunkV(1))
    const future = [[-0.3, 1.22], [0.05, 1.27], [0.38, 1.2]].map(([v, u]) => bez(now, treeMap(T, 1.05, trunkV(1)), treeMap(T, u - 0.08, v * 0.8), treeMap(T, u, v), 20))
    T._geo = { trunk, branches, now, future }
    return T._geo
  }
  const YEARS = [[2010, 'LOS ANGELES'], [2014, 'TOUR'], [2016, 'STOCKHOLM'], [2020, 'VENTURE'], [2022, 'NEW YORK'], [2024, 'SHANGHAI']]
  function treeScene(sc, f, t) {
    const T = L.tree, geo = treeGeom(T), m = sc.marks
    const grow = 1 - Math.pow(1 - clamp((f - m.grow[0]) / (m.grow[1] - m.grow[0])), 1.7)
    const stay = m.stay != null ? clamp((f - m.stay) / 10) : 0, leave = m.leave != null ? Math.max(0, 1 - Math.abs(f - m.leave - 6) / 14) : 0
    // a soft dark bed under the tree so the neon reads over the globe
    const gr = g.createRadialGradient(W / 2, (T.vertical ? (T.y0 + T.y1) / 2 : T.cy), 50, W / 2, (T.vertical ? (T.y0 + T.y1) / 2 : T.cy), Math.max(W, H) * 0.6)
    gr.addColorStop(0, 'rgba(2,3,12,0.55)'); gr.addColorStop(1, 'rgba(2,3,12,0.15)')
    g.fillStyle = gr; g.fillRect(0, 0, W, H)
    // the roads not taken
    for (const b of geo.branches) {
      const s = clamp((grow - b.uf) / 0.16)
      if (s <= 0) continue
      const a = 0.65 + 0.35 * stay
      glowLine(head(b.pts, s), b.a.neon, 4 + 2 * stay, a, [1, 12])
      if (s > 0.98) {
        const [tx, ty] = b.tip
        dotGlow(tx, ty, 6 + 3 * stay, b.a.neon, a)
        const up = T.vertical ? -22 : (ty < T.cy ? -20 : 38)
        text(b.a.fork.city.toUpperCase(), tx, ty + up, `700 ${T.vertical ? 30 : 26}px ${SANS}`, rgba(b.a.neon, 1), 'center', 'alphabetic', 12)
        text('STAYED ' + b.a.fork.year, tx, ty + up + (T.vertical ? -34 : 24), `600 16px ${MONO}`, rgba(WHITE, 0.75), 'center', 'alphabetic', 8)
      }
      // the first fork says it out loud
      if (b.a.id === 'la' && s > 0.5) {
        const [px, py] = sample(b.pts, 0.42)
        text('STAY', px + (T.vertical ? -18 : 0), py + (T.vertical ? 0 : -18), `700 22px ${SANS}`, rgba(b.a.neon, 1), T.vertical ? 'right' : 'center', 'middle', 10)
      }
    }
    // the life that happened
    const tr = head(geo.trunk, grow)
    glowLine(tr, REAL, 5 + 2.5 * leave, 1)
    const [hx, hy] = tr[tr.length - 1]
    dotGlow(hx, hy, 9 + 4 * leave, REAL)
    for (const [yr, label] of YEARS) {
      if (grow < uOf(yr)) continue
      const [x, y] = treeMap(T, uOf(yr), trunkV(uOf(yr)))
      g.fillStyle = rgba(REAL, 1); g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-6, -6, 12, 12); g.restore()
      if (T.vertical) text(yr + '  ' + label, x + 24, y + 7, `600 19px ${MONO}`, rgba(WHITE, 0.85), 'left', 'alphabetic', 8)
      else text(yr, x, y + 34, `600 17px ${MONO}`, rgba(WHITE, 0.85), 'center', 'alphabetic', 8), text(label, x, y + 54, `13px ${MONO}`, rgba(WHITE, 0.6), 'center', 'alphabetic', 8)
    }
    const la = geo.branches.find((b) => b.a.id === 'la')
    if (grow > la.uf + 0.05) { const [px, py] = treeMap(T, la.uf + 0.05, trunkV(la.uf + 0.05)); text('GO', px + (T.vertical ? 22 : 0), py + (T.vertical ? -8 : -20), `700 22px ${SANS}`, REAL, T.vertical ? 'left' : 'center', 'middle', 10) }
    if (grow > 0.995) {
      const n = geo.now
      text('NOW', n[0] + (T.vertical ? 22 : 0), n[1] + (T.vertical ? 8 : -22), `700 26px ${SANS}`, WHITE, T.vertical ? 'left' : 'center', 'alphabetic', 10)
      const fp = clamp((f - m.grow[1]) / 20)
      for (const p of geo.future) glowLine(head(p, fp), WHITE, 2.5, 0.35 + 0.15 * Math.sin(t * 3), [1, 10])
    }
    const [bx, by] = treeMap(T, 0, 0)
    text('PAST', bx + (T.vertical ? 0 : -20), by + (T.vertical ? 42 : 6), `600 15px ${MONO}`, rgba(WHITE, 0.55), T.vertical ? 'center' : 'right', 'alphabetic')
  }

  // ------------------------------------------------------------------ a place: photo, label, leader to the globe
  function placeScene(sc, f, t, k, n) {
    const im = IMG[sc.photo], P = D.places[sc.geo], B = L.photo
    const col = P ? P.color : REAL
    const [w, h] = fit(im, B.w, B.h)
    const x = L.vertical ? B.x : Math.round(B.x + (B.w - w) / 2), y = B.y
    const intro = sc.hard ? out3((k + 1) / 3) : out3((k + 1) / 7)
    const outro = sc.hard ? 1 : clamp((n - k) / 4)
    const a = intro * outro
    g.save(); g.globalAlpha = a
    // leader from the pin to the photo
    const pin = pinXY()
    if (pin && !G.jump && G.a > 0.5) {
      const tx = L.vertical ? x + 34 : x - 16, ty = L.vertical ? y - 18 : y + 40
      const ctl = L.vertical ? [pin[0], ty] : [tx - 120, pin[1]]
      const pts = Array.from({ length: 25 }, (_, i) => { const s = i / 24, u = 1 - s; return [u * u * pin[0] + 2 * u * s * ctl[0] + s * s * tx, u * u * pin[1] + 2 * u * s * ctl[1] + s * s * ty] })
      const p = out3(k / 6)
      glowLine(head(pts, p), col, 2, 0.75, [6, 7])
      if (p >= 1) { const q = sample(pts, (t * 0.9) % 1); dotGlow(q[0], q[1], 4, col) }
    }
    // the photo
    const sc0 = lerp(0.95, 1, intro)
    g.save(); g.translate(x + w / 2, y + h / 2); g.scale(sc0, sc0); g.translate(-x - w / 2, -y - h / 2)
    const arcade = sc.look === 'arcade'
    g.shadowColor = rgba(col, arcade ? 0.9 : 0.55); g.shadowBlur = arcade ? 34 : 24
    g.fillStyle = '#000'; g.fillRect(x, y, w, h)
    g.shadowBlur = 0
    if (sc.chapter === 'ended') g.filter = 'grayscale(0.8) brightness(0.8)'
    const kb = sc.pan ? 1.0 : 1 + 0.06 * (k / Math.max(1, n))
    if (sc.pan) cover(im, x, y, w, h, clamp(k / Math.max(1, n)), 0.5, 1.6)
    else cover(im, x, y, w, h, sc.fx ?? 0.5, sc.fy ?? 0.5, kb)
    g.filter = 'none'
    g.strokeStyle = arcade ? rgba(col, 1) : rgba(WHITE, 0.9); g.lineWidth = arcade ? 3 : 2
    g.strokeRect(x, y, w, h)
    const pad = 12, Lb = 36
    g.strokeStyle = rgba(col, 1); g.lineWidth = 3
    for (const [cx, cy, sx, sy] of [[x - pad, y - pad, 1, 1], [x + w + pad, y - pad, -1, 1], [x - pad, y + h + pad, 1, -1], [x + w + pad, y + h + pad, -1, -1]]) { g.beginPath(); g.moveTo(cx + sx * Lb, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + sy * Lb); g.stroke() }
    g.restore()
    // the label
    if (P) {
      const lx = L.vertical ? x + w + 34 : x, maxw = L.vertical ? L.labelMaxX - lx : Math.max(w, 640)
      let ly = L.vertical ? y + 6 : y + h + 30
      const big = L.vertical ? 44 : 52
      const nameFont = fitFont(P.name, 700, big, maxw, 22)
      ly += parseInt(nameFont.split(' ')[1]) * 0.9
      text(P.name, lx, ly, nameFont, col, 'left', 'alphabetic', 14)
      ly += L.vertical ? 34 : 38
      const yr = sc.ghost ? '' : ' · ' + (sc.year ?? P.yr)
      text(P.country + yr, lx, ly, `400 ${L.vertical ? 24 : 26}px ${SANS}`, rgba(WHITE, 0.92), 'left', 'alphabetic', 10)
      ly += L.vertical ? 28 : 30
      text(fmtLat(P.lat) + '  ' + fmtLon(P.lon), lx, ly, `16px ${MONO}`, rgba(WHITE, 0.65), 'left', 'alphabetic', 8)
      if (!sc.quick && P.gdp != null) { ly += 24; text(P.iso + ' ' + P.yr + '  GDP ' + pct(P.gdp) + (P.infl != null ? '  INFL ' + P.infl.toFixed(1) + '%' : ''), lx, ly, `16px ${MONO}`, rgba(col, 1), 'left', 'alphabetic', 8) }
      const chip = (label, filled) => {
        ly += 22
        g.font = `700 15px ${MONO}`
        const cw = g.measureText(label).width + 22
        if (filled) { g.fillStyle = rgba(col, 0.95); g.fillRect(lx, ly, cw, 28) } else { g.strokeStyle = rgba(col, 0.9); g.lineWidth = 1.5; g.strokeRect(lx + 0.5, ly + 0.5, cw, 28) }
        text(label, lx + 11, ly + 19, `700 15px ${MONO}`, filled ? '#05060c' : rgba(col, 1), 'left', 'alphabetic')
        ly += 28
      }
      if (sc.ghost) {
        const A = AG[sc.ghost]
        chip('MY AGENT · STAYED ' + A.fork.year, true)
        const p = smooth((k - 4) / Math.max(1, n * 0.55))
        const yrNow = Math.round(lerp(A.fork.year, 2026, p))
        const row = A.rows[yrNow - 2010]
        ly += L.vertical ? 44 : 52
        text(String(yrNow), lx, ly, `700 ${L.vertical ? 40 : 46}px ${MONO}`, WHITE, 'left', 'alphabetic', 12)
        const rl = wrap(row.role.toUpperCase(), `700 ${L.vertical ? 26 : 30}px ${SANS}`, maxw)
        for (const l of rl) { ly += L.vertical ? 32 : 36; text(l, lx, ly, `700 ${L.vertical ? 26 : 30}px ${SANS}`, col, 'left', 'alphabetic', 12) }
        ly += 26
        text(row.industryLabel.toUpperCase() + '  ·  ' + row.city.toUpperCase(), lx, ly, `15px ${MONO}`, rgba(WHITE, 0.7), 'left', 'alphabetic', 8)
      } else if (sc.chapter) chip(sc.chapter === 'ended' ? 'CHAPTER ENDED' : 'STILL GOING', sc.chapter !== 'ended')
      else if (P.agent && !sc.quick) chip(AG[P.agent].real ? 'LIVED · NOW' : 'LIVED · ' + P.yr, false)
    }
    g.restore()
  }

  // ------------------------------------------------------------------ the street: the selves who stayed peel off
  function forksScene(sc, f, t, k, n) {
    const vp = L.vp
    const ghosts = D.agents.filter((a) => !a.real)
    ghosts.forEach((a, i) => {
      const s = (k - 4 - i * (n - 40) / ghosts.length) / 44
      if (s <= 0 || s > 1.5) return
      const side = i % 2 ? 1 : -1
      const end = [vp[0] + side * W * (0.3 + 0.05 * (i % 3)), H * (L.vertical ? 0.62 + 0.03 * (i % 4) : 0.8 + 0.04 * (i % 3))]
      const p = out3(s)
      const x = lerp(vp[0], end[0], p), y = lerp(vp[1], end[1], p * p)
      const pts = Array.from({ length: 20 }, (_, j) => { const q = (p * j) / 19; return [lerp(vp[0], end[0], q), lerp(vp[1], end[1], q * q)] })
      const a1 = clamp(1.5 - s)
      glowLine(pts, a.neon, 2 + 4 * p, a1, [1, 10])
      const scale = 0.7 + 0.8 * p
      g.save(); g.globalAlpha = a1; g.translate(x, y); g.scale(scale, scale)
      const label = a.fork.city.toUpperCase() + ' SELF'
      g.font = `700 24px ${SANS}`
      const tw = g.measureText(label).width + 30
      g.fillStyle = rgba('#05060c', 0.75); g.fillRect(-tw / 2, -42, tw, 36)
      g.strokeStyle = rgba(a.neon, 1); g.lineWidth = 2; g.strokeRect(-tw / 2, -42, tw, 36)
      text(label, 0, -17, `700 24px ${SANS}`, a.neon, 'center', 'alphabetic')
      text('STAYED ' + a.fork.year, 0, 16, `600 15px ${MONO}`, rgba(WHITE, 0.85), 'center', 'alphabetic', 8)
      g.restore()
      dotGlow(x, y - 52 * scale, 5, a.neon, a1)
    })
  }

  // ------------------------------------------------------------------ the causal tree
  function simTree(sc, f, t, k, n) {
    const T = L.sim
    const gr = g.createRadialGradient(T.cx, T.cy, 30, T.cx, T.cy, T.R * 2.1)
    gr.addColorStop(0, 'rgba(2,3,12,0.72)'); gr.addColorStop(0.7, 'rgba(2,3,12,0.4)'); gr.addColorStop(1, 'rgba(2,3,12,0)')
    g.fillStyle = gr; g.beginPath(); g.ellipse(T.cx, T.cy, T.R * 2.1 * T.sx, T.R * 2.1, 0, 0, TAU); g.fill()
    const spin = t * 0.04
    D.agents.forEach((a, i) => {
      const ang = -Math.PI / 2 + i * TAU / 10 + spin
      const s1 = out3((k - i * 0.9) / 10)
      if (s1 <= 0) return
      const ex = T.cx + Math.cos(ang) * T.R * T.sx, ey = T.cy + Math.sin(ang) * T.R
      const mid = [T.cx + Math.cos(ang - 0.18) * T.R * 0.5 * T.sx, T.cy + Math.sin(ang - 0.18) * T.R * 0.5]
      const pts = bez([T.cx, T.cy], mid, mid, [ex, ey], 24)
      glowLine(head(pts, s1), a.neon, 3, 1, a.real ? null : [2, 9])
      if (s1 < 1) return
      dotGlow(ex, ey, 8, a.neon)
      // where she ends up across the runs: the three likeliest industries
      const ends = Object.entries(a.ends).sort((p, q) => q[1] - p[1]).slice(0, 3)
      ends.forEach(([ind, runs], j) => {
        const s2 = out3((k - 12 - i * 0.9 - j * 2) / 10)
        if (s2 <= 0) return
        const sa = ang + (j - 1) * 0.3
        const len = T.R2 * (0.55 + 0.45 * runs / 60)
        const fx = ex + Math.cos(sa) * len * T.sx, fy = ey + Math.sin(sa) * len
        const ip = D.industries[ind]
        glowLine([[ex, ey], [lerp(ex, fx, s2), lerp(ey, fy, s2)]], ip.color, 1 + runs / 18, 0.9, [1, 7])
        if (s2 >= 1) {
          dotGlow(fx, fy, 3 + runs / 14, ip.color)
          text(ip.short.toUpperCase() + ' ' + runs, fx + Math.cos(sa) * 12, fy + Math.sin(sa) * 12 + 5, `600 15px ${MONO}`, rgba(WHITE, 0.85), Math.cos(sa) >= 0 ? 'left' : 'right', 'alphabetic', 6)
        }
      })
      const lx = ex - Math.cos(ang) * 20, ly = ey - Math.sin(ang) * 20
      text(a.real ? 'ME' : a.fork.city.toUpperCase(), lx, ly + 7, `700 ${T.font}px ${SANS}`, WHITE, Math.cos(ang) > 0.2 ? 'right' : Math.cos(ang) < -0.2 ? 'left' : 'center', 'alphabetic', 12)
    })
    dotGlow(T.cx, T.cy, 13, REAL)
    text('2010', T.cx, T.cy + 38, `700 18px ${MONO}`, WHITE, 'center', 'alphabetic', 8)
    text('CAUSAL TREE  ·  10 AGENTS  ·  100 RUNS  ·  2010 TO 2031', W / 2, T.head, `600 18px ${MONO}`, rgba(WHITE, 0.88), 'center', 'alphabetic', 8)
  }

  // ------------------------------------------------------------------ the agents side by side
  function tileRect(i) {
    const T = L.tiles, c = i % T.cols, r = Math.floor(i / T.cols)
    return { x: T.x0 + c * (T.w + T.gx), y: T.y0 + r * (T.h + T.gy), w: T.w, h: T.h }
  }
  function spark(iso, upto, x, y, w, h, col, strong) {
    const s = D.gdp[iso]; if (!s) return
    g.strokeStyle = rgba(WHITE, 0.25); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke()
    const pts = []
    for (let yr = 2010; yr <= Math.min(upto, 2024); yr++) { const v = s[yr]; if (v == null) continue; pts.push([x + (w * (yr - 2010)) / 14, y + h / 2 - clamp(v / 10, -1, 1) * h / 2]) }
    if (pts.length > 1) glowLine(pts, col, strong ? 2.4 : 1.6, 1)
  }
  function agentsScene(sc, f, t, k, n) {
    const T = L.tiles, m = sc.marks
    const order = D.tileOrder
    const yf = f < m.build ? 2010 : lerp(2010, 2026, smooth((f - m.build) / Math.max(1, sc.f1 - 14 - m.build)))
    const year = Math.floor(yf)
    const zi = order.indexOf('utah'), tr = tileRect(zi)
    const th = { x: tr.x + T.thumb.x, y: tr.y + T.thumb.y, w: T.thumb.w, h: T.thumb.h }
    const z = smooth((k - 6) / (1.25 * FPS))
    const s0 = Math.min((W * 0.78) / th.w, (H * 0.5) / th.h)
    const s = Math.pow(s0, 1 - z)
    const cx0 = th.x + th.w / 2, cy0 = th.y + th.h / 2
    const ox = lerp(W / 2, cx0, z) - cx0 * s, oy = lerp(H * 0.42, cy0, z) - cy0 * s
    // the backdrop dims as the grid arrives, so the tiles read
    g.fillStyle = `rgba(3,4,14,${(0.2 + 0.35 * z).toFixed(3)})`; g.fillRect(0, 0, W, H)
    g.save(); g.setTransform(s, 0, 0, s, ox, oy)
    order.forEach((id, i) => {
      const a = AG[id], r = tileRect(i), row = a.rows[year - 2010]
      const forked = a.real || year >= a.fork.year
      const flash = a.real ? 0 : Math.max(0, 1 - Math.abs(yf - a.fork.year - 0.15) * 3)
      g.fillStyle = 'rgba(5,7,20,0.8)'; g.fillRect(r.x, r.y, r.w, r.h)
      g.shadowColor = rgba(a.neon, 0.8); g.shadowBlur = 16 + 30 * flash
      g.strokeStyle = rgba(a.neon, forked ? 1 : 0.55); g.lineWidth = 2 + 2 * flash; g.strokeRect(r.x, r.y, r.w, r.h)
      g.shadowBlur = 0
      const tb = { x: r.x + T.thumb.x, y: r.y + T.thumb.y, w: T.thumb.w, h: T.thumb.h }
      cover(IMG[a.photo], tb.x, tb.y, tb.w, tb.h, a.fx ?? 0.5, a.fy ?? 0.35)
      g.strokeStyle = rgba(a.neon, 0.9); g.lineWidth = 1.5; g.strokeRect(tb.x, tb.y, tb.w, tb.h)
      const tx = r.x + T.text.x, tw = T.text.w
      let ty = r.y + T.text.y
      const name = a.real ? 'ME' : a.fork.city.toUpperCase()
      text(name, tx, ty, fitFont(name, 700, T.fs.name, tw, 16), a.neon, 'left', 'alphabetic', 8)
      ty += T.fs.gap
      text(a.real ? 'THE ONE WHO LIVED IT' : (forked ? 'STAYED ' + a.fork.year : 'LIVED · FORKS ' + a.fork.year), tx, ty, `600 ${T.fs.small}px ${MONO}`, rgba(WHITE, forked ? 0.8 : 0.5), 'left', 'alphabetic')
      ty += T.fs.gap + 2
      const rf = `700 ${T.fs.role}px ${SANS}`
      for (const l of wrap(row.role, rf, tw).slice(0, 2)) { ty += T.fs.role + 2; text(l, tx, ty, rf, rgba(WHITE, forked ? 1 : 0.6), 'left', 'alphabetic') }
      const chipOn = f >= m.industries ? Math.max(0.3, 1 - (f - m.industries) / 30) : 0
      const cy = r.y + r.h - T.fs.chipB
      g.font = `700 ${T.fs.small}px ${MONO}`
      const cw = g.measureText(row.industryLabel.toUpperCase()).width + 16
      g.fillStyle = rgba(row.industryColor, 0.85 + 0.15 * chipOn); g.fillRect(tx, cy - T.fs.small - 6, cw, T.fs.small + 10)
      if (chipOn) { g.strokeStyle = rgba(WHITE, chipOn); g.lineWidth = 2; g.strokeRect(tx - 2, cy - T.fs.small - 8, cw + 4, T.fs.small + 14) }
      text(row.industryLabel.toUpperCase(), tx + 8, cy, `700 ${T.fs.small}px ${MONO}`, '#05060c', 'left', 'alphabetic')
      const eco = f >= m.economy
      spark(row.iso, year, tx + cw + 12, cy - T.fs.small - 8, tw - cw - 14, T.fs.small + 14, a.neon, eco)
      if (eco) text('GDP', tx + tw, cy - T.fs.small - 10, `600 11px ${MONO}`, rgba(WHITE, 0.7), 'right', 'alphabetic')
      if (flash > 0.05) text('FORK', r.x + r.w - 10, r.y + 24, `700 16px ${MONO}`, rgba(WHITE, flash), 'right', 'alphabetic', 8)
    })
    g.restore()
    const hv = clamp((k - 6 - 1.25 * FPS) / 10)
    if (hv > 0) {
      text(String(year), L.tilesHead[0], L.tilesHead[1], `700 ${L.vertical ? 64 : 58}px ${SANS}`, rgba(WHITE, hv), 'left', 'alphabetic', 12)
      text('10 AGENTS  ·  SAME START  ·  REAL DATA', L.tilesHead[0] + (L.vertical ? 175 : 165), L.tilesHead[1] - 8, `600 18px ${MONO}`, rgba(GOLD, hv), 'left', 'alphabetic', 8)
    }
  }

  // ------------------------------------------------------------------ the data card for one self
  function chart(iso, metric, key, era, x, y, w, h, col, k) {
    const s = (metric === 'infl' ? D.inflation : D.gdp)[iso] || {}
    const vals = []; for (let yr = 2010; yr <= 2024; yr++) if (s[yr] != null) vals.push([yr, s[yr]])
    const lo = Math.min(-2, ...vals.map((v) => v[1])), hi = Math.max(4, ...vals.map((v) => v[1]))
    const X = (yr) => x + (w * (yr - 2010)) / 14, Y = (v) => y + h - ((v - lo) / (hi - lo)) * h
    g.fillStyle = 'rgba(4,6,18,0.72)'; g.fillRect(x - 18, y - 44, w + 36, h + 86)
    g.strokeStyle = rgba(col, 0.5); g.lineWidth = 1.5; g.strokeRect(x - 18, y - 44, w + 36, h + 86)
    // the era band
    const eb = clamp((k - 6) / 8)
    g.fillStyle = rgba(era.accent, 0.22 * eb); g.fillRect(X(Math.max(2010, era.start)), y - 10, X(Math.min(2024, era.end)) - X(Math.max(2010, era.start)) || 18, h + 20)
    g.strokeStyle = rgba(WHITE, 0.18); g.lineWidth = 1
    for (const v of [0]) { g.beginPath(); g.moveTo(x, Y(v)); g.lineTo(x + w, Y(v)); g.stroke() }
    for (const yr of [2010, 2015, 2020, 2024]) text(String(yr), X(yr), y + h + 30, `14px ${MONO}`, rgba(WHITE, 0.6), 'center', 'alphabetic')
    text((metric === 'infl' ? 'INFLATION' : 'GDP GROWTH') + ', ' + iso + ', WORLD BANK', x, y - 18, `600 14px ${MONO}`, rgba(WHITE, 0.75), 'left', 'alphabetic')
    const p = out3(k / 14)
    const pts = vals.map(([yr, v]) => [X(yr), Y(v)])
    glowLine(head(pts, p), col, 3, 1)
    if (k > 12 && s[key] != null) {
      const px = X(key), py = Y(s[key]), q = clamp((k - 12) / 6)
      for (let i = 0; i < 2; i++) { const pp = ((k / FPS) * 0.9 + i * 0.5) % 1; g.strokeStyle = rgba(WHITE, (1 - pp) * q); g.lineWidth = 2; g.beginPath(); g.arc(px, py, 8 + pp * 30, 0, TAU); g.stroke() }
      dotGlow(px, py, 7, col, q)
      const right = px < x + w * 0.6
      text(key + '  ' + pct(s[key]).replace('+', metric === 'infl' ? '' : '+'), px + (right ? 18 : -18), py - 16, `700 26px ${SANS}`, rgba(WHITE, q), right ? 'left' : 'right', 'alphabetic', 10)
    }
  }
  function silhouette(iso, place, x, y, w, h, col, k) {
    const polys = D.shapes[iso]; if (!polys) return
    const near = polys.filter((p) => { const c = p.reduce((s, q) => [s[0] + q[0], s[1] + q[1]], [0, 0]).map((v) => v / p.length); return Math.hypot(c[0] - place.lon, c[1] - place.lat) < 28 })
    if (!near.length) return
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
    const cl = Math.cos(place.lat * rad)
    for (const p of near) for (const [lo, la] of p) { x0 = Math.min(x0, lo * cl); x1 = Math.max(x1, lo * cl); y0 = Math.min(y0, la); y1 = Math.max(y1, la) }
    const s = Math.min(w / (x1 - x0), h / (y1 - y0))
    const ox = x + (w - (x1 - x0) * s) / 2, oy = y + (h - (y1 - y0) * s) / 2
    const P = (lo, la) => [ox + (lo * cl - x0) * s, oy + (y1 - la) * s]
    const a = clamp(k / 8)
    g.save(); g.globalAlpha = a
    g.fillStyle = rgba(col, 0.16); g.strokeStyle = rgba(col, 1); g.lineWidth = 2
    g.shadowColor = rgba(col, 0.9); g.shadowBlur = 18
    for (const p of near) { g.beginPath(); p.forEach(([lo, la], i) => { const [px, py] = P(lo, la); i ? g.lineTo(px, py) : g.moveTo(px, py) }); g.closePath(); g.fill(); g.stroke() }
    g.shadowBlur = 0
    const [px, py] = P(place.lon, place.lat)
    dotGlow(px, py, 6, WHITE, a)
    text(place.name, px, py - 16, `700 16px ${MONO}`, WHITE, 'center', 'alphabetic', 8)
    g.restore()
  }
  function honestScene(sc, f, t, k, n) {
    const A = AG[sc.agent], P = D.places[sc.geo], C = L.honest, col = A.neon
    const era = D.eras.find((e) => sc.key >= e.start && sc.key < e.end) ?? D.eras[D.eras.length - 1]
    const row = A.rows[2026 - 2010]
    const push = 1 + 0.035 * (k / Math.max(1, n))
    g.save(); g.translate(W / 2, H / 2); g.scale(push, push); g.translate(-W / 2, -H / 2)
    g.fillStyle = 'rgba(3,4,14,0.35)'; g.fillRect(0, 0, W, H)
    silhouette(P.iso, P, C.sil.x, C.sil.y, C.sil.w, C.sil.h, col, k)
    const ax = (d) => { const q = out3((k - d) / 7); return [lerp(-30, 0, q), q] }
    let [dx, q] = ax(0)
    let y = C.ty
    g.globalAlpha = q
    text('MY ' + A.fork.city.toUpperCase() + ' SELF', C.tx + dx, y, fitFont('MY ' + A.fork.city.toUpperCase() + ' SELF', 700, C.fs[0], C.tw, 30), col, 'left', 'alphabetic', 16)
    ;[dx, q] = ax(3); g.globalAlpha = q
    y += C.fs[1] + 18
    text('2026  ·  ' + row.role.toUpperCase(), C.tx + dx, y, fitFont('2026  ·  ' + row.role.toUpperCase(), 700, C.fs[1], C.tw, 22), WHITE, 'left', 'alphabetic', 14)
    ;[dx, q] = ax(6); g.globalAlpha = q
    y += 50
    g.font = `700 18px ${MONO}`
    const chipT = sc.key + '  ·  ' + era.label.toUpperCase()
    const cw = Math.min(C.tw, g.measureText(chipT).width + 24)
    g.fillStyle = rgba(era.accent, 0.92); g.fillRect(C.tx + dx, y - 26, cw, 36)
    text(chipT, C.tx + dx + 12, y - 2, fitFont(chipT, 700, 18, cw - 24, 12).replace(SANS, MONO), '#05060c', 'left', 'alphabetic')
    y += 44
    text(sc.trend.toUpperCase(), C.tx + dx, y, `700 ${C.fs[2]}px ${SANS}`, era.accent, 'left', 'alphabetic', 12)
    g.globalAlpha = 1
    chart(P.iso, sc.metric, sc.key, era, C.chart.x, C.chart.y, C.chart.w, C.chart.h, col, k - 4)
    g.restore()
  }

  // ------------------------------------------------------------------ all of them, around the world
  function ringScene(sc, f, t, k, n) {
    const R = L.ring, m = sc.marks
    const warm = m.grateful != null ? smooth((f - m.grateful) / 14) : 0
    const order = D.tileOrder
    order.forEach((id, i) => {
      const a = AG[id]
      const ang = -Math.PI / 2 + i * TAU / order.length
      const x = R.cx + Math.cos(ang) * R.rx, y = R.cy + Math.sin(ang) * R.ry
      const pop = out3((k - i * 1.6) / 8)
      if (pop <= 0) return
      const col = mix(a.neon, GOLD, warm * 0.85)
      // the line from her photo to her place on the globe
      const [px, py, c] = proj(a.home.lon, a.home.lat)
      let ex = px, ey = py, vis = c > 0
      if (!vis) { const d = Math.hypot(px - G.x, py - G.y) || 1; ex = G.x + (px - G.x) / d * G.r; ey = G.y + (py - G.y) / d * G.r }
      const lp = out3((k - i * 1.6 - 4) / 10)
      if (lp > 0) {
        const pts = Array.from({ length: 21 }, (_, j) => { const s = j / 20; return [lerp(x, ex, s), lerp(y, ey, s) - Math.sin(Math.PI * s) * 18] })
        glowLine(head(pts, lp), col, 2.2 + 1.5 * warm, vis ? 1 : 0.4, a.real ? null : [2, 8])
        if (lp >= 1) { for (let j = 0; j < 2; j++) { const q = sample(pts, ((t * 0.8) + j * 0.5 + i * 0.13) % 1); dotGlow(q[0], q[1], 3.5, col, vis ? 1 : 0.4) } }
        if (vis && lp >= 1) dotGlow(ex, ey, 6, col)
      }
      const r = R.tr * pop
      g.save()
      g.shadowColor = rgba(col, 0.95); g.shadowBlur = 22 + 22 * warm
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = '#000'; g.fill()
      g.shadowBlur = 0
      g.clip(); cover(IMG[a.photo], x - r, y - r, r * 2, r * 2, a.fx ?? 0.5, a.fy ?? 0.35)
      g.restore()
      g.strokeStyle = rgba(col, 1); g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke()
      if (pop > 0.9) {
        const below = Math.sin(ang) > -0.3
        text(a.real ? 'ME, NOW' : a.fork.city.toUpperCase(), x, y + (below ? r + 26 : -r - 12), `700 ${R.fs}px ${SANS}`, WHITE, 'center', 'alphabetic', 10)
      }
    })
    if (warm > 0) {
      const p = ((f - m.grateful) / 45) % 1
      g.strokeStyle = rgba(GOLD, (1 - p) * 0.6 * warm); g.lineWidth = 3
      g.beginPath(); g.arc(G.x, G.y, G.r * (1 + p * 1.4), 0, TAU); g.stroke()
    }
  }

  // ------------------------------------------------------------------ the race, from above
  function raceGeom() {
    if (raceGeom.g) return raceGeom.g
    const T = L.race
    const map = (u, v) => (T.vertical ? [T.cx + v * T.hw, lerp(T.y0, T.y1, u)] : [lerp(T.x0, T.x1, u), T.cy + v * T.hh])
    const tv = (u) => 0.16 * Math.sin(u * 7.5) + 0.05 * Math.sin(u * 17)
    const trunk = Array.from({ length: 121 }, (_, i) => { const u = i / 120; return map(u, tv(u)) })
    const ghosts = D.agents.filter((a) => !a.real)
    const roads = ghosts.map((a, i) => {
      const uf = 0.08 + 0.09 * i, side = i % 2 ? 1 : -1
      const pts = []
      for (let j = 0; j <= 60; j++) {
        const s = j / 60, u = uf + (1.05 - uf) * s
        const v = tv(uf) + side * (0.95 - 0.04 * (i % 3)) * smooth(s * 1.6) + 0.06 * Math.sin(s * 9 + i)
        pts.push(map(u, v))
      }
      return { a, uf, pts }
    })
    raceGeom.g = { trunk, roads }
    return raceGeom.g
  }
  function raceScene(sc, f, t, k, n) {
    const T = L.race, m = sc.marks, geo = raceGeom()
    const took = m.took != null ? Math.max(0, 1 - Math.abs(f - m.took - 5) / 18) : 0
    const didnt = m.didnt != null ? clamp((f - m.didnt) / 10) : 0
    g.fillStyle = 'rgba(3,3,12,0.72)'; g.fillRect(0, 0, W, H)
    g.save()
    g.translate(W / 2, H / 2); g.rotate((T.vertical ? 1 : -1) * 0.04 * Math.sin(t * 0.4)); g.scale(1.02 + 0.03 * (k / n), 1.02 + 0.03 * (k / n)); g.translate(-W / 2, -H / 2)
    // ground grid from above
    g.strokeStyle = 'rgba(140,90,255,0.16)'; g.lineWidth = 1
    const s = 60, off = (t * 40) % s
    g.beginPath()
    for (let x = -s; x < W + s; x += s) { g.moveTo(x, 0); g.lineTo(x, H) }
    for (let y = -s + (T.vertical ? off : 0); y < H + s; y += s) { g.moveTo(0, y); g.lineTo(W, y) }
    g.stroke()
    const road = (pts, color, a, dotted) => {
      g.lineCap = 'round'; g.lineJoin = 'round'
      g.strokeStyle = rgba('#090a1c', 0.9 * a); g.lineWidth = 34
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke()
      glowLine(pts, color, dotted ? 3 : 4, a, dotted ? [2, 12] : null)
    }
    const p = (k + 4) / (n * 0.78)
    for (const r of geo.roads) road(r.pts, r.a.neon, 0.55 + 0.45 * didnt, true)
    road(geo.trunk, REAL, 0.75 + 0.25 * took, false)
    // the hovercraft: the whole pack runs the real road, and each peels off at her fork
    const craft = (pts, s, color, label, lab) => {
      const [x, y, hd] = sample(pts, s)
      const trail = []
      for (let j = 0; j < 14; j++) { const q = sample(pts, Math.max(0, s - j * 0.012)); trail.push([q[0], q[1]]) }
      for (let j = 1; j < trail.length; j++) { g.strokeStyle = rgba(color, (1 - j / trail.length) * 0.7); g.lineWidth = 10 * (1 - j / trail.length) + 2; g.beginPath(); g.moveTo(trail[j - 1][0], trail[j - 1][1]); g.lineTo(trail[j][0], trail[j][1]); g.stroke() }
      g.save(); g.translate(x, y); g.rotate(hd)
      g.shadowColor = rgba(color, 1); g.shadowBlur = 18
      g.fillStyle = rgba(color, 1); g.beginPath(); g.moveTo(16, 0); g.lineTo(-11, -9); g.lineTo(-6, 0); g.lineTo(-11, 9); g.closePath(); g.fill()
      g.shadowBlur = 0; g.fillStyle = WHITE; g.beginPath(); g.arc(4, 0, 2.5, 0, TAU); g.fill()
      g.restore()
      if (label && lab > 0) text(label, x, y - 22, `700 20px ${SANS}`, rgba(color, lab), 'center', 'alphabetic', 10)
    }
    craft(geo.trunk, clamp(p), REAL, 'ME', 1)
    for (const r of geo.roads) {
      if (p < r.uf) { craft(geo.trunk, clamp(p - 0.008 * (D.agents.indexOf(r.a))), r.a.neon, null, 0); continue }
      const sp = clamp((p - r.uf) / (1.05 - r.uf) * 1.15)
      craft(r.pts, sp, r.a.neon, r.a.fork.city.toUpperCase(), clamp(sp * 6))
    }
    g.restore()
    text(took > 0.2 || f < (m.didnt ?? 1e9) ? 'THE ROAD I TOOK' : 'THE ONES I DIDN’T', L.raceTag[0], L.raceTag[1], `700 22px ${MONO}`, f < (m.didnt ?? 1e9) ? REAL : GOLD, 'left', 'alphabetic', 10)
    g.setLineDash(f < (m.didnt ?? 1e9) ? [] : [2, 8]); g.strokeStyle = f < (m.didnt ?? 1e9) ? REAL : GOLD; g.lineWidth = 3
    g.beginPath(); g.moveTo(L.raceTag[0], L.raceTag[1] + 14); g.lineTo(L.raceTag[0] + 170, L.raceTag[1] + 14); g.stroke(); g.setLineDash([])
  }

  // ------------------------------------------------------------------ full frame photos
  function fullPhoto(sc, k, n) {
    const im = ORIG[sc.photo]
    const [iw, ih] = dimsOf(im)
    const r = (iw / ih) / (W / H)
    const zoom = 1 + 0.05 * (k / Math.max(1, n))
    const [fx, fy] = sc.pos ?? [0.5, 0.5]
    if (sc.cover || (r < 1.4 && r > 1 / 1.4)) cover(im, 0, 0, W, H, fx, fy, sc.still ? 1 : zoom)
    else {
      g.filter = 'blur(40px) brightness(0.42)'; cover(im, -60, -60, W + 120, H + 120); g.filter = 'none'
      const [w, h] = fit(im, W, H, 4)
      g.save(); g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore()
    }
  }
  function tag(sc, t) {
    const mrg = 46, Lb = 70
    g.strokeStyle = rgba(WHITE, 0.7); g.lineWidth = 2
    for (const [x, y, sx, sy] of [[mrg, mrg + L.tagTop, 1, 1], [W - mrg, mrg + L.tagTop, -1, 1], [mrg, H - mrg - L.tagBot, 1, -1], [W - mrg, H - mrg - L.tagBot, -1, -1]]) { g.beginPath(); g.moveTo(x + sx * Lb, y); g.lineTo(x, y); g.lineTo(x, y + sy * Lb); g.stroke() }
    const [nx, ny] = L.now
    text(sc.tag, nx, ny, `600 18px ${MONO}`, rgba(WHITE, 0.9), 'left', 'top', 8)
    g.fillStyle = `rgba(255,90,90,${(0.5 + 0.5 * Math.sin(t * 6)).toFixed(3)})`; g.beginPath(); g.arc(nx - 16, ny + 10, 5, 0, TAU); g.fill()
  }

  // ------------------------------------------------------------------ the heart, from all of them
  const HEART = (() => {
    const pts = Array.from({ length: 401 }, (_, i) => { const a = (i / 400) * TAU; return [16 * Math.pow(Math.sin(a), 3), -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))] })
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
    const cy = (y0 + y1) / 2
    return pts.map(([x, y]) => [x / 16, (y - cy) / 16])
  })()
  const heartTrails = {}
  function heartScene(sc, f, t, k, n) {
    fullPhoto(sc, k, n)
    const Hc = L.heart, m = sc.marks
    const ord = D.tileOrder
    const flyIn = 1.25 * FPS, trace = 1.05 * FPS
    ord.forEach((id, i) => {
      const a = AG[id]
      const seg0 = i / ord.length, seg1 = (i + 1) / ord.length
      const at = (s) => { const q = HEART[Math.round(clamp(s) * 400)]; return [Hc.cx + q[0] * Hc.s, Hc.cy + q[1] * Hc.s] }
      const start = [W * (i % 2 ? 1.15 : -0.15), H * (0.15 + 0.08 * i)]
      const P0 = at(seg0)
      const c1 = [W * (0.2 + 0.6 * ((i * 37) % 10) / 10), H * (0.12 + 0.75 * ((i * 53) % 10) / 10)]
      const path = bez(start, c1, [P0[0] + (i % 2 ? 180 : -180), P0[1] - 160], P0, 40)
      const kk = k - i * 2.2
      let pos
      if (kk < flyIn) pos = sample(path, smooth(kk / flyIn))
      else { const s = lerp(seg0, seg1, smooth((kk - flyIn) / trace)); const q = at(s); const q2 = at(s + 0.003); pos = [q[0], q[1], Math.atan2(q2[1] - q[1], q2[0] - q[0])] }
      if (kk < 0) return
      const hist = (heartTrails[id] = heartTrails[id] || [])
      hist.push([pos[0], pos[1]]); if (hist.length > 22) hist.shift()
      // the part of the heart she has drawn stays lit
      if (kk >= flyIn) {
        const s1 = lerp(seg0, seg1, smooth((kk - flyIn) / trace))
        const pts = []; for (let s = seg0; s <= s1 + 1e-6; s += 0.004) pts.push(at(s))
        const pulse = kk > flyIn + trace ? 0.85 + 0.15 * Math.sin(t * 3 + i) : 1
        glowLine(pts, a.neon, 4, pulse)
      }
      for (let j = 1; j < hist.length; j++) { g.strokeStyle = rgba(a.neon, (j / hist.length) * 0.55); g.lineWidth = 2 + 10 * (j / hist.length); g.lineCap = 'round'; g.beginPath(); g.moveTo(hist[j - 1][0], hist[j - 1][1]); g.lineTo(hist[j][0], hist[j][1]); g.stroke() }
      if (kk < flyIn + trace) {
        g.save(); g.translate(pos[0], pos[1]); g.rotate(pos[2])
        g.shadowColor = rgba(a.neon, 1); g.shadowBlur = 16
        g.fillStyle = rgba(a.neon, 1); g.beginPath(); g.moveTo(14, 0); g.lineTo(-10, -8); g.lineTo(-5, 0); g.lineTo(-10, 8); g.closePath(); g.fill()
        g.restore()
        const lab = clamp(1 - (kk - flyIn * 0.7) / 12)
        if (lab > 0) text(a.real ? 'ME' : a.fork.city.toUpperCase(), pos[0], pos[1] - 18, `700 19px ${SANS}`, rgba(a.neon, lab), 'center', 'alphabetic', 10)
      }
    })
  }

  // ------------------------------------------------------------------ frame
  const sceneAt = (f) => D.scenes.find((s) => f >= s.f0 && f < s.f1) ?? D.scenes[D.scenes.length - 1]
  let last = null
  window.draw = (f) => {
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, W, H)
    const t = f / FPS, sc = sceneAt(f), k = f - sc.f0, n = sc.f1 - sc.f0
    updateGlobe(f, sc)
    let year = 2026
    if (sc.geo && D.places[sc.geo]) year = sc.year ?? D.places[sc.geo].yr
    if (sc.type === 'tree') year = Math.round(lerp(2010, 2026, clamp((f - sc.marks.grow[0]) / (sc.marks.grow[1] - sc.marks.grow[0]))))
    if (sc.type === 'simtree') year = 2010 + (Math.floor(t * 8) % 22)
    if (sc.type === 'full' || sc.type === 'heart') {
      if (sc.type === 'heart') heartScene(sc, f, t, k, n)
      else { fullPhoto(sc, k, n); if (sc.tag) tag(sc, t) }
      last = sc
      return
    }
    chrome(f, t, sc, year)
    if (sc.type === 'tree') { drawGlobe(f, t, sc); treeScene(sc, f, t) }
    else if (sc.type === 'place') { drawGlobe(f, t, sc); placeScene(sc, f, t, k, n) }
    else if (sc.type === 'forks') { drawGlobe(f, t, sc); forksScene(sc, f, t, k, n) }
    else if (sc.type === 'simtree') simTree(sc, f, t, k, n)
    else if (sc.type === 'agents') agentsScene(sc, f, t, k, n)
    else if (sc.type === 'honest') { honestScene(sc, f, t, k, n); drawGlobe(f, t, sc) }
    else if (sc.type === 'ring') { drawGlobe(f, t, sc); ringScene(sc, f, t, k, n) }
    else if (sc.type === 'race') raceScene(sc, f, t, k, n)
    else drawGlobe(f, t, sc)
    // a light glitch on a hard cut
    if (k < 2 && f > 0 && sc.glitch) {
      seed = sc.f0 * 31 + k * 7
      for (let i = 0; i < 4; i++) { const y = rnd() * H, h = 2 + rnd() * 18; g.fillStyle = rgba(i % 2 ? G.col : WHITE, 0.08 + rnd() * 0.1); g.fillRect((rnd() - 0.5) * 80, y, W, h) }
    }
    last = sc
  }
})()
