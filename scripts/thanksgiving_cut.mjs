// The Thanksgiving piece: Caity's photos in framed windows over the
// simulation, cut to her voiceover word by word. Voice first: every cut point
// is a word in the take (media/thanksgiving/vo_<V>.json from thanksgiving_vo.mjs).
//
//   node scripts/thanksgiving_cut.mjs --version A [--aspect 16x9]
//   node scripts/thanksgiving_cut.mjs --version A --music track.m4a --music-at 156
//
// --music-at is the moment in the track (seconds) that lands on the cut into the
// ghosts' arcade world ("In Stockholm..."): in her edit, the synth at 2:36.
// Writes media/thanksgiving/cuts/GLP_Thanksgiving_<V>_<aspect>.mp4 and .srt.
//
// Three passes: the background (simulation plates, dimmed under a photo),
// the photo cards (rendered frame by frame in Chromium, with alpha), then
// overlay, captions and sound.

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const V = arg('version', 'A')
const music = arg('music')
const musicAt = Number(arg('music-at', NaN))
const ROOT = resolve('.')
const FOOT = `${ROOT}/media/thanksgiving/footage`
const WORK = `${ROOT}/media/thanksgiving/.work`
const OUT = `${ROOT}/media/thanksgiving/cuts`
const FPS = 30
const ASPECT = arg('aspect', '9x16')
const [W, H] = ASPECT === '16x9' ? [1920, 1080] : [1080, 1920]
// Where things sit. Vertical: windows above the captions and left of the app
// icons; captions in the same safe band as the other films. Horizontal: windows
// in the upper frame, captions in the lower third.
const LAY = ASPECT === '16x9'
  ? { box: { cx: 960, cy: 450, w: 1300, h: 700 }, cap: 46, mL: 260, mR: 260, mV: 105, hook: 76, hookPos: [960, 540], hookWrap: 30, title: [540, 300], sub: [540, 405], cx: 960 } // end title in the open sky, left of her on the rock
  : { box: { cx: 520, cy: 690, w: 840, h: 860 }, cap: 52, mL: 80, mR: 170, mV: 560, hook: 84, hookPos: [495, 820], hookWrap: 17, title: [495, 450], sub: [495, 610], cx: 495 }
mkdirSync(`${WORK}/cards`, { recursive: true })
mkdirSync(OUT, { recursive: true })

const vo = JSON.parse(readFileSync(`${ROOT}/media/thanksgiving/vo_${V}.json`, 'utf8'))
const caps = vo.captions
const TOTAL = +(vo.seconds + 1.0).toFixed(2) // a beat longer than the voice, for the end card

// ------------------------------------------------------------------ timing
const line = (re) => caps.find((c) => re.test(c.text)) ?? (() => { throw new Error(`no line ${re}`) })()
const bare = (w) => w.replace(/\(\d+\)$/, '')
// the n-th time a word is said in a line
const word = (re, w, n = 0) => {
  const hits = line(re).words.filter((x) => bare(x.w) === w)
  if (!hits[n]) throw new Error(`no word "${w}" #${n} in ${re}`)
  return hits[n].start
}
const LEAD = 0.08 // the picture changes a hair before the word
const cut = (t) => +(t - LEAD).toFixed(3)

// ------------------------------------------------------------------ edit
const dims = (photo) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', `${FOOT}/${photo}.jpg`]).toString().trim().split(',').map(Number)
// plate: a shot and its in point at time `since`, with an optional second shot
// screened over it at `op`, the classic and arcade worlds superimposed
const P = (shot, inn, since, over = null, op = 0.45) => ({ shot, inn, since, over: over && { shot: over[0], inn: over[1], op } })
const win = (photo, o = {}) => ({ kind: 'win', photo, look: o.look ?? 'classic', label: o.label ?? '', sub: o.sub ?? '', hard: !!o.hard, pan: !!o.pan, size: o.size ?? null })
// a full frame photo fills the frame when its shape is close to the frame's, and otherwise sits whole on a blurred copy of itself
const full = (photo, o = {}) => {
  const [w, h] = dims(photo)
  const r = (w / h) / (W / H)
  return { kind: 'full', photo, fit: r < 1.4 && r > 1 / 1.4 ? 'cover' : 'contain', pos: o.pos ?? '50% 50%' }
}
// where each photo was taken, for the locator globe and the readouts (iso3 for the World Bank numbers)
const GEO = {
  la: ['LOS ANGELES', 34.05, -118.24, 'USA', 2012], sto: ['STOCKHOLM', 59.33, 18.07, 'SWE', 2016], utah: ['UTAH', 40.76, -111.89, 'USA', 2021],
  hnl: ['HAWAII', 21.31, -157.86, 'USA', 2021], nyc: ['NEW YORK', 40.71, -74.0, 'USA', 2022], lon: ['LONDON', 51.51, -0.13, 'GBR', 2023],
  ber: ['BERLIN', 52.52, 13.4, 'DEU', 2023], osl: ['OSLO', 59.91, 10.75, 'NOR', 2024], sha: ['SHANGHAI', 31.23, 121.47, 'CHN', 2024],
  sf: ['SAN FRANCISCO', 37.77, -122.42, 'USA', 2026], hoga: ['HIGH COAST', 62.95, 18.25, 'SWE', 2017], brc: ['BLACK ROCK CITY', 40.79, -119.2, 'USA', 2015],
  ca: ['CALIFORNIA', 36.78, -119.42, 'USA', 2015], sco: ['SCOTLAND', 56.82, -5.11, 'GBR', 2018],
}

const beats = []
const at = (t0, b) => beats.push({ t0: Math.max(0, t0), ...b })

// Opening: the globe assembling, classic and arcade together; in version A the second question shows her leaving
const g0 = P('c_globe_build', 1.2, 0, ['a_globe_build', 1.2], 0.5)
at(0, { bg: g0 })
if (/^If you.d stayed/.test(caps[1].text)) at(cut(caps[1].voiceStart), { bg: g0, card: win('highcoast_field_horizon_back'), geo: 'hoga' })

