// Edit decision lists for every deliverable. Each cut is a run of shots
// (with in and out points), the transition between them, and the captions
// for each shot in shot-local seconds. The same captions become the burned
// subtitles, the .srt files and the voiceover script, so they always match.
// Specific outcomes are read from media/facts.json (the simulation's output).


export function buildCuts(f) {
  const s = f.selves
  const odds = (id) => s[id].firstChoice.odds

  // ---------------------------------------------------------------- arcade
  // Caption times are in shot seconds (the shot's own clock), so a scene can
  // be trimmed differently in each cut and its lines stay on their pictures.
  const A = {
    hook: { shot: 'a_hook', kicker: 'PRESS START', captions: [
      { at: [0.15, 3.0], text: 'I simulated every life I could have lived.', hook: true },
      { at: [3.1, 8.3], text: 'One for every place I\u2019ve lived. Real education, real industries, real economic data.' },
    ] },
    build: { shot: 'a_globe_build', kicker: 'STAGE 1 \u00b7 THE WORLD', captions: [
      { at: [2.3, 9.8], text: 'Ten agents share one clock, from 2010 to 2031. One is the life that happened. Nine are ghosts.' },
    ] },
    real: { shot: 'a_globe_follow', kicker: 'STAGE 2 \u00b7 THE LIFE THAT HAPPENED', captions: [
      { at: [0.6, 6.0], text: 'The real thread replays my life: USC film school, studio internships, DJing as Parker + Barrow.' },
      { at: [6.2, 10.8], text: 'Then touring between LA and Stockholm. Each city shows what was possible.' },
    ] },
    sto: { shot: 'a_dio_sto', kicker: 'FORK \u00b7 STOCKHOLM 2016', captions: [
      { at: [1.3, 8.8], text: `In 2016, a ghost stays in Stockholm. In ${odds('sto')} of 100 runs, she goes into game art.` },
    ] },
    forks: { shot: 'a_street_forks', kicker: 'STAGE 3 \u00b7 THE GHOSTS FORK', captions: [
      { at: [0.2, 5.2], text: '2020: the rooms close. I move into venture capital, between LA, Hawaii and Utah.' },
      { at: [5.4, 11.8], text: 'Every time I leave a place, the ghost who stayed splits off and lives on without me.' },
    ] },
    tour: { shot: 'a_globe_tour', kicker: 'STAGE 4 \u00b7 THE AGENTS', captions: [
      { at: [0.2, 3.3], text: 'Each ghost is an agent, deciding for itself.' },
      { at: [3.5, 6.8], text: 'Hawaii: ocean and climate ventures.' },
      { at: [7.0, 10.3], text: 'Berlin: a techno label of her own.' },
      { at: [10.5, 13.1], text: 'Shanghai: cross border venture.' },
    ] },
    time: { shot: 'a_timeline', kicker: 'STAGE 5 \u00b7 THE REAL WORLD', captions: [
      { at: [0.7, 6.3], text: 'They all live through the same real world: the festival boom, Brexit, the pandemic, ChatGPT.' },
      { at: [6.5, 11.5], text: 'Every macro, geopolitical and tech event sits on the timeline with a source.' },
    ] },
    how: { shot: 'a_how', kicker: 'STAGE 6 \u00b7 THE MODEL', captions: [
      { at: [0.2, 8.8], text: 'At every fork, each option is scored on fit, industry growth, the local economy, risk, and the pull of the other selves.' },
    ] },
    data: { shot: 'a_dio_ghost', kicker: 'STAGE 7 \u00b7 THE DATA', captions: [
      { at: [0.6, 7.9], text: 'The data is real: World Bank growth and inflation for every country, Wikipedia attention for every industry.' },
    ] },
    lives: { shot: 'a_lives', kicker: 'STAGE 8 \u00b7 THE OUTPUT', captions: [
      { at: [0.7, 8.4], text: 'A hundred runs of the whole world. These are the most common lives, and where each is heading in 2031.' },
    ] },
    outro: { shot: 'a_outro', kicker: 'CONTINUE?', captions: [
      { at: [0.2, 4.6], text: `And the real me? Projected to ${s.real.in2031.city}, in world models.` },
    ], end: [4.8, 8.0] },
  }

  // ---------------------------------------------------------------- classic
  const C = {
    hook: { shot: 'c_globe_build', captions: [
      // the classic cuts enter this shot at 1.5s, so its captions start there
      { at: [1.65, 4.5], text: 'I simulated every life I could have lived.', hook: true },
      { at: [4.6, 9.8], text: 'One for every place I\u2019ve lived. Real education, real industries, real economic data.' },
    ] },
    real: { shot: 'c_globe_follow', captions: [
      { at: [0.2, 5.6], text: 'The real thread replays my life: USC film school, studio internships, DJing as Parker + Barrow.' },
      { at: [5.8, 11.8], text: 'In 2015, Lightning in a Bottle and Burning Man, then touring between Los Angeles and Stockholm.' },
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
      { at: [0.2, 3.3], text: 'London: music, in A&R.' },
      { at: [3.5, 6.8], text: 'Utah: a Silicon Slopes startup.' },
      { at: [7.0, 10.3], text: 'New York: founding an AI startup.' },
      { at: [10.5, 13.1], text: 'Oslo: producing festivals.' },
    ] },
    time: { shot: 'c_timeline', captions: [
      { at: [0.7, 6.3], text: 'They all live through the same real world: the festival boom, Brexit, the pandemic, ChatGPT.' },
      { at: [6.5, 11.5], text: 'Every macro, geopolitical and tech event sits on the timeline with a source.' },
    ] },
    how: { shot: 'c_how', captions: [
      { at: [0.2, 8.8], text: 'At every fork, each option is scored on fit, industry growth, the local economy, risk, and the pull of the other selves.' },
    ] },
    data: { shot: 'c_data', captions: [
      { at: [0.2, 4.4], text: 'The data is real: World Bank growth and inflation for every country.' },
      { at: [4.6, 8.8], text: `UK GDP, 2020: down ${Math.abs(f.data.ukGdp2020).toFixed(1)} percent. Every number is sourced.` },
    ] },
    lives: { shot: 'c_lives', captions: [
      { at: [0.7, 8.4], text: 'A hundred runs of the whole world. These are the most common lives, and where each is heading in 2031.' },
    ] },
    outro: { shot: 'c_outro', captions: [
      { at: [0.2, 4.6], text: `And the real me? Projected to ${s.real.in2031.city}, in world models.` },
    ], end: [4.8, 8.0] },
  }

  const seg = (scene, inn, out, extra = {}) => ({ ...scene, in: inn, out, ...extra })
  // Same, with captions timed from the segment's own in point
  const segL = (scene, inn, out, captions) => ({ ...scene, in: inn, out, captions, local: true })
  const T = { arcade: ['pixelize', 0.7], classic: ['fade', 0.8] }
  const make = (style, S) => {
    const [tr, td] = T[style]
    return [
      {
        length: 'Final', platforms: ['YouTube', 'LinkedIn', 'X', 'Reels', 'TikTok'], transition: tr, td,
        segments: style === 'arcade'
          ? [seg(S.hook, 0, 8.6), seg(S.build, 2, 10), seg(S.real, 0.4, 10.9), seg(S.sto, 1, 9), seg(S.forks, 0, 12), seg(S.tour, 0, 13.2), seg(S.time, 0.5, 11.6), seg(S.how, 0, 9), seg(S.data, 0.4, 8), seg(S.lives, 0.5, 8.5), seg(S.outro, 0, 8)]
          : [seg(S.hook, 1.5, 10), seg(S.real, 0, 12), seg(S.loom, 0, 10), seg(S.forks, 0, 10), seg(S.tour, 0, 13.2), seg(S.time, 0.5, 11.6), seg(S.how, 0, 9), seg(S.data, 0, 9), seg(S.lives, 0.5, 8.5), seg(S.outro, 0, 8)],
      },
      {
        length: '60s', platforms: ['Reels', 'TikTok', 'Shorts', 'LinkedIn', 'X'], transition: tr, td: td * 0.85,
        segments: style === 'arcade'
          ? [seg(S.hook, 0, 8.4), seg(S.real, 0.4, 10.9), seg(S.forks, 0, 12), seg(S.tour, 3.5, 10.5, { captions: S.tour.captions.slice(1, 3) }), seg(S.how, 0, 9), seg(S.lives, 0.5, 8.3), seg(S.outro, 0, 8)]
          : [seg(S.hook, 1.5, 9.9), seg(S.real, 0, 12), seg(S.forks, 0, 10), seg(S.tour, 3.5, 10.5, { captions: S.tour.captions.slice(1, 3) }), seg(S.how, 0, 9), seg(S.outro, 0, 8)],
      },
      {
        length: '30s', platforms: ['Reels', 'TikTok', 'Shorts', 'X', 'LinkedIn'], transition: tr, td: td * 0.7,
        segments: style === 'arcade'
          ? [seg(S.hook, 0, 8.4), segL(S.forks, 5.2, 12, [{ at: [0.2, 6.6], text: 'Every time I leave a place, the ghost who stayed splits off and lives on without me.' }]), segL(S.tour, 3.5, 10.5, [{ at: [0.1, 3.4], text: 'Each ghost is an agent with my background.' }, { at: [3.6, 6.9], text: 'Same me. Different city. Different life.' }]), segL(S.outro, 0, 8, [{ at: [0.2, 4.6], text: 'Real data, real places, a hundred runs of the world.' }])]
          : [seg(S.hook, 1.5, 9.9), segL(S.forks, 4.8, 10, [{ at: [0.2, 5.0], text: 'Each time I leave a place, the ghost who stayed splits off.' }]), segL(S.tour, 7, 13.2, [{ at: [0.1, 3.4], text: 'Each ghost is an agent with my background.' }, { at: [3.6, 6.1], text: 'Same me. Different city. Different life.' }]), segL(S.outro, 0, 8, [{ at: [0.2, 4.6], text: 'Real data, real places, a hundred runs of the world.' }])],
      },
      {
        length: '15s', platforms: ['Reels', 'TikTok', 'Shorts', 'X'], transition: tr, td: 0.4,
        segments: style === 'arcade'
          ? [seg(S.hook, 0, 6, { captions: [S.hook.captions[0], { at: [3.1, 5.9], text: 'One for every place I’ve lived.' }] }), segL(S.forks, 6, 11, [{ at: [0.1, 4.9], text: 'Every ghost splits off and lives on.' }]), segL(S.outro, 3.8, 8, [])]
          : [seg(S.hook, 1.5, 7.5, { captions: [S.hook.captions[0], { at: [4.6, 7.4], text: 'One for every place I’ve lived.' }] }), segL(S.forks, 5, 10, [{ at: [0.1, 4.9], text: 'Every ghost splits off and lives on.' }]), segL(S.outro, 3.8, 8, [])],
      },
    ]
  }

  return { arcade: make('arcade', A), classic: make('classic', C) }
}
