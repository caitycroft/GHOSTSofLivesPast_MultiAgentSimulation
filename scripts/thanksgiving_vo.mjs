// Prepares a Thanksgiving voiceover take for the edit: each line is cut at the
// times forced alignment found (scripts/align.py), long pauses are tightened
// to a set breath, the emotional beats keep a longer one, and the whole track
// is levelled to -14 LUFS. Writes the voice track and the caption timings the
// picture is cut to.
//
//   python3 scripts/align.py take.m4a "Opening A" media/thanksgiving/take_A_lines.json
//   node scripts/thanksgiving_vo.mjs --take take.m4a --lines media/thanksgiving/take_A_lines.json --out media/thanksgiving/vo_A

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const take = arg('take')
const lines = JSON.parse(readFileSync(arg('lines'), 'utf8'))
const out = arg('out', 'media/thanksgiving/vo')

// the pause after each line, in seconds; the beats that carry the piece breathe longer
const pauseAfter = (text, i) => {
  if (i === lines.length - 1) return 2.5 // room for the end card
  if (/^And here I am/.test(text)) return 1.8
  if (/^We can.t go back/.test(text)) return 1.3
  if (/^Have you ever wondered/.test(text) && /^If you/.test(lines[i + 1]?.text ?? '')) return 0.6
  if (/most honest answer/.test(text)) return 1.0
  return 0.95
}
const PAD_IN = 0.12, PAD_OUT = 0.3

let t = 0.6 // a beat of silence before the first word
const placed = lines.map((l, i) => {
  const a = Math.max(0, l.start - PAD_IN, i > 0 ? lines[i - 1].end + 0.05 : 0)
  const b = Math.min(l.end + PAD_OUT, i < lines.length - 1 ? lines[i + 1].start - 0.05 : Infinity)
  const p = { text: l.text, a, b, at: t, voiceStart: +(t + (l.start - a)).toFixed(2), voiceEnd: +(t + (l.end - a)).toFixed(2) }
  t = t + (b - a) + Math.max(0, pauseAfter(l.text, i) - PAD_OUT)
  return p
})
const total = +t.toFixed(2)

const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(spawnSync('ffmpeg', ['-hide_banner', '-i', take, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-']).stderr.toString())?.[1] ?? -18)
const gain = -18 - lufs
const parts = placed.map((p, i) => `[0:a]atrim=${p.a.toFixed(3)}:${p.b.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=${gain.toFixed(2)}dB,highpass=f=70,afade=t=in:d=0.02,afade=t=out:st=${(p.b - p.a - 0.06).toFixed(3)}:d=0.06,adelay=${Math.round(p.at * 1000)}:all=1[l${i}]`)
const mix = `${placed.map((_, i) => `[l${i}]`).join('')}amix=inputs=${placed.length}:normalize=0:dropout_transition=0,apad=whole_dur=${total},atrim=0:${total},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[vo]`
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', take, '-filter_complex', [...parts, mix].join(';'), '-map', '[vo]', '-c:a', 'pcm_s16le', `${out}.wav`])
// captions: each line shows from just before its first word until just before the next line
const captions = placed.map((p, i) => ({ text: p.text, t0: +Math.max(0, p.voiceStart - 0.15).toFixed(2), t1: +(i < placed.length - 1 ? placed[i + 1].voiceStart - 0.27 : p.voiceEnd + 1.2).toFixed(2), voiceStart: p.voiceStart, voiceEnd: p.voiceEnd }))
writeFileSync(`${out}.json`, JSON.stringify({ seconds: total, levelledFrom: lufs, captions }, null, 1))
console.log(`wrote ${out}.wav (${total}s, from ${lufs} LUFS to -14) and ${out}.json`)
for (const c of captions) console.log(`  ${c.t0.toFixed(2).padStart(6)} to ${c.t1.toFixed(2).padStart(6)}  ${c.text}`)
