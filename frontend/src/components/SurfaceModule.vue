<template>
  <div class="surface-module">
    <div class="sm-toolbar">
      <span class="label">目标函数</span>
      <el-select :model-value="store.functionId" style="width:200px" @update:model-value="store.setFunction">
        <el-option v-for="f in TEST_FUNCTIONS" :key="f.id" :label="f.name" :value="f.id" />
      </el-select>
      <span class="formula">{{ formula }}</span>
      <span v-if="store.surfaceLoading" class="surface-status">⏳ 曲面加载中…</span>
      <span v-else-if="store.surfaceError" class="surface-status error">
        ⚠ 曲面加载失败：{{ store.surfaceError }}
        <el-button link type="primary" size="small" @click="store.loadSurface">重试</el-button>
      </span>
    </div>
    <div class="sm-body">
      <div class="sm-viewer">
        <div ref="container" class="viewer3d">
          <div class="hud" v-if="store.surface">
            <div class="hud-row">
              ⭐ 曲面最低点 ({{ fmt(store.surface.minPoint.x) }}, {{ fmt(store.surface.minPoint.y) }})
              · f ≈ {{ fmt(store.surface.minPoint.z, 4) }}
            </div>
            <div class="hud-row" v-if="curInfo">
              📍 当前位置 · {{ curInfo.name }} · 步 {{ curInfo.step }}/{{ curInfo.total }}
              · ({{ fmt(curInfo.x) }}, {{ fmt(curInfo.y) }}) · f = {{ fmt(curInfo.z, 4) }}
            </div>
            <div class="hud-row" v-else>📍 当前位置 · 暂无可用分层</div>
          </div>
          <div class="viewer-error" v-if="store.surfaceError && !store.surfaceLoading">
            曲面加载失败：{{ store.surfaceError }}（分层面板仍可使用）
          </div>
        </div>
        <div class="step-bar">
          <el-button size="small" @click="togglePlay" :disabled="!canStep">{{ playing ? '⏸ 暂停' : '▶ 播放' }}</el-button>
          <el-slider
            :model-value="store.currentStep" :min="0" :max="maxStep" :disabled="!canStep"
            style="flex:1;margin:0 16px" @update:model-value="onStep"
          />
          <span class="step-text">步 {{ store.currentStep }}/{{ maxStep }}</span>
        </div>
      </div>
      <LayerPanel class="sm-side" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useSurfaceModuleStore } from '../store/surfaceModule'
import { TEST_FUNCTIONS } from '../types'
import type { SurfaceGrid } from '../types'
import LayerPanel from './LayerPanel.vue'

const store = useSurfaceModuleStore()
const container = ref<HTMLDivElement>()

let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls, animId: number
const surfaceGroup = new THREE.Group()
const layersGroup = new THREE.Group()
const markerGroup = new THREE.Group()

interface Mapper {
  mx: (x: number) => number
  my: (y: number) => number
  mz: (z: number) => number
  zt: (z: number) => number
}
let mapper: Mapper | null = null

const formula = computed(() => TEST_FUNCTIONS.find(f => f.id === store.functionId)?.formula || '')
const maxStep = computed(() => {
  const r = store.currentLayer?.result
  return r ? r.path.length - 1 : 0
})
const canStep = computed(() => !!store.currentLayer && store.currentLayer.status === 'ok' && store.currentLayer.functionId === store.functionId)
const curInfo = computed(() => {
  const cl = store.currentLayer
  if (!cl || cl.status !== 'ok' || !cl.result || cl.functionId !== store.functionId) return null
  const idx = Math.min(store.currentStep, cl.result.path.length - 1)
  const p = cl.result.path[idx]
  return { name: cl.name, step: idx, total: cl.result.path.length - 1, x: p.x, y: p.y, z: p.z }
})

function fmt(v: number, digits = 3) {
  if (!Number.isFinite(v)) return '—'
  if (v !== 0 && (Math.abs(v) >= 1000 || Math.abs(v) < 1e-3)) return v.toExponential(2)
  return v.toFixed(digits)
}

// ---- 当前位置步进播放 ----
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
function pause() { playing.value = false; if (timer) { clearInterval(timer); timer = null } }
function togglePlay() {
  if (playing.value) { pause(); return }
  if (!canStep.value) return
  playing.value = true
  timer = setInterval(() => {
    if (store.currentStep < maxStep.value) store.setCurrentStep(store.currentStep + 1)
    else pause()
  }, 80)
}
function onStep(v: number) { pause(); store.setCurrentStep(v) }

