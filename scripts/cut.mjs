// Edits rendered shots into finished, labeled videos.
//
// For every cut in scripts/cuts.mjs and both aspects it writes:
//   media/final/<name>.mp4  shots joined with transitions, captions burned
//                           into the platform safe zones, silent stereo track
//   media/final/<name>.srt  the same captions as a subtitle file
//   media/final/VO_SCRIPTS.md and INDEX.md
//
//   node scripts/cut.mjs [--only arcade|classic] [--fonts path/to/ttf/dir]

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { buildCuts } from './cuts.mjs'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const fontsDir = arg('fonts', 'media/fonts')
const only = arg('only', '')
const dry = process.argv.includes('--dry')
const facts = JSON.parse(readFileSync('media/facts.json', 'utf8'))
const cuts = buildCuts(facts)
mkdirSync('media/final', { recursive: true })

const FPS = 30
const WPS_MAX = 3.0 // words per second a voice can read comfortably (hooks may run hotter)

// ------------------------------------------------------------------ ASS
const LAYOUT = {
  '16x9': { w: 1920, h: 1080, cap: 46, hook: 80, hookPx: 52, kick: 22, mL: 260, mR: 260, mV: 105, cx: 960, hookY: 520, endY: 500 },
  // 9:16: keep clear of the top bar, the right hand icon column and the bottom caption area
  '9x16': { w: 1080, h: 1920, cap: 50, hook: 84, hookPx: 44, kick: 24, mL: 80, mR: 170, mV: 560, cx: 495, hookY: 820, endY: 880 },
}
const C = { white: '&H00FFFFFF', box: '&H38080402', magenta: '&H00D02FFF', cyan: '&H00FFF338', green: '&H007AFF3D', amber: '&H006BB3FF', grey: '&H00C8C8C8', clear: '&HFF000000' }

function header(look, L) {
  const f = (name, font, size, primary, outline, back, bold, border, ol, sh, align, mL, mR, mV, spacing = 0) =>
    `Style: ${name},${font},${size},${primary},&H000000FF,${outline},${back},${bold ? -1 : 0},0,0,0,100,100,${spacing},0,${border},${ol},${sh},${align},${mL},${mR},${mV},1`
  const styles = look === 'arcade'
    ? [
        f('Box', 'Liberation Sans', L.cap, C.clear, C.box, C.box, true, 3, 18, 0, 2, L.mL, L.mR, L.mV),
        f('Cap', 'Liberation Sans', L.cap, C.white, C.magenta, '&H00000000', true, 1, 2.2, 0, 2, L.mL, L.mR, L.mV),
        f('Hook', 'Press Start 2P', L.hookPx, C.white, C.magenta, '&H00000000', false, 1, 4, 0, 5, 0, 0, 0, 2),
        f('Title', 'Press Start 2P', L.hookPx + 4, C.white, C.magenta, '&H00000000', false, 1, 4, 0, 5, 0, 0, 0, 4),
        f('Sub', 'Liberation Sans', L.kick + 6, C.cyan, '&H00000000', '&H00000000', true, 1, 0, 0, 5, 0, 0, 0, 3),
      ]
    : [
        f('Box', 'Liberation Sans', L.cap, C.clear, C.box, C.box, true, 3, 18, 0, 2, L.mL, L.mR, L.mV),
        f('Cap', 'Liberation Sans', L.cap, C.white, '&H00000000', '&H00000000', true, 1, 0, 0, 2, L.mL, L.mR, L.mV),
        f('Hook', 'Liberation Sans', L.hook, C.white, '&H40000000', '&H80000000', true, 1, 2, 3, 5, 0, 0, 0, 1),
        f('Title', 'Liberation Sans', L.hook - 6, C.white, '&H40000000', '&H80000000', true, 1, 1, 2, 5, 0, 0, 0, 14),
        f('Sub', 'Liberation Sans', L.kick + 6, C.amber, '&H00000000', '&H00000000', false, 1, 0, 0, 5, 0, 0, 0, 6),
      ]
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${L.w}
PlayResY: ${L.h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styles.join('\n')}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
}