// "I've lived in ten cities..." the ten cities over the real thread and the neon street, then the threads splitting
const tenRe = /^I.ve lived in ten cities/
const t10 = cut(line(tenRe).voiceStart), tStayed = cut(word(tenRe, 'the', 0))
const cities = [
  ['la_performing_red_ableton', 'la'], ['stockholm_archipelago_flag', 'sto'], ['utah_saltflats_mirrors_dance', 'utah'],
  ['hawaii_running_road_crop', 'hnl'], ['nyc_soho_street_selfies_stencil', 'nyc'], ['london_alphatheta_mic_still', 'lon'],
  ['berlin_night_street_signs', 'ber'], ['oslo_pride_dj_born_to_mix_smile', 'osl'], ['shanghai_bund_skyline_night', 'sha'],
  ['sf_golden_gate_sunset_friend', 'sf'],
]
const montage = P('c_globe_follow_plate', 0.5, t10, ['a_street_forks', 0], 0.5)
cities.forEach(([photo, g], i) => at(t10 + (i * (tStayed - t10)) / cities.length, { bg: montage, card: win(photo, { label: GEO[g][0], hard: true }), geo: g }))
at(tStayed, { bg: P('a_street_forks', 5.4, tStayed, ['c_globe_tour_plate', 0], 0.4) })

// "So I built a multi agent simulation. Each agent is me... shaped by its economy and industries"
const simRe = /^So I built/
const tSim = cut(line(simRe).voiceStart)
const loom = P('c_loom', 0.5, tSim, ['a_timeline', 0.5], 0.4)
at(tSim, { bg: loom, card: win('nyc_story_wall_full', { size: ASPECT === '16x9' ? [700, 640] : [600, 800], pan: true }), geo: 'nyc', run: true })
at(cut(word(simRe, 'each')), { bg: loom, card: win('utah_saltflats_mirrors_standing'), geo: 'utah', run: true })
at(cut(word(simRe, 'and')), { bg: P('c_data', 1.0, cut(word(simRe, 'and')), ['a_how', 0], 0.3), run: true })
at(cut(line(/most honest answer/).voiceStart), { bg: P('a_lives', 0.5, cut(line(/most honest answer/).voiceStart), ['c_lives', 0.5], 0.35), run: true })

// The three ghosts, in the arcade world: the globe tour with each city's neon street over it
const ghRe = /^In Stockholm/
const tSto = cut(line(ghRe).voiceStart), tBer = cut(word(ghRe, 'in', 1)), tHnl = cut(word(ghRe, 'in', 2))
at(tSto, { bg: P('a_globe_tour_plate', 0.3, tSto, ['a_dio_sto_plate', 1], 0.5), card: win('stockholm_boat_sunset', { look: 'arcade', label: 'STOCKHOLM', sub: 'MY AGENT, STAYED IN 2016' }), geo: 'sto', ghost: [2016, 2031] })
at(tBer, { bg: P('a_globe_tour_plate', 9.0, tBer, ['a_street_forks', 2], 0.45), card: win('berlin_studio_projector_setup', { look: 'arcade', label: 'BERLIN', sub: 'MY AGENT, STAYED IN 2023' }), geo: 'ber', ghost: [2023, 2031] })
at(tHnl, { bg: P('a_globe_tour_plate', 4.4, tHnl, ['a_dio_ghost_plate', 0], 0.45), card: win('hawaii_coast_lava_path_still', { look: 'arcade', label: 'HAWAII', sub: 'MY AGENT, STAYED IN 2021' }), geo: 'hnl', ghost: [2021, 2031] })

// "And here I am." everything drops away
at(cut(line(/^And here I am/).voiceStart), { card: full('la_studio_desk_selfie_now', { pos: '78% 50%' }), now: true })

// Thanksgiving, looking back, gratitude: the warm classic globe with the arcade city under it
const tgRe = /^Today is Thanksgiving/
const tTg = cut(line(tgRe).voiceStart)
const orbit = P('c_outro_plate', 0, tTg, ['a_outro', 0], 0.4)
at(tTg, { bg: orbit, card: win('sf_golden_gate_family'), geo: 'sf' })
at(cut(word(tgRe, 'wherever')), { bg: orbit, card: win('highcoast_lake_pink_sky'), geo: 'hoga' })
const lkRe = /^Looking at all of them/
at(cut(line(lkRe).voiceStart), { bg: orbit, card: win('selfie_autumn_street_fleece') })
const tGrateful = cut(word(lkRe, 'i', 1))
const threads = P('c_globe_tour_plate', 0, tGrateful, ['a_hook', 0], 0.45)
at(tGrateful, { bg: threads, card: win('highcoast_field_laughing'), geo: 'hoga' })

// "For the chapters that ended, and the ones still going. For the roads I took, and the ones I didn't."
const chRe = /^For the chapters/
const tCh = cut(line(chRe).voiceStart), tGoing = cut(word(chRe, 'and', 0)), tRoads = cut(word(chRe, 'for', 1))
const ended = [['la_opening_for_rufus_du_sol_mic', 'ca'], ['burningman_fire_katana_playa', 'brc'], ['scotland_performing_valley_solo', 'sco'], ['shanghai_graduation_selfie_classmates', 'sha']]
const going = [['berlin_node_talk_smile', 'ber'], ['shanghai_thesis_infinite_game_studio_presentation', 'sha'], ['sf_dj_duo_headphones', 'sf']]
ended.forEach(([p, g], i) => at(tCh + (i * (tGoing - tCh)) / ended.length, { bg: threads, card: win(p, { hard: true }), geo: g }))
going.forEach(([p, g], i) => at(tGoing + (i * (tRoads - tGoing)) / going.length, { bg: threads, card: win(p, { hard: true }), geo: g }))
at(tRoads, { bg: threads, card: win('shanghai_heart_wishes_tunnel'), geo: 'sha' })

// "We can't go back. But we can say thank you, and choose where we go next."
const bkRe = /^We can.t go back/
const tBack = cut(line(bkRe).voiceStart)
at(tBack, { bg: P('c_timeline', 5, tBack, ['a_timeline', 5], 0.4) })
at(cut(word(bkRe, 'but')), { card: full('sf_run_golden_gate_dusk'), geo: 'sf', now: true })