// ---- 场景 ----
function initScene() {
  const c = container.value!
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x111827)
  camera = new THREE.PerspectiveCamera(45, c.clientWidth / c.clientHeight, 0.1, 100)
  camera.position.set(3.4, 2.8, 3.8)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(c.clientWidth, c.clientHeight)
  c.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0.5, 0)
  scene.add(new THREE.AmbientLight(0x8090b0, 1.2))
  const dl = new THREE.DirectionalLight(0xffffff, 1.1); dl.position.set(3, 5, 3); scene.add(dl)
  const dl2 = new THREE.DirectionalLight(0x6688cc, 0.4); dl2.position.set(-3, -2, -2); scene.add(dl2)
  scene.add(surfaceGroup); scene.add(layersGroup); scene.add(markerGroup)
}

function onResize() {
  const c = container.value
  if (!c || !renderer || !c.clientWidth || !c.clientHeight) return
  camera.aspect = c.clientWidth / c.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(c.clientWidth, c.clientHeight)
}

function disposeGroup(g: THREE.Group) {
  for (const child of [...g.children]) {
    g.remove(child)
    const anyChild = child as any
    anyChild.geometry?.dispose?.()
    if (Array.isArray(anyChild.material)) anyChild.material.forEach((m: any) => m?.dispose?.())
    else anyChild.material?.dispose?.()
  }
}

/** 高度着色：蓝(低) → 青 → 绿 → 黄 → 红(高) */
function heightColor(t: number): [number, number, number] {
  const stops: Array<[number, [number, number, number]]> = [
    [0.0, [0.19, 0.21, 0.58]],
    [0.35, [0.12, 0.56, 0.78]],
    [0.6, [0.18, 0.72, 0.44]],
    [0.8, [0.93, 0.80, 0.28]],
    [1.0, [0.80, 0.24, 0.22]],
  ]
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1]
      const [t1, c1] = stops[i]
      const k = (t - t0) / (t1 - t0 || 1)
      return [
        c0[0] + (c1[0] - c0[0]) * k,
        c0[1] + (c1[1] - c0[1]) * k,
        c0[2] + (c1[2] - c0[2]) * k,
      ]
    }
  }
  return stops[stops.length - 1][1]
}

/** 把函数域映射到以原点为中心的展示盒；z 轴按 92 分位截断尖峰，路径与曲面共用同一映射 */
function buildMapper(grid: SurfaceGrid): Mapper {
  const xs = grid.x, ys = grid.y
  const xMin = xs[0], xMax = xs[xs.length - 1]
  const yMin = ys[0], yMax = ys[ys.length - 1]
  let zMin = Infinity
  const all: number[] = []
  for (const row of grid.z) for (const z of row) {
    if (Number.isFinite(z)) { all.push(z); if (z < zMin) zMin = z }
  }
  all.sort((a, b) => a - b)
  const zClip = all.length ? all[Math.min(all.length - 1, Math.floor(all.length * 0.92))] : 1
  const span = zClip - zMin || 1
  const HALF = 2.4, HEIGHT = 1.8
  const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2
  const s = Math.max((xMax - xMin) / 2, (yMax - yMin) / 2) || 1
  return {
    mx: (x) => THREE.MathUtils.clamp(((x - cx) / s) * HALF, -HALF, HALF),
    my: (y) => THREE.MathUtils.clamp(((y - cy) / s) * HALF, -HALF, HALF),
    mz: (z) => THREE.MathUtils.clamp((z - zMin) / span, 0, 1) * HEIGHT,
    zt: (z) => THREE.MathUtils.clamp((z - zMin) / span, 0, 1),
  }
}

function buildSurface() {
  disposeGroup(surfaceGroup)
  const grid = store.surface
  if (!grid) { mapper = null; return }
  const m = buildMapper(grid)
  mapper = m
  const nx = grid.x.length, ny = grid.y.length
  const positions = new Float32Array(nx * ny * 3)
  const colors = new Float32Array(nx * ny * 3)
  let k = 0
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const z = grid.z[j][i]
      positions[k] = m.mx(grid.x[i])
      positions[k + 1] = m.mz(z)
      positions[k + 2] = m.my(grid.y[j])
      const [r, g, b] = heightColor(m.zt(z))
      colors[k] = r; colors[k + 1] = g; colors[k + 2] = b
      k += 3
    }
  }
  const indices: number[] = []
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  surfaceGroup.add(new THREE.Mesh(geom, new THREE.MeshPhongMaterial({
    vertexColors: true, side: THREE.DoubleSide, shininess: 35, transparent: true, opacity: 0.97
  })))
  surfaceGroup.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
    wireframe: true, color: 0xffffff, transparent: true, opacity: 0.05
  })))
}

