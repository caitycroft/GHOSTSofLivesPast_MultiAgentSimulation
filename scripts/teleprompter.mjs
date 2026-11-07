// Builds the voiceover teleprompter page from media/final/scripts.json, so
// the lines it times are exactly the captions burned into each video.
//   node scripts/teleprompter.mjs  ->  media/final/teleprompter.html

import { readFileSync, writeFileSync } from 'node:fs'

const scripts = JSON.parse(readFileSync('media/final/scripts.json', 'utf8'))
const data = JSON.stringify(scripts).replace(/</g, '\\u003c')

const html = `<title>Lives Past Teleprompter</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap">
<style>
  /* Layout: a reading stage on top (the line to say now, large), the full script below.
     One dark world on purpose: read in a dim room, next to a recording screen. */
  :root {
    color-scheme: dark;
    --ink: #07080d;
    --stage: #0d0f17;
    --rule: #232838;
    --text: #eef2ff;
    --dim: #8b93ab;
    --now: #ffb36b;      /* the warm colour of the life that happened */
    --next: #7cc4ff;     /* the cool colour of the ghosts */
    --read: Arial, "Liberation Sans", "Helvetica Neue", sans-serif;
    --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  }
  html, body { height: 100%; }
  body { background: var(--ink); color: var(--text); font-family: var(--read); font-size: 16px; line-height: 1.45; }
  .wrap { max-width: 1100px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 20px 60px; display: grid; gap: 22px; }
  header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 20px; }
  h1 { margin: 0; font-weight: 700; text-decoration: underline; text-underline-offset: 0.18em; font-size: 1.35rem; letter-spacing: 0.02em; text-wrap: balance; }
  header p { margin: 0; color: var(--dim); max-width: 60ch; }
  .picker { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .picker button { font: inherit; text-align: left; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--rule); background: var(--stage); color: var(--text); cursor: pointer; display: grid; gap: 2px; }
  .picker button small { color: var(--dim); font-family: var(--mono); font-size: 0.75rem; }
  .picker button[aria-pressed="true"] { border-color: var(--now); box-shadow: inset 0 0 0 1px var(--now); }
  .picker button:focus-visible, .controls button:focus-visible { outline: 2px solid var(--next); outline-offset: 2px; }
  .stage { background: var(--stage); border: 1px solid var(--rule); border-radius: 14px; padding: clamp(18px, 4vw, 40px); display: grid; gap: 18px; min-height: 52vh; align-content: center; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-family: var(--mono); font-size: 0.8rem; color: var(--dim); font-variant-numeric: tabular-nums; }
  .meta b { color: var(--text); font-weight: 600; }
  .prev, .next { font-size: clamp(1.05rem, 2.6vw, 1.6rem); color: var(--dim); min-height: 1.5em; }
  .next { color: var(--next); opacity: 0.85; }
  .now { font-size: clamp(1.7rem, 5.2vw, 3.4rem); font-weight: 700; line-height: 1.22; text-wrap: balance; min-height: 2.5em; }
  .now.hook { color: var(--now); }
  .now.wait { color: var(--dim); font-weight: 400; }
  .count { font-size: clamp(4rem, 16vw, 9rem); font-weight: 700; color: var(--now); line-height: 1; font-variant-numeric: tabular-nums; }
  .linebar, .bar { height: 6px; border-radius: 3px; background: var(--rule); overflow: hidden; }
  .linebar i, .bar i { display: block; height: 100%; width: 0%; background: var(--now); }
  .bar i { background: var(--next); }
  .controls { display: flex; flex-wrap: wrap; gap: 10px; }
  .controls button { font: inherit; font-weight: 700; padding: 12px 20px; border-radius: 10px; border: 1px solid var(--rule); background: var(--ink); color: var(--text); cursor: pointer; min-width: 120px; }
  .controls button.primary { background: var(--now); border-color: var(--now); color: #1a0e02; }
  .hint { color: var(--dim); font-size: 0.9rem; }
  .script { display: grid; gap: 4px; }
  .script h2 { margin: 0 0 6px; font-weight: 700; text-decoration: underline; text-underline-offset: 0.18em; font-size: 1rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); }
  .files { font-family: var(--mono); font-size: 0.78rem; color: var(--dim); margin: 0 0 8px; overflow-wrap: anywhere; }
  .row { display: grid; grid-template-columns: 9.5em 1fr; gap: 14px; padding: 8px 10px; border-radius: 8px; }
  .row time { font-family: var(--mono); font-size: 0.85rem; color: var(--dim); font-variant-numeric: tabular-nums; padding-top: 2px; }
  .row p { margin: 0; max-width: 65ch; }
  .row.live { background: rgba(255, 179, 107, 0.1); }
  .row.hook p { font-weight: 700; color: var(--now); }
  @media (max-width: 560px) { .row { grid-template-columns: 1fr; gap: 2px; } }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<main class="wrap">
  <header>
    <h1>Ghosts of Lives Past, voiceover</h1>
    <p>Pick a video, press Start, and read the highlighted line. Lines appear exactly when the matching caption appears in the video, so your read lands in sync.</p>
  </header>

  <nav class="picker" id="picker" aria-label="Choose a video script"></nav>

  <section class="stage" aria-live="polite">
    <div class="meta"><span id="which"></span><span>time <b id="clock">00:00.0</b> of <b id="total"></b></span></div>
    <div class="bar"><i id="bar"></i></div>
    <div class="prev" id="prev"></div>
    <div class="now wait" id="now">Press Start for a three second count in.</div>
    <div class="linebar"><i id="linebar"></i></div>
    <div class="next" id="next"></div>
    <div class="controls">
      <button class="primary" id="go" type="button">Start</button>
      <button id="reset" type="button">Reset</button>
    </div>
    <div class="hint">Space starts and pauses, R resets. A beep counts you in; the video starts on the high beep. The bar under each line shows how much time it has left.</div>
  </section>

  <section class="script" id="script"></section>
</main>

<script>
  const SCRIPTS = ${data};
  const $ = (id) => document.getElementById(id);
  const fmt = (t) => String(Math.floor(t / 60)).padStart(2, '0') + ':' + (t % 60).toFixed(1).padStart(4, '0');
  let pick = 0;
  try { pick = Math.min(SCRIPTS.length - 1, Number(localStorage.getItem('glp-vo') || 0)); } catch (e) {}
  let state = 'idle', t = 0, last = 0, countFrom = 0, raf = 0, actx = null;

  function beep(freq, len) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0.18, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + len);
      o.start(); o.stop(actx.currentTime + len);
    } catch (e) {}
  }

  function renderPicker() {
    $('picker').innerHTML = '';
    SCRIPTS.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(i === pick));
      b.innerHTML = '<span>' + s.look + ', ' + s.length + '</span><small>' + Math.round(s.seconds) + ' seconds, ' + s.lines.length + ' lines</small>';
      b.onclick = () => { pick = i; try { localStorage.setItem('glp-vo', String(i)); } catch (e) {} reset(); renderPicker(); renderScript(); };
      $('picker').appendChild(b);
    });
  }

  function renderScript() {
    const s = SCRIPTS[pick];
    $('which').textContent = s.look + ', ' + s.length;
    $('total').textContent = fmt(s.seconds);
    const rows = s.lines.map((l, i) => '<div class="row' + (l.hook ? ' hook' : '') + '" id="row' + i + '"><time>' + fmt(l.t0) + ' to ' + fmt(l.t1) + '</time><p>' + l.text + '</p></div>').join('');
    const end = s.end != null ? '<div class="row"><time>' + fmt(s.end) + ' to ' + fmt(s.seconds) + '</time><p>Title card. Silence, or let the music carry it.</p></div>' : '';
    $('script').innerHTML = '<h2>Full script</h2><p class="files">' + s.files.join('<br>') + '</p>' + rows + end;
  }

  function show() {
    const s = SCRIPTS[pick];
    if (state === 'count') {
      const left = Math.ceil(3 - countFrom);
      $('now').className = 'now'; $('now').innerHTML = '<span class="count">' + left + '</span>';
      $('prev').textContent = ''; $('next').textContent = s.lines[0] ? s.lines[0].text : '';
      return;
    }
    $('clock').textContent = fmt(Math.min(t, s.seconds));
    $('bar').style.width = (100 * Math.min(1, t / s.seconds)) + '%';
    let cur = -1, nextI = 0;
    s.lines.forEach((l, i) => { if (t >= l.t0 && t < l.t1) cur = i; if (l.t0 <= t) nextI = i + 1; });
    document.querySelectorAll('.row').forEach((r) => r.classList.remove('live'));
    if (cur >= 0) {
      const l = s.lines[cur];
      $('now').className = 'now' + (l.hook ? ' hook' : '');
      $('now').textContent = l.text;
      $('linebar').style.width = (100 * (1 - (t - l.t0) / (l.t1 - l.t0))) + '%';
      $('prev').textContent = cur > 0 ? s.lines[cur - 1].text : '';
      $('next').textContent = s.lines[cur + 1] ? s.lines[cur + 1].text : '';
      const row = $('row' + cur); if (row) row.classList.add('live');
    } else {
      $('now').className = 'now wait';
      $('now').textContent = state === 'idle' ? 'Press Start for a three second count in.' : t >= s.seconds ? 'Done. Reset to go again.' : (s.end != null && t >= s.end ? 'Title card: stay quiet.' : 'Breathe.');
      $('linebar').style.width = '0%';
      $('prev').textContent = '';
      $('next').textContent = s.lines[nextI] ? s.lines[nextI].text : '';
    }
  }

  function frame(now) {
    const dt = (now - last) / 1000; last = now;
    if (state === 'count') {
      const before = Math.ceil(3 - countFrom);
      countFrom += dt;
      const after = Math.ceil(3 - countFrom);
      if (after !== before && after > 0) beep(660, 0.12);
      if (countFrom >= 3) { state = 'run'; t = 0; beep(1320, 0.25); }
    } else if (state === 'run') {
      t += dt;
      if (t >= SCRIPTS[pick].seconds) { state = 'done'; $('go').textContent = 'Start'; }
    }
    show();
    if (state === 'count' || state === 'run') raf = requestAnimationFrame(frame);
  }

  function go() {
    if (state === 'run' || state === 'count') { state = 'paused'; $('go').textContent = 'Resume'; cancelAnimationFrame(raf); return; }
    if (state === 'paused') { state = 'run'; } else { state = 'count'; countFrom = 0; t = 0; beep(660, 0.12); }
    $('go').textContent = 'Pause';
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function reset() { cancelAnimationFrame(raf); state = 'idle'; t = 0; $('go').textContent = 'Start'; show(); }

  $('go').onclick = go;
  $('reset').onclick = reset;
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); go(); }
    if (e.key === 'r' || e.key === 'R') reset();
  });
  renderPicker(); renderScript(); show();
</script>
`
writeFileSync('media/final/teleprompter.html', html)
console.log('wrote media/final/teleprompter.html')
