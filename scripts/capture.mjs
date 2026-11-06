// Frame accurate shot capture.
//
// Drives the app on a virtual clock (Playwright clock API), screenshots every
// frame and pipes them to ffmpeg, so motion is smooth however slowly the
// machine renders. Needs ffmpeg on PATH and Playwright Chromium.
//
//   npm run build && npx vite preview --port 4173
//   node scripts/capture.mjs --aspect 16x9 --shots a_hook,a_how
//   node scripts/capture.mjs --aspect 9x16 --prefix a_      (every arcade shot)
//
// Add --software on machines without a GPU (forces SwiftShader).

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'
import { SHOTS, ASPECTS } from './shots.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const aspect = arg('aspect', '16x9')
const base = arg('url', 'http://localhost:4173/')
const fps = Number(arg('fps', 30))
const outDir = arg('out', `media/shots/${aspect}`)
const limit = Number(arg('seconds', 0))
const software = process.argv.includes('--software')
const skip = process.argv.includes('--skip-existing')
const ids = arg('shots', '') ? arg('shots').split(',') : Object.keys(SHOTS).filter((k) => k.startsWith(arg('prefix', '')))
const size = ASPECTS[aspect]
mkdirSync(outDir, { recursive: true })

const args = software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist', '--enable-gpu']
const browser = await chromium.launch({ args })

for (const id of ids) {
  const shot = SHOTS[id]
  const out = `${outDir}/${id}.mp4`
  if (skip && existsSync(out)) { console.log(`skip ${id}`); continue }
  const duration = limit || shot.duration
  const frames = Math.round(duration * fps)
  const frameMs = 1000 / fps
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] })
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 })
  const start = Date.now()
  await page.clock.install({ time: new Date() })
  await page.goto(base + shot.url)
  for (let ahead = 1000; ; ahead *= 2) {
    try {
      await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + ahead))
      break
    } catch (e) {
      if (ahead > 30000) throw e
    }
  }
  await page.waitForFunction(() => document.fonts.ready.then(() => !!window.__clock && !!window.__app))
  await page.waitForTimeout(3000) // land mesh, snapshot and fonts load in real time while the clock is frozen
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Animation.enable')

  const steps = [...shot.steps].sort((a, b) => a[0] - b[0])
  let next = 0
  let realPerFrame = 400
  let lastReal = Date.now()
  for (let f = 0; f < frames; f++) {
    const t = f / fps
    while (next < steps.length && steps[next][0] <= t) {
      await steps[next][1](page).catch((e) => console.warn(`${id}: step at ${steps[next][0]}s failed: ${e.message.split('\n')[0]}`))
      next++
    }
    if (f % 15 === 0) await cdp.send('Animation.setPlaybackRate', { playbackRate: Math.min(1, frameMs / realPerFrame) })
    await page.clock.runFor(frameMs)
    const buf = await page.screenshot({ type: 'jpeg', quality: 94, timeout: 180000 })
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
    const now = Date.now()
    realPerFrame = realPerFrame * 0.9 + (now - lastReal) * 0.1
    lastReal = now
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  await page.close()
  console.log(`${aspect} ${id}: ${duration}s in ${((Date.now() - start) / 1000).toFixed(0)}s (${(realPerFrame / 1000).toFixed(2)}s per frame)`)
}
await browser.close()