/** 各可见分层：按自身颜色/样式/截取区间画在同一张曲面上 */
function buildLayers() {
  disposeGroup(layersGroup)
  const m = mapper
  if (!m) return
  for (const layer of store.functionLayers) {
    if (!layer.visible || layer.status !== 'ok' || !layer.result) continue
    const n = layer.result.path.length
    const a = Math.max(0, Math.min(layer.range[0], n - 1))
    const b = Math.max(a, Math.min(layer.range[1], n - 1))
    const pts = layer.result.path.slice(a, b + 1)
    if (!pts.length) continue
    const color = new THREE.Color(layer.color || '#ffffff')
    const vecs = pts.map(p => new THREE.Vector3(m.mx(p.x), m.mz(p.z) + 0.015, m.my(p.y)))
    const geom = new THREE.BufferGeometry().setFromPoints(vecs)
    if (layer.lineStyle === 'points' || vecs.length === 1) {
      layersGroup.add(new THREE.Points(geom, new THREE.PointsMaterial({ color, size: 0.07 })))
    } else if (layer.lineStyle === 'dashed') {
      const line = new THREE.Line(geom, new THREE.LineDashedMaterial({ color, dashSize: 0.09, gapSize: 0.06 }))
      line.computeLineDistances()
      layersGroup.add(line)
    } else {
      layersGroup.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color })))
    }
    // 截取段末端标记
    const end = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color }))
    end.position.copy(vecs[vecs.length - 1])
    layersGroup.add(end)
  }
}

/** 最低点（金色）与当前所在位置（绿色，跟随当前分层与当前步） */
function buildMarkers() {
  disposeGroup(markerGroup)
  const m = mapper
  if (!m || !store.surface) return
  const mp = store.surface.minPoint
  const minMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 16),
    new THREE.MeshPhongMaterial({ color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 0.7 })
  )
  minMesh.position.set(m.mx(mp.x), m.mz(mp.z), m.my(mp.y))
  markerGroup.add(minMesh)

  const cl = store.currentLayer
  if (cl && cl.status === 'ok' && cl.result && cl.functionId === store.functionId) {
    const idx = Math.min(store.currentStep, cl.result.path.length - 1)
    const p = cl.result.path[idx]
    const cur = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0x00e676, emissive: 0x00e676, emissiveIntensity: 0.6 })
    )
    cur.position.set(m.mx(p.x), m.mz(p.z) + 0.06, m.my(p.y))
    markerGroup.add(cur)
  }
}

let rendering = false
function animate() {
  if (!rendering) return
  animId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

onMounted(() => {
  initScene()
  if (!store.surface || store.surface.functionId !== store.functionId) store.loadSurface()
  else { buildSurface(); buildLayers(); buildMarkers() }
  window.addEventListener('resize', onResize)
  rendering = true
  animate()
})
onActivated(() => {
  onResize()
  if (!rendering) { rendering = true; animate() }
})
onDeactivated(() => {
  rendering = false
  cancelAnimationFrame(animId)
  pause()
})
watch(() => store.surface, () => { buildSurface(); buildLayers(); buildMarkers() })
watch(() => [store.functionLayers, store.currentStep, store.currentLayerId], () => { buildLayers(); buildMarkers() }, { deep: true })
onUnmounted(() => { pause(); rendering = false; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); renderer?.dispose() })
</script>

<style scoped>
.surface-module { background:#fff; border-radius:8px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,.06) }
.sm-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px }
.sm-toolbar .label { font-size:13px; color:#606266 }
.formula { font-size:12px; color:#909399; font-family:ui-monospace,monospace }
.surface-status { font-size:12px; color:#909399 }
.surface-status.error { color:#f56c6c }
.sm-body { display:grid; grid-template-columns: 1fr 340px; gap:16px }
@media (max-width: 1100px) { .sm-body { grid-template-columns: 1fr } }
.sm-viewer { min-width:0 }
.viewer3d { position:relative; width:100%; height:480px; border-radius:8px; overflow:hidden; border:1px solid #eee; background:#111827 }
.hud { position:absolute; left:10px; top:10px; pointer-events:none; display:flex; flex-direction:column; align-items:flex-start; gap:6px }
.hud-row {
  background:rgba(17,24,39,.72); color:#e5e7eb; font-size:12px;
  padding:4px 10px; border-radius:6px; font-family:ui-monospace,monospace
}
.viewer-error {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  color:#fca5a5; font-size:13px; padding:0 30px; text-align:center
}
.step-bar { display:flex; align-items:center; margin-top:10px }
.step-text { font-size:13px; color:#666; white-space:nowrap }
</style>
