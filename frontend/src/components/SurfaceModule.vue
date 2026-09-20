<template>
  <section class="surface-module">
    <div class="surface-layout">
      <aside class="surface-sidebar">
        <div class="card">
          <h3>1. 选择函数曲面</h3>
          <el-select v-model="functionId" size="small" style="width:100%">
            <el-option v-for="f in TEST_FUNCTIONS" :key="f.id" :label="f.name" :value="f.id" />
          </el-select>
          <p class="formula">{{ currentFunction.formula }}</p>
        </div>

        <div class="card">
          <h3>2. 设置本次路径</h3>
          <el-form label-position="top" size="small">
            <el-form-item label="算法">
              <el-select v-model="form.algorithm" style="width:100%">
                <el-option v-for="a in ALGORITHMS" :key="a.id" :label="a.name" :value="a.id" />
              </el-select>
            </el-form-item>
            <div class="form-row">
              <el-form-item label="初始 X">
                <el-input-number v-model="form.x0" :min="currentFunction.xRange[0]" :max="currentFunction.xRange[1]" :step="0.1" />
              </el-form-item>
              <el-form-item label="初始 Y">
                <el-input-number v-model="form.y0" :min="currentFunction.yRange[0]" :max="currentFunction.yRange[1]" :step="0.1" />
              </el-form-item>
            </div>
            <div class="form-row">
              <el-form-item label="步长">
                <el-input-number v-model="form.learningRate" :min="0.0001" :max="1" :step="0.005" :precision="4" />
              </el-form-item>
              <el-form-item label="迭代">
                <el-input-number v-model="form.iterations" :min="1" :max="1000" :step="10" />
              </el-form-item>
            </div>
            <el-form-item v-if="form.algorithm === 'gradient_descent'" label="动量">
              <el-slider v-model="form.momentum" :min="0" :max="0.99" :step="0.05" show-input :show-input-controls="false" />
            </el-form-item>
            <template v-if="form.algorithm === 'simulated_annealing'">
              <div class="form-row">
                <el-form-item label="温度">
                  <el-input-number v-model="form.temperature" :min="1" :max="1000" :step="10" />
                </el-form-item>
                <el-form-item label="冷却率">
                  <el-input-number v-model="form.coolingRate" :min="0.01" :max="0.999" :step="0.01" :precision="3" />
                </el-form-item>
              </div>
            </template>
            <el-button type="primary" size="small" style="width:100%" @click="addLayer">
              ➕ 将本次设置加入分层
            </el-button>
          </el-form>
        </div>

        <div class="card layer-card-list">
          <div class="layer-header">
            <h3>3. 分层管理</h3>
            <span>{{ store.readyLayers.length }}/{{ store.layers.length }} 可用</span>
          </div>

          <el-empty v-if="!store.layers.length" description="还没有分层，先运行一次设置" :image-size="60" />

          <article
            v-for="layer in store.layers"
            :key="layer.id"
            class="layer-item"
            :class="{ selected: store.workspace.selectedLayerId === layer.id }"
            @click="store.selectLayer(layer.id)"
          >
            <div class="layer-title-row">
              <button class="icon-button" :title="layer.visible ? '隐藏分层' : '显示分层'" @click.stop="store.toggleLayer(layer.id)">
                {{ layer.visible ? '👁' : '—' }}
              </button>
              <div class="layer-name">
                <strong>{{ layer.name }}</strong>
                <el-tag size="small" :type="statusType(layer.status)">{{ statusText(layer.status) }}</el-tag>
              </div>
              <button class="icon-button danger" title="删除分层" @click.stop="store.removeLayer(layer.id)">×</button>
            </div>

            <p class="layer-summary">{{ summarize(layer) }}</p>

            <div v-if="layer.status === 'error'" class="layer-error">
              <span>{{ layer.error }}</span>
              <el-button size="small" type="warning" plain @click.stop="store.retryLayer(layer.id)">仅重试此层</el-button>
            </div>

            <template v-else-if="layer.status === 'ready'">
              <div class="style-row" @click.stop>
                <label>
                  颜色
                  <input type="color" :value="layer.color" @input="onColor(layer, ($event.target as HTMLInputElement).value)" />
                </label>
                <label>
                  样式
                  <el-select :model-value="layer.lineStyle" size="small" @change="(v: SurfaceLineStyle) => onLineStyle(layer, v)">
                    <el-option label="实线" value="solid" />
                    <el-option label="虚线" value="dashed" />
                    <el-option label="点线" value="dotted" />
                  </el-select>
                </label>
              </div>
              <div class="clip-row" @click.stop>
                <span>截取 {{ layer.clipStart }}–{{ layer.clipEnd }} / {{ layer.result?.path.length ? layer.result.path.length - 1 : 0 }}</span>
                <el-slider
                  :model-value="[layer.clipStart, layer.clipEnd]"
                  :min="0"
                  :max="layer.result ? layer.result.path.length - 1 : 0"
                  range
                  @change="(v: [number, number]) => onClip(layer, v)"
                />
              </div>
            </template>
          </article>
        </div>
      </aside>

      <main class="surface-main card">
        <div class="viewer-toolbar">
          <div class="play-controls">
            <el-button size="small" :disabled="!canPlay" @click="playAnimation">▶</el-button>
            <el-button size="small" :disabled="!canPlay" @click="pauseAnimation">⏸</el-button>
            <el-button size="small" :disabled="!canPlay" @click="resetAnimation">⏹</el-button>
          </div>
          <el-slider
            class="step-slider"
            :model-value="store.workspace.currentStep"
            :min="selectedLayer?.clipStart || 0"
            :max="selectedLayer?.clipEnd || 0"
            :disabled="!canPlay"
            @input="onStep"
          />
          <div class="position-info">
            <span>当前步：{{ canPlay ? store.workspace.currentStep : '—' }}</span>
            <span>位置：{{ currentPoint ? `(${currentPoint.x.toFixed(3)}, ${currentPoint.y.toFixed(3)})` : '—' }}</span>
            <span>f：{{ currentPoint ? currentPoint.z.toFixed(4) : '—' }}</span>
          </div>
        </div>
        <div ref="viewer" class="surface-viewer">
          <div class="legend">
            <span><i class="minimum"></i> 函数最低点</span>
            <span><i class="current"></i> 当前位置</span>
            <span v-for="layer in store.visibleReadyLayers" :key="layer.id">
              <i :style="{ background: layer.color }"></i>{{ layer.name }}
            </span>
          </div>
          <el-empty v-if="!store.readyLayers.length" description="运行设置后，路径会分层叠加到这张曲面上" :image-size="90" />
        </div>
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ALGORITHMS, TEST_FUNCTIONS, type OptimizationParams, type SurfaceLayer, type SurfaceLayerStatus, type SurfaceLineStyle, type IterationPoint } from '@/types'
import { evaluateFunction, getTestFunction } from '@/lib/functions'
import { buildSurfaceModel, type SurfaceModel } from '@/lib/surfaceGeometry'
import { useSurfaceStore } from '@/store/surface'

