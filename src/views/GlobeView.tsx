import { useEffect, useRef } from 'react'
import { GlobeScene, type CameraMode, type VisualStyle } from '../globe/GlobeScene'
import { clock } from '../lib/clock'
import type { LandData } from '../lib/geo'
import type { Live } from '../live/useLive'
import type { SimResult } from '../sim/engine'

interface Props {
  sim: SimResult
  land: LandData | null
  live: Live
  mode: CameraMode
  focusId: string | null
  active: boolean
  onSelect: (id: string) => void
  style: VisualStyle
}

export function GlobeView({ sim, land, live, mode, focusId, active, onSelect, style }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<GlobeScene | null>(null)

  useEffect(() => {
    const s = new GlobeScene(host.current!)
    scene.current = s
    s.setYear(clock.get().t)
    const off = clock.subscribe(() => s.setYear(clock.get().t))
    return () => { off(); s.dispose(); scene.current = null }
  }, [])

  useEffect(() => { scene.current?.setStyle(style) }, [style])
  useEffect(() => { if (land) { scene.current?.setLand(land); scene.current?.setStyle(scene.current.style) } }, [land])
  useEffect(() => { scene.current?.setSim(sim) }, [sim])
  useEffect(() => { scene.current?.setQuakes(live.quakes) }, [live.quakes])
  useEffect(() => { if (live.iss) scene.current?.setISS(live.iss) }, [live.iss])
  useEffect(() => { scene.current?.setSun(live.sun.lat, live.sun.lon) }, [live.sun])
  useEffect(() => { scene.current?.setMode(mode, focusId) }, [mode, focusId])
  useEffect(() => { scene.current?.setActive(active) }, [active])
  useEffect(() => { if (scene.current) scene.current.onSelect = onSelect }, [onSelect])

  return <div className="globe" ref={host} />
}
