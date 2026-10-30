import { useSyncExternalStore } from 'react'
import { CLOCK } from '../data/eras'

// The shared clock (PRD 2: one clock, 2008 to 2031). `t` is fractional so
// every view can animate smoothly between yearly frames.

export interface ClockState {
  t: number
  playing: boolean
  speed: number // years per second
}

let state: ClockState = { t: CLOCK.start, playing: true, speed: 0.55 }
const listeners = new Set<() => void>()

export const clock = {
  get: () => state,
  set(patch: Partial<ClockState>) {
    state = { ...state, ...patch }
    if (state.t < CLOCK.start) state.t = CLOCK.start
    if (state.t > CLOCK.end) state.t = CLOCK.end
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

let last = performance.now()
function tick(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (state.playing) {
    let t = state.t + dt * state.speed
    if (t >= CLOCK.end) t = CLOCK.end
    clock.set({ t, playing: t < CLOCK.end })
  }
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

export function useClock<T>(select: (s: ClockState) => T): T {
  return useSyncExternalStore(clock.subscribe, () => select(state))
}

export const useYear = () => useClock((s) => Math.floor(s.t))

// Capture hook: scripts/capture.mjs drives the clock directly when ?capture=1
if (new URLSearchParams(window.location.search).has('capture')) {
  ;(window as unknown as { __clock: typeof clock }).__clock = clock
}
