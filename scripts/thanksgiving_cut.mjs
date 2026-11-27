// The Thanksgiving piece: Caity's photos in framed windows over the
// simulation, cut to her voiceover word by word. Voice first: every cut point
// is a word in the take (media/thanksgiving/vo_<V>.json from thanksgiving_vo.mjs).
//
//   node scripts/thanksgiving_cut.mjs --version A
//   node scripts/thanksgiving_cut.mjs --version A --music track.m4a --music-at 156
//
// --music-at is the moment in the track (seconds) that lands on the cut into the
// ghosts' arcade world ("In Stockholm..."): in her edit, the synth at 2:36.
// Writes media/thanksgiving/cuts/GLP_Thanksgiving_<V>_9x16.mp4 and .srt.
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
const W = 1080, H = 1920
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
const P = (shot, inn, since) => ({ shot, inn, since }) // plate: shot, its in point at time `since`
const win = (photo, o = {}) => ({ kind: 'win', photo, look: o.look ?? 'classic', label: o.label ?? '', sub: o.sub ?? '', hard: !!o.hard, pan: !!o.pan, size: o.size ?? null })
const full = (photo, o = {}) => ({ kind: 'full', photo, fit: o.fit ?? 'cover', pos: o.pos ?? '50% 50%' })

const beats = []
const at = (t0, b) => beats.push({ t0: Math.max(0, t0), ...b })

// Opening: the globe assembling; in version A the second question shows her leaving
const g0 = P('c_globe_build', 1.2, 0)
at(0, { bg: g0 })
if (/^If you.d stayed/.test(caps[1].text)) at(cut(caps[1].voiceStart), { bg: g0, card: win('highcoast_field_horizon_back') })

// "I've lived in ten cities..." the ten cities, then the threads splitting on "the me who stayed"
const tenRe = /^I.ve lived in ten cities/
const t10 = cut(line(tenRe).voiceStart), tStayed = cut(word(tenRe, 'the', 0))
const cities = [
  ['la_performing_red_ableton', 'LOS ANGELES'], ['stockholm_archipelago_flag', 'STOCKHOLM'], ['utah_saltflats_mirrors_dance', 'UTAH'],
  ['hawaii_running_road_crop', 'HAWAII'], ['nyc_soho_street_selfies_stencil', 'NEW YORK'], ['london_alphatheta_mic_still', 'LONDON'],
  ['berlin_night_street_signs', 'BERLIN'], ['oslo_pride_dj_born_to_mix_smile', 'OSLO'], ['shanghai_bund_skyline_night', 'SHANGHAI'],
  ['sf_golden_gate_sunset_friend', 'SAN FRANCISCO'],
]
const montage = P('c_globe_follow', 0.5, t10)
cities.forEach(([photo, label], i) => at(t10 + (i * (tStayed - t10)) / cities.length, { bg: montage, card: win(photo, { label, hard: true }) }))
at(tStayed, { bg: P('a_street_forks', 5.4, tStayed) })

// "So I built a multi agent simulation. Each agent is me... shaped by its economy and industries"
const simRe = /^So I built/
const tSim = cut(line(simRe).voiceStart)
const loom = P('c_loom', 0.5, tSim)
at(tSim, { bg: loom, card: win('nyc_story_wall_full', { size: [600, 800], pan: true }) })
at(cut(word(simRe, 'each')), { bg: loom, card: win('utah_saltflats_mirrors_standing') })
at(cut(word(simRe, 'and')), { bg: P('c_data', 1.0, cut(word(simRe, 'and'))) })
at(cut(line(/most honest answer/).voiceStart), { bg: P('a_lives', 0.5, cut(line(/most honest answer/).voiceStart)) })

// The three ghosts, in the arcade world
const ghRe = /^In Stockholm/
const tSto = cut(line(ghRe).voiceStart), tBer = cut(word(ghRe, 'in', 1)), tHnl = cut(word(ghRe, 'in', 2))
at(tSto, { bg: P('a_globe_tour', 0.3, tSto), card: win('stockholm_boat_sunset', { look: 'arcade', label: 'STOCKHOLM', sub: 'MY AGENT, STAYED IN 2016' }) })
at(tBer, { bg: P('a_globe_tour', 9.0, tBer), card: win('berlin_studio_projector_setup', { look: 'arcade', label: 'BERLIN', sub: 'MY AGENT, STAYED IN 2023' }) })
at(tHnl, { bg: P('a_globe_tour', 4.4, tHnl), card: win('hawaii_coast_lava_path_still', { look: 'arcade', label: 'HAWAII', sub: 'MY AGENT, STAYED IN 2021' }) })

