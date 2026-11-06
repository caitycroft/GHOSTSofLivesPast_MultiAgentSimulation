import type { IndustryId } from './eras'

// Narrative templates per industry and era for the ghosts (PRD 3.2). First
// person, plain. {city} and {role} are filled in by the simulation. The real
// thread uses the lived lines in lived.ts instead. Rewrite freely.
type Templates = Partial<Record<string, string[]>>

export const NARRATIVE: Record<IndustryId, Templates> = {
  film: {
    festival: ['In {city} I read scripts until the slate felt like a calendar.', 'I learned how a studio says yes in {city}.'],
    platform: ['The studio in {city} started asking how a story would trend.', 'Every pitch in {city} now came with a streaming number.'],
    pandemic: ['Every set in {city} went dark and we cut films over video calls.', 'In {city} the release calendar became a streaming queue.'],
    reset: ['In {city} the writers walked out and I walked out with them.', 'Budgets shrank in {city} and the slate got braver.'],
    ai: ['In {city} the tools started drawing the storyboards.', 'I spent the year in {city} teaching a model what a good cut feels like.'],
    worldmodels: ['In {city} we stopped shooting places and started generating them.', 'My last picture in {city} was a world you could walk around in.'],
  },
  music: {
    festival: ['In {city} the drop was the whole economy.', 'Every weekend in {city} was a bigger stage.'],
    platform: ['In {city} the playlist became the radio.', 'I wrote for other voices in {city} and watched the streams climb.'],
    pandemic: ['Every room in {city} closed, so I played to a webcam.', 'In {city} I made a record nobody could dance to yet.'],
    reset: ['The rooms in {city} reopened and everyone came at once.', 'In {city} touring paid again, louder than ever.'],
    ai: ['In {city} the machines learned to sing and I learned to direct them.', 'A model in {city} finished my demo better than I would have.'],
    worldmodels: ['In {city} the show became a world you could walk into.', 'I play shows in {city} that exist in three places at once.'],
  },
  platforms: {
    festival: ['In {city} I fixed bugs for a startup no one had heard of yet.', 'I learned in {city} that software is a story told to a machine.'],
    platform: ['As a {role} in {city} I watched a billion people scroll past my work.', 'The growth chart in {city} only went one way.'],
    pandemic: ['The whole world logged in at once and my pager never stopped in {city}.', 'Our usage doubled in {city} while the streets emptied.'],
    reset: ['In {city} the layoffs came by calendar invite.', 'We cut the roadmap in half in {city} and shipped the half that mattered.'],
    ai: ['My product in {city} was rebuilt around a chat box in six weeks.', 'In {city} every roadmap started with the word model.'],
    worldmodels: ['In {city} the interface became a place instead of a page.', 'We shipped the first app in {city} you could stand inside.'],
  },
  venture: {
    platform: ['In {city} I learned to read a cap table before a script.', 'Every coffee in {city} was a pitch.'],
    pandemic: ['In {city} money was free and every deck was a decade early.', 'I wrote checks in {city} over video for founders I never met.'],
    reset: ['In {city} the markdowns arrived before the spring.', 'The rate hikes hit {city} and half my portfolio went quiet.'],
    ai: ['In {city} every deal was an AI deal.', 'As a {role} in {city} I bet on the people building the compute.'],
    worldmodels: ['In {city} I fund the people who simulate the world.', 'My best investment in {city} was a company that builds places.'],
  },
  xr: {
    festival: ['In {city} I built levels for games that nobody played.', 'I learned to light a room that did not exist in {city}.'],
    platform: ['In {city} I strapped a headset to strangers and watched them gasp.', 'Every investor in {city} wanted a demo, then a different demo.'],
    pandemic: ['Our virtual stage in {city} sold out while the real ones closed.', 'In {city} I held a concert for avatars from my bedroom.'],
    reset: ['In {city} the metaverse budgets vanished and the good builders stayed.', 'We kept building in {city} after the hype left the room.'],
    ai: ['In {city} the world builders became world prompters.', 'The headset got lighter in {city} and the worlds got smarter.'],
    worldmodels: ['In {city} I finally walked through a world that grew as I looked at it.', 'Everything I built in {city} for a decade turned out to be practice.'],
  },
  web3: {
    platform: ['In {city} I read white papers until sunrise.', 'I learned in {city} that a ledger is also a story.'],
    pandemic: ['In {city} I made more in a month than in a year, on paper.', 'Everyone I knew in {city} had a wallet and a theory.'],
    reset: ['In {city} the tokens went to zero and the friends stayed.', 'Crypto winter in {city} lasted longer than the real one.'],
    ai: ['In {city} the tokens went quiet and the GPUs got loud.', 'I rewrote my thesis in {city} and called it compute.'],
    worldmodels: ['What was left of the wave in {city} became plumbing.', 'In {city} I own nothing on chain and everything in the model.'],
  },
  ai: {
    platform: ['In {city} my models ranked what everyone else saw.', 'I trained networks in {city} that nobody believed would learn to see.'],
    pandemic: ['In {city} we modeled the spread and watched the curve.', 'The lab in {city} stayed open on video calls.'],
    reset: ['In {city} a chatbot changed the subject of every meeting.', 'As a {role} in {city} I watched a demo become a company in a weekend.'],
    ai: ['As a {role} in {city} I sit between the model and the world.', 'In {city} the demo became the product overnight.'],
    worldmodels: ['In {city} the models learned physics and started building places.', 'I help the world models in {city} meet the people who need them.'],
  },
  worldmodels: {
    reset: ['In {city} I trained a model to imagine the next frame of a street.', 'Simulation stopped being a game in {city} and started being a tool.'],
    ai: ['In {city} I capture real places as splats and let models dream the rest.', 'As a {role} in {city} I build worlds that remember the people in them.'],
    worldmodels: ['In {city} we render the planet one splat at a time.', 'As a {role} in {city} I build the places the models imagine.'],
  },
  local: {
    festival: ['I stayed in {city} and learned a trade with my hands.', 'In {city} I knew everyone and everyone knew me.'],
    platform: ['In {city} I opened something small and posted it online.', 'My corner of {city} started showing up on maps.'],
    pandemic: ['In {city} I kept the doors open as long as I could.', 'The neighborhood in {city} ordered through my window.'],
    reset: ['Energy prices doubled in {city} and the whole town learned to budget.', 'In {city} the tourists came back all at once.'],
    ai: ['In {city} a chatbot started answering my customers at night.', 'The tools found me in {city} before I went looking for them.'],
    worldmodels: ['In {city} my work exists twice now, once in the world and once in the model.', 'I am still in {city}, and that turned out to be a choice.'],
  },
}

export function narrate(industry: IndustryId, eraId: string, city: string, role: string, seed: number): string {
  const byEra = NARRATIVE[industry]
  const options = byEra[eraId] ?? Object.values(byEra).find(Boolean) ?? ['I was in {city}.']
  const line = options[Math.abs(seed) % options.length]
  return line.replaceAll('{city}', city).replaceAll('{role}', role.toLowerCase())
}
