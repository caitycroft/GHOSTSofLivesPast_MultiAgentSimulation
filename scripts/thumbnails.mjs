// Social thumbnails for the arcade films: clean stills of the app (no
// captions, no in-scene labels) plus the end card type, rendered with Playwright.
//
//   npm run build && npx vite preview --port 4173
//   node scripts/thumbnails.mjs [--url http://localhost:4173/]   (needs media/fonts)
//
// Stills run on a virtual clock at the films' fixed moment, so the globe is
// lit exactly as in the videos.
//
// Writes media/thumbnails/: a 16:9 (1920x1080 PNG, plus 1280x720 JPG for
// YouTube), a 9:16 cover (1080x1920) laid out so it also survives the 3:4
// profile grid crop, and that 3:4 crop (1080x1440).
//
// The cyan line gets a graphite stroke, not black: about 2px outside the
// letters at 1080p (a 4.5px stroke painted under the fill), so it separates
// from the grid without reading as marker.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const root = resolve('.')
const out = resolve('media/thumbnails')
const work = resolve('media/thumbnails/.work')
mkdirSync(work, { recursive: true })

const base = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://localhost:4173/'


const C = { white: '#ffffff', magenta: '#ff2fd0', cyan: '#38f3ff', graphite: '#2e333b' }

const page = ({ w, h, bg, globe, title, titlePx, sub, subPx, hook, hookPx, layout }) => `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Press Start 2P'; src: url('file://${root}/media/fonts/PressStart2P-Regular.ttf'); }
  @font-face { font-family: 'Arial'; src: local('Arial'), url('file://${root}/media/fonts/LiberationSans-Bold.ttf'); font-weight: 700; }
  html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: #02040a; }
  .bg { position: absolute; inset: 0; background: url('${bg}') center top / ${layout.bgScale * 100}% auto no-repeat; }
  /* calm the busiest part of the frame behind the type, keep the edges vivid */
  .shade { position: absolute; inset: 0; background:
    radial-gradient(ellipse ${layout.shade} at 50% ${layout.shadeY}, rgba(2,4,10,0.74), rgba(2,4,10,0.28) 60%, rgba(2,4,10,0) 82%),
    linear-gradient(to bottom, rgba(2,4,10,${layout.top}), rgba(2,4,10,${layout.top * 0.8}) 13%, rgba(2,4,10,0) 26%, rgba(2,4,10,0) 78%, rgba(2,4,10,0.35)); }
  .globe { position: absolute; left: ${globe.x}px; top: ${globe.y}px; width: ${globe.size}px; height: ${globe.size}px;
    background: url('${globe.src}') ${globe.pos} / ${globe.bgSize}; border-radius: 50%;
    -webkit-mask-image: radial-gradient(circle closest-side, #000 ${globe.solid}%, transparent ${globe.fade}%); mask-image: radial-gradient(circle closest-side, #000 ${globe.solid}%, transparent ${globe.fade}%);
    filter: drop-shadow(0 0 ${globe.size * 0.06}px rgba(61,255,154,0.35)); }
  svg { position: absolute; inset: 0; overflow: visible; }
  .title { font-family: 'Press Start 2P'; font-size: ${titlePx}px; fill: ${C.white}; stroke: ${C.magenta}; stroke-width: ${titlePx * 0.07}px; paint-order: stroke fill; letter-spacing: ${titlePx * 0.06}px;
    filter: drop-shadow(0 0 ${titlePx * 0.18}px ${C.magenta}) drop-shadow(0 0 ${titlePx * 0.5}px rgba(255,47,208,0.55)); }
  .sub { font-family: Arial; font-weight: 700; font-size: ${subPx}px; fill: ${C.cyan}; letter-spacing: ${subPx * 0.09}px;
    stroke: ${C.graphite}; stroke-width: ${layout.stroke}px; stroke-linejoin: round; paint-order: stroke fill;
    filter: drop-shadow(0 0 ${subPx * 0.12}px rgba(2,4,10,0.55)); }
  .hook { font-family: Arial; font-weight: 700; font-size: ${hookPx}px; fill: ${C.white}; letter-spacing: ${hookPx * 0.02}px;
    stroke: ${C.graphite}; stroke-width: ${layout.stroke}px; stroke-linejoin: round; paint-order: stroke fill;
    filter: drop-shadow(0 0 ${hookPx * 0.14}px rgba(2,4,10,0.6)); }
</style>
<div class="bg"></div>
${globe.src ? '<div class="globe"></div>' : ''}
<div class="shade"></div>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${hook.map((t, i) => `<text class="hook" x="${w / 2}" y="${layout.hookY + i * hookPx * 1.22}" text-anchor="middle">${t}</text>`).join('\n  ')}
  ${title.map((t, i) => `<text class="title" x="${w / 2}" y="${layout.titleY + i * titlePx * 1.3}" text-anchor="middle">${t}</text>`).join('\n  ')}
  ${sub.map((t, i) => `<text class="sub" x="${w / 2}" y="${layout.subY + i * subPx * 1.35}" text-anchor="middle">${t}</text>`).join('\n  ')}
</svg>`