const store = useSurfaceStore()
const viewer = ref<HTMLDivElement>()

const form = reactive<OptimizationParams>({
  algorithm: 'gradient_descent',
  functionId: store.activeFunctionId,
  x0: -1.5,
  y0: 2.5,
  learningRate: 0.01,
  iterations: 100,
  momentum: 0.9,
  temperature: 100,
  coolingRate: 0.95
})

const functionId = computed({
  get: () => store.activeFunctionId,
  set: (value: string) => store.setFunction(value)
})
const currentFunction = computed(() => getTestFunction(store.activeFunctionId))
const selectedLayer = computed(() => store.selectedLayer)
const canPlay = computed(() => !!selectedLayer.value?.result && selectedLayer.value.status === 'ready')
const currentPoint = computed<IterationPoint | null>(() => {
  const layer = selectedLayer.value
  if (!layer?.result) return null
  return layer.result.path[store.workspace.currentStep] || null
})

watch(functionId, id => {
  form.functionId = id
  const fn = getTestFunction(id)
  if (form.x0 < fn.xRange[0] || form.x0 > fn.xRange[1]) form.x0 = fn.xRange[0]
  if (form.y0 < fn.yRange[0] || form.y0 > fn.yRange[1]) form.y0 = fn.yRange[1]
})

function statusType(status: SurfaceLayerStatus) {
  return status === 'ready' ? 'success' : status === 'loading' ? 'warning' : 'danger'
}
function statusText(status: SurfaceLayerStatus) {
  return status === 'ready' ? '可用' : status === 'loading' ? '加载中' : '失败'
}
function summarize(layer: SurfaceLayer) {
  const p = layer.params
  return `${algorithmLabel(p.algorithm)} · 起点(${p.x0}, ${p.y0}) · 步长${p.learningRate} · ${p.iterations}步`
}
function algorithmLabel(id: string) {
  return ALGORITHMS.find(a => a.id === id)?.name || id
}

