// Lays a recorded voiceover onto other cuts. A take recorded to one cut (say
// the arcade Final, read off the teleprompter) is split into its lines at the
// pauses; each line is matched by its text to the lines of a target cut and
// placed where that cut's caption starts, keeping the read's natural lag.
// Lines a target needs that the take lacks come from pickup takes.
//
//   node scripts/vo.mjs --take take.wav --from "Arcade,Final" --to "Arcade,60s"
//   node scripts/vo.mjs --take take.wav --from "Arcade,Final" --to "Arcade,30s" --pickups pickups.wav
//
// Writes media/final_vo/<video>_VO.wav (voice only, -14 LUFS) and the videos
// with that voice muxed in. Text matching is exact, so a line read against
// the current scripts.json always finds its place.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const take = arg('take')
const [fromLook, fromLen] = arg('from', 'Arcade,Final').split(',')
const [toLook, toLen] = arg('to', 'Arcade,60s').split(',')
const pickups = arg('pickups')
const pickupLines = arg('pickup-lines', '') // "|" separated, in the order they are read
const dry = process.argv.includes('--dry')

const scripts = JSON.parse(readFileSync('media/final/scripts.json', 'utf8'))
const find = (look, len) => scripts.find((s) => s.look === look && s.length === len) ?? (() => { throw new Error(`no cut ${look} ${len}`) })()
const src = find(fromLook, fromLen)
const dst = find(toLook, toLen)

