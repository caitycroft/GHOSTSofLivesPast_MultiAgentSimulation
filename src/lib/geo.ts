import * as THREE from 'three'
import { feature, mesh } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { MultiLineString, FeatureCollection, Feature, Geometry, Position } from 'geojson'

// Natural Earth land (via world-atlas), rasterized once into an equirectangular
// mask that both the globe point cloud and the 2D map sample from.

export interface LandData {
  mask: { width: number; height: number; data: Uint8ClampedArray }
  coast: Position[][]
  isLand: (lat: number, lon: number) => boolean
}

let landPromise: Promise<LandData> | null = null

export function loadLand(): Promise<LandData> {
  if (landPromise) return landPromise
  landPromise = (async () => {
    const topo = (await import('world-atlas/land-50m.json')).default as unknown as Topology<{ land: GeometryCollection }>
    const land = feature(topo, topo.objects.land) as unknown as FeatureCollection | Feature<Geometry>
    const coastMesh = mesh(topo, topo.objects.land) as unknown as MultiLineString

    const width = 2048
    const height = 1024
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#fff'
    const features = 'features' in land ? land.features : [land]
    for (const f of features) {
      const g = f.geometry
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
      for (const poly of polys) {
        ctx.beginPath()
        for (const ring of poly) {
          // Split rings that cross the antimeridian so they do not smear
          let prevLon: number | null = null
          ring.forEach(([lon, lat], i) => {
            const x = ((lon + 180) / 360) * width
            const y = ((90 - lat) / 180) * height
            if (i === 0 || (prevLon !== null && Math.abs(lon - prevLon) > 180)) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
            prevLon = lon
          })
          ctx.closePath()
        }
        ctx.fill('evenodd')
      }
    }
    const img = ctx.getImageData(0, 0, width, height)
    const data = new Uint8ClampedArray(width * height)
    for (let i = 0; i < width * height; i++) data[i] = img.data[i * 4]
    const isLand = (lat: number, lon: number) => {
      const x = Math.floor(((lon + 180) / 360) * width) % width
      const y = Math.min(height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * height)))
      return data[y * width + x] > 127
    }
    return { mask: { width, height, data }, coast: coastMesh.coordinates, isLand }
  })()
  return landPromise
}

export function latLonToVec3(lat: number, lon: number, r = 1, out = new THREE.Vector3()): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return out.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}