// "Happy Thanksgiving, from all of me." and the end card
at(cut(line(/^Happy Thanksgiving/).voiceStart), { card: full('highcoast_rock_dusk_all_yours', { pos: '62% 50%' }), end: true })

beats.sort((a, b) => a.t0 - b.t0)
beats.forEach((b, i) => {
  b.f0 = Math.round(b.t0 * FPS)
  b.f1 = i < beats.length - 1 ? Math.round(beats[i + 1].t0 * FPS) : Math.round(TOTAL * FPS)
  b.n = b.f1 - b.f0
  if (b.n <= 0) throw new Error(`empty beat at ${b.t0}`)
})

// ------------------------------------------------------------------ cards
const BOX = LAY.box
function rect(card) {
  let ww, wh
  if (card.size) [ww, wh] = card.size
  else {
    const [w, h] = dims(card.photo)
    const s = Math.min(BOX.w / w, BOX.h / h, 1.45)
    ww = Math.round(w * s); wh = Math.round(h * s)
  }
  return { x: Math.round(BOX.cx - ww / 2), y: Math.round(BOX.cy - wh / 2), w: ww, h: wh }
}

const LOOK = {
  classic: {
    frame: 'border: 1.5px solid rgba(255,255,255,.85); border-radius: 4px; box-shadow: 0 24px 70px rgba(0,0,0,.65);',
    label: 'font: 700 28px Arial; letter-spacing: 7px; color: rgba(255,255,255,.94); text-shadow: 0 2px 10px rgba(0,0,0,.7);',
    sub: 'font: 400 20px Arial; letter-spacing: 4px; color: #ffb36b; text-shadow: 0 2px 8px rgba(0,0,0,.7);',
  },
  arcade: {
    frame: 'border: 3px solid #38f3ff; border-radius: 10px; box-shadow: 0 0 18px rgba(56,243,255,.65), 0 0 64px rgba(255,47,208,.38), 0 30px 80px rgba(0,0,0,.6);',
    label: "font: 24px 'Press Start 2P'; letter-spacing: 2px; color: #38f3ff; text-shadow: 0 0 8px rgba(255,47,208,.9), 0 0 2px #000;",
    sub: "font: 15px 'Press Start 2P'; letter-spacing: 1px; color: #ff6fe0; text-shadow: 0 0 6px rgba(255,47,208,.8), 0 0 2px #000;",
  },
}

function cardHtml(card) {
  const img = `file://${FOOT}/${card.photo}.jpg`
  const fonts = `@font-face { font-family: 'Press Start 2P'; src: url('file://${ROOT}/media/fonts/PressStart2P-Regular.ttf'); }
    @font-face { font-family: Arial; src: url('file://${ROOT}/media/fonts/LiberationSans-Bold.ttf'); font-weight: 700; }
    @font-face { font-family: Arial; src: url('file://${ROOT}/media/fonts/LiberationSans-Regular.ttf'); font-weight: 400; }`
  if (card.kind === 'full') {
    return `<!doctype html><meta charset=utf-8><style>${fonts}
      html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:transparent}
      .wrap{position:absolute;inset:0;opacity:var(--o,1);overflow:hidden;background:#02040a}
      .fill{position:absolute;inset:-60px;background:url('${img}') center/cover;filter:blur(38px) brightness(.42)}
      .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:${card.fit};object-position:${card.pos};transform:scale(calc(1 + .06 * var(--k,0)))}
      </style><div class=wrap>${card.fit === 'contain' ? '<div class=fill></div>' : ''}<img class=ph src="${img}"></div>`
  }
  const r = rect(card)
  const L = LOOK[card.look]
  return `<!doctype html><meta charset=utf-8><style>${fonts}
    html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:transparent}
    .all{position:absolute;inset:0;opacity:var(--o,1)}
    .win{position:absolute;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;overflow:hidden;${L.frame}}
    .win img{width:100%;height:100%;object-fit:cover;${card.pan ? 'object-position:calc(var(--k,0) * 100%) 50%;' : 'transform:scale(calc(1 + .05 * var(--k,0)));'}}
    .l1{position:absolute;left:${r.x}px;top:${r.y - 46}px;white-space:nowrap;${L.label}}
    .l2{position:absolute;left:${r.x}px;top:${r.y + r.h + 18}px;white-space:nowrap;${L.sub}}
    </style><div class=all><div class=l1>${card.label}</div><div class=win><img src="${img}"></div><div class=l2>${card.sub}</div></div>`
}

function clipOf(card) {
  if (card.kind === 'full') return { x: 0, y: 0, width: W, height: H }
  const r = rect(card)
  const x = Math.max(0, r.x - 90), y = Math.max(0, r.y - 110)
  return { x, y, width: Math.min(W, r.x + r.w + 90) - x, height: Math.min(H, r.y + r.h + 110) - y }
}

const key = (card, n) => { const c = clipOf(card); return `${ASPECT}_${card.kind}_${card.photo}_${card.look ?? card.fit}_${card.hard ? 'h' : 's'}_${c.x}-${c.y}-${c.width}-${c.height}_${n}`.replace(/[^\w-]/g, '') }

