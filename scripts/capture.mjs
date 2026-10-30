// Frame accurate walkthrough capture.
//
// Drives the app on a virtual clock (Playwright clock API), screenshots every
// frame and pipes them to ffmpeg, so the video is perfectly smooth no matter
// how fast the machine renders. Needs ffmpeg on PATH and Playwright Chromium.
//
//   npm run build && npx vite preview --port 4173
//   node scripts/capture.mjs --preset technical --out media/technical.mp4
//   node scripts/capture.mjs --preset artsy --out media/artsy.mp4
//
// Add --software on machines without a GPU (forces SwiftShader).

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const preset = arg('preset', 'technical')
const out = arg('out', `media/${preset}.mp4`)
const base = arg('url', 'http://localhost:4173/')
const fps = Number(arg('fps', 30))
const limit = Number(arg('seconds', 0))
const software = process.argv.includes('--software')

// ---------------------------------------------------------------- presets
const year = (y, playing = true) => (p) => p.evaluate(([y, playing]) => window.__clock.set({ t: y, playing }), [y, playing])
const key = (k) => (p) => p.keyboard.press(k)
const click = (sel) => (p) => p.click(sel)
const speed = (s) => (p) => p.evaluate((s) => window.__clock.set({ speed: s }), s)
const hover = (sel, dx = 0, dy = 0) => async (p) => {
  const box = await p.locator(sel).first().boundingBox()
  if (box) await p.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy)
}
const css = (id, text) => (p) => p.evaluate(([id, text]) => {
  let el = document.getElementById(id)
  if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el) }
  el.textContent = text
}, [id, text])
const scroll = (sel, y) => (p) => p.evaluate(([sel, y]) => document.querySelector(sel)?.scrollTo({ top: y }), [sel, y])

const PRESETS = {
  technical: {
    size: { width: 1600, height: 900 },
    query: '?capture=1',
    duration: 108,
    captionStyle: 'technical',
    steps: [
      [0, speed(0.5)],
      [0, year(2008)],
      [17, click('text=Follow')],
      [27, click('text=Tour')],
      [36, key('2')],
      [36, year(2014)],
      [46, key('3')],
      [46, year(2026, false)],
      [50, click('.card >> nth=0')],
      [55, scroll('.drawer-body', 420)],
      [57, click('.drawer .close')],
      [61, key('4')],
      [61, year(2016)],
      [70, key('5')],
      [70, year(2021, false)],
      [74, hover('.heat-row:nth-child(6) .cell:nth-child(18)')],
      [79, hover('.heat-row:nth-child(5) .cell:nth-child(15)')],
      [83, scroll('.layer.scroll', 700)],
      [87, key('1')],
      [87, key('v')],
      [87, year(2008)],
      [87, speed(1.1)],
      [88, click('text=Tour')],
    ],
    captions: [
      [0.5, 8, 'A planet rebuilt from 120,000 points of Natural Earth land, sweeping west to east.'],
      [8.5, 16.5, 'Eight selves, eight agents, one clock from 2008 to 2031. Time is altitude: each thread rises off the globe as the years pass.'],
      [17, 26.5, 'Follow mode: a chase camera rides one self. Rings are cities, scaled by how connected they are that year.'],
      [27, 35.5, 'Tour hands the camera from self to self. The faint clouds are where each self landed across 100 runs.'],
      [36, 45.5, 'The loom: each life coils around its city like tree rings and weaves over the others. The night side is the real sun, right now.'],
      [46, 60.5, 'Life cards: three choices, where each self is now, where it is heading, and how often its path came up.'],
      [61, 69.5, 'Split: two lives on the same clock, the one who stayed and the one who left.'],
      [70, 86.5, 'Every number has a receipt. Industry weather blends the authored era baseline with Wikipedia attention and World Bank data. Recorded offline here, so live feeds show as waiting.'],
      [87, 101, 'Void mode: the same simulation as a retro console. Each era is a new stage with its own four colour palette.'],
    ],
    fades: [[0, 1.2, 1, 0], [101, 103, 0, 1]],
    titles: [[103, 108, 'GHOSTS OF LIVES PAST', 'github.com/caitycroft/GHOSTSofLivesPast_MultiAgentSimulation']],
  },
  artsy: {
    size: { width: 1080, height: 1920 },
    query: '?capture=1&cinema=1',
    duration: 62,
    captionStyle: 'artsy',
    steps: [
      [0, speed(0.0001)],
      [0, css('quiet', '.chorus { opacity: 0; transition: opacity 1.5s; }')],
      [7.5, css('quiet', '.chorus { opacity: 1; transition: opacity 1.5s; }')],
      [54, css('quiet', '.chorus { opacity: 0; transition: opacity 1.2s; }')],
      [0, year(2008, false)],
      [7, speed(0.5)],
      [7, year(2008)],
      [8, key('t')],
      // Each era is a stage: the light flips between cyanotype and void
      [7 + 7 / 0.5 - 0.6, key('v')],
      [7 + 12 / 0.5 - 0.6, key('v')],
      [7 + 13 / 0.5 - 0.6, key('v')],
      [7 + 15 / 0.5 - 0.6, key('v')],
      [7 + 18 / 0.5 - 0.6, key('v')],
    ],
    captions: [],
    fades: [[0, 2.5, 1, 0], [55.5, 57, 0, 1]],
    titles: [[1.5, 6.5, 'GHOSTS OF LIVES PAST', 'THE UNLIVED LIVES'], [57, 62, 'EIGHT LIVES', '2008 TO 2031']],
  },
}