// "And here I am." everything drops away
at(cut(line(/^And here I am/).voiceStart), { card: full('la_studio_desk_selfie_now', { pos: '78% 50%' }) })

// Thanksgiving, looking back, gratitude
const tgRe = /^Today is Thanksgiving/
const tTg = cut(line(tgRe).voiceStart)
const orbit = P('c_outro', 0, tTg)
at(tTg, { bg: orbit, card: win('sf_golden_gate_family') })
at(cut(word(tgRe, 'wherever')), { bg: orbit, card: win('highcoast_lake_pink_sky') })
const lkRe = /^Looking at all of them/
at(cut(line(lkRe).voiceStart), { bg: orbit, card: win('selfie_autumn_street_fleece') })
const tGrateful = cut(word(lkRe, 'i', 1))
const threads = P('c_globe_tour', 0, tGrateful)
at(tGrateful, { bg: threads, card: win('highcoast_field_laughing') })

// "For the chapters that ended, and the ones still going. For the roads I took, and the ones I didn't."
const chRe = /^For the chapters/
const tCh = cut(line(chRe).voiceStart), tGoing = cut(word(chRe, 'and', 0)), tRoads = cut(word(chRe, 'for', 1))
const ended = ['la_opening_for_rufus_du_sol_mic', 'burningman_fire_katana_playa', 'scotland_performing_valley_solo', 'shanghai_graduation_selfie_classmates']
const going = ['berlin_node_talk_smile', 'shanghai_thesis_infinite_game_studio_presentation', 'sf_dj_duo_headphones']
ended.forEach((p, i) => at(tCh + (i * (tGoing - tCh)) / ended.length, { bg: threads, card: win(p, { hard: true }) }))
going.forEach((p, i) => at(tGoing + (i * (tRoads - tGoing)) / going.length, { bg: threads, card: win(p, { hard: true }) }))
at(tRoads, { bg: threads, card: win('shanghai_heart_wishes_tunnel') })

// "We can't go back. But we can say thank you, and choose where we go next."
const bkRe = /^We can.t go back/
const tBack = cut(line(bkRe).voiceStart)
at(tBack, { bg: P('c_timeline', 5, tBack) })
at(cut(word(bkRe, 'but')), { card: full('sf_run_golden_gate_dusk') })

// "Happy Thanksgiving, from all of me." and the end card
at(cut(line(/^Happy Thanksgiving/).voiceStart), { card: full('highcoast_rock_dusk_all_yours', { fit: 'contain' }) })

beats.sort((a, b) => a.t0 - b.t0)
beats.forEach((b, i) => {
  b.f0 = Math.round(b.t0 * FPS)
  b.f1 = i < beats.length - 1 ? Math.round(beats[i + 1].t0 * FPS) : Math.round(TOTAL * FPS)
  b.n = b.f1 - b.f0
  if (b.n <= 0) throw new Error(`empty beat at ${b.t0}`)
})

// ------------------------------------------------------------------ cards
const dims = (photo) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', `${FOOT}/${photo}.jpg`]).toString().trim().split(',').map(Number)
// windows sit in a box above the captions and left of the app icons
const BOX = { cx: 520, cy: 690, w: 840, h: 860 }
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

