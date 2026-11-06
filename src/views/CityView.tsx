import { useEffect, useRef, useState } from 'react'
import { CityScene, type CityCam } from '../city/CityScene'
import { PLACE_BY_ID } from '../data/places'
import type { CameraMode, VisualStyle } from '../globe/GlobeScene'
import { clock, useYear } from '../lib/clock'
import type { Live } from '../live/useLive'
import type { SimResult } from '../sim/engine'
import type { WeatherTable } from '../sim/weather'
import { PlaceCard } from '../ui/PlaceCard'

const CAM: Record<CameraMode, CityCam> = { orbit: 'diorama', follow: 'street', tour: 'auto' }

interface Props {
  sim: SimResult
  weather: WeatherTable
  live: Live
  focusId: string | null
  style: VisualStyle
  mode: CameraMode
}

export function CityView({ sim, weather, live, focusId, style, mode }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<CityScene | null>(null)
  const [place, setPlace] = useState<string>('la')
  const [dio, setDio] = useState(false)
  const [banner, setBanner] = useState(0)
  const year = useYear()

  useEffect(() => {
    const s = new CityScene(host.current!)
    scene.current = s
    s.onPlace = (id) => { setPlace(id); setBanner((b) => b + 1) }
    s.onDiorama = setDio
    s.setYear(clock.get().t)
    const off = clock.subscribe(() => s.setYear(clock.get().t))
    return () => { off(); s.dispose(); scene.current = null }
  }, [])

  useEffect(() => { scene.current?.setData(sim, weather, live.signals) }, [sim, weather, live.signals])
  useEffect(() => { scene.current?.setStyle(style) }, [style])
  useEffect(() => { scene.current?.setFocus(focusId) }, [focusId])
  useEffect(() => { scene.current?.setCam(CAM[mode]) }, [mode])

  const p = PLACE_BY_ID[place]
  return (
    <div className="city" ref={host}>
      <div className="city-banner" key={banner}>
        <div className="cb-kicker">{p.kind === 'lived' ? 'Lived here' : p.kind === 'waypoint' ? 'Waypoint' : 'A ghost moved here'}</div>
        <div className="cb-city">{p.city}</div>
        <div className="cb-country">{p.country}</div>
      </div>
      <div className={'city-card' + (dio ? ' on' : '')}>
        <PlaceCard placeId={place} year={year} sim={sim} weather={weather} signals={live.signals} style={style} />
      </div>
    </div>
  )
}
