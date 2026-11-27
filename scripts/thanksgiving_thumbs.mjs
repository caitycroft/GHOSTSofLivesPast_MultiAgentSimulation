// Thumbnails for the Thanksgiving piece, three options in each shape, drawn
// with the same graphics as the film so they match it: the heart on the High
// Coast, the ring of selves around the globe, and the life tree with her at NOW.
// Warm gold and the agents' spectrum, so they read apart from the arcade (cyan)
// and classic thumbnails. Titles in Arial, white and gold with a graphite stroke.
//
//   node scripts/thanksgiving_thumbs.mjs --aspect 9x16
//   node scripts/thanksgiving_thumbs.mjs --aspect 16x9
//
// Writes media/thumbnails/thanksgiving/GLP_Thanksgiving_thumb_<option>_<aspect>.png,
// and from them a YouTube JPG (1280x720) and a 3:4 grid crop (1080x1440).

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { ASPECT, FOOT, FPS, GRADE, H, L, ROOT, VERT, W, WORK, agents, gfxData, heartPos } from './thanksgiving_cut.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const DIR = `${ROOT}/media/thumbnails/thanksgiving`
mkdirSync(DIR, { recursive: true })

const GOLD = '#ffd28a', STROKE = '#2e333b'
const NOW_PHOTO = 'sf_sunlit_selfie_presidio'

// a still of two plates screened together, graded like the film
function plate(out, [shot, t, over, ot, op, grade]) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', `${ROOT}/media/shots/${ASPECT}/${shot}.mp4`, '-ss', String(ot), '-i', `${ROOT}/media/shots/${ASPECT}/${over}.mp4`,
    '-filter_complex', `[0:v]scale=${W}:${H},format=gbrp[a];[1:v]scale=${W}:${H},format=gbrp[b];[a][b]blend=all_mode=screen:all_opacity=${op},format=yuv420p,${grade}`, '-frames:v', '1', out])
}