async function renderCards() {
  const jobs = beats.filter((b) => b.card).map((b) => ({ b, n: Math.ceil((b.n + 2) / 4) * 4 }))
  const todo = jobs.filter(({ b, n }) => !existsSync(`${WORK}/cards/${key(b.card, n)}.mov`))
  if (!todo.length) return
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  for (const { b, n } of todo) {
    const file = `${WORK}/cards/${key(b.card, n)}.mov`
    // a file page, so the photo (a local file) is allowed to load
    writeFileSync(`${WORK}/card.html`, cardHtml(b.card))
    await page.goto(`file://${WORK}/card.html`, { waitUntil: 'load' })
    await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]))
    if (await page.evaluate(() => [...document.images].some((i) => !i.naturalWidth))) throw new Error(`photo did not load: ${b.card.photo}`)
    const clip = clipOf(b.card)
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'png', '-pix_fmt', 'rgba', file], { stdio: ['pipe', 'inherit', 'inherit'] })
    const fin = b.card.hard ? 0 : 5, fout = b.card.hard ? 0 : 4
    for (let i = 0; i < n; i++) {
      const o = Math.min(1, fin ? (i + 1) / fin : 1, fout ? (b.n - i) / fout : 1)
      await page.evaluate(([k, o]) => { document.documentElement.style.setProperty('--k', k); document.documentElement.style.setProperty('--o', Math.max(0, o)) }, [i / Math.max(1, n - 1), o])
      const png = await page.screenshot({ type: 'png', clip, omitBackground: true })
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
    }
    ff.stdin.end()
    await new Promise((r) => ff.on('close', r))
    console.log(`  card ${b.card.photo} (${n} frames)`)
  }
  await browser.close()
}

// ------------------------------------------------------------------ background
function renderBackground(file) {
  const inputs = [], parts = []
  let k = 0
  // a plate segment: trimmed, held if the shot runs out, and drifting slowly (a gentle push and sway)
  const seg = (shot, inn, b, phase) => {
    inputs.push('-ss', Math.max(0, inn).toFixed(3), '-i', `${ROOT}/media/shots/${ASPECT}/${shot}.mp4`)
    const z = `${Math.round(W * 1.1)}:${Math.round(H * 1.1)}`
    return `[${k++}:v]fps=${FPS},scale=${W}:${H},tpad=stop_mode=clone:stop_duration=30,trim=end_frame=${b.n},setpts=PTS-STARTPTS,scale=${z},crop=${W}:${H}:x='(iw-ow)/2*(1+0.7*sin(t*0.31+${phase}))':y='(ih-oh)/2*(1+0.7*cos(t*0.23+${phase}))',format=gbrp`
  }
  beats.forEach((b, i) => {
    if (!b.bg || b.card?.kind === 'full') {
      inputs.push('-f', 'lavfi', '-i', `color=c=0x02040a:s=${W}x${H}:r=${FPS}`)
      parts.push(`[${k++}:v]trim=end_frame=${b.n},setpts=PTS-STARTPTS,format=yuv420p[s${i}]`)
      return
    }
    const dt = b.t0 - b.bg.since
    // under a photo the world stays vivid, just softened a touch so the photo reads first
    const treat = b.card ? ',eq=brightness=-0.05:saturation=1.08,gblur=sigma=1.4' : ''
    if (!b.bg.over) {
      parts.push(`${seg(b.bg.shot, b.bg.inn + dt, b, i * 0.7)},format=yuv420p${treat}[s${i}]`)
      return
    }
    parts.push(`${seg(b.bg.shot, b.bg.inn + dt, b, i * 0.7)}[a${i}]`)
    parts.push(`${seg(b.bg.over.shot, b.bg.over.inn + dt, b, i * 0.7 + 2.1)}[o${i}]`)
    parts.push(`[a${i}][o${i}]blend=all_mode=screen:all_opacity=${b.bg.over.op},format=yuv420p${treat}[s${i}]`)
  })
  parts.push(`${beats.map((_, i) => `[s${i}]`).join('')}concat=n=${beats.length}:v=1:a=0[bg]`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[bg]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), file])
}

// ------------------------------------------------------------------ overlay
// The high tech layer that runs under the photos the whole time: a locator
// globe with real coastlines that turns to each place, brackets, coordinates and
// the country's real GDP and inflation for that year, the simulation's readouts,
// a data column, a drifting grid, a scan band and glitch hits on the cuts.
const HUD = ASPECT === '16x9'
  ? { loc: [1770, 175, 105], data: [44, 60], tick: [30, 130, 820], now: [70, 80] }
  : { loc: [935, 215, 86], data: [40, 175], tick: [22, 330, 1150], now: [60, 200] }

function hudData() {
  const topo = JSON.parse(readFileSync(`${ROOT}/node_modules/world-atlas/land-110m.json`, 'utf8'))
  const { feature } = require('topojson-client')
  const land = feature(topo, topo.objects.land)
  const polys = land.type === 'FeatureCollection' ? land.features.flatMap((f) => f.geometry.coordinates) : land.geometry.coordinates
  const rings = polys.flatMap((poly) => poly).map((ring) => ring.filter((_, i) => i % 2 === 0).map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]))
  const snap = JSON.parse(readFileSync(`${ROOT}/public/data/snapshot.json`, 'utf8'))
  const wb = (kind, iso, yr) => snap.worldBank?.[kind]?.[iso]?.[String(yr)] ?? snap.worldBank?.[kind]?.[iso]?.[String(Math.min(yr, 2024))] ?? null
  return {
    W, H, FPS, total: Math.round(TOTAL * FPS), hud: HUD, rings,
    beats: beats.map((b) => {
      const g = b.geo && GEO[b.geo]
      return {
        f0: b.f0, f1: b.f1, t0: b.f0 / FPS, kind: b.card?.kind ?? null, look: b.card?.look ?? null, hard: !!b.card?.hard,
        rect: b.card?.kind === 'win' ? rect(b.card) : null, ghost: b.ghost ?? null, run: !!b.run, now: !!b.now, end: !!b.end,
        geo: g && { name: g[0], lat: g[1], lon: g[2], iso: g[3], yr: g[4], gdp: wb('gdp', g[3], g[4]), infl: wb('inflation', g[3], g[4]) },
      }
    }),
  }
}

