import * as THREE from 'three'
import { getTestFunction, evaluateFunction } from './functions'

const DOMAIN_SIZE = 6
const SURFACE_HEIGHT = 2.4
const GRID_SEGMENTS = 72

export interface SurfaceModel {
  geometry: THREE.BufferGeometry
  mapPoint: (x: number, y: number, z: number, lift?: number) => THREE.Vector3
  zMin: number
  zMax: number
}

function percentile(values: number[], ratio: number) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)))
  return sorted[index]
}

export function buildSurfaceModel(functionId: string): SurfaceModel {
  const fn = getTestFunction(functionId)
  const [xMin, xMax] = fn.xRange
  const [yMin, yMax] = fn.yRange
  const xSpan = xMax - xMin
  const ySpan = yMax - yMin

  const raw: number[] = []
  const samples: { x: number; y: number; z: number }[] = []
  for (let iy = 0; iy <= GRID_SEGMENTS; iy++) {
    const y = yMin + (iy / GRID_SEGMENTS) * ySpan
    for (let ix = 0; ix <= GRID_SEGMENTS; ix++) {
      const x = xMin + (ix / GRID_SEGMENTS) * xSpan
      const z = evaluateFunction(functionId, x, y)
      samples.push({ x, y, z })
      if (Number.isFinite(z)) raw.push(z)
    }
  }

  const zMin = raw.length ? Math.min(...raw) : 0
  const zMax = raw.length ? percentile(raw, 0.98) : 1
  const zSpan = zMax - zMin || 1

  const mapX = (x: number) => ((x - xMin) / xSpan - 0.5) * DOMAIN_SIZE
  const mapZ = (y: number) => ((y - yMin) / ySpan - 0.5) * DOMAIN_SIZE
  const mapHeight = (z: number) => {
    const safeZ = Math.min(zMax, Math.max(zMin, z))
    return ((safeZ - zMin) / zSpan) * SURFACE_HEIGHT
  }

  const positions: number[] = []
  const colors: number[] = []
  const color = new THREE.Color()
  for (const sample of samples) {
    const { x, y, z } = sample
    const h = Number.isFinite(z) ? mapHeight(z) : 0
    positions.push(mapX(x), h, mapZ(y))

    const safeHeight = Number.isFinite(z) ? Math.min(zMax, Math.max(zMin, z)) : zMin
    const t = Math.min(1, Math.max(0, (safeHeight - zMin) / zSpan))
    color.setHSL(0.58 - 0.5 * t, 0.68, 0.24 + 0.36 * t)
    colors.push(color.r, color.g, color.b)
  }

  const indices: number[] = []
  for (let iy = 0; iy < GRID_SEGMENTS; iy++) {
    for (let ix = 0; ix < GRID_SEGMENTS; ix++) {
      const a = iy * (GRID_SEGMENTS + 1) + ix
      const b = a + 1
      const c = a + GRID_SEGMENTS + 1
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return {
    geometry,
    zMin,
    zMax,
    mapPoint: (x, y, z, lift = 0.035) => new THREE.Vector3(mapX(x), mapHeight(z) + lift, mapZ(y))
  }
}
