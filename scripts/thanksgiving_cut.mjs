// The Thanksgiving piece as video art: the simulation's classic and arcade
// worlds cut fast and superimposed underneath, a graphics layer on top (the
// life tree, the big globe in each agent's colour, the agents side by side,
// the data, the race and the heart), and Caity's photos as the human thread,
// placed beside the globe rather than over it. Voice first: every cut is a word
// in the take (media/thanksgiving/vo_<V>.json from thanksgiving_vo.mjs).
//
//   node scripts/thanksgiving_cut.mjs --version A [--aspect 16x9]
//   node scripts/thanksgiving_cut.mjs --version A --music track.m4a --music-at 156
//   node scripts/thanksgiving_cut.mjs --version A --preview 3,12.5,24   (graphics frames only, as PNGs)
//
// --music-at is the moment in the track (seconds) that lands on the cut into the
// ghosts ("In Stockholm..."): in her edit, the synth at 2:36.
// Needs media/thanksgiving/agents.json (esbuild scripts/agents.ts, see its header).
// Writes media/thanksgiving/cuts/GLP_Thanksgiving_<V>_<aspect>.mp4 and .srt.

import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
export const ROOT = resolve('.')
export const FOOT = `${ROOT}/media/thanksgiving/footage`
export const WORK = `${ROOT}/media/thanksgiving/.work`
const OUT = `${ROOT}/media/thanksgiving/cuts`
export const FPS = 30
export const ASPECT = arg('aspect', '9x16')
export const VERT = ASPECT !== '16x9'
export const [W, H] = VERT ? [1080, 1920] : [1920, 1080]
mkdirSync(WORK, { recursive: true })
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
const fr = (t) => Math.round(t * FPS)

// ------------------------------------------------------------------ layout
// Vertical: the globe up top and left of the app icons, photos under it, captions
// in the band above the platform's own text. Horizontal: the globe on the left,
// photos to its right, captions in the lower third.
export const L = VERT
  ? {
      vertical: true, globe: { x: 495, y: 590, r: 300 }, photo: { x: 80, y: 945, w: 480, h: 345 }, labelMaxX: 905,
      readout: [40, 150], tick: [22, 330, 1150], vp: [540, 860],
      tree: { vertical: true, cx: 500, hw: 400, y0: 1140, y1: 420 },
      sim: { cx: 520, cy: 790, R: 290, R2: 120, sx: 1.0, font: 26, head: 262 },
      tiles: { cols: 2, x0: 64, y0: 272, w: 418, h: 190, gx: 22, gy: 14, thumb: { x: 10, y: 10, w: 132, h: 170 }, text: { x: 156, y: 36, w: 250 }, fs: { name: 26, gap: 22, small: 14, role: 19, chipB: 14 } },
      tilesHead: [64, 246],
      honest: { sil: { x: 610, y: 280, w: 390, h: 330 }, tx: 80, ty: 770, tw: 880, fs: [60, 40, 28], chart: { x: 110, y: 1040, w: 790, h: 200 } },
      mini: { x: 300, y: 455, r: 200 },
      ring: { cx: 495, cy: 765, rx: 365, ry: 468, tr: 62, fs: 18 }, ringGlobe: { x: 495, y: 765, r: 228 },
      race: { vertical: true, cx: 500, hw: 430, y0: 1520, y1: 250 }, raceTag: [64, 262],
      now: [70, 232], tagTop: 120, tagBot: 420,
      hook: 72, hookPos: [495, 1335], hookWrap: 22, cap: 52, mL: 80, mR: 170, mV: 470, title: [540, 330], sub: [540, 478],
    }
  : {
      vertical: false, globe: { x: 500, y: 470, r: 345 }, photo: { x: 1000, y: 110, w: 760, h: 470 }, labelMaxX: 1860,
      readout: [44, 40], tick: [30, 130, 820], vp: [960, 520],
      tree: { vertical: false, cy: 440, hh: 320, x0: 170, x1: 1450 },
      sim: { cx: 960, cy: 485, R: 255, R2: 105, sx: 1.55, font: 22, head: 66 },
      tiles: { cols: 5, x0: 104, y0: 150, w: 324, h: 340, gx: 18, gy: 18, thumb: { x: 10, y: 10, w: 304, h: 150 }, text: { x: 14, y: 196, w: 296 }, fs: { name: 28, gap: 22, small: 14, role: 20, chipB: 16 } },
      tilesHead: [104, 122],
      honest: { sil: { x: 1520, y: 80, w: 330, h: 290 }, tx: 760, ty: 200, tw: 740, fs: [64, 42, 30], chart: { x: 790, y: 540, w: 1000, h: 230 } },
      mini: { x: 380, y: 480, r: 250 },
      ring: { cx: 960, cy: 470, rx: 650, ry: 330, tr: 64, fs: 18 }, ringGlobe: { x: 960, y: 470, r: 232 },
      race: { vertical: false, cy: 470, hh: 400, x0: 80, x1: 1840 }, raceTag: [60, 150],
      now: [80, 70], tagTop: 0, tagBot: 0,
      hook: 70, hookPos: [960, 902], hookWrap: 40, cap: 46, mL: 260, mR: 260, mV: 105, title: [540, 300], sub: [540, 405],
    }