const HUD_PAGE = String.raw`<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:transparent;overflow:hidden}canvas{display:block}</style>
<canvas id=c></canvas><script>
const D = window.D, W = D.W, H = D.H
const cv = document.getElementById('c'); cv.width = W; cv.height = H
const g = cv.getContext('2d')
const MONO = '"JetBrains Mono", "DejaVu Sans Mono", monospace'
let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const HEX = '0123456789ABCDEF'
const tick = Array.from({ length: 400 }, (_, i) => {
  const r = rnd()
  if (r < 0.18) return 'AGT' + String(1 + (i % 10)).padStart(2, '0') + ' P=' + rnd().toFixed(3)
  if (r < 0.3) return 'RUN ' + String(1 + Math.floor(rnd() * 100)).padStart(3, '0') + ' OK'
  if (r < 0.4) return 'W ' + (rnd() * 2 - 1).toFixed(2) + ' ' + (rnd() * 2 - 1).toFixed(2)
  return Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => HEX[Math.floor(rnd() * 16)]).join('')).join(' ')
})
let rot = { lon: -100, lat: 22 }
const rad = Math.PI / 180
const wrap = (d) => ((d + 540) % 360) - 180
function proj(lon, lat, cx, cy, r) {
  const l = (lon - rot.lon) * rad, p = lat * rad, p0 = rot.lat * rad
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)
  return [cx + r * Math.cos(p) * Math.sin(l), cy - r * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), cosc]
}
function path(pts, cx, cy, r) {
  g.beginPath(); let pen = false
  for (const [lo, la] of pts) {
    const [x, y, c] = proj(lo, la, cx, cy, r)
    if (c < 0) { pen = false; continue }
    if (!pen) { g.moveTo(x, y); pen = true } else g.lineTo(x, y)
  }
  g.stroke()
}
const fmtLat = (v) => Math.abs(v).toFixed(2) + (v >= 0 ? 'N' : 'S'), fmtLon = (v) => Math.abs(v).toFixed(2) + (v >= 0 ? 'E' : 'W')
const beatAt = (f) => D.beats.find((b) => f >= b.f0 && f < b.f1) ?? D.beats[D.beats.length - 1]

window.draw = (f) => {
  g.clearRect(0, 0, W, H)
  const t = f / D.FPS, b = beatAt(f), k = f - b.f0
  const arc = b.look === 'arcade' || !!b.ghost
  const C1 = arc ? '56,243,255' : '255,220,180', C2 = arc ? '255,47,208' : '124,196,255'
  const fade = b.end ? Math.max(0, 1 - (t - b.t0) / 0.8) : 1
  if (fade <= 0) return
  g.save(); g.globalAlpha = fade
  const clean = b.kind === 'full'
  g.lineCap = 'round'

  if (!clean) {
    // grid, drifting
    g.strokeStyle = 'rgba(' + C1 + ',0.06)'; g.lineWidth = 1
    const s = 64, oy = (t * 18) % s, ox = (t * 7) % s
    g.beginPath()
    for (let x = -s + ox; x < W; x += s) { g.moveTo(x, 0); g.lineTo(x, H) }
    for (let y = -s + oy; y < H; y += s) { g.moveTo(0, y); g.lineTo(W, y) }
    g.stroke()
    // scan band
    const sy = ((t * 0.28) % 1) * (H + 240) - 120
    const gr = g.createLinearGradient(0, sy - 90, 0, sy + 90)
    gr.addColorStop(0, 'rgba(' + C1 + ',0)'); gr.addColorStop(0.5, 'rgba(' + C1 + ',0.09)'); gr.addColorStop(1, 'rgba(' + C1 + ',0)')
    g.fillStyle = gr; g.fillRect(0, sy - 90, W, 180)
    // data column
    const [tx, ty0, ty1] = D.hud.tick, lh = 18
    g.font = '12px ' + MONO; g.textBaseline = 'top'
    const off = (t * 42) % lh, first = Math.floor((t * 42) / lh)
    for (let y = ty0 - off, i = 0; y < ty1; y += lh, i++) {
      if (y < ty0) continue
      const edge = Math.min(1, (y - ty0) / 80, (ty1 - y) / 80)
      g.fillStyle = 'rgba(' + (i % 7 === 3 ? C2 : C1) + ',' + (0.38 * edge).toFixed(3) + ')'
      g.fillText(tick[(first + i) % tick.length], tx, y)
    }
  }

  // simulation readout
  let year = 2026
  if (b.geo && !b.ghost) year = b.geo.yr
  if (b.ghost) year = Math.round(b.ghost[0] + (b.ghost[1] - b.ghost[0]) * Math.min(1, k / Math.max(1, b.f1 - b.f0 - 8)))
  if (b.run) year = 2010 + (Math.floor(t * 9) % 22)
  if (!clean) {
    const [dx, dy] = D.hud.data
    g.font = '15px ' + MONO; g.textBaseline = 'top'; g.fillStyle = 'rgba(' + C1 + ',0.82)'
    const run = String(1 + (Math.floor(t * 6) % 100)).padStart(3, '0')
    const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = (t % 60).toFixed(1).padStart(4, '0')
    g.fillText('GHOSTS OF LIVES PAST  SIM', dx, dy)
    g.fillText('RUN ' + run + '/100  AGENTS 10', dx, dy + 21)
    g.fillStyle = 'rgba(' + C2 + ',0.9)'
    g.fillText('YEAR ' + year + '  T+' + mm + ':' + ss, dx, dy + 42)
  }

  // locator globe
  const [lx, ly, lr] = D.hud.loc
  if (b.geo) {
    rot.lon += wrap(b.geo.lon - rot.lon) * 0.2
    rot.lat += (b.geo.lat * 0.6 - rot.lat) * 0.2
  } else rot.lon += 0.5
  if (!clean) {
    g.fillStyle = 'rgba(2,4,10,0.55)'; g.beginPath(); g.arc(lx, ly, lr, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(' + C1 + ',0.18)'; g.lineWidth = 1
    for (let lo = -180; lo < 180; lo += 30) path(Array.from({ length: 37 }, (_, i) => [lo, -90 + i * 5]), lx, ly, lr)
    for (let la = -60; la <= 60; la += 30) path(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, la]), lx, ly, lr)
    g.strokeStyle = 'rgba(' + C1 + ',0.7)'; g.lineWidth = 1.1
    for (const ring of D.rings) path(ring, lx, ly, lr)
    g.strokeStyle = 'rgba(' + C1 + ',0.85)'; g.lineWidth = 1.5
    g.beginPath(); g.arc(lx, ly, lr, 0, Math.PI * 2); g.stroke()
    // radar ticks turning around the rim
    g.strokeStyle = 'rgba(' + C2 + ',0.8)'; g.lineWidth = 2
    for (let i = 0; i < 3; i++) { const a = t * 1.3 + i * 2.1; g.beginPath(); g.arc(lx, ly, lr + 9, a, a + 0.55); g.stroke() }
    if (b.geo) {
      const [mx, my, mc] = proj(b.geo.lon, b.geo.lat, lx, ly, lr)
      if (mc > 0) {
        const pulse = (t * 1.4) % 1
        g.strokeStyle = 'rgba(' + C2 + ',' + (1 - pulse).toFixed(3) + ')'; g.lineWidth = 2
        g.beginPath(); g.arc(mx, my, 4 + pulse * 18, 0, Math.PI * 2); g.stroke()
        g.fillStyle = 'rgb(' + C2 + ')'; g.beginPath(); g.arc(mx, my, 4, 0, Math.PI * 2); g.fill()
        // leader line from the place on the globe to the photo
        if (b.rect) {
          const r = b.rect, tx2 = r.x + r.w + 14, ty2 = r.y - 14
          const p = Math.min(1, k / 8)
          g.strokeStyle = 'rgba(' + C1 + ',0.55)'; g.lineWidth = 1.2; g.setLineDash([5, 5])
          g.beginPath(); g.moveTo(mx, my)
          const ex = mx + (tx2 - mx) * p, ey = my + (ty2 - my) * p
          g.lineTo(ex, my + (ey - my) * 0.5); g.lineTo(ex, ey); g.stroke(); g.setLineDash([])
        }
      }
      g.font = '13px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = 'rgba(' + C1 + ',0.9)'
      g.fillText(b.geo.name, lx, ly + lr + 18)
      g.fillStyle = 'rgba(' + C1 + ',0.6)'
      g.fillText(fmtLat(b.geo.lat) + ' ' + fmtLon(b.geo.lon), lx, ly + lr + 35)
      g.textAlign = 'left'
    }
  }

  // brackets, coordinates and the country's numbers around the photo
  if (b.rect) {
    const r = b.rect, pad = 14, L = 46 * Math.min(1, (k + 1) / 6)
    g.strokeStyle = 'rgba(' + C1 + ',0.92)'; g.lineWidth = 2
    const corners = [[r.x - pad, r.y - pad, 1, 1], [r.x + r.w + pad, r.y - pad, -1, 1], [r.x - pad, r.y + r.h + pad, 1, -1], [r.x + r.w + pad, r.y + r.h + pad, -1, -1]]
    for (const [x, y, sx, sy] of corners) { g.beginPath(); g.moveTo(x + sx * L, y); g.lineTo(x, y); g.lineTo(x, y + sy * L); g.stroke() }
    g.fillStyle = 'rgba(' + C2 + ',0.9)'
    for (const [x, y] of corners) g.fillRect(x - 3, y - 3, 6, 6)
    if (b.geo) {
      g.font = '15px ' + MONO; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(' + C1 + ',0.9)'
      g.fillText(fmtLat(b.geo.lat) + '  ' + fmtLon(b.geo.lon), r.x + r.w, r.y - 24)
      const gdp = b.geo.gdp, inf = b.geo.infl
      const yr = b.ghost ? year : b.geo.yr
      const line = b.geo.iso + ' ' + yr + (gdp != null ? '  GDP ' + (gdp >= 0 ? '+' : '') + gdp.toFixed(1) + '%' : '') + (inf != null ? '  INFL ' + inf.toFixed(1) + '%' : '')
      g.fillStyle = 'rgba(' + C2 + ',0.88)'; g.font = '13px ' + MONO
      g.fillText(line, r.x + r.w, r.y + r.h + 44)
      g.textAlign = 'left'
    }
  }

  // the clean full frame moments carry only a quiet frame and a tag
  if (clean && !b.end) {
    const m = 46, L = 70
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2
    for (const [x, y, sx, sy] of [[m, m + 120, 1, 1], [W - m, m + 120, -1, 1], [m, H - m - 120, 1, -1], [W - m, H - m - 120, -1, -1]]) { g.beginPath(); g.moveTo(x + sx * L, y); g.lineTo(x, y); g.lineTo(x, y + sy * L); g.stroke() }
    const [nx, ny] = D.hud.now
    g.font = '16px ' + MONO; g.textBaseline = 'top'; g.fillStyle = 'rgba(255,255,255,0.88)'
    g.fillText(b.geo ? b.geo.name + '  ' + fmtLat(b.geo.lat) + ' ' + fmtLon(b.geo.lon) : 'NOW, 2026', nx, ny)
    g.fillStyle = 'rgba(255,90,90,' + (0.5 + 0.5 * Math.sin(t * 6)).toFixed(3) + ')'; g.beginPath(); g.arc(nx - 16, ny + 9, 5, 0, Math.PI * 2); g.fill()
  }

  // glitch on the cut
  if (k < 4 && f > 0) {
    seed = b.f0 * 31 + k * 7
    for (let i = 0; i < 6; i++) {
      const y = rnd() * H, h = 3 + rnd() * 28, x = (rnd() - 0.5) * 120
      g.fillStyle = 'rgba(' + (i % 2 ? C1 : C2) + ',' + (0.16 + rnd() * 0.16).toFixed(3) + ')'
      g.fillRect(x, y, W, h)
    }
  }
  g.restore()
}
</script>`

