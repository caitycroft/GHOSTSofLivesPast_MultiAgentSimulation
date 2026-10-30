# Ghosts of Lives Past

**The Unlived Lives: a spatial multi agent simulation of the lives that could have been lived.**

Eight versions of one person, one per place, each making three real choices (at eighteen, twenty five and thirty) inside the actual timeline of film, platforms, the pandemic, the decentralized wave, AI and world models. Every self is an agent on one shared clock (2008 to 2031) in one shared world. They meet in cities, pull on each other's choices, and pivot when the weather of their industry turns. The piece observes; it does not rank.

## Run it

```bash
npm install
npm run dev
```

Build for Vercel (static, no server, no API keys):

```bash
npm run build
```

Vercel detects Vite automatically. Output is `dist/`.

## Views

| Key | View | What it is |
|---|---|---|
| 1 | Flythrough | three.js globe that reconstructs itself from scattered points. Time is altitude: threads rise off the planet as the clock runs, braid where selves share a city, and arc between cities. Orbit, Follow (chase camera on one self) and Tour (hands off from self to self). |
| 2 | Loom | 2D dotted world. Each thread coils outward around its city like tree rings and weaves over and under the others. Hover a head for its year and receipts. |
| 3 | Life cards | One tarot style card per self: route, three choices as glyphs, now (2026), heading (2031), odds across 100 runs, the one sentence. Click for the full year by year timeline. |
| 4 | Split | Two selves side by side on the same clock. |
| 5 | Dashboard | Live Earth, cast city weather, industry weather heatmap with receipts on hover, raw attention and macro signals, the selves this year, path distributions, source status. |

Keys: Space plays and pauses, arrow keys step a year, 1 to 5 switch views, O / F / T pick the camera, V toggles Void mode, H hides the interface (cinema), Escape clears focus.

URL flags: `?style=void`, `?cinema=1`, `?view=loom`, `?mode=tour`, `?speed=0.3`.

## Void mode

A toggle (top right, or V) that turns the whole piece into a retro console. The globe renders through a post pass that drops it into pixel blocks, ordered dithers it to a four colour palette, and adds scanlines and a slight CRT bulge; saturated light such as the threads keeps its hue. Each era becomes a stage with its own palette: amber monitor, CGA, handheld green, synth grid, white phosphor, green phosphor. The loom renders at half resolution and upscales pixelated, city rings become hexagons, the chorus line types out like a game dialogue box under a HUD, and the interface switches to a pixel font (Press Start 2P, bundled locally). The default cyanotype look stays in Arial.

## Walkthrough videos

`scripts/capture.mjs` records frame accurate videos on a virtual clock, so motion is smooth even on a slow machine. Two presets:

- `technical`: 16:9 with captions, every view, receipts on hover, Void mode at the end.
- `artsy`: 9:16 for Reels, interface hidden, tour camera, the look flipping between cyanotype and Void at each era.

```bash
npm run build && npx vite preview --port 4173
```

```bash
node scripts/capture.mjs --preset technical --out media/technical.mp4
```

```bash
node scripts/capture.mjs --preset artsy --out media/artsy.mp4
```

Needs ffmpeg and Playwright Chromium (`npx playwright install chromium`). Add `--software` on a machine without a GPU. Record on a machine with open internet so the live feeds show up in the cut.

## Real world data

All sources are keyless and CORS friendly, fetched in the browser. Slow sources cache for a day in localStorage. If a source is down, the piece runs on the authored baseline and says so.

| Signal | Source | Used for |
|---|---|---|
| Sun position | Computed (NOAA solar position equations) | Real day and night on the globe and the loom |
| Earthquakes, past day, M2.5+ | USGS GeoJSON feed | Pulsing rings on the planet, dashboard |
| ISS position | wheretheiss.at | Live point and orbit trail at true altitude |
| Current weather per city | Open-Meteo | Dashboard |
| Attention per industry | Wikimedia pageviews API | Year over year growth bends each industry's weather (2015 on) |
| World GDP growth | World Bank NY.GDP.MKTP.KD.ZG | Macro pressure on every industry, strongest on film and local |
| Share of each country online | World Bank IT.NET.USER.ZS | How connected each city is each year |

## The model (PRD Part 3)

- `src/data/selves.ts` SELF table. **Draft cast.** The places, starting attributes, the real self's lived choices and the eight sentences are placeholders until the notebook lines in PRD Part 6 are filled in.
- `src/data/places.ts` PLACE table: sixteen cities, industries present, cost band, base connection.
- `src/data/eras.ts` ERA table: six eras, their light, and the authored baseline weather.
- `src/data/branches.ts` BRANCH table: three branches at each of the three decision points (27 paths).
- `src/data/narrative.ts` First person narrative templates per industry and era. Rewrite freely.
- `src/sim/weather.ts` Builds the per year, per industry weather from baseline plus live signals, with receipts.
- `src/sim/engine.ts` The agent layer. At each decision a self weighs fit, weather, risk appetite and the pull of other selves already in a city, then chooses with some randomness. Between decisions craft, network and capital drift; selves in the same city in the same year raise each other's network; after thirty a self can pivot when its industry turns. 100 runs give the distribution; the canonical world replays each self's most common path. The PATH table is the output.

## Stack

React 18, TypeScript, Vite, three.js (custom shaders, UnrealBloom, film grain and aberration pass), topojson with Natural Earth land via world-atlas.