const key = (card, n) => `${card.kind}_${card.photo}_${card.look ?? card.fit}_${card.hard ? 'h' : 's'}_${n}`.replace(/[^\w-]/g, '')

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
  beats.forEach((b, i) => {
    if (!b.bg || b.card?.kind === 'full') {
      inputs.push('-f', 'lavfi', '-i', `color=c=0x02040a:s=${W}x${H}:r=${FPS}`)
      parts.push(`[${i}:v]trim=end_frame=${b.n},setpts=PTS-STARTPTS,format=yuv420p[s${i}]`)
      return
    }
    const inn = b.bg.inn + (b.t0 - b.bg.since)
    inputs.push('-ss', inn.toFixed(3), '-i', `${ROOT}/media/shots/9x16/${b.bg.shot}.mp4`)
    const dim = b.card ? ',eq=brightness=-0.16:saturation=0.65,gblur=sigma=10' : ''
    parts.push(`[${i}:v]fps=${FPS},scale=${W}:${H},tpad=stop_mode=clone:stop_duration=30,trim=end_frame=${b.n},setpts=PTS-STARTPTS,format=yuv420p${dim}[s${i}]`)
  })
  parts.push(`${beats.map((_, i) => `[s${i}]`).join('')}concat=n=${beats.length}:v=1:a=0[bg]`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[bg]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), file])
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
    style('Box', 52, C.clear, C.box, C.box, true, 3, 18, 0, 2, 80, 170, 560),
    style('Cap', 52, C.white, '&H00000000', '&H00000000', true, 1, 0, 0, 2, 80, 170, 560),
    style('Hook', 84, C.white, '&H40000000', '&H80000000', true, 1, 2, 3, 5, 0, 0, 0, 1),
    style('Title', 86, C.white, '&H40000000', '&H80000000', true, 1, 1, 2, 5, 0, 0, 0, 14),
    style('Sub', 34, C.amber, '&H00000000', '&H00000000', false, 1, 0, 0, 5, 0, 0, 0, 6),
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
        for (const w of ch.text.split(' ')) { if ((l + ' ' + w).trim().length > 17) { lines.push(l.trim()); l = w } else l += ' ' + w }
        lines.push(l.trim())
        ass += `Dialogue: 1,${ts(ch.t0)},${ts(ch.t1)},Hook,,0,0,0,,{\\pos(495,820)\\fad(220,160)\\blur0.6\\q0}${esc(lines.join('\\N'))}\n`
        continue
      }
      ass += `Dialogue: 0,${ts(ch.t0)},${ts(ch.t1)},Box,,0,0,0,,{\\fad(140,120)}${esc(ch.text)}\n`
      ass += `Dialogue: 1,${ts(ch.t0)},${ts(ch.t1)},Cap,,0,0,0,,{\\fad(140,120)}${esc(ch.text)}\n`
    }
  })
  ass += `Dialogue: 1,${ts(END_T0)},${ts(TOTAL)},Title,,0,0,0,,{\\pos(495,450)\\fad(600,0)}GHOSTS OF\\NLIVES PAST\n`
  ass += `Dialogue: 1,${ts(END_T0 + 0.4)},${ts(TOTAL)},Sub,,0,0,0,,{\\pos(495,610)\\fad(600,0)}@caitycroft\n`
  writeFileSync(assFile, ass)
  writeFileSync(srtFile, srt)
}

// ------------------------------------------------------------------ final
async function main() {
  console.log(`Thanksgiving ${V}: ${beats.length} beats, ${TOTAL}s`)
  await renderCards()
  const bg = `${WORK}/bg_${V}.mp4`
  renderBackground(bg)
  const name = `GLP_Thanksgiving_${V}_9x16${music ? '' : '_voice-only'}`
  const assFile = `${WORK}/${name}.ass`
  writeCaptions(assFile, `${OUT}/GLP_Thanksgiving_${V}_9x16.srt`)

  const inputs = ['-i', bg], parts = []
  let prev = '0:v', k = 0
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
    parts.push(`[${voIn + 1}:a]atrim=start=${start.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=-9dB,afade=t=in:d=1.2,afade=t=out:st=${(TOTAL - 2.5).toFixed(2)}:d=2.5,atrim=0:${TOTAL}[bed]`)
    parts.push(`[bed][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`)
    parts.push(`[vo][duck]amix=inputs=2:normalize=0,alimiter=limit=0.89[aout]`)
  } else parts.push(`[${voIn}:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${TOTAL}[aout]`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[vout]', '-map', '[aout]', '-t', String(TOTAL),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', `${OUT}/${name}.mp4`], { stdio: 'inherit' })
  console.log(`wrote media/thanksgiving/cuts/${name}.mp4`)
}
main().catch((e) => { console.error(e); process.exit(1) })