async function addLayer() {
  const fn = currentFunction.value
  if (form.x0 < fn.xRange[0] || form.x0 > fn.xRange[1] || form.y0 < fn.yRange[0] || form.y0 > fn.yRange[1]) {
    ElMessage.error(`初始点必须位于 ${fn.name} 的定义域内`)
    return
  }
  await store.addLayer({ ...form })
}
function onColor(layer: SurfaceLayer, color: string) { store.setLayerColor(layer.id, color) }
function onLineStyle(layer: SurfaceLayer, style: SurfaceLineStyle) { store.setLayerLineStyle(layer.id, style) }
function onClip(layer: SurfaceLayer, range: [number, number]) {
  if (Array.isArray(range) && range.length === 2) store.setClipRange(layer.id, range[0], range[1])
}
function onStep(step: number | number[]) {
  if (typeof step === 'number') {
    pauseAnimation()
    store.setCurrentStep(step)
  }
}

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let resizeObserver: ResizeObserver
let raf = 0
let model: SurfaceModel | null = null
const surfaceGroup = new THREE.Group()
const pathGroup = new THREE.Group()
const markerGroup = new THREE.Group()

function initScene() {
  const el = viewer.value!
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b1220)
  camera = new THREE.PerspectiveCamera(45, el.clientWidth / Math.max(1, el.clientHeight), 0.1, 100)
  camera.position.set(6.4, 4.8, 7.2)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0.9, 0)

  scene.add(new THREE.AmbientLight(0x8fa3c7, 1.4))
  const key = new THREE.DirectionalLight(0xffffff, 1.8)
  key.position.set(4, 7, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x67e8f9, 0.55)
  rim.position.set(-5, 2, -4)
  scene.add(rim)

  const grid = new THREE.GridHelper(6, 12, 0x355070, 0x1e293b)
  grid.position.y = -0.02
  scene.add(grid)
  scene.add(surfaceGroup, pathGroup, markerGroup)

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(el)
}

function disposeObject(object: THREE.Object3D) {
  object.traverse(child => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(material)) material.forEach(m => m.dispose())
    else material?.dispose()
  })
}

function clearGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child)
    disposeObject(child)
  }
}

function rebuildSurface() {
  clearGroup(surfaceGroup)
  model = buildSurfaceModel(store.activeFunctionId)
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0.06,
    transparent: true,
    opacity: 0.94
  })
  surfaceGroup.add(new THREE.Mesh(model.geometry, material))

  const fn = getTestFunction(store.activeFunctionId)
  for (const [x, y] of fn.minima || []) {
    const z = evaluateFunction(store.activeFunctionId, x, y)
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 0),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.7 })
    )
    marker.position.copy(model.mapPoint(x, y, z, 0.16))
    surfaceGroup.add(marker)
  }
}

function makeLineMaterial(layer: SurfaceLayer) {
  if (layer.lineStyle === 'solid') {
    return new THREE.LineBasicMaterial({ color: layer.color, transparent: true, opacity: 0.95 })
  }
  return new THREE.LineDashedMaterial({
    color: layer.color,
    dashSize: layer.lineStyle === 'dotted' ? 0.035 : 0.18,
    gapSize: layer.lineStyle === 'dotted' ? 0.11 : 0.08,
    transparent: true,
    opacity: 0.95
  })
}

function rebuildPaths() {
  if (!model) return
  clearGroup(pathGroup)
  clearGroup(markerGroup)
  const step = store.workspace.currentStep

  for (const layer of store.visibleReadyLayers) {
    const path = store.clippedPath(layer)
    if (path.length < 2) continue

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(path.flatMap(p => {
      const v = model!.mapPoint(p.x, p.y, p.z, 0.05)
      return [v.x, v.y, v.z]
    }), 3))
    const line = new THREE.Line(geometry, makeLineMaterial(layer))
    line.computeLineDistances()
    pathGroup.add(line)

    if (layer.result && layer.id === store.workspace.selectedLayerId && layer.visible && step >= layer.clipStart && step <= layer.clipEnd) {
      const point = layer.result.path[step]
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 18, 18),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: new THREE.Color(layer.color),
          emissiveIntensity: 0.5
        })
      )
      marker.position.copy(model.mapPoint(point.x, point.y, point.z, 0.15))
      markerGroup.add(marker)
    }
  }
}

