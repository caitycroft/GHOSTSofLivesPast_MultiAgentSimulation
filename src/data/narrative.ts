import type { IndustryId } from './eras'

// Narrative templates per industry and era (PRD 3.2). First person, plain.
// {city} and {role} are filled in by the simulation. Rewrite freely.
type Templates = Partial<Record<string, string[]>>

export const NARRATIVE: Record<IndustryId, Templates> = {
  film: {
    film: ['In {city} I carried cables for people who made the light.', 'I learned the grammar of a cut in {city}.'],
    platform: ['The studio in {city} started asking how a story would trend.', 'My reel became a feed and my feed became a job.'],
    pandemic: ['Every set in {city} went dark and I wrote in the kitchen.', 'We shot a whole film on laptops from {city}.'],
    decentral: ['Someone offered to put my film on a chain in {city}.', 'I sold one frame of a short as a token and felt strange about it.'],
    ai: ['In {city} the tools started drawing the storyboards for me.', 'I spent the year teaching a model what a good cut feels like.'],
    worldmodels: ['In {city} we stopped shooting places and started generating them.', 'My last film was a world you could walk around in.'],
  },
  platforms: {
    film: ['In {city} I fixed bugs for a startup no one had heard of yet.', 'I learned that software is a story told to a machine.'],
    platform: ['As a {role} in {city} I watched a billion people scroll past my work.', 'The growth chart in {city} only went one way.'],
    pandemic: ['The whole world logged in at once and my pager never stopped in {city}.', 'Our usage doubled while the streets in {city} emptied.'],
    decentral: ['Half my team in {city} left to start a DAO.', 'I kept the servers running while everyone talked about owning the internet.'],
    ai: ['My product in {city} was rebuilt around a chat box in six weeks.', 'In {city} every roadmap started with the word model.'],
    worldmodels: ['In {city} the interface became a place instead of a page.', 'We shipped the first app you could stand inside.'],
  },
  xr: {
    film: ['In {city} I built levels for games that nobody played.', 'I learned to light a room that did not exist.'],
    platform: ['In {city} I strapped a headset to strangers and watched them gasp.', 'Every investor in {city} wanted a demo, then a different demo.'],
    pandemic: ['Our virtual stage in {city} sold out while the real ones closed.', 'I held a concert for ten thousand avatars from my bedroom.'],
    decentral: ['In {city} we sold land in a world that was still loading.', 'The metaverse had a thousand landlords and no residents.'],
    ai: ['In {city} the world builders became world prompters.', 'The headset got lighter and the worlds got smarter.'],
    worldmodels: ['In {city} I finally walked through a world that grew as I looked at it.', 'Everything I built for a decade turned out to be practice.'],
  },
  web3: {
    platform: ['In {city} I read white papers until sunrise.', 'I learned that a ledger is also a story.'],
    pandemic: ['In {city} I made more in a month than I had in a year, on paper.', 'Everyone I knew had a wallet and a theory.'],
    decentral: ['As a {role} in {city} I signed term sheets in a chat window.', 'In {city} the parties were on yachts and the governance was on Discord.'],
    ai: ['In {city} the tokens went quiet and the GPUs got loud.', 'I rewrote my thesis in {city} and called it compute.'],
    worldmodels: ['In {city} I funded the people who simulate the world instead of owning it.', 'What was left of the wave became plumbing.'],
  },
  ai: {
    film: ['In {city} I trained small networks on a borrowed GPU.', 'Nobody believed the machines would learn to see.'],
    platform: ['In {city} my models ranked what everyone else saw.', 'I built recommendation engines and quietly shaped taste.'],
    pandemic: ['In {city} we modeled the spread and watched the curve.', 'The lab in {city} stayed open on video calls.'],
    decentral: ['In {city} I watched a language model write its first good paragraph.', 'Everyone was chasing tokens and I was chasing tokens of a different kind.'],
    ai: ['As a {role} in {city} I sat between the model and the world.', 'In {city} the demo became the product overnight.'],
    worldmodels: ['In {city} the models learned physics and started building places.', 'I help the world models meet the people who need them.'],
  },
  worldmodels: {
    ai: ['In {city} I trained a model to imagine the next frame of a city.', 'Simulation stopped being a game and started being a tool.'],
    worldmodels: ['As a {role} in {city} I build worlds that remember the people in them.', 'In {city} we render the planet one splat at a time.'],
  },
  local: {
    film: ['I stayed in {city} and learned a trade with my hands.', 'In {city} I knew everyone and everyone knew me.'],
    platform: ['In {city} I opened a small shop and posted it online.', 'My corner of {city} started showing up on maps.'],
    pandemic: ['In {city} I kept the doors open as long as I could.', 'The neighborhood in {city} ordered through my window.'],
    decentral: ['In {city} a stranger paid me in a coin I did not understand.', 'I watched the boom from the counter in {city}.'],
    ai: ['In {city} a chatbot started answering my customers at night.', 'The tools found me in {city} before I went looking for them.'],
    worldmodels: ['In {city} my shop exists twice now, once in the world and once in the model.', 'I am still in {city}, and that turned out to be a choice.'],
  },
}

export function narrate(industry: IndustryId, eraId: string, city: string, role: string, seed: number): string {
  const byEra = NARRATIVE[industry]
  const options = byEra[eraId] ?? byEra[Object.keys(byEra).pop()!] ?? ['I was in {city}.']
  const line = options[Math.abs(seed) % options.length]
  return line.replaceAll('{city}', city).replaceAll('{role}', role.toLowerCase())
}
