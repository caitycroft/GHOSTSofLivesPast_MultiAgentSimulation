import * as THREE from 'three'
import { CLOCK } from '../data/eras'
import { PLACE_BY_ID } from '../data/places'
import type { PathRow } from '../sim/engine'
import { latLonToVec3 } from '../lib/geo'

// Time is altitude: every thread rises off the planet as the clock runs, so the
// whole run reads as a loom of light standing on the globe (PRD 4.2, idea 1).
// Selves that share a city braid around the same axis; moves are great arcs.

export const R0 = 1.015
export const RISE = 0.0175

const up = new THREE.Vector3(0, 1, 0)
const dirCache = new Map<string, { d: THREE.Vector3; e1: THREE.Vector3; e2: THREE.Vector3 }>()

function basis(placeId: string) {
  let b = dirCache.get(placeId)
  if (!b) {
    const p = PLACE_BY_ID[placeId]
    const d = latLonToVec3(p.lat, p.lon, 1)
    const e1 = new THREE.Vector3().crossVectors(d, up).normalize()
    const e2 = new THREE.Vector3().crossVectors(d, e1).normalize()
    b = { d, e1, e2 }
    dirCache.set(placeId, b)
  }
  return b
}

const ease = (s: number) => s * s * (3 - 2 * s)
const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpE1 = new THREE.Vector3()
const tmpE2 = new THREE.Vector3()

export function radiusAt(t: number) {
  return R0 + (t - CLOCK.start) * RISE
}

export function threadPoint(rows: PathRow[], selfIdx: number, t: number, out = new THREE.Vector3()): THREE.Vector3 {
  const f = Math.max(0, Math.min(rows.length - 1, t - CLOCK.start))
  const i = Math.min(rows.length - 2, Math.floor(f))
  const s = Math.max(0, Math.min(1, f - i))
  const a = basis(rows[i].place)
  const b = basis(rows[Math.min(rows.length - 1, i + 1)].place)
  let r = radiusAt(t)
  if (a === b) {
    tmpA.copy(a.d)
    tmpE1.copy(a.e1)
    tmpE2.copy(a.e2)
  } else {
    const k = ease(s)
    const angle = a.d.angleTo(b.d)
    // Spherical interpolation of the direction, with the arc lifted by distance
    const sinA = Math.sin(angle) || 1
    const wa = Math.sin((1 - k) * angle) / sinA
    const wb = Math.sin(k * angle) / sinA
    tmpA.copy(a.d).multiplyScalar(wa).add(tmpB.copy(b.d).multiplyScalar(wb)).normalize()
    tmpE1.copy(a.e1).lerp(b.e1, k).normalize()
    tmpE2.copy(a.e2).lerp(b.e2, k).normalize()
    r += Math.sin(Math.PI * k) * (0.04 + angle * 0.16)
  }
  const phi = t * 2.4 + selfIdx * 0.785
  const braid = 0.012 * r
  return out
    .copy(tmpA)
    .multiplyScalar(r)
    .addScaledVector(tmpE1, Math.cos(phi) * braid)
    .addScaledVector(tmpE2, Math.sin(phi) * braid)
}

// A tube whose every vertex knows which year it belongs to, so a shader can
// draw it in as the clock runs. Parallel transport frames keep it untwisted.
export function buildThreadGeometry(rows: PathRow[], selfIdx: number, radius: number, stepsPerYear = 24, radial = 6) {
  const pts: THREE.Vector3[] = []
  const years: number[] = []
  const total = (rows.length - 1) * stepsPerYear
  for (let k = 0; k <= total; k++) {
    const t = CLOCK.start + k / stepsPerYear
    pts.push(threadPoint(rows, selfIdx, t))
    years.push(t)
  }
  const n = pts.length
  const tangents = pts.map((_, i) => new THREE.Vector3().subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize())
  const normals: THREE.Vector3[] = []
  let nrm = new THREE.Vector3().crossVectors(tangents[0], up)
  if (nrm.lengthSq() < 1e-6) nrm.set(1, 0, 0)
  nrm.normalize()
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i])
      const len = axis.length()
      if (len > 1e-6) nrm.applyAxisAngle(axis.divideScalar(len), Math.asin(Math.min(1, len)))
    }
    normals.push(nrm.clone())
  }
  const pos = new Float32Array(n * radial * 3)
  const nor = new Float32Array(n * radial * 3)
  const yr = new Float32Array(n * radial)
  const bin = new THREE.Vector3()
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    bin.crossVectors(tangents[i], normals[i]).normalize()
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2
      v.copy(normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(bin, Math.sin(a))
      const o = (i * radial + j) * 3
      nor[o] = v.x
      nor[o + 1] = v.y
      nor[o + 2] = v.z
      pos[o] = pts[i].x + v.x * radius
      pos[o + 1] = pts[i].y + v.y * radius
      pos[o + 2] = pts[i].z + v.z * radius
      yr[i * radial + j] = years[i]
    }
  }
  const idx: number[] = []
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j
      const b = i * radial + ((j + 1) % radial)
      const c = (i + 1) * radial + j
      const d = (i + 1) * radial + ((j + 1) % radial)
      idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('aYear', new THREE.BufferAttribute(yr, 1))
  g.setIndex(idx)
  return g
}