async function renderHud(file) {
  const data = hudData()
  writeFileSync(`${WORK}/hud.html`, HUD_PAGE.replace('window.D,', `${JSON.stringify(data)},`))
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  await page.goto(`file://${WORK}/hud.html`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.load('15px "JetBrains Mono"'))
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'png', '-pix_fmt', 'rgba', file], { stdio: ['pipe', 'inherit', 'inherit'] })
  for (let f = 0; f < data.total; f++) {
    await page.evaluate((f) => window.draw(f), f)
    const png = await page.screenshot({ type: 'png', omitBackground: true })
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  await browser.close()
  console.log(`  overlay (${data.total} frames)`)
}

// ------------------------------------------------------------------ captions
const C = { white: '&H00FFFFFF', box: '&H38080402', clear: '&HFF000000', amber: '&H006BB3FF' }
const style = (name, size, primary, outline, back, bold, border, ol, sh, align, mL, mR, mV, spacing = 0) =>
  `Style: ${name},Liberation Sans,${size},${primary},&H000000FF,${outline},${back},${bold ? -1 : 0},0,0,0,100,100,${spacing},0,${border},${ol},${sh},${align},${mL},${mR},${mV},1`
const ts = (t) => { const cs = Math.max(0, Math.round(t * 100)); return `${Math.floor(cs / 360000)}:${String(Math.floor((cs % 360000) / 6000)).padStart(2, '0')}:${String(Math.floor((cs % 6000) / 100)).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}` }
const srtTs = (t) => { const ms = Math.max(0, Math.round(t * 1000)); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}` }
const esc = (s) => s.replace(/\{/g, '(').replace(/\}/g, ')')

// each line in short phrases, timed by its words, so no caption runs past two
// lines: split at punctuation, then split a long piece near its middle, before
// a joining word where there is one ("who you'd be / if you'd made...")
const MAXC = 40
const JOIN = new Set(['who', 'if', 'and', 'but', 'in', 'to', 'where', 'about', 'by', 'from', 'that', 'for', 'with', 'instead', 'staying', 'building'])
function split(idx, toks) {
  const len = (a, b) => toks.slice(a, b).join(' ').length
  if (len(idx[0], idx[1]) <= MAXC || idx[1] - idx[0] < 3) return [idx]
  const mid = len(idx[0], idx[1]) / 2
  let best = null
  for (let k = idx[0] + 1; k < idx[1]; k++) {
    const score = Math.abs(len(idx[0], k) - mid) - (JOIN.has(toks[k].toLowerCase().replace(/[^a-z']/g, '')) ? 8 : 0)
    if (best == null || score < best[1]) best = [k, score]
  }
  return [...split([idx[0], best[0]], toks), ...split([best[0], idx[1]], toks)]
}
function chunks(c, next0) {
  const toks = c.text.split(/\s+/)
  const ws = c.words ?? []
  const wordAt = []
  let wi = 0
  toks.forEach((t, i) => { wordAt[i] = /[A-Za-z]/.test(t) ? ws[wi++] : null })
  if (wi !== ws.length || ws.length === 0) return [{ text: c.text, t0: c.t0, t1: Math.min(c.t1, next0 ?? Infinity) }]
  const pieces = []
  let from = 0
  toks.forEach((t, i) => { if (/[.,?!]$/.test(t) || i === toks.length - 1) { pieces.push([from, i + 1]); from = i + 1 } })
  const parts = pieces.flatMap((p) => split(p, toks))
  // a very short piece rides with its neighbour
  const merged = []
  for (const p of parts) {
    const prev = merged[merged.length - 1]
    if (prev && (toks.slice(p[0], p[1]).join(' ').length < 10 || toks.slice(prev[0], prev[1]).join(' ').length < 10) && toks.slice(prev[0], p[1]).join(' ').length <= MAXC) prev[1] = p[1]
    else merged.push([...p])
  }
  const out = merged.map(([a, b]) => ({ text: toks.slice(a, b).join(' '), t0: (wordAt.slice(a, b).find(Boolean)?.start ?? c.t0) - 0.12 }))
  out.forEach((o, i) => { o.t1 = i < out.length - 1 ? out[i + 1].t0 - 0.06 : Math.min(c.t1, next0 ?? Infinity) })
  return out
}

const END_T0 = +(caps[caps.length - 1].voiceEnd + 0.45).toFixed(2)
function writeCaptions(assFile, srtFile) {
  let ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`
  ass += [
    style('Box', LAY.cap, C.clear, C.box, C.box, true, 3, 18, 0, 2, LAY.mL, LAY.mR, LAY.mV),
    style('Cap', LAY.cap, C.white, '&H00000000', '&H00000000', true, 1, 0, 0, 2, LAY.mL, LAY.mR, LAY.mV),
    style('Hook', LAY.hook, C.white, '&H40000000', '&H80000000', true, 1, 2, 3, 5, 0, 0, 0, 1),
    style('Title', 86, C.white, '&H40000000', '&H80000000', true, 1, 1, 2, 5, 0, 0, 0, 14),
    // the handle sits over bright sky too, so it carries a dark outline and shadow
    style('Sub', 36, C.amber, '&H50000000', '&H70000000', true, 1, 2, 2, 5, 0, 0, 0, 6),
  ].join('\n')
  ass += '\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
  let srt = '', n = 0
  caps.forEach((c, li) => {
    const last = li === caps.length - 1
    for (const ch of chunks(c, last ? END_T0 - 0.1 : undefined)) {
      srt += `${++n}\n${srtTs(ch.t0)} --> ${srtTs(ch.t1)}\n${ch.text}\n\n`
      if (li === 0) {
        // the opening question, large in the middle of the frame
        const lines = []; let l = ''
        for (const w of ch.text.split(' ')) { if ((l + ' ' + w).trim().length > LAY.hookWrap) { lines.push(l.trim()); l = w } else l += ' ' + w }
        lines.push(l.trim())
        ass += `Dialogue: 1,${ts(ch.t0)},${ts(ch.t1)},Hook,,0,0,0,,{\\pos(${LAY.hookPos[0]},${LAY.hookPos[1]})\\fad(220,160)\\blur0.6\\q0}${esc(lines.join('\\N'))}\n`
        continue
      }
      ass += `Dialogue: 0,${ts(ch.t0)},${ts(ch.t1)},Box,,0,0,0,,{\\fad(140,120)}${esc(ch.text)}\n`
      ass += `Dialogue: 1,${ts(ch.t0)},${ts(ch.t1)},Cap,,0,0,0,,{\\fad(140,120)}${esc(ch.text)}\n`
    }
  })
  ass += `Dialogue: 1,${ts(END_T0)},${ts(TOTAL)},Title,,0,0,0,,{\\pos(${LAY.title[0]},${LAY.title[1]})\\fad(600,0)}GHOSTS OF\\NLIVES PAST\n`
  ass += `Dialogue: 1,${ts(END_T0 + 0.4)},${ts(TOTAL)},Sub,,0,0,0,,{\\pos(${LAY.sub[0]},${LAY.sub[1]})\\fad(600,0)}@caitycroft\n`
  writeFileSync(assFile, ass)
  writeFileSync(srtFile, srt)
}

