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

Space plays and pauses, arrow keys step a year, Escape clears focus.

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
