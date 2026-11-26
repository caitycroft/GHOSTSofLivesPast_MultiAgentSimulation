// Edit decision lists for every deliverable. Each cut is a run of shots
// (with in and out points), the transition between them, and the captions
// for each shot in shot-local seconds. The same captions become the burned
// subtitles, the .srt files and the voiceover script, so they always match.
// Specific outcomes are read from media/facts.json (the simulation's output).
//
// Voice: "I" is the life that happened. Each ghost is "my agent" in a city,
// and "she" after that.

// What an agent does on her first unlived path, keyed by the path's label in
// the simulation, so a tour caption always names the path the model chose
const DOES = {
  'Ocean and climate ventures': 'builds a career in ocean and climate ventures',
  'Techno DJ and label owner': 'starts a techno label of her own',
  'Cross border venture': 'works in cross border venture capital',
  'Music label A&R': 'works in music, in A&R',
  'Silicon Slopes startup': 'joins a Silicon Slopes startup',
  'AI startup founder': 'founds an AI startup',
  'Independent label in Brooklyn': 'starts an indie label in Brooklyn',
  'Festival and live music production': 'produces festivals and live music',
}

export function buildCuts(f) {
  const s = f.selves
  const agent = (id) => {
    const c = s[id].firstChoice
    return `In ${c.city}, my agent ${DOES[c.label] ?? `goes into ${c.label.toLowerCase()}`}.`
  }
  const sto = s.sto.ends
  const stoEngine = (sto.xr ?? 0) + (sto.worldmodels ?? 0)

  // ---------------------------------------------------------------- arcade
  // Caption times are in shot seconds (the shot's own clock), so a scene can
  // be trimmed differently in each cut and its lines stay on their pictures.
  const A = {
    hook: { shot: 'a_hook', kicker: 'PRESS START', captions: [
      { at: [0.15, 3.0], text: 'I simulated every life I could have lived.', hook: true },
      { at: [3.1, 8.3], text: 'One for every place I’ve lived. Real education, real industries, real economic data.' },
    ] },
    build: { shot: 'a_globe_build', kicker: 'STAGE 1 · THE WORLD', captions: [
      { at: [2.3, 9.8], text: 'Ten agents share one clock, from 2010 to 2031. One is the life that happened. Nine are ghosts.' },
    ] },
    real: { shot: 'a_globe_follow', kicker: 'STAGE 2 · THE LIFE THAT HAPPENED', captions: [
      { at: [0.6, 6.0], text: 'First, my real life: USC film school, studio internships, DJing as Parker + Barrow.' },
      { at: [6.2, 9.8], text: 'Then touring and living between Los Angeles and Stockholm.' },
    ] },
    sto: { shot: 'a_dio_sto', kicker: 'FORK · STOCKHOLM 2016', captions: [
      { at: [0.5, 5.0], text: 'In 2016, my agent stays in Stockholm and goes into game development.' },
      { at: [5.2, 10.6], text: `In ${stoEngine} of 100 runs, her engine skills lead to games or world models.` },
    ] },
    forks: { shot: 'a_street_forks', kicker: 'STAGE 3 · THE GHOSTS FORK', captions: [
      { at: [0.2, 5.2], text: '2020: COVID lockdowns. I move into venture capital, between LA, Hawaii and Utah.' },
      { at: [5.4, 11.8], text: 'Every time I leave a place, the ghost who stayed splits off and lives on without me.' },
    ] },
    tour: { shot: 'a_globe_tour', kicker: 'STAGE 4 · THE AGENTS', captions: [
      { at: [0.3, 4.0], text: 'Each ghost is an agent: my background, her own choices.' },
      { at: [4.2, 8.6], text: agent('hnl') },
      { at: [8.9, 13.1], text: agent('ber') },
      { at: [13.4, 17.6], text: agent('sha') },
    ] },
    time: { shot: 'a_timeline', kicker: 'STAGE 5 · THE REAL WORLD', captions: [
      { at: [0.7, 6.3], text: 'They all live through the same real world: the festival boom, Brexit, COVID, ChatGPT.' },
      { at: [6.5, 11.5], text: 'Every economic, political and tech event links to its source.' },
    ] },
    how: { shot: 'a_how', kicker: 'STAGE 6 · THE MODEL', captions: [
      { at: [0.2, 8.4], text: 'At every fork, each option is scored on fit, industry growth, the local economy, risk, and where the other agents are.' },
    ] },
    data: { shot: 'a_dio_ghost', kicker: 'STAGE 7 · THE DATA', captions: [
      { at: [0.6, 7.9], text: 'The data is real: World Bank growth and inflation for every country, Wikipedia page views for every industry.' },
    ] },
    lives: { shot: 'a_lives', kicker: 'STAGE 8 · THE OUTPUT', captions: [
      { at: [0.7, 8.0], text: 'A hundred runs of the world. These are the most common lives, and where each is heading in 2031.' },
    ] },
    outro: { shot: 'a_outro', kicker: 'CONTINUE?', captions: [
      { at: [0.2, 6.8], text: 'And the real me? In San Francisco, building with AI and figuring out where the world is headed.' },
    ], end: [7.0, 10.5] },
  }

  // ---------------------------------------------------------------- classic
  const C = {
    hook: { shot: 'c_globe_build', captions: [
      // the classic cuts enter this shot at 1.5s, so its captions start there
      { at: [1.65, 4.5], text: 'I simulated every life I could have lived.', hook: true },
      { at: [4.6, 9.8], text: 'One for every place I’ve lived. Real education, real industries, real economic data.' },
    ] },
    real: { shot: 'c_globe_follow', captions: [
      { at: [0.2, 5.6], text: 'First, my real life: USC film school, studio internships, DJing as Parker + Barrow.' },
      { at: [5.8, 12.8], text: '2015: Lightning in a Bottle, Burning Man, then touring and living between Los Angeles and Stockholm.' },
    ] },
    loom: { shot: 'c_loom', captions: [
      { at: [0.2, 4.6], text: 'Ten agents share one clock, from 2010 to 2031.' },
      { at: [4.8, 9.8], text: 'One is the life that happened. Nine are ghosts who stayed.' },
    ] },
    forks: { shot: 'c_city_street', captions: [
      { at: [0.2, 4.8], text: 'NYU in New York, then London, Berlin, Oslo and Shanghai.' },
      { at: [5.0, 9.8], text: 'Each time I leave a place, the ghost who stayed splits off.' },
    ] },
    tour: { shot: 'c_globe_tour', captions: [
      { at: [0.3, 4.3], text: agent('lon') },
      { at: [4.8, 8.8], text: agent('utah') },
      { at: [9.3, 13.3], text: agent('nyc') },
      { at: [13.8, 17.8], text: agent('osl') },
    ] },
    time: { shot: 'c_timeline', captions: [
      { at: [0.7, 6.3], text: 'They all live through the same real world: the festival boom, Brexit, COVID, ChatGPT.' },
      { at: [6.5, 11.5], text: 'Every economic, political and tech event links to its source.' },
    ] },
    how: { shot: 'c_how', captions: [
      { at: [0.2, 8.4], text: 'At every fork, each option is scored on fit, industry growth, the local economy, risk, and where the other agents are.' },
    ] },
    data: { shot: 'c_data', captions: [
      { at: [0.2, 4.5], text: 'The data is real: World Bank growth and inflation for every country.' },
      { at: [4.7, 8.8], text: `UK GDP, 2020: down ${Math.abs(f.data.ukGdp2020).toFixed(1)} percent. Every number is sourced.` },
    ] },
    lives: { shot: 'c_lives', captions: [
      { at: [0.7, 8.0], text: 'A hundred runs of the world. These are the most common lives, and where each is heading in 2031.' },
    ] },
    outro: { shot: 'c_outro', captions: [
      { at: [0.2, 6.8], text: 'And the real me? In San Francisco, building with AI and figuring out where the world is headed.' },
    ], end: [7.0, 10.5] },
  }

  const seg = (scene, inn, out, extra = {}) => ({ ...scene, in: inn, out, ...extra })
  // Same, with captions timed from the segment's own in point
  const segL = (scene, inn, out, captions) => ({ ...scene, in: inn, out, captions, local: true })
  const T = { arcade: ['pixelize', 0.7], classic: ['fade', 0.8] }
  const make = (style, S) => {
    const [tr, td] = T[style]
    const same = 'Same me. Different city. Different life.'
    return [
      {
        length: 'Final', platforms: ['YouTube', 'LinkedIn', 'X', 'Reels', 'TikTok'], transition: tr, td,
        segments: style === 'arcade'
          ? [seg(S.hook, 0, 8.6), seg(S.build, 2, 10), seg(S.real, 0.4, 10.4), seg(S.sto, 0.3, 11.0), seg(S.forks, 0, 12), seg(S.tour, 0, 17.8), seg(S.time, 0.5, 11.6), seg(S.how, 0, 8.6), seg(S.data, 0.4, 8), seg(S.lives, 0.5, 8.5), seg(S.outro, 0, 10.5)]
          : [seg(S.hook, 1.5, 10), seg(S.real, 0, 13), seg(S.loom, 0, 10), seg(S.forks, 0, 10), seg(S.tour, 0, 18), seg(S.time, 0.5, 11.6), seg(S.how, 0, 8.6), seg(S.data, 0, 9), seg(S.lives, 0.5, 8.5), seg(S.outro, 0, 10.5)],
      },
      {
        length: '60s', platforms: ['Reels', 'TikTok', 'Shorts', 'LinkedIn', 'X'], transition: tr, td: td * 0.85,
        segments: style === 'arcade'
          // the COVID line as recorded runs 5.6s, so the next caption comes in half a second later
          ? [seg(S.hook, 0, 8.4), seg(S.real, 0.4, 10.4), seg(S.forks, 0, 11.9, { captions: [{ ...S.forks.captions[0], at: [0.2, 5.7] }, { ...S.forks.captions[1], at: [5.9, 11.8] }] }), seg(S.tour, 4.0, 13.4, { captions: S.tour.captions.slice(1, 3) }), seg(S.how, 0, 8.6), seg(S.lives, 0.5, 8.1), seg(S.outro, 0, 8.9)]
          : [seg(S.hook, 1.5, 9.9), seg(S.real, 0, 13), seg(S.forks, 0, 10), seg(S.tour, 4.5, 13.7, { captions: S.tour.captions.slice(1, 3) }), seg(S.time, 0.5, 7.2, { captions: S.time.captions.slice(0, 1) }), seg(S.how, 0, 8.6), seg(S.outro, 0, 8.9)],
      },
      {
        length: '30s', platforms: ['Reels', 'TikTok', 'Shorts', 'X', 'LinkedIn'], transition: tr, td: td * 0.7,
        segments: style === 'arcade'
          ? [seg(S.hook, 0, 8.4), segL(S.forks, 5.2, 12, [{ at: [0.2, 6.6], text: 'Every time I leave a place, the ghost who stayed splits off and lives on without me.' }]), segL(S.tour, 4.0, 12.4, [{ at: [0.1, 3.6], text: 'Each ghost is an agent with my background.' }, { at: [3.8, 8.2], text: same }]), segL(S.outro, 2.0, 10.5, [{ at: [0.2, 4.6], text: 'Real data, real places, a hundred runs of the world.' }])]
          : [seg(S.hook, 1.5, 9.9), segL(S.forks, 4.2, 10, [{ at: [0.2, 5.6], text: 'Each time I leave a place, the ghost who stayed splits off.' }]), segL(S.tour, 9.0, 16.6, [{ at: [0.1, 3.6], text: 'Each ghost is an agent with my background.' }, { at: [3.8, 7.4], text: same }]), segL(S.outro, 2.0, 10.5, [{ at: [0.2, 4.6], text: 'Real data, real places, a hundred runs of the world.' }])],
      },
      {
        length: '15s', platforms: ['Reels', 'TikTok', 'Shorts', 'X'], transition: tr, td: 0.4,
        segments: style === 'arcade'
          ? [seg(S.hook, 0, 6, { captions: [S.hook.captions[0], { at: [3.1, 5.9], text: 'One for every place I’ve lived.' }] }), segL(S.forks, 6, 11, [{ at: [0.1, 4.9], text: 'Every ghost splits off and lives on.' }]), segL(S.outro, 5.8, 10.5, [])]
          : [seg(S.hook, 1.5, 7.5, { captions: [S.hook.captions[0], { at: [4.6, 7.4], text: 'One for every place I’ve lived.' }] }), segL(S.forks, 5, 10, [{ at: [0.1, 4.9], text: 'Every ghost splits off and lives on.' }]), segL(S.outro, 5.8, 10.5, [])],
      },
    ]
  }

  return { arcade: make('arcade', A), classic: make('classic', C) }
}