// title lines as SVG text with a graphite stroke painted under the fill
const svgText = (lines) => lines.map(({ t, x, y, size, color = '#ffffff', anchor = 'middle', weight = 700, spacing = 2, stroke = 3 }) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial" font-weight="${weight}" font-size="${size}" letter-spacing="${spacing}" fill="${color}" stroke="${STROKE}" stroke-width="${stroke * 2}" paint-order="stroke" stroke-linejoin="round" style="filter: drop-shadow(0 4px 14px rgba(0,0,0,.55))">${t}</text>`).join('')
// the agents' colours as one bar, the "all of me" spectrum
const spectrum = (x, y, w, h = 8, anchor = 'middle') => {
  const x0 = anchor === 'middle' ? x - w / 2 : x, sw = w / agents.length
  return agents.map((a, i) => `<rect x="${(x0 + i * sw).toFixed(1)}" y="${y}" width="${(sw - 4).toFixed(1)}" height="${h}" rx="${h / 2}" fill="${a.neon}"/>`).join('')
}
const brand = (x, y, size, anchor = 'middle') => svgText([{ t: 'GHOSTS OF LIVES PAST', x, y, size, color: '#ffffff', anchor, spacing: 6, stroke: 2 }])

// where NOW is on the tree, so her photo sits at the tip of the life that happened
const nowXY = () => {
  const T = L.tree, v = 0.07 * Math.sin(6.5)
  return T.vertical ? [T.cx + v * T.hw, T.y1] : [T.x1, T.cy + v * T.hh]
}

const SCRIPT = (t, x, y, size, anchor = 'middle', color = '#ffffff') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Great Vibes" font-size="${size}" fill="${color}" stroke="${STROKE}" stroke-width="4" paint-order="stroke" style="filter: drop-shadow(0 3px 10px rgba(0,0,0,.6))">${t}</text>`

const OPTIONS = {
  // the one she picked: the forking roads ending in her ten faces, around the globe
  lives: {
    scene: { type: 'tree', noReadout: true, faces: VERT ? 60 : 56, marks: { grow: [0, 60], stay: 62, leave: null } }, at: 100,
    bg: ['c_globe_build', 6, 'a_globe_build', 6, 0.5, 'eq=brightness=-0.04:saturation=1.45'],
    svg: () => VERT
      ? svgText([{ t: 'GHOSTS OF', x: 540, y: 1352, size: 104, spacing: 6 }, { t: 'LIVES PAST', x: 540, y: 1462, size: 104, spacing: 6 }, { t: 'TEN CITIES. TEN DIFFERENT LIVES.', x: 540, y: 1525, size: 38, color: GOLD, spacing: 4, stroke: 2 }])
        + spectrum(540, 1552, 600) + SCRIPT('Happy Thanksgiving from all of me', 540, 1640, 62)
      : svgText([{ t: 'GHOSTS OF LIVES PAST', x: 960, y: 952, size: 88, spacing: 6 }, { t: 'TEN CITIES. TEN DIFFERENT LIVES.', x: 960, y: 1010, size: 36, color: GOLD, spacing: 4, stroke: 2 }])
        + spectrum(960, 1030, 640) + SCRIPT('Happy Thanksgiving from all of me', 70, 110, 64, 'start'),
  },
  heart: {
    scene: { type: 'heart', photo: 'highcoast_rock_dusk_all_yours', pos: heartPos, still: true, cover: true }, at: 120,
    svg: () => VERT
      ? svgText([{ t: 'HAPPY', x: 540, y: 1395, size: 128 }, { t: 'THANKSGIVING', x: 540, y: 1510, size: 104 }, { t: 'FROM ALL OF ME', x: 540, y: 1590, size: 52, color: GOLD, spacing: 8 }]) + spectrum(540, 1622, 520) + brand(540, 1668, 26)
      : svgText([{ t: 'HAPPY', x: 92, y: 330, size: 124, anchor: 'start' }, { t: 'THANKSGIVING', x: 92, y: 436, size: 84, anchor: 'start' }, { t: 'FROM ALL OF ME', x: 96, y: 512, size: 50, color: GOLD, anchor: 'start', spacing: 7 }]) + spectrum(96, 544, 560, 8, 'start') + brand(96, 980, 28, 'start'),
  },
  ring: {
    scene: { type: 'ring', globe: L.ringGlobe, spin: 0.35, noPin: true, color: '#7cc4ff', noReadout: true, marks: {} }, at: 95,
    bg: ['a_street_forks', 6.5, 'c_city_street', 3, 0.3, 'eq=brightness=-0.17:saturation=1.45'],
    svg: () => VERT
      ? svgText([{ t: '10 CITIES.', x: 540, y: 1455, size: 116 }, { t: '10 OF ME.', x: 540, y: 1575, size: 116, color: GOLD }]) + spectrum(540, 1612, 520) + brand(540, 1660, 26)
      : svgText([{ t: '10 CITIES. <tspan fill="' + GOLD + '">10 OF ME.</tspan>', x: 960, y: 1000, size: 92 }]) + brand(60, 64, 26, 'start') + spectrum(60, 84, 360, 6, 'start'),
  },
  tree: {
    scene: { type: 'tree', noReadout: true, marks: { grow: [0, 60], stay: 62, leave: null } }, at: 100,
    bg: ['c_globe_build', 6, 'a_globe_build', 6, 0.5, GRADE.dim],
    svg: () => VERT
      ? svgText([{ t: 'WHO WOULD I BE', x: 540, y: 1395, size: 100 }, { t: 'IF I’D STAYED?', x: 540, y: 1505, size: 100, color: GOLD }]) + spectrum(540, 1545, 520) + brand(540, 1600, 26)
      : svgText([{ t: 'WHO WOULD I BE <tspan fill="' + GOLD + '">IF I’D STAYED?</tspan>', x: 960, y: 985, size: 80 }]) + brand(60, 64, 26, 'start') + spectrum(60, 84, 360, 6, 'start'),
    photo: true,
  },
}

const fonts = `@font-face { font-family: 'Press Start 2P'; src: url('file://${ROOT}/media/fonts/PressStart2P-Regular.ttf'); }
  @font-face { font-family: Arial; src: url('file://${ROOT}/media/fonts/LiberationSans-Bold.ttf'); font-weight: 700; }
  @font-face { font-family: Arial; src: url('file://${ROOT}/media/fonts/LiberationSans-Regular.ttf'); font-weight: 400; }
  @font-face { font-family: 'Great Vibes'; src: url('file://${ROOT}/media/fonts/GreatVibes-Regular.woff2'); }`

const browser = await chromium.launch()
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null
for (const [id, o] of Object.entries(OPTIONS).filter(([id]) => !only || only.includes(id))) {
  const data = gfxData()
  data.scenes = [{ ...o.scene, f0: 0, f1: 10000, n: 10000 }]
  // the tree's branches all reach right; in a still it sits a little left so the faces balance the frame
  if (o.scene.faces && !VERT) data.L = { ...L, tree: { ...L.tree, x0: 110, x1: 1390 } }
  let bg = ''
  if (o.bg) { const f = `${WORK}/thumb_bg_${id}_${ASPECT}.png`; plate(f, o.bg); bg = `<div style="position:absolute;inset:0;background:url('file://${f}') center/cover"></div>` }
  const photos = [...new Set([o.scene.photo, ...agents.map((a) => a.photo)].filter(Boolean))]
  let me = ''
  if (o.photo) {
    const [x, y] = nowXY(), r = VERT ? 86 : 78
    me = `<div style="position:absolute;left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;overflow:hidden;border:5px solid ${GOLD};box-shadow:0 0 30px rgba(255,170,80,.9),0 0 80px rgba(255,154,61,.6)"><img src="file://${FOOT}/${NOW_PHOTO}.jpg" style="width:100%;height:100%;object-fit:cover;object-position:50% 30%"></div>`
      + `<svg width="${W}" height="${H}" style="position:absolute;inset:0">${svgText([{ t: 'ME, NOW', x: x + (VERT ? r + 18 : 0), y: y + (VERT ? 12 : r + 44), size: 30, anchor: VERT ? 'start' : 'middle', color: GOLD, stroke: 2 }])}</svg>`
  }
  const html = `<!doctype html><meta charset=utf-8><style>${fonts} html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#02040a} img.src{display:none} canvas{position:absolute;inset:0}</style>
${bg}<canvas id=c></canvas>${photos.map((p) => `<img class=src data-id="${p}" src="file://${FOOT}/${p}.jpg">`).join('')}${me}
<svg width="${W}" height="${H}" style="position:absolute;inset:0">${o.svg()}</svg><script>window.D = ${JSON.stringify(data)}</script>`
  const file = `${WORK}/thumb_${id}_${ASPECT}.html`
  writeFileSync(file, html)
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  await page.goto(`file://${file}`, { waitUntil: 'load' })
  await page.evaluate(() => Promise.all([document.fonts.load('700 20px Arial'), document.fonts.load('40px "Great Vibes"'), document.fonts.load('15px "JetBrains Mono"'), ...[...document.images].map((i) => i.decode())]))
  // only the photos the graphics draw are theirs; her NOW photo is a plain page image
  await page.evaluate(() => document.querySelectorAll('img:not(.src)').forEach((i) => i.removeAttribute('data-id')))
  await page.addScriptTag({ path: `${ROOT}/scripts/thanksgiving_gfx.js` })
  for (let f = 0; f <= o.at; f++) await page.evaluate((f) => window.draw(f), f)
  const out = `${DIR}/GLP_Thanksgiving_thumb_${id}_${ASPECT}.png`
  await page.screenshot({ path: out })
  await page.close()
  if (VERT) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', out, '-vf', 'crop=1080:1440:0:240', `${DIR}/GLP_Thanksgiving_thumb_${id}_3x4.png`])
  else execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', out, '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', `${DIR}/GLP_Thanksgiving_thumb_${id}_YouTube.jpg`])
  console.log(`wrote ${out.replace(ROOT + '/', '')}`)
}
await browser.close()
void FPS