// ------------------------------------------------------------------ final
// measure a finished file and bring it to -14 LUFS (social platforms' target), leaving the picture untouched
export function level(file, target = -14) {
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${file}" -af ebur128=framelog=quiet -f null - 2>&1 || true`]).toString())?.[1])
  if (!Number.isFinite(lufs) || Math.abs(lufs - target) < 0.4) return
  const tmp = file.replace(/\.mp4$/, '_lvl.mp4')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-c:v', 'copy', '-af', `volume=${(target - lufs).toFixed(2)}dB,alimiter=limit=0.89`, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp])
  execFileSync('mv', [tmp, file])
  console.log(`  level ${lufs} -> ${target} LUFS: ${file.split('/').pop()}`)
}
async function main() {
  console.log(`Thanksgiving ${V}: ${beats.length} beats, ${TOTAL}s`)
  if (arg('preview')) {
    // a few overlay frames as PNGs, to check the design without a full render
    const data = hudData()
    writeFileSync(`${WORK}/hud.html`, HUD_PAGE.replace('window.D,', `${JSON.stringify(data)},`))
    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: W, height: H } })
    await page.goto(`file://${WORK}/hud.html`)
    await page.evaluate(() => document.fonts.load('15px "JetBrains Mono"'))
    const want = arg('preview').split(',').map((x) => Math.round(Number(x) * FPS))
    for (let f = 0; f <= Math.max(...want); f++) {
      await page.evaluate((f) => window.draw(f), f)
      if (want.includes(f)) await page.screenshot({ path: `${WORK}/preview_${ASPECT}_${f}.png`, omitBackground: true })
    }
    await browser.close()
    return
  }
  await renderCards()
  const bg = `${WORK}/bg_${V}_${ASPECT}.mp4`
  renderBackground(bg)
  const hud = `${WORK}/hud_${V}_${ASPECT}.mov`
  await renderHud(hud)
  const name = `GLP_Thanksgiving_${V}_${ASPECT}${music ? '' : '_voice-only'}`
  const assFile = `${WORK}/${name}.ass`
  writeCaptions(assFile, `${OUT}/GLP_Thanksgiving_${V}_${ASPECT}.srt`)

  // background, then the overlay, then the photos on top
  const inputs = ['-i', bg, '-i', hud], parts = [`[0:v][1:v]overlay=0:0:eof_action=pass[h0]`]
  let prev = 'h0', k = 1
  beats.forEach((b) => {
    if (!b.card) return
    k++
    const n = Math.ceil((b.n + 2) / 4) * 4
    inputs.push('-i', `${WORK}/cards/${key(b.card, n)}.mov`)
    const c = clipOf(b.card)
    const t0 = (b.f0 / FPS).toFixed(4), t1 = (b.f1 / FPS - 0.001).toFixed(4)
    parts.push(`[${k}:v]setpts=PTS-STARTPTS+${t0}/TB[c${k}]`)
    parts.push(`[${prev}][c${k}]overlay=${c.x}:${c.y}:eof_action=pass:enable='between(t,${t0},${t1})'[v${k}]`)
    prev = `v${k}`
  })
  parts.push(`[${prev}]subtitles=filename=${assFile}:fontsdir=${ROOT}/media/fonts[vout]`)
  const voIn = k + 1
  inputs.push('-i', `${ROOT}/media/thanksgiving/vo_${V}.wav`)
  if (music) {
    // the track starts so that its chosen moment lands on the cut into the ghosts' world; it ducks under the voice
    const start = Math.max(0, musicAt - tSto)
    console.log(`  music from ${(start / 60) | 0}:${(start % 60).toFixed(1).padStart(4, '0')} in the track, ${musicAt}s on the Stockholm cut at ${tSto}s`)
    inputs.push('-i', music)
    parts.push(`[${voIn}:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${TOTAL},asplit=2[vo][key]`)
    // the master is loud (about -7 LUFS), so the bed sits about 17 dB down, a little scooped where the voice lives,
    // ducks a few dB more while she speaks, and lifts 6 dB under the end card
    const lift = (END_T0 - 0.6).toFixed(2)
    parts.push(`[${voIn + 1}:a]atrim=start=${start.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,equalizer=f=2500:t=q:w=1.2:g=-3,volume='pow(10,(-17+6*clip((t-${lift})/1.0,0,1))/20)':eval=frame,afade=t=in:d=0.8,afade=t=out:st=${(TOTAL - 2.2).toFixed(2)}:d=2.2,atrim=0:${TOTAL}[bed]`)
    parts.push(`[bed][key]sidechaincompress=threshold=0.04:ratio=3:attack=15:release=350[duck]`)
    parts.push(`[vo][duck]amix=inputs=2:normalize=0,alimiter=limit=0.89[aout]`)
  } else parts.push(`[${voIn}:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${TOTAL}[aout]`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[vout]', '-map', '[aout]', '-t', String(TOTAL),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', `${OUT}/${name}.mp4`], { stdio: 'inherit' })
  console.log(`wrote media/thanksgiving/cuts/${name}.mp4`)
  level(`${OUT}/${name}.mp4`)
  if (music) {
    // the same picture with the voice alone, in case a platform mutes the song
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${OUT}/${name}.mp4`, '-i', `${ROOT}/media/thanksgiving/vo_${V}.wav`, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', `apad=whole_dur=${TOTAL}`, '-c:a', 'aac', '-b:a', '192k', '-t', String(TOTAL), '-movflags', '+faststart', `${OUT}/${name}_voice-only.mp4`])
    console.log(`wrote media/thanksgiving/cuts/${name}_voice-only.mp4`)
    level(`${OUT}/${name}_voice-only.mp4`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