const lufs = (f) => Number(/I:\s+(-?[\d.]+) LUFS/.exec(spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-']).stderr.toString())?.[1] ?? -18)
// What counts as silence depends on how loud the take is: a quiet recording's
// soft word endings ("background", "life", "world") sit below a fixed
// threshold, so it is set about 22 dB under the take's own loudness
const thresholds = new Map()
const threshold = (f) => {
  if (!thresholds.has(f)) thresholds.set(f, Math.min(-38, Math.max(-60, lufs(f) - 22)))
  return thresholds.get(f)
}

// speech intervals of a file: the complement of its pauses
function speech(file, minPause = 0.3) {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=noise=${threshold(file).toFixed(1)}dB:d=${minPause}`, '-f', 'null', '-']).stderr.toString()
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString())
  const marks = [...log.matchAll(/silence_(start|end): ([\d.]+)/g)].map((m) => [m[1], Number(m[2])])
  const out = []
  let cur = 0
  for (const [k, t] of marks) {
    if (k === 'start') { if (t - cur > 0.05) out.push([cur, t]); cur = null }
    else cur = t
  }
  if (cur != null && dur - cur > 0.05) out.push([cur, dur])
  return out
}

// a cut from speech interval i0 to i1, with room for breath in and for the
// last word to ring out, never reaching into the neighbouring phrases
const PAD_IN = 0.08, PAD_OUT = 0.25
function span(sp, i0, i1) {
  const before = i0 > 0 ? sp[i0 - 1][1] + 0.02 : 0
  const after = i1 < sp.length - 1 ? sp[i1 + 1][0] - 0.03 : Infinity
  return { a: Math.max(0, before, sp[i0][0] - PAD_IN), b: Math.min(after, sp[i1][1] + PAD_OUT) }
}

// cut a take into lines: each phrase belongs to the latest line whose caption
// it starts after (allowing a read that comes in up to 0.8s early)
function linesOf(file, cut) {
  const sp = speech(file)
  const owner = (start) => { let k = -1; cut.lines.forEach((l, i) => { if (l.t0 - 0.8 <= start) k = i }); return k }
  return cut.lines.map((l, i) => {
    const idx = sp.map((p, k) => (owner(p[0]) === i ? k : -1)).filter((k) => k >= 0)
    if (!idx.length) return null
    return { text: l.text, file, ...span(sp, idx[0], idx[idx.length - 1]), lag: sp[idx[0]][0] - l.t0 }
  })
}

const have = new Map()
for (const seg of linesOf(take, src)) if (seg) have.set(seg.text, seg)
// A short line that opens a longer recorded one ("One for every place I've lived.")
// is cut from the longer line at its first pause
for (const l of dst.lines) {
  if (have.has(l.text)) continue
  const longer = [...have.values()].find((s) => s.text.startsWith(l.text))
  if (!longer) continue
  const sp = speech(take, 0.12)
  const inside = sp.map((p, k) => k).filter((k) => sp[k][1] > longer.a && sp[k][0] < longer.b)
  const words = l.text.split(/\s+/).length, total = longer.text.split(/\s+/).length
  const want = longer.a + ((longer.b - longer.a) * words) / total
  const last = inside.reduce((best, k) => (Math.abs(sp[k][1] - want) < Math.abs(sp[best][1] - want) ? k : best), inside[inside.length - 1])
  have.set(l.text, { ...longer, text: l.text, b: span(sp, inside[0], last).b })
}
if (pickups) {
  const names = pickupLines.split('|').map((s) => s.trim()).filter(Boolean)
  // a pickup line can have pauses of its own ("Same me. Different city."), so
  // the take is split into as many lines as were read, at its biggest gaps
  const sp = speech(pickups, 0.25)
  const gaps = sp.slice(1).map(([a], i) => ({ i, gap: a - sp[i][1] })).sort((x, y) => y.gap - x.gap).slice(0, names.length - 1).map((g) => g.i).sort((x, y) => x - y)
  const groups = []
  let from = 0
  for (const g of [...gaps, sp.length - 1]) { groups.push(span(sp, from, g)); from = g + 1 }
  if (groups.length !== names.length) console.warn(`pickups: found ${groups.length} lines, expected ${names.length}`)
  names.forEach((text, i) => groups[i] && have.set(text, { text, file: pickups, ...groups[i], lag: 0.2 }))
}

// place each line at its caption plus the read's own lag (0.15 to 0.6s); if
// the line before it runs long, start a little later rather than overlap
const plan = []
let ok = true
let prevEnd = 0
dst.lines.forEach((l, i) => {
  const seg = have.get(l.text)
  if (!seg) { ok = false; console.log(`  MISSING  "${l.text}"`); return }
  const at = Math.max(l.t0 + Math.min(Math.max(seg.lag, 0.15), 0.6), prevEnd + 0.15)
  const len = seg.b - seg.a
  const limit = (dst.lines[i + 1]?.t0 ?? dst.seconds) + 0.6 // may run into the next caption's lead in
  const fits = at + len <= limit && at - l.t0 < 1.2
  if (!fits) ok = false
  console.log(`  ${fits ? 'ok  ' : 'LONG'} ${at.toFixed(2)}s +${len.toFixed(2)}s (caption at ${l.t0.toFixed(2)}s)  ${l.text}`)
  plan.push({ ...seg, at })
  prevEnd = at + len
})
if (!ok) console.log('  some lines are missing or run long; nothing written for them to overlap')
if (dry || !plan.length) process.exit(ok ? 0 : 1)

// assemble: each line trimmed, matched in level to the other takes, faded at
// its edges, delayed to its place, mixed, then the whole track to -14 LUFS
mkdirSync('media/final_vo', { recursive: true })
const files = [...new Set(plan.map((p) => p.file))]
const gain = Object.fromEntries(files.map((f) => [f, -18 - lufs(f)]))
for (const f of files) console.log(`  level ${gain[f] >= 0 ? '+' : ''}${gain[f].toFixed(1)} dB  ${f.split('/').pop()}`)
const inputs = files.flatMap((f) => ['-i', f])
const parts = plan.map((p, i) => `[${files.indexOf(p.file)}:a]atrim=${p.a.toFixed(3)}:${p.b.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=${gain[p.file].toFixed(2)}dB,afade=t=in:d=0.015,afade=t=out:st=${(p.b - p.a - 0.04).toFixed(3)}:d=0.04,adelay=${Math.round(p.at * 1000)}:all=1[l${i}]`)
// timestamps are restamped from zero after the mix: padding and trimming read
// them, and they would otherwise start at the first line's delay
const mix = `${plan.map((_, i) => `[l${i}]`).join('')}amix=inputs=${plan.length}:normalize=0:dropout_transition=0,asetpts=N/SR/TB,apad=whole_dur=${dst.seconds.toFixed(3)},atrim=0:${dst.seconds.toFixed(3)},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[vo]`
for (const name of dst.files) {
  const base = name.replace(/\.mp4$/, '')
  const wav = `media/final_vo/${base}_VO.wav`
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', [...parts, mix].join(';'), '-map', '[vo]', '-c:a', 'pcm_s16le', wav])
  const video = `media/final/${name}`
  if (existsSync(video)) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', `media/final_vo/${base}_VO.mp4`])
    console.log(`wrote media/final_vo/${base}_VO.mp4 and _VO.wav`)
  } else console.log(`wrote ${wav} (no video ${video} to mux)`)
}