// ------------------------------------------------------------------ places and agents
const AGENTS = JSON.parse(readFileSync(`${ROOT}/media/thanksgiving/agents.json`, 'utf8'))
const NEON = Object.fromEntries(AGENTS.agents.map((a) => [a.id, a.neon]))
const COUNTRY = { USA: 'UNITED STATES', SWE: 'SWEDEN', GBR: 'UNITED KINGDOM', DEU: 'GERMANY', NOR: 'NORWAY', CHN: 'CHINA' }
// where each photo was taken: name, lat, lon, iso3, year, and whose colour (the agent who stayed there; the real thread in San Francisco)
const GEO = {
  la: ['LOS ANGELES', 34.05, -118.24, 'USA', 2012, 'la'], sto: ['STOCKHOLM', 59.33, 18.07, 'SWE', 2016, 'sto'], utah: ['UTAH', 40.76, -111.89, 'USA', 2021, 'utah'],
  hnl: ['HAWAII', 21.31, -157.86, 'USA', 2021, 'hnl'], nyc: ['NEW YORK', 40.71, -74.0, 'USA', 2022, 'nyc'], lon: ['LONDON', 51.51, -0.13, 'GBR', 2023, 'lon'],
  ber: ['BERLIN', 52.52, 13.4, 'DEU', 2023, 'ber'], osl: ['OSLO', 59.91, 10.75, 'NOR', 2024, 'osl'], sha: ['SHANGHAI', 31.23, 121.47, 'CHN', 2024, 'sha'],
  sf: ['SAN FRANCISCO', 37.77, -122.42, 'USA', 2026, 'real'], hoga: ['HIGH COAST', 62.95, 18.25, 'SWE', 2017, 'sto'], brc: ['BLACK ROCK CITY', 40.79, -119.2, 'USA', 2015, 'la'],
  ca: ['CALIFORNIA', 36.78, -119.42, 'USA', 2015, 'la'], sco: ['SCOTLAND', 56.82, -5.11, 'GBR', 2018, 'lon'],
}
const wb = (kind, iso, yr) => AGENTS[kind]?.[iso]?.[String(Math.min(yr, 2024))] ?? null
const places = Object.fromEntries(Object.entries(GEO).map(([key, [name, lat, lon, iso, yr, agent]]) => [key, {
  key, name, lat, lon, iso, yr, agent, color: NEON[agent], country: COUNTRY[iso], gdp: wb('gdp', iso, yr), infl: wb('inflation', iso, yr),
}]))
// each agent: the photo of her in that city, and her home on the globe
const AGENT_PHOTO = {
  real: ['sf_sunlit_selfie_presidio', 0.5, 0.3], la: ['la_performing_red_ableton', 0.45, 0.3], sto: ['stockholm_archipelago_flag', 0.5, 0.45], utah: ['utah_saltflats_mirrors_standing', 0.5, 0.45],
  hnl: ['hawaii_xr_quest_headset_glasses', 0.5, 0.3], lon: ['london_alphatheta_mic_still', 0.5, 0.3], ber: ['berlin_node_talk_smile', 0.45, 0.3], nyc: ['nyc_studio_smile_headphones', 0.5, 0.3],
  osl: ['oslo_pride_dj_closeup', 0.5, 0.3], sha: ['shanghai_ima_lowres_thesis_smile', 0.55, 0.3],
}
export const agents = AGENTS.agents.map((a) => {
  const home = places[a.real ? 'sf' : a.id]
  return {
    id: a.id, name: a.name, neon: a.neon, real: a.real, fork: a.fork, ends: a.ends, home: { lat: home.lat, lon: home.lon },
    photo: AGENT_PHOTO[a.id][0], fx: AGENT_PHOTO[a.id][1], fy: AGENT_PHOTO[a.id][2],
    rows: a.rows.map((r) => ({ role: r.role, industryLabel: r.industryLabel, industryColor: r.industryColor, city: r.city, iso: r.iso })),
  }
})