const ts = (t) => {
  const cs = Math.max(0, Math.round(t * 100))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`
}
const srtTs = (t) => {
  const ms = Math.max(0, Math.round(t * 1000))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`
}
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`
const words = (s) => s.split(/\s+/).filter(Boolean).length
const escAss = (s) => s.replace(/\{/g, '(').replace(/\}/g, ')')

// ------------------------------------------------------------------ timeline
function timeline(cut) {
  let acc = 0
  const segs = cut.segments.map((s, i) => {
    const len = s.out - s.in
    const start = i === 0 ? 0 : acc - cut.td
    acc = start + len
    return { ...s, len, start }
  })
  const lines = []
  for (const s of segs) {
    s.captions.forEach((c, j) => {
      const local0 = s.local ? c.at[0] : c.at[0] - s.in
      const local1 = s.local ? c.at[1] : c.at[1] - s.in
      const a = Math.max(0, local0)
      const b = Math.min(s.len - 0.05, local1)
      if (b - a < 0.6) return
      lines.push({ t0: s.start + a, t1: s.start + b, text: c.text, hook: !!c.hook, kicker: j === 0 ? s.kicker : undefined })
    })
  }
  // One line at a time: a line ends just before the next one starts
  for (let i = 0; i < lines.length - 1; i++) lines[i].t1 = Math.min(lines[i].t1, lines[i + 1].t0 - 0.12)
  const last = segs[segs.length - 1]
  const end = last.end ? { t0: last.start + Math.max(0, last.end[0] - last.in), t1: last.start + last.len } : null
  return { segs, lines, end, total: acc }
}

// ------------------------------------------------------------------ render
const index = []
const vo = []
let n = 0
const LOOKS = [['arcade', 'Arcade'], ['classic', 'Classic']].filter(([k]) => !only || k === only)

for (const [look, Look] of LOOKS) {
  for (const cut of cuts[look]) {
    const tl = timeline(cut)
    for (const l of tl.lines) {
      const wps = words(l.text) / (l.t1 - l.t0)
      if (wps > WPS_MAX + (l.hook ? 0.4 : 0)) console.warn(`  pace: ${Look} ${cut.length} "${l.text.slice(0, 40)}..." ${wps.toFixed(2)} words/s`)
    }
    const voBlock = [`### ${Look}, ${cut.length} (${tl.total.toFixed(0)} seconds)`, '', `Files: ${['16x9', '9x16'].map((a) => `\`${name(look, cut, a)}.mp4\``).join(' and ')}`, '', '| Time | Line |', '|---|---|']
    for (const l of tl.lines) voBlock.push(`| ${mmss(l.t0)} to ${mmss(l.t1)} | ${l.hook ? '**' + l.text + '** (hook: punchy, a touch faster)' : l.text} |`)
    if (tl.end) voBlock.push(`| ${mmss(tl.end.t0)} to ${mmss(tl.end.t1)} | (Title card. Silence, or let the music carry it.) |`)
    vo.push(voBlock.join('\n'))

    for (const aspect of ['16x9', '9x16']) {
      n++
      const L = LAYOUT[aspect]
      const base = name(look, cut, aspect)
      index.push({ n, file: `${base}.mp4`, look: Look, length: cut.length, aspect, seconds: tl.total, platforms: platformsFor(cut, aspect) })

      // captions
      let ass = header(look, L)
      let srt = ''
      tl.lines.forEach((l, i) => {
        srt += `${i + 1}\n${srtTs(l.t0)} --> ${srtTs(l.t1)}\n${l.text}\n\n`
        if (l.hook) {
          const text = look === 'arcade' ? l.text.toUpperCase() : l.text
          const fx = look === 'arcade' ? '\\blur3' : '\\blur0.6'
          ass += `Dialogue: 1,${ts(l.t0)},${ts(l.t1)},Hook,,0,0,0,,{\\pos(${L.cx},${L.hookY})\\fad(250,200)${fx}\\q0}${escAss(wrapHook(text, aspect, look))}\n`
          return
        }
        const kick = look === 'arcade' && l.kicker ? `{\\fnPress Start 2P\\fs${L.kick}\\c${C.cyan}\\3c${C.magenta}\\bord1.2\\blur0.8}${l.kicker}{\\r}\\N` : ''
        const kickBox = look === 'arcade' && l.kicker ? `{\\fnPress Start 2P\\fs${L.kick}}${l.kicker}{\\r}\\N` : ''
        ass += `Dialogue: 0,${ts(l.t0)},${ts(l.t1)},Box,,0,0,0,,{\\fad(180,160)}${kickBox}${escAss(l.text)}\n`
        ass += `Dialogue: 1,${ts(l.t0)},${ts(l.t1)},Cap,,0,0,0,,{\\fad(180,160)${look === 'arcade' ? '\\blur1.6' : ''}}${kick}${escAss(l.text)}\n`
      })
      if (tl.end) {
        const fx = look === 'arcade' ? '\\blur3' : ''
        ass += `Dialogue: 1,${ts(tl.end.t0)},${ts(tl.end.t1)},Title,,0,0,0,,{\\pos(${L.cx},${L.endY})\\fad(500,0)${fx}}GHOSTS OF LIVES PAST\n`
        ass += `Dialogue: 1,${ts(tl.end.t0 + 0.4)},${ts(tl.end.t1)},Sub,,0,0,0,,{\\pos(${L.cx},${L.endY + (aspect === '9x16' ? 110 : 90)})\\fad(500,0)}The Unlived Lives \\h\\h·\\h\\h a multi agent simulation\n`
      }
      writeFileSync(`media/final/${base}.ass`, ass)
      writeFileSync(`media/final/${base}.srt`, srt)

      // video
      const inputs = []
      const parts = []
      tl.segs.forEach((s, i) => {
        const file = `media/shots/${aspect}/${s.shot}.mp4`
        if (!existsSync(file) && !dry) throw new Error(`missing shot ${file}`)
        inputs.push('-i', file)
        parts.push(`[${i}:v]trim=start=${s.in}:end=${s.out},setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p,settb=AVTB[s${i}]`)
      })
      let prev = 's0'
      tl.segs.forEach((s, i) => {
        if (i === 0) return
        const out = `x${i}`
        parts.push(`[${prev}][s${i}]xfade=transition=${cut.transition}:duration=${cut.td.toFixed(2)}:offset=${s.start.toFixed(3)}[${out}]`)
        prev = out
      })
      parts.push(`[${prev}]subtitles=filename=media/final/${base}.ass:fontsdir=${fontsDir}[v]`)
      const args = ['-y', '-loglevel', 'error', ...inputs, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
        '-filter_complex', parts.join(';'), '-map', '[v]', '-map', `${tl.segs.length}:a`, '-t', tl.total.toFixed(3),
        '-c:v', 'libx264', '-preset', 'slow', '-crf', aspect === '9x16' ? '21' : '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', `media/final/${base}.mp4`]
      if (dry) { console.log(`would render ${base} (${tl.total.toFixed(1)}s)`); continue }
      const t = Date.now()
      const r = spawnSync('ffmpeg', args, { stdio: 'inherit' })
      if (r.status !== 0) throw new Error(`ffmpeg failed for ${base}`)
      console.log(`${base}  ${tl.total.toFixed(1)}s  (${((Date.now() - t) / 1000).toFixed(0)}s)`)
    }
  }
}