const cfg = PRESETS[preset]
if (!cfg) throw new Error(`Unknown preset ${preset}`)
const duration = limit || cfg.duration
const frameMs = 1000 / fps
const frames = Math.round(duration * fps)

// ---------------------------------------------------------------- run
mkdirSync(dirname(out), { recursive: true })
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] })

const args = software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist', '--enable-gpu']
const browser = await chromium.launch({ args })
const page = await browser.newPage({ viewport: cfg.size, deviceScaleFactor: 1 })
const start = new Date()
await page.clock.install({ time: start })
await page.goto(base + cfg.query)
// Freeze virtual time a moment ahead of now; retry if the page outran us
for (let ahead = 1000; ; ahead *= 2) {
  try {
    await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + ahead))
    break
  } catch (e) {
    if (ahead > 30000) throw e
  }
}
await page.waitForFunction(() => document.fonts.ready.then(() => true))
await page.waitForTimeout(2500) // land mesh and fonts load in real time while the clock is frozen

const cdp = await page.context().newCDPSession(page)
await cdp.send('Animation.enable')

await page.evaluate((mode) => {
  const css = document.createElement('style')
  css.textContent = `
    #cap-fade { position: fixed; inset: 0; background: #000; z-index: 300; pointer-events: none; }
    #cap-caption { position: fixed; left: 50%; top: 88px; transform: translateX(-50%); max-width: 1000px; padding: 12px 20px; z-index: 250; pointer-events: none;
      background: rgba(2, 4, 10, 0.78); border-left: 3px solid #ffb36b; color: #eef3ff; font: 19px/1.4 Arial, sans-serif; }
    #cap-title { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; z-index: 310; pointer-events: none; color: #eef3ff; text-align: center; }
    #cap-title .t { font: bold ${mode === 'artsy' ? 54 : 46}px Arial, sans-serif; letter-spacing: 0.3em; padding-left: 0.3em; }
    #cap-title .s { font: ${mode === 'artsy' ? 22 : 20}px Arial, sans-serif; letter-spacing: 0.25em; opacity: 0.7; }
    ${mode === 'artsy' ? '.chorus { left: 60px !important; right: 60px !important; bottom: 160px !important; } .chorus-line { font-size: 34px !important; } .app.void .chorus-line { font-size: 20px !important; } .chorus-meta, .hud { font-size: 15px !important; } .chorus-era { font-size: 16px !important; }' : ''}
  `
  document.head.appendChild(css)
  for (const id of ['cap-fade', 'cap-caption', 'cap-title']) {
    const el = document.createElement('div')
    el.id = id
    el.style.opacity = '0'
    document.body.appendChild(el)
  }
  document.getElementById('cap-title').innerHTML = '<div class="t"></div><div class="s"></div>'
}, cfg.captionStyle)

const ramp = (t, a, b, edge = 0.5) => Math.max(0, Math.min(1, (t - a) / edge, (b - t) / edge))
const steps = [...cfg.steps].sort((a, b) => a[0] - b[0])
let next = 0
let realPerFrame = 400
let lastReal = Date.now()

for (let f = 0; f < frames; f++) {
  const t = f / fps
  while (next < steps.length && steps[next][0] <= t) {
    await steps[next][1](page).catch((e) => console.warn(`step at ${steps[next][0]}s failed: ${e.message.split('\n')[0]}`))
    next++
  }
  const cap = cfg.captions.find(([a, b]) => t >= a && t < b)
  const fade = cfg.fades.find(([a, b]) => t >= a && t <= b)
  const title = cfg.titles.find(([a, b]) => t >= a && t < b)
  await page.evaluate(([capText, capOp, fadeOp, titleT, titleS, titleOp]) => {
    const c = document.getElementById('cap-caption')
    if (c.textContent !== capText) c.textContent = capText
    c.style.opacity = String(capOp)
    document.getElementById('cap-fade').style.opacity = String(fadeOp)
    const tt = document.getElementById('cap-title')
    tt.querySelector('.t').textContent = titleT
    tt.querySelector('.s').textContent = titleS
    tt.style.opacity = String(titleOp)
  }, [
    cap ? cap[2] : '',
    cap ? ramp(t, cap[0], cap[1]) : 0,
    fade ? fade[2] + (fade[3] - fade[2]) * ((t - fade[0]) / (fade[1] - fade[0])) : cfg.fades.some(([, b, , to]) => t > b && to === 1) ? 1 : 0,
    title ? title[2] : '',
    title ? title[3] : '',
    title ? ramp(t, title[0], title[1], 1) : 0,
  ])

  // Keep CSS animations in step with virtual time
  if (f % 15 === 0) await cdp.send('Animation.setPlaybackRate', { playbackRate: Math.min(1, frameMs / realPerFrame) })

  await page.clock.runFor(frameMs)
  const buf = await page.screenshot({ type: 'jpeg', quality: 92, timeout: 180000 })
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))

  const now = Date.now()
  realPerFrame = realPerFrame * 0.9 + (now - lastReal) * 0.1
  lastReal = now
  if (f % (fps * 5) === 0) console.log(`${preset}: ${t.toFixed(0)}s of ${duration}s, ${(realPerFrame / 1000).toFixed(2)}s per frame`)
}

ff.stdin.end()
await new Promise((r) => ff.on('close', r))
await browser.close()
console.log(`wrote ${out}`)