// ------------------------------------------------------------------ edit
// scenes are what the graphics layer draws; plates are the simulation underneath
const scenes = [], plates = []
const sc = (t0, type, o = {}) => scenes.push({ t0: Math.max(0, t0), type, ...o })
const pl = (t0, shot, inn = 0, over = null, op = 0.4, grade = 'vivid') => plates.push({ t0: Math.max(0, t0), shot, inn, over: over && { shot: over[0], inn: over[1], op }, grade })
const big = { ...L.globe }

// Opening: the life as a neon line that forks at every place she left; solid for the road taken, dotted for the ones not
const tenRe = /^I.ve lived in ten cities/
const t10 = cut(line(tenRe).voiceStart), tStayed = cut(word(tenRe, 'the', 0))
const openWords = [...caps[0].words, ...(/^If you/.test(caps[1].text) ? caps[1].words : [])]
const pick = (names) => { for (const n of names) { const w = openWords.find((x) => bare(x.w) === n); if (w) return fr(w.start) } return null }
pl(0, 'c_globe_build', 1.2, ['a_globe_build', 1.2], 0.5, 'dim')
sc(0, 'tree', { noReadout: false, marks: { grow: [fr(0.35), fr(t10 - 0.55)], stay: pick(['stayed', 'other', 'different']), leave: pick(['leaving', 'path', 'timeline', 'choice']) } })

// "I've lived in ten cities, in six countries." ten hard cuts: the globe jumps, the dot takes each city's colour, the photo sits under it
const cities = [
  ['la_performing_red_ableton', 'la', ['a_hook', 1]], ['stockholm_archipelago_flag', 'sto', ['a_dio_sto_plate', 0.5]], ['utah_saltflats_mirrors_dance', 'utah', ['a_street_forks', 1]],
  ['hawaii_xr_quest_headset_glasses', 'hnl', ['a_dio_ghost_plate', 0.5]], ['nyc_soho_street_selfies_stencil', 'nyc', ['a_city_nyc', 0.5]], ['london_alphatheta_mic_still', 'lon', ['c_city_street', 2]],
  ['berlin_night_street_signs', 'ber', ['a_street_forks', 3]], ['oslo_pride_dj_born_to_mix_smile', 'osl', ['a_city_osl', 0.5]], ['shanghai_bund_skyline_night', 'sha', ['a_city_sha', 0.5]],
  ['sf_golden_gate_sunset_friend', 'sf', ['a_outro', 2]],
]
cities.forEach(([photo, g, plate], i) => {
  const t = t10 + (i * (tStayed - t10)) / cities.length
  sc(t, 'place', { photo, geo: g, globe: big, hard: true, quick: true, glitch: i > 0 })
  pl(t, plate[0], plate[1], i % 2 ? ['c_city_street', 1 + i * 0.6] : ['a_street_forks', 0.5 + i * 0.5], 0.3)
})
// "...about the me who stayed, and the life she'd keep building there." the selves who stayed peel off down the neon street
sc(tStayed, 'forks', { ticker: true, glitch: true })
pl(tStayed, 'a_street_forks', 5.4, ['c_globe_tour_plate', 0], 0.3)

