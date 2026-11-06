// Shot list for the walkthrough films. Each shot is one continuous, frame
// accurate capture of the app; scripts/cut.mjs edits shots into finished
// videos with transitions, burned captions and voiceover scripts.
//
// A shot: the URL it opens, how long it runs, and timed steps. Steps run on
// virtual time, so every render of a shot is identical.

const clock = (t, speed, playing = true) => (p) => p.evaluate(([t, speed, playing]) => window.__clock.set({ t, speed, playing }), [t, speed, playing])
const focus = (id) => (p) => p.evaluate((id) => window.__app.setFocus(id), id)
const mode = (m) => (p) => p.evaluate((m) => window.__app.setMode(m), m)
const scrollTo = (sel, y) => (p) => p.evaluate(([sel, y]) => document.querySelector(sel)?.scrollTo({ top: y, behavior: 'smooth' }), [sel, y])
const hover = (sel) => async (p) => {
  const box = await p.locator(sel).first().boundingBox().catch(() => null)
  if (box) await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
}

const base = (style, view, extra = '') => `?capture=1&clean=1&cinema=1&style=${style}&view=${view}${extra}`

export const SHOTS = {
  // ------------------------------------------------------------------ arcade
  a_hook: { url: base('arcade', 'city', '&mode=follow'), duration: 9, steps: [[0, clock(2014.72, 0.85)]] },
  a_globe_build: { url: base('arcade', 'globe', '&mode=orbit'), duration: 10, steps: [[0, clock(2010, 0.35)]] },
  a_globe_follow: { url: base('arcade', 'globe', '&mode=follow'), duration: 11, steps: [[0, clock(2015.55, 0.36)]] },
  a_dio_sto: { url: base('arcade', 'city', '&mode=orbit'), duration: 9, steps: [[0, clock(2016.12, 0.07)]] },
  a_street_forks: { url: base('arcade', 'city', '&mode=follow'), duration: 12, steps: [[0, clock(2020.25, 0.55)]] },
  a_globe_tour: { url: base('arcade', 'globe', '&mode=follow'), duration: 14, steps: [[0, clock(2024.6, 0.38)], [0, focus('sto')], [3.5, focus('hnl')], [7, focus('ber')], [10.5, focus('sha')]] },
  a_timeline: { url: base('arcade', 'timeline'), duration: 12, steps: [[0, clock(2010.6, 1.3)]] },
  a_how: { url: base('arcade', 'how'), duration: 9, steps: [[0, clock(2024.4, 0, false)], [0, focus('real')], [4.5, focus('sto')], [4.5, scrollTo('.layer.scroll', 760)]] },
  a_dio_ghost: { url: base('arcade', 'city', '&mode=orbit'), duration: 8, steps: [[0, clock(2027.4, 0.1)], [0, focus('nyc')]] },
  a_lives: { url: base('arcade', 'cards'), duration: 9, steps: [[0, clock(2031, 0, false)], [2.5, scrollTo('.layer.scroll', 520)], [5.5, scrollTo('.layer.scroll', 1100)]] },
  a_outro: { url: base('arcade', 'city', '&mode=follow'), duration: 8, steps: [[0, clock(2030.35, 0.42)]] },

  // ------------------------------------------------------------------ classic
  c_globe_build: { url: base('cyanotype', 'globe', '&mode=orbit'), duration: 10, steps: [[0, clock(2010, 0.35)]] },
  c_globe_follow: { url: base('cyanotype', 'globe', '&mode=follow'), duration: 12, steps: [[0, clock(2010.25, 0.45)]] },
  c_loom: { url: base('cyanotype', 'loom'), duration: 10, steps: [[0, clock(2014.4, 1.1)]] },
  c_city_street: { url: base('cyanotype', 'city', '&mode=follow'), duration: 10, steps: [[0, clock(2022.15, 0.5)]] },
  c_globe_tour: { url: base('cyanotype', 'globe', '&mode=follow'), duration: 14, steps: [[0, clock(2023.7, 0.38)], [0, focus('lon')], [3.5, focus('utah')], [7, focus('nyc')], [10.5, focus('osl')]] },
  c_timeline: { url: base('cyanotype', 'timeline'), duration: 12, steps: [[0, clock(2010.6, 1.3)]] },
  c_how: { url: base('cyanotype', 'how'), duration: 9, steps: [[0, clock(2016.4, 0, false)], [0, focus('real')], [4.5, focus('sto')], [4.5, scrollTo('.layer.scroll', 760)]] },
  c_data: { url: base('cyanotype', 'dash'), duration: 9, steps: [[0, clock(2021, 0, false)], [1.5, scrollTo('.layer.scroll', 560)], [3, hover('.heat-row:nth-child(5) .cell:nth-child(13)')], [6, hover('.heat-row:nth-child(8) .cell:nth-child(16)')]] },
  c_lives: { url: base('cyanotype', 'cards'), duration: 9, steps: [[0, clock(2031, 0, false)], [2.5, scrollTo('.layer.scroll', 520)], [5.5, scrollTo('.layer.scroll', 1100)]] },
  c_outro: { url: base('cyanotype', 'globe', '&mode=orbit'), duration: 8, steps: [[0, clock(2029.4, 0.6)]] },
}

export const ASPECTS = {
  '16x9': { width: 1920, height: 1080 },
  '9x16': { width: 1080, height: 1920 },
}