function name(look, cut, aspect) {
  const Look = look === 'arcade' ? 'Arcade' : 'Classic'
  const plat = platformsFor(cut, aspect).join('-')
  const idx = String(LOOKS_INDEX(look, cut, aspect)).padStart(2, '0')
  return `GLP_${idx}_${Look}_${cut.length}_${aspect}_${plat}`
}
function LOOKS_INDEX(look, cut, aspect) {
  const order = ['Final', '60s', '30s', '15s']
  return (look === 'arcade' ? 0 : 8) + order.indexOf(cut.length) * 2 + (aspect === '16x9' ? 1 : 2)
}
function platformsFor(cut, aspect) {
  if (aspect === '16x9') return cut.length === 'Final' ? ['YouTube', 'LinkedIn', 'X'] : cut.length === '15s' ? ['X', 'LinkedIn'] : ['LinkedIn', 'X', 'YouTube']
  return cut.length === 'Final' ? ['Reels', 'TikTok'] : ['Reels', 'TikTok', 'Shorts']
}
function wrapHook(text, aspect, look) {
  // Big hooks wrap by hand so they sit in the safe zone
  const max = aspect === '9x16' ? (look === 'arcade' ? 16 : 18) : (look === 'arcade' ? 26 : 30)
  const out = []
  let line = ''
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w } else line += ' ' + w
  }
  out.push(line.trim())
  return out.join('\\N')
}

if (!dry) {
  index.sort((a, b) => a.n - b.n)
  const rows = index.map((r) => `| ${r.file} | ${r.look} | ${r.length} | ${r.aspect === '9x16' ? '9:16 vertical' : '16:9 horizontal'} | ${r.seconds.toFixed(0)}s | ${r.platforms.join(', ')} |`)
  writeFileSync('media/final/INDEX.md', `# Ghosts of Lives Past: video deliverables\n\nData snapshot ${facts.asOf.slice(0, 10)}. Every caption is burned into the platform safe zone; the matching .srt sits next to each video for platforms that take caption files. Each video has a silent stereo track, ready for voiceover and music.\n\n| File | Look | Cut | Aspect | Length | Made for |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`)
}
writeFileSync('media/final/VO_SCRIPTS.md', `# Voiceover scripts\n\nOne script per cut. The 16:9 and 9:16 versions of a cut share the same script and timing, and the lines match the burned in captions word for word. Read at an easy pace (about 150 words a minute); each line has to finish by its end time. Start the hook a beat after the video starts.\n\n${vo.join('\n\n')}\n`)
console.log('wrote media/final/VO_SCRIPTS.md')