// globe: the globe still is cropped so its sphere (centre cx, cy, radius r in
// the still) lands centred in a circle of radius `ring` at (x, y)
const globeAt = (src, sw, sh, cx, cy, r, x, y, sphere, ring) => {
  const k = sphere / r
  return { src, size: ring * 2, x: x - ring, y: y - ring, bgSize: `${sw * k}px ${sh * k}px`, pos: `${ring - cx * k}px ${ring - cy * k}px`, solid: (sphere / ring) * 100 + 1, fade: 97 }
}

const SHEETS = [
  {
    name: 'GLP_Arcade_Thumbnail_16x9_YouTube-LinkedIn-X', w: 1920, h: 1080,
    globe: globeAt(`file://${work}/globe16.png`, 1920, 1080, 960, 537, 412, 960, 330, 165, 215),
    hook: ['I simulated every life I could have lived.'], hookPx: 50,
    title: ['GHOSTS OF LIVES PAST'], titlePx: 82,
    sub: ['The Unlived Lives \u00b7 a multi agent simulation'], subPx: 46,
    layout: { bgScale: 1.25, top: 0.9, hookY: 108, titleY: 660, subY: 752, stroke: 4.5, shade: '62% 34%', shadeY: '62%' },
  },
  {
    // the 3:4 grid shows y 240 to 1680; everything that matters sits inside it
    name: 'GLP_Arcade_Thumbnail_9x16_Reels-TikTok-Shorts', w: 1080, h: 1920,
    globe: globeAt(`file://${work}/globe916.png`, 1080, 1920, 539, 960, 411, 540, 600, 150, 195),
    hook: ['I simulated every life', 'I could have lived.'], hookPx: 60,
    title: ['GHOSTS OF', 'LIVES PAST'], titlePx: 84,
    sub: ['The Unlived Lives', 'a multi agent simulation'], subPx: 52,
    layout: { bgScale: 1.25, top: 0.55, hookY: 338, titleY: 940, subY: 1172, stroke: 4.5, shade: '80% 26%', shadeY: '55%' },
  },
]

// A still of the app on a virtual clock (the films' moment, so the sun is the
// same), held at year t, with labels and interface hidden, after `frames` frames
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function still(browser, { w, h, t, query, frames, file }) {
  // stills are kept between runs; --fresh captures them again
  if (existsSync(`${work}/${file}`) && !process.argv.includes('--fresh')) return `file://${work}/${file}`
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await p.clock.install({ time: new Date('2026-11-06T15:30:00Z') })
  await p.goto(`${base}?capture=1&clean=1&cinema=1&${query}`)
  for (let ahead = 1000; ; ahead *= 2) {
    try { await p.clock.pauseAt(new Date((await p.evaluate(() => Date.now())) + ahead)); break } catch (e) { if (ahead > 30000) throw e }
  }
  for (let i = 0; !(await p.evaluate(() => !!window.__clock && !!window.__app)); i++) { if (i > 240) throw new Error('app never became ready'); await sleep(250) }
  await sleep(3000) // land mesh and fonts load in real time
  await p.evaluate((t) => window.__clock.set({ t, speed: 0, playing: false }), t)
  await p.addStyleTag({ content: '.globe-overlay, .chorus, .top, .bottom { visibility: hidden !important; }' })
  for (let f = 0; f < frames; f++) await p.clock.runFor(1000 / 30)
  await p.screenshot({ path: `${work}/${file}`, timeout: 120000 })
  await p.close()
  return `file://${work}/${file}`
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
SHEETS[0].bg = await still(browser, { w: 1920, h: 1080, t: 2031, query: 'style=arcade&view=city&mode=follow', frames: 8, file: 'bg16.png' })
SHEETS[1].bg = await still(browser, { w: 1080, h: 1920, t: 2020.25, query: 'style=arcade&view=city&mode=follow', frames: 90, file: 'bg916.png' })
// the globe as the build shot leaves it, 9.5 seconds in, over the Americas
await still(browser, { w: 1920, h: 1080, t: 2013.3, query: 'style=arcade&view=globe&mode=orbit&nobuild=1', frames: 285, file: 'globe16.png' })
await still(browser, { w: 1080, h: 1920, t: 2013.3, query: 'style=arcade&view=globe&mode=orbit&nobuild=1', frames: 285, file: 'globe916.png' })
for (const s of SHEETS) {
  const html = `${work}/${s.name}.html`
  writeFileSync(html, page(s))
  const p = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 })
  await p.goto(`file://${html}`)
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${out}/${s.name}.png` })
  await p.close()
  console.log(`wrote media/thumbnails/${s.name}.png`)
}
await browser.close()

// YouTube takes 1280x720 under 2MB; the profile grid shows the 3:4 middle of a 9:16 cover
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${out}/${SHEETS[0].name}.png`, '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', `${out}/GLP_Arcade_Thumbnail_16x9_YouTube_1280x720.jpg`])
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${out}/${SHEETS[1].name}.png`, '-vf', 'crop=1080:1440:0:240', `${out}/GLP_Arcade_Thumbnail_3x4_Instagram-grid.png`])
console.log('wrote the YouTube JPG and the 3:4 grid crop')