// "So I built a multi agent simulation." the story wall she made, held long enough to read (it comes in during the
// breath before the line), then the simulation itself in rapid cuts under the causal tree from "simulation"
const simRe = /^So I built/
const tSim = cut(line(simRe).voiceStart), tEach = cut(word(simRe, 'each'))
const tWall = Math.max(line(tenRe).voiceEnd + 0.35, tSim - 0.6), tMulti = cut(word(simRe, 'simulation'))
sc(tWall, 'place', { photo: 'nyc_story_wall_full', geo: 'nyc', globe: big, pan: true, year: 2023 })
pl(tWall, 'c_loom', 0.5, ['a_timeline', 0.5], 0.4)
sc(tMulti, 'simtree', { glitch: true, quick: true })
// (the split doorway is mostly empty when tall, so the vertical cut uses the data and the streets instead)
const rapid = [['c_loom', 3], ['a_loom', 1], ['a_timeline', 4], VERT ? ['c_data', 2] : ['c_split', 1], ['a_dash', 2], ['a_how', 3], ['c_globe_tour', 2.5], VERT ? ['a_city_nyc', 1] : ['a_split', 2], ['a_lives', 3], ['c_data', 4]]
rapid.forEach(([s, inn], i) => pl(tMulti + (i * (tEach - tMulti)) / rapid.length, s, inn))

// "Each agent is me, staying in one of those cities and building a life shaped by its economy and industries at the time."
// from her in Utah, out to all ten selves side by side, their years running and their lives splitting at each fork
const hRe = /most honest answer/
const tHonest = cut(line(hRe).voiceStart)
sc(tEach, 'agents', { noReadout: true, marks: { build: fr(cut(word(simRe, 'and'))), economy: fr(cut(word(simRe, 'economy'))), industries: fr(cut(word(simRe, 'industries'))) } })
const agBg = VERT ? [['c_data', 0], ['a_dash', 0.5], ['c_lives', 1], ['a_lives', 1.5], ['a_timeline', 3]] : [['c_split', 0], ['a_split', 0.5], ['a_dash', 1.5], ['c_data', 1], ['a_loom', 2]]
agBg.forEach(([s, inn], i) => pl(tEach + (i * (tHonest - tEach)) / agBg.length, s, inn, null, 0, 'dim'))

// "It's my most honest answer to where each life would be today." four selves, one card each: her role now, the era, the country's numbers
const ghRe = /^In Stockholm/
const tSto = cut(line(ghRe).voiceStart)
const honest = [
  { agent: 'sha', key: 2020, metric: 'gdp', trend: 'COVID 19 pandemic', at: tHonest, plate: ['a_city_sha', 0.3] },
  { agent: 'nyc', key: 2022, metric: 'infl', trend: 'Inflation and rate hikes', at: cut(word(hRe, 'answer')), plate: ['a_city_nyc', 0.3] },
  { agent: 'osl', key: 2024, metric: 'gdp', trend: 'Generative AI and the compute buildout', at: cut(word(hRe, 'each')), plate: ['a_city_osl', 0.3] },
  { agent: 'lon', key: 2016, metric: 'gdp', trend: 'Brexit and the 2016 US election', at: cut(word(hRe, 'today')) + 0.15, plate: ['c_globe_tour_plate', 0.6] },
]
for (const h of honest) {
  sc(h.at, 'honest', { ...h, geo: h.agent, globe: L.mini, noLabel: true, glitch: true })
  pl(h.at, h.plate[0], h.plate[1], ['a_dash', 2], 0.25)
}

// The three ghosts, in the arcade world: where she stayed, and what she does there now
const tBer = cut(word(ghRe, 'in', 1)), tHnl = cut(word(ghRe, 'in', 2))
sc(tSto, 'place', { photo: 'stockholm_boat_sunset', geo: 'sto', globe: big, look: 'arcade', ghost: 'sto' })
pl(tSto, 'a_dio_sto_plate', 1, ['a_street_forks', 7], 0.35)
sc(tBer, 'place', { photo: 'ibiza_amnesia_vj_performing', geo: 'ber', globe: big, look: 'arcade', ghost: 'ber', fx: 0.6 })
pl(tBer, 'a_street_forks', 2, ['a_hook', 5], 0.35)
sc(tHnl, 'place', { photo: 'hawaii_eternal_game_jeep_hud_still', geo: 'hnl', globe: big, look: 'arcade', ghost: 'hnl', fx: 0.45 })
pl(tHnl, 'a_dio_ghost_plate', 0, ['a_outro', 3], 0.35)

