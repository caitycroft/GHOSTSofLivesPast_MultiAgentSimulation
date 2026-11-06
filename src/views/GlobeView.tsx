import { useEffect, useRef, useState } from 'react'
import { GlobeScene, type CameraMode, type VisualStyle } from '../globe/GlobeScene'
import { clock, useYear } from '../lib/clock'
import type { LandData } from '../lib/geo'
import type { Live } from '../live/useLive'
import type { SimResult } from '../sim/engine'
import type { WeatherTable } from '../sim/weather'
import { PlaceCard } from '../ui/PlaceCard'

interface Props {
  sim: SimResult
  weather: WeatherTable
  land: LandData | null
  live: Live
  mode: CameraMode
  focusId: string | null
  active: boolean
  onSelect: (id: string) => void
  style: VisualStyle
}

export function GlobeView({ sim, weather, land, live, mode, focusId, active, onSelect, style }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const scene = useRef<GlobeScene | null>(null)
  const [popup, setPopup] = useState<string | null>(null)
  const year = useYear()

  useEffect(() => {
    const s = new GlobeScene(host.current!)
    scene.current = s
    s.popupEl = pop.current
    s.onPopup = setPopup
    s.onPlace = (id) => s.pinPlace(s.pinnedPlace === id ? null : id)
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

  return (
    <div className="globe" ref={host}>
      <div className="popup-anchor" ref={pop}>
        {popup && <PlaceCard placeId={popup} year={year} sim={sim} weather={weather} signals={live.signals} style={style} />}
      </div>
    </div>
  )
}