function resize() {
  if (!viewer.value || !renderer) return
  const width = viewer.value.clientWidth
  const height = viewer.value.clientHeight
  if (!width || !height) return
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

let playTimer: ReturnType<typeof setInterval> | null = null
function playAnimation() {
  const layer = selectedLayer.value
  if (!layer?.result || playTimer) return
  if (store.workspace.currentStep >= layer.clipEnd) store.setCurrentStep(layer.clipStart)
  playTimer = setInterval(() => {
    const current = store.workspace.currentStep
    if (current >= layer.clipEnd) pauseAnimation()
    else store.setCurrentStep(current + 1)
  }, 100)
}
function pauseAnimation() {
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}
function resetAnimation() {
  pauseAnimation()
  if (selectedLayer.value) store.setCurrentStep(selectedLayer.value.clipStart)
}

function animate() {
  raf = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

watch(() => store.activeFunctionId, () => {
  rebuildSurface()
  rebuildPaths()
})
watch(() => [store.layers, store.workspace.currentStep, store.activeFunctionId], rebuildPaths, { deep: true })

onMounted(() => {
  initScene()
  rebuildSurface()
  rebuildPaths()
  animate()
})
onActivated(() => {
  resize()
  if (!raf) animate()
})
onDeactivated(pauseAnimation)
onUnmounted(() => {
  pauseAnimation()
  cancelAnimationFrame(raf)
  raf = 0
  resizeObserver.disconnect()
  clearGroup(surfaceGroup)
  clearGroup(pathGroup)
  clearGroup(markerGroup)
  controls.dispose()
  renderer.dispose()
  store.flushPersist()
})
</script>

<style scoped>
.surface-module { min-height: 520px }
.surface-layout { display:grid; grid-template-columns:340px minmax(0,1fr); gap:16px }
.card { background:#fff; border-radius:10px; padding:16px; box-shadow:0 2px 10px rgba(15,23,42,.07) }
.card h3 { font-size:14px; color:#1e293b; margin-bottom:12px }
.formula { margin-top:10px; padding:8px 10px; background:#f1f5f9; border-radius:6px; color:#475569; font-size:12px }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:10px }
:deep(.el-form-item) { margin-bottom:12px }
:deep(.el-input-number) { width:100% }
.surface-sidebar { display:flex; flex-direction:column; gap:16px; min-width:0 }
.layer-card-list { padding-bottom:10px }
.layer-header { display:flex; align-items:center; justify-content:space-between }
.layer-header span { font-size:12px; color:#64748b }
.layer-item { border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-top:10px; cursor:pointer; transition:border-color .2s, background .2s }
.layer-item:hover { border-color:#93c5fd }
.layer-item.selected { border-color:#3b82f6; background:#eff6ff }
.layer-title-row { display:flex; align-items:center; gap:8px }
.icon-button { width:26px; height:26px; border:none; border-radius:6px; background:#f1f5f9; cursor:pointer; color:#334155 }
.icon-button.danger:hover { background:#fee2e2; color:#dc2626 }
.layer-name { flex:1; display:flex; align-items:center; justify-content:space-between; gap:6px; min-width:0 }
.layer-name strong { font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.layer-summary { margin:8px 0; color:#64748b; font-size:12px }
.layer-error { display:flex; flex-direction:column; gap:8px; padding:8px; border-radius:6px; background:#fff1f2; color:#be123c; font-size:12px }
.style-row { display:flex; gap:12px; align-items:end; margin-top:8px }
.style-row label { flex:1; font-size:12px; color:#64748b; display:flex; flex-direction:column; gap:4px }
.style-row input[type=color] { width:100%; height:28px; border:1px solid #dbe3ee; border-radius:4px; background:#fff; padding:2px }
.style-row :deep(.el-select) { width:100% }
.clip-row { margin-top:8px; font-size:12px; color:#64748b }
.clip-row :deep(.el-slider) { margin:4px 6px 0 }
.surface-main { padding:12px; min-width:0; display:flex; flex-direction:column }
.viewer-toolbar { display:grid; grid-template-columns:auto minmax(180px,1fr) auto; gap:12px; align-items:center; padding:0 4px 10px; border-bottom:1px solid #eef2f7 }
.play-controls { display:flex; gap:5px }
.position-info { display:flex; gap:14px; font-size:12px; color:#475569; white-space:nowrap }
.surface-viewer { position:relative; flex:1; min-height:560px; border-radius:8px; overflow:hidden; background:#0b1220 }
.surface-viewer :deep(canvas) { display:block }
.surface-viewer :deep(.el-empty) { position:absolute; inset:0; background:rgba(255,255,255,.72); border-radius:8px }
.legend { position:absolute; left:12px; top:12px; z-index:2; display:flex; flex-direction:column; gap:7px; padding:10px 12px; border-radius:8px; background:rgba(15,23,42,.72); color:#e2e8f0; font-size:12px; pointer-events:none }
.legend span { display:flex; align-items:center; gap:6px }
.legend i { width:10px; height:10px; border-radius:50%; display:inline-block; background:#00ffcc }
.legend i.minimum { background:#fbbf24; border-radius:2px; transform:rotate(45deg) }
.legend i.current { background:#fff; box-shadow:0 0 8px #fff }
@media (max-width: 1100px) {
  .surface-layout { grid-template-columns:1fr }
  .surface-viewer { min-height:460px }
  .viewer-toolbar { grid-template-columns:1fr }
  .position-info { flex-wrap:wrap }
}
</style>