// "And here I am." everything drops away
const tHere = cut(line(/^And here I am/).voiceStart)
sc(tHere, 'full', { photo: 'la_studio_desk_selfie_now', pos: [0.78, 0.5], tag: 'NOW, 2026' })
pl(tHere, null)

// Thanksgiving, looking back: San Francisco, then the High Coast
const tgRe = /^Today is Thanksgiving/
const tTg = cut(line(tgRe).voiceStart)
sc(tTg, 'place', { photo: 'sf_golden_gate_family', geo: 'sf', globe: big })
pl(tTg, 'a_outro', 0, ['c_city_street', 4], 0.35, 'warm')
sc(cut(word(tgRe, 'wherever')), 'place', { photo: 'highcoast_lake_pink_sky', geo: 'hoga', globe: big })

// "Looking at all of them, I don't feel regret. I feel grateful." every self around the world, lines to where she stayed, warming to gold
const lkRe = /^Looking at all of them/
const tLook = cut(line(lkRe).voiceStart)
sc(tLook, 'ring', { globe: L.ringGlobe, spin: 0.35, noPin: true, color: '#7cc4ff', marks: { grateful: fr(cut(word(lkRe, 'i', 1))) } })
pl(tLook, 'a_timeline', 2, ['c_loom', 2], 0.3, 'dim')

// "For the chapters that ended, and the ones still going." the ended in grey, the going in colour
const chRe = /^For the chapters/
const tCh = cut(line(chRe).voiceStart), tGoing = cut(word(chRe, 'and', 0)), tRoads = cut(word(chRe, 'for', 1))
const ended = [['la_opening_for_rufus_du_sol_mic', 'ca'], ['burningman_fire_katana_playa', 'brc'], ['scotland_performing_valley_solo', 'sco'], ['shanghai_graduation_selfie_classmates', 'sha']]
const going = [['berlin_node_talk_smile', 'ber'], ['shanghai_thesis_infinite_game_studio_presentation', 'sha'], ['sf_dj_duo_headphones', 'sf']]
ended.forEach(([p, g], i) => sc(tCh + (i * (tGoing - tCh)) / ended.length, 'place', { photo: p, geo: g, globe: big, hard: true, chapter: 'ended', glitch: i > 0 }))
going.forEach(([p, g], i) => sc(tGoing + (i * (tRoads - tGoing)) / going.length, 'place', { photo: p, geo: g, globe: big, hard: true, chapter: 'going', glitch: true }))
pl(tCh, 'a_hook', 3, ['c_city_street', 5], 0.3)
// "For the roads I took, and the ones I didn't." the race from above: every self in the pack, peeling off at her fork
sc(tRoads, 'race', { noReadout: true, marks: { took: fr(cut(word(chRe, 'took'))), didnt: fr(cut(line(chRe).words.at(-1).start)) } })
pl(tRoads, 'a_street_forks', 8, null, 0, 'dark')

// "We can't go back. But we can say thank you, and choose where we go next."
const bkRe = /^We can.t go back/
const tBack = cut(line(bkRe).voiceStart)
sc(tBack, 'plain', { ticker: true })
pl(tBack, 'c_timeline', 5, ['a_timeline', 5], 0.4)
sc(cut(word(bkRe, 'but')), 'full', { photo: 'sf_run_golden_gate_dusk', tag: 'SAN FRANCISCO  37.77°N 122.42°W' })
pl(cut(word(bkRe, 'but')), null)

// "Happy Thanksgiving, from all of me." every self's hovercraft comes in, and their trails draw a heart around her on the High Coast
const hpRe = /^Happy Thanksgiving/
const tHappy = cut(line(hpRe).voiceStart)
export const heartPos = VERT ? [0.55, 0.5] : [0.5, 0.5]
sc(tHappy, 'heart', { photo: 'highcoast_rock_dusk_all_yours', pos: heartPos, still: true, cover: true })
pl(tHappy, null)

