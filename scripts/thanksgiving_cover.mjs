// Puts the thumbnail at the very start of each Thanksgiving film, so the cover a
// platform shows first is the designed one: held for a second, then a quick
// crossfade into the film. The sound (and the captions file) start a second
// later, with the picture. The verticals get the vertical cover, the
// horizontals the horizontal one. Safe to run twice: a film that already has its
// cover (tagged in its metadata) is left alone.
//
//   node scripts/thanksgiving_cover.mjs A 9x16        (one version, one shape)
//   node scripts/thanksgiving_cover.mjs               (everything in media/thanksgiving/cuts)

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

const CUTS = 'media/thanksgiving/cuts', THUMBS = 'media/thumbnails/thanksgiving'
const HOLD = 1.0, FADE = 0.25, TAG = 'glp-thanksgiving-cover'
const [v0, a0] = process.argv.slice(2)
const jobs = (v0 ? [v0] : ['A', 'B', 'C']).flatMap((v) => (a0 ? [a0] : ['9x16', '16x9']).map((a) => [v, a]))

const tagged = (f) => execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags=comment', '-of', 'csv=p=0', f]).toString().includes(TAG)
const shift = (t) => {
  const [h, m, rest] = t.split(':'), [s, ms] = rest.split(',')
  const x = Math.round(((+h * 60 + +m) * 60 + +s) * 1000 + +ms + HOLD * 1000)
  return `${String(Math.floor(x / 3600000)).padStart(2, '0')}:${String(Math.floor((x % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((x % 60000) / 1000)).padStart(2, '0')},${String(x % 1000).padStart(3, '0')}`
}

for (const [v, a] of jobs) {
  const film = `${CUTS}/GLP_Thanksgiving_${v}_${a}.mp4`, voice = `${CUTS}/GLP_Thanksgiving_${v}_${a}_voice-only.mp4`
  const thumb = `${THUMBS}/GLP_Thanksgiving_thumb_lives_${a}.png`
  if (!existsSync(film)) { console.log(`skip ${v} ${a}: no film`); continue }
  if (tagged(film)) { console.log(`skip ${v} ${a}: already has its cover`); continue }
  const [W, H] = a === '16x9' ? [1920, 1080] : [1080, 1920]
  const ms = Math.round(HOLD * 1000)
  // the film: cover held, crossfade, sound delayed to start with the picture
  const tmp = film.replace(/\.mp4$/, '_cov.mp4')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-framerate', '30', '-t', String(HOLD + FADE), '-i', thumb, '-i', film,
    '-filter_complex', `[0:v]scale=${W}:${H},setsar=1,fps=30,settb=AVTB,format=yuv420p[c];[1:v]setsar=1,fps=30,settb=AVTB,format=yuv420p[f];[c][f]xfade=transition=fade:duration=${FADE}:offset=${HOLD}[vout];[1:a]adelay=${ms}:all=1[aout]`,
    '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-metadata', `comment=${TAG}`, tmp])
  renameSync(tmp, film)
  // the voice only copy: the same picture, its own sound delayed the same way
  if (existsSync(voice) && !tagged(voice)) {
    const vt = voice.replace(/\.mp4$/, '_cov.mp4')
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', film, '-i', voice, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', `adelay=${ms}:all=1`, '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', '-metadata', `comment=${TAG}`, vt])
    renameSync(vt, voice)
  }
  // the captions move with the sound
  const srt = `${CUTS}/GLP_Thanksgiving_${v}_${a}.srt`
  if (existsSync(srt)) writeFileSync(srt, readFileSync(srt, 'utf8').replace(/(\d\d:\d\d:\d\d,\d\d\d)/g, (t) => shift(t)))
  console.log(`cover on ${v} ${a}`)
}
