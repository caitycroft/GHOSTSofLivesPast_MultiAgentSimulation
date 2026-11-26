// The Thanksgiving piece: a voice first script. Caity records it at her own
// pace and the picture is cut to her take, so the timings here only pace the
// teleprompter (about 140 words a minute, with room to breathe).
//
//   node scripts/thanksgiving.mjs  ->  media/thanksgiving/scripts.json and teleprompter.html
//
// Each opening is its own entry in the teleprompter, with the same body.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const OPENINGS = {
  'Opening A': ['Have you ever wondered who you’d be if you’d made a different choice?', 'If you’d stayed, instead of leaving?'],
  'Opening B': ['Have you ever wondered what your life would look like on a different timeline?'],
  'Opening C': ['Have you ever wondered who you’d be if you’d taken the other path?'],
  'Opening D': ['Have you ever wondered who you’d be if you’d stayed in a place you left?'],
}

// [line, pause after it in seconds]
const BODY = [
  ['I’ve lived in ten cities, in six countries. Every time I left one, I wondered about the me who stayed, and the life she’d keep building there.', 0.8],
  ['So I built a multi agent simulation. Each agent is me, staying in one of those cities, building a life on real economic and industry data.', 0.6],
  ['It’s my most honest answer to where each life would be today.', 0.9],
  ['In Stockholm, she builds games. In Berlin, she runs her own techno label. In Hawaii, she’s building ocean and climate ventures.', 0.9],
  ['And here I am.', 1.6],
  ['Today is Thanksgiving in the US. Wherever you are, it’s a good day to look back.', 0.8],
  ['Looking at all of them, I don’t feel regret. I feel grateful.', 0.9],
  ['For the chapters that ended, and the ones still going. For the roads I took, and the ones I didn’t.', 0.9],
  ['We can’t go back. But we can say thank you, and choose where we go next.', 1.1],
  ['Happy Thanksgiving, from all of me.', 0],
]

const WPS = 2.5 // an unhurried, warm read (150 words a minute)
const words = (s) => s.split(/\s+/).filter(Boolean).length

const scripts = Object.entries(OPENINGS).map(([name, opening]) => {
  const lines = []
  let t = 1.0
  const add = (text, pause, hook = false) => {
    const d = Math.max(1.6, words(text) / WPS)
    lines.push({ t0: +t.toFixed(2), t1: +(t + d).toFixed(2), text, hook })
    t += d + pause
  }
  opening.forEach((l, i) => add(l, i === opening.length - 1 ? 0.8 : 0.4, i === 0))
  BODY.forEach(([l, p]) => add(l, p))
  return {
    look: 'Thanksgiving', length: name, seconds: +(t + 1.5).toFixed(2),
    files: ['GLP_Thanksgiving_9x16_Reels-TikTok.mp4', 'GLP_Thanksgiving_16x9_YouTube-LinkedIn-X.mp4'],
    lines, end: null,
  }
})

mkdirSync('media/thanksgiving', { recursive: true })
writeFileSync('media/thanksgiving/scripts.json', JSON.stringify(scripts, null, 1))
for (const s of scripts) console.log(`${s.length}: ${s.lines.reduce((n, l) => n + words(l.text), 0)} words, about ${Math.round(s.seconds)} seconds`)
execFileSync('node', ['scripts/teleprompter.mjs', '--scripts', 'media/thanksgiving/scripts.json', '--out', 'media/thanksgiving/teleprompter.html',
  '--title', 'Thanksgiving Teleprompter', '--heading', 'Ghosts of Lives Past, Thanksgiving voiceover',
  '--intro', 'Voice first: read at your own pace and the picture will be cut to your take. Each opening option is its own script; pick one, press Start, and follow the highlighted line. Space pauses if you need a breath.',
  '--hint', 'Space starts and pauses, R resets. A beep counts you in, and the first line lights up on the high beep. The bar under each line is only a pace guide: take the time a line needs.'], { stdio: 'inherit' })