// frames
for (const list of [scenes, plates]) {
  list.sort((a, b) => a.t0 - b.t0)
  list.forEach((b, i) => {
    b.f0 = fr(b.t0)
    b.f1 = i < list.length - 1 ? fr(list[i + 1].t0) : fr(TOTAL)
    b.n = b.f1 - b.f0
    if (b.n <= 0) throw new Error(`empty ${b.type ?? b.shot} at ${b.t0}`)
  })
}
// where she sits in the rock photo, so the heart is drawn around her (head and shoulders, in the photo's own fractions)
{
  const [iw, ih] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', `${FOOT}/highcoast_rock_dusk_all_yours.jpg`]).toString().trim().split(',').map(Number)
  const s = Math.max(W / iw, H / ih), sw = W / s, sh = H / s
  const fx = (0.535 * iw - (iw - sw) * heartPos[0]) * s, fy = (0.47 * ih - (ih - sh) * heartPos[1]) * s
  L.heart = { cx: Math.round(fx), cy: Math.round(fy), s: VERT ? 370 : 290 }
}

// ------------------------------------------------------------------ background
export const GRADE = {
  vivid: 'eq=contrast=1.07:saturation=1.5',
  dim: 'eq=brightness=-0.07:saturation=1.35',
  dark: 'eq=brightness=-0.12:saturation=1.3,gblur=sigma=2',
  warm: 'eq=saturation=1.4,colorbalance=rs=0.07:gs=0.02:bs=-0.05',
}
function renderBackground(file) {
  const inputs = [], parts = []
  let k = 0
  // a plate segment: trimmed, held if the shot runs out, drifting slowly (a gentle push and sway)
  const seg = (shot, inn, b, phase) => {
    inputs.push('-ss', Math.max(0, inn).toFixed(3), '-i', `${ROOT}/media/shots/${ASPECT}/${shot}.mp4`)
    const z = `${Math.round(W * 1.1)}:${Math.round(H * 1.1)}`
    return `[${k++}:v]fps=${FPS},scale=${W}:${H},tpad=stop_mode=clone:stop_duration=30,trim=end_frame=${b.n},setpts=PTS-STARTPTS,scale=${z},crop=${W}:${H}:x='(iw-ow)/2*(1+0.7*sin(t*0.31+${phase}))':y='(ih-oh)/2*(1+0.7*cos(t*0.23+${phase}))',format=gbrp`
  }
  plates.forEach((b, i) => {
    if (!b.shot) {
      inputs.push('-f', 'lavfi', '-i', `color=c=0x02040a:s=${W}x${H}:r=${FPS}`)
      parts.push(`[${k++}:v]trim=end_frame=${b.n},setpts=PTS-STARTPTS,format=yuv420p[s${i}]`)
      return
    }
    const grade = GRADE[b.grade]
    if (!b.over) { parts.push(`${seg(b.shot, b.inn, b, i * 0.7)},format=yuv420p,${grade}[s${i}]`); return }
    parts.push(`${seg(b.shot, b.inn, b, i * 0.7)}[a${i}]`)
    parts.push(`${seg(b.over.shot, b.over.inn, b, i * 0.7 + 2.1)}[o${i}]`)
    parts.push(`[a${i}][o${i}]blend=all_mode=screen:all_opacity=${b.over.op},format=yuv420p,${grade}[s${i}]`)
  })
  parts.push(`${plates.map((_, i) => `[s${i}]`).join('')}concat=n=${plates.length}:v=1:a=0[bg]`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[bg]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), file])
}

