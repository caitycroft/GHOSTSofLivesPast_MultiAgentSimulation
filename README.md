# Ghosts of Lives Past

**The Unlived Lives: a spatial multi agent simulation of the lives I could have lived, in every place I have lived.**

One thread is the life that happened: USC (Cinematic Arts, Narrative Studies, Photography) from 2010, studio internships and DJing as Parker + Barrow, touring between Los Angeles and Stockholm, venture capital through the pandemic between LA, Hawaii and Utah, NYU ITP and IMA across New York, London, Berlin, Oslo and Shanghai, and Los Angeles, New York and San Francisco since 2025.

Every other thread is a ghost: the same person, with the same background, who stayed in one of those places at the moment she was there. Ghosts share the real thread until their fork, then each becomes an agent with its own choices. All ten share one clock (2010 to 2031) and one world, so they meet in cities, pull on each other's decisions, and pivot when an industry turns. The piece observes; it does not rank.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Build for Vercel (static, no server, no API keys; Vercel detects Vite, output is `dist/`):

```bash
npm run build
```

## Views and looks

| Key | View | What it is |
|---|---|---|
| 1 | Globe | A planet that rebuilds itself from 120,000 points. Time is altitude: threads rise as the years pass, braid where lives share a city, and hop across the map. Ghosts are faint strands until their fork. Place cards pop up where the focused life is. |
| 2 | City | The simulation as a world to fly through. One year is 120 units of street; the street becomes whatever city the focused life is in, with towers built from that city's industries. Gantries mark the years, billboards carry world events and World Bank receipts, every self is a hover ship, and ghosts split off at their fork and peel away when lives part. Orbit rises into an isometric diorama of the current city. |
| 3 | Loom | The 2D map: each life coils around its cities like tree rings and weaves over the others. |
| 4 | Timeline | A ribbon past a fixed playhead: the eras, macro, geopolitics, technology, culture, the life that happened, where she was, and where each ghost forks. Hover any event for its receipt. |
| 5 | Lives | One card per self: route, every choice (shared and unlived), now, heading to 2031, the odds across 100 runs. |
| 6 | Split | Two lives side by side on one clock. |
| 7 | How it works | Inputs, the model and its scoring rule, outputs, and a live row of the output table. |
| 8 | Data | Industry weather heatmap with receipts, GDP growth and inflation per country, attention per industry, the selves this year, sources. |

Three looks, switchable at the top right: **Classic** (cyanotype light), **Arcade** (neon wireframe, magenta, cyan and green on black), and **Void** (a dithered retro console, a new four colour palette per era).

Keys: Space play and pause, arrows step a year, 1 to 8 views, C / A / V looks, O / F / T camera (orbit, follow, tour), H hides the interface, Escape clears focus. URL flags: `?style=arcade`, `?view=city`, `?mode=tour`, `?focus=sto`, `?speed=0.3`, `?cinema=1`.

## The model

- `src/data/lived.ts`: the life that happened, year by year: route, role, industry, the five real forks.
- `src/data/selves.ts`: the real thread and nine ghosts, each with its fork (year and place).
- `src/data/places.ts`: ten lived places with the career paths that were open there, waypoints (Burning Man, Lightning in a Bottle, the High Coast, Mallorca, Svalbard) and hubs a ghost might move to.
- `src/data/eras.ts` and `src/data/events.ts`: seven eras from 2010 to 2031 and the macro, geopolitical, tech and culture events, each with a Wikipedia receipt (`npm run check-events`).
- `src/sim/weather.ts`: one number per industry per year, from the authored era baseline bent by Wikipedia attention and World Bank GDP growth, with receipts.
- `src/sim/engine.ts`: the agents. At every fork an option scores `fit + 0.9 x weather + 0.4 x local economy + risk + pull of others - distance + stay`; choices are drawn with a softmax; between forks craft, network and capital drift; lives in the same city raise each other's network; a life can pivot when its industry turns. 100 runs; the canonical path is the most common one, chosen step by step.

## Real data

`npm run snapshot` pulls every source and writes `public/data/snapshot.json` with the date it was fetched. The app loads the snapshot first, so it runs on real numbers offline, then refreshes the real time feeds in the browser.

| Signal | Source | Used for |
|---|---|---|
| GDP growth, inflation, internet use, 13 countries | World Bank API | Local economy at every fork, city connection, place cards, receipts |
| Attention per industry, 16 topics, 2015 on | Wikimedia pageviews API | Bends each industry's yearly weather |
| Earthquakes, past day | USGS | Pulses on the globe |
| ISS position | wheretheiss.at | A live point at true altitude |
| Weather in every lived city | Open-Meteo | Data view |
| Sun position | Computed (NOAA equations) | Real day and night |

## The films

The walkthrough videos are made from the app itself, frame by frame on a virtual clock, so motion stays smooth on any machine.

1. `scripts/shots.mjs` lists the shots. `node scripts/capture.mjs --aspect 16x9 --prefix a_` renders the arcade shots (add `--software` without a GPU).
2. `node media/facts.cjs` (built from `scripts/facts.ts`) runs the same simulation on the same snapshot and records the outcomes the captions quote.
3. `scripts/cuts.mjs` is the edit list for every film and length; `node scripts/cut.mjs` joins the shots with transitions, burns captions into the platform safe zones, and writes matching `.srt` files and `VO_SCRIPTS.md`.

Needs ffmpeg with libass, Playwright Chromium, and the caption fonts in `media/fonts` (Liberation Sans and Press Start 2P as .ttf).

## Stack

React 18, TypeScript, Vite, three.js (custom shaders, fat lines, UnrealBloom, film grain, a dithering pass), topojson with Natural Earth land.