// ------------------------------------------------------------------ graphics
export function gfxData() {
  const { feature } = require('topojson-client')
  const topo = JSON.parse(readFileSync(`${ROOT}/node_modules/world-atlas/land-110m.json`, 'utf8'))
  const land = feature(topo, topo.objects.land)
  const polys = land.type === 'FeatureCollection' ? land.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)) : land.geometry.coordinates
  const allRings = polys.flatMap((p) => p)
  const rings = allRings.map((ring) => ring.filter((_, i) => i % 2 === 0).map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]))
  // the land as a dot matrix: a point is land when it sits inside an odd number of rings
  const boxes = allRings.map((r) => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, y] of r) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y) } return [a, b, c, d] })
  const inside = (x, y) => {
    let n = 0
    allRings.forEach((r, k) => {
      const [a, b, c, d] = boxes[k]; if (x < a || x > b || y < c || y > d) return
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) n++ }
    })
    return n % 2 === 1
  }
  const dots = []
  const step = 1.6
  for (let la = -58; la <= 82; la += step) for (let lo = -180; lo < 180; lo += step / Math.max(0.35, Math.cos((la * Math.PI) / 180))) if (inside(lo, la)) dots.push(+lo.toFixed(2), +la.toFixed(2))
  // country outlines for the data cards
  const ctopo = JSON.parse(readFileSync(`${ROOT}/node_modules/world-atlas/countries-110m.json`, 'utf8'))
  const ISO = { SWE: '752', DEU: '276', USA: '840', GBR: '826', NOR: '578', CHN: '156' }
  const shapes = {}
  for (const f of feature(ctopo, ctopo.objects.countries).features) {
    const iso = Object.keys(ISO).find((k) => ISO[k] === String(f.id).padStart(3, '0'))
    if (!iso) continue
    const ps = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    shapes[iso] = ps.map((p) => p[0].map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]))
  }
  return {
    W, H, FPS, total: fr(TOTAL), L, rings, dots, shapes, places, agents, eras: AGENTS.eras, industries: AGENTS.industries,
    gdp: AGENTS.gdp, inflation: AGENTS.inflation, tileOrder: ['real', 'la', 'sto', 'utah', 'hnl', 'nyc', 'lon', 'ber', 'osl', 'sha'],
    scenes: scenes.map(({ t0, ...s }) => s),
  }
}
const photosUsed = () => [...new Set([...scenes.map((s) => s.photo).filter(Boolean), ...agents.map((a) => a.photo)])]
async function gfxPage() {
  const data = gfxData()
  const fonts = `@font-face { font-family: 'Press Start 2P'; src: url('file://${ROOT}/media/fonts/PressStart2P-Regular.ttf'); }
    @font-face { font-family: Arial; src: url('file://${ROOT}/media/fonts/LiberationSans-Bold.ttf'); font-weight: 700; }
    @font-face { font-family: Arial; src: url('file://${ROOT}/media/fonts/LiberationSans-Regular.ttf'); font-weight: 400; }`
  const imgs = photosUsed().map((p) => `<img data-id="${p}" src="file://${FOOT}/${p}.jpg">`).join('')
  writeFileSync(`${WORK}/gfx_${V}_${ASPECT}.html`, `<!doctype html><meta charset=utf-8><style>${fonts} html,body{margin:0;background:transparent;overflow:hidden} img{display:none} canvas{display:block}</style>
<canvas id=c></canvas>${imgs}<script>window.D = ${JSON.stringify(data)}</script>`)
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  await page.goto(`file://${WORK}/gfx_${V}_${ASPECT}.html`, { waitUntil: 'load' })
  await page.evaluate(() => Promise.all([document.fonts.load('700 20px Arial'), document.fonts.load('400 20px Arial'), document.fonts.load('15px "JetBrains Mono"'), document.fonts.load('600 15px "JetBrains Mono"'), ...[...document.images].map((i) => i.decode())]))
  if (await page.evaluate(() => [...document.images].some((i) => !i.naturalWidth))) throw new Error('a photo did not load')
  await page.addScriptTag({ path: `${ROOT}/scripts/thanksgiving_gfx.js` })
  page.on('pageerror', (e) => { throw e })
  return { browser, page, data }
}
async function renderGfx(file) {
  const { browser, page, data } = await gfxPage()
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'png', '-pix_fmt', 'rgba', file], { stdio: ['pipe', 'inherit', 'inherit'] })
  for (let f = 0; f < data.total; f++) {
    await page.evaluate((f) => window.draw(f), f)
    let png
    for (let tries = 0; !png; tries++) {
      try { png = await page.screenshot({ type: 'png', omitBackground: true }) } catch (e) { if (tries >= 3) throw e; await new Promise((r) => setTimeout(r, 1500)) }
    }
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
    if (f % 300 === 0) console.log(`  graphics ${f}/${data.total}`)
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  await browser.close()
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
    style('Box', L.cap, C.clear, C.box, C.box, true, 3, 18, 0, 2, L.mL, L.mR, L.mV),
    style('Cap', L.cap, C.white, '&H00000000', '&H00000000', true, 1, 0, 0, 2, L.mL, L.mR, L.mV),
    style('Hook', L.hook, C.white, '&H40000000', '&H80000000', true, 1, 2, 3, 5, 0, 0, 0, 1),
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
        for (const w of ch.text.split(' ')) { if ((l + ' ' + w).trim().length > L.hookWrap) { lines.push(l.trim()); l = w } else l += ' ' + w }
        lines.push(l.trim())
        ass += `Dialogue: 1,${ts(ch.t0)},${ts(ch.t1)},Hook,,0,0,0,,{\\pos(${L.hookPos[0]},${L.hookPos[1]})\\fad(220,160)\\blur0.6\\q0}${esc(lines.join('\\N'))}\n`
        continue
      }
      ass += `Dialogue: 0,${ts(ch.t0)},${ts(ch.t1)},Box,,0,0,0,,{\\fad(140,120)}${esc(ch.text)}\n`
      ass += `Dialogue: 1,${ts(ch.t0)},${ts(ch.t1)},Cap,,0,0,0,,{\\fad(140,120)}${esc(ch.text)}\n`
    }
  })
  ass += `Dialogue: 1,${ts(END_T0)},${ts(TOTAL)},Title,,0,0,0,,{\\pos(${L.title[0]},${L.title[1]})\\fad(600,0)}GHOSTS OF\\NLIVES PAST\n`
  ass += `Dialogue: 1,${ts(END_T0 + 0.4)},${ts(TOTAL)},Sub,,0,0,0,,{\\pos(${L.sub[0]},${L.sub[1]})\\fad(600,0)}@caitycroft\n`
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
  console.log(`Thanksgiving ${V} ${ASPECT}: ${scenes.length} scenes, ${plates.length} plates, ${TOTAL}s`)
  if (arg('preview')) {
    // a few graphics frames as PNGs, to check the design without a full render
    const { browser, page } = await gfxPage()
    const want = arg('preview').split(',').map((x) => fr(Number(x)))
    for (let f = 0; f <= Math.max(...want); f++) {
      await page.evaluate((f) => window.draw(f), f)
      if (want.includes(f)) await page.screenshot({ path: `${WORK}/preview_${ASPECT}_${(f / FPS).toFixed(1)}.png`, omitBackground: true })
    }
    await browser.close()
    return
  }
  const bg = `${WORK}/bg_${V}_${ASPECT}.mp4`
  if (!process.argv.includes('--keep-bg')) renderBackground(bg)
  console.log('  background done')
  const gfx = `${WORK}/gfx_${V}_${ASPECT}.mov`
  if (!process.argv.includes('--keep-gfx')) await renderGfx(gfx)
  const name = `GLP_Thanksgiving_${V}_${ASPECT}${music ? '' : '_voice-only'}`
  const assFile = `${WORK}/${name}.ass`
  writeCaptions(assFile, `${OUT}/GLP_Thanksgiving_${V}_${ASPECT}.srt`)

  // the simulation underneath, the graphics and photos over it, then the captions
  const inputs = ['-i', bg, '-i', gfx, '-i', `${ROOT}/media/thanksgiving/vo_${V}.wav`]
  const parts = [`[0:v][1:v]overlay=0:0:eof_action=pass,subtitles=filename=${assFile}:fontsdir=${ROOT}/media/fonts[vout]`]
  const voIn = 2
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
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', `${OUT}/${name}.mp4`], { stdio: 'inherit' })
  console.log(`wrote media/thanksgiving/cuts/${name}.mp4`)
  level(`${OUT}/${name}.mp4`)
  // the graphics layer is about 2.5 GB of PNG frames; it goes once the film is made, unless kept for a quick re-finish
  if (!process.argv.includes('--keep-work')) execFileSync('rm', ['-f', gfx])
  if (music) {
    // the same picture with the voice alone, in case a platform mutes the song
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${OUT}/${name}.mp4`, '-i', `${ROOT}/media/thanksgiving/vo_${V}.wav`, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', `apad=whole_dur=${TOTAL}`, '-c:a', 'aac', '-b:a', '192k', '-t', String(TOTAL), '-movflags', '+faststart', `${OUT}/${name}_voice-only.mp4`])
    console.log(`wrote media/thanksgiving/cuts/${name}_voice-only.mp4`)
    level(`${OUT}/${name}_voice-only.mp4`)
  }
}
// run as a script (the thumbnails import this file for its layout and data)
if (process.argv[1]?.endsWith('thanksgiving_cut.mjs')) main().catch((e) => { console.error(e); process.exit(1) })
