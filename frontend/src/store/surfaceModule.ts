import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import type { OptimizationParams, OptimizationResult, SurfaceGrid, SurfaceLayer } from '../types'
import { ALGORITHMS } from '../types'

const STORAGE_KEY = 'surface-module-v1'
const PALETTE = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6c5ce7', '#00b894', '#e17055', '#74b9ff', '#fd79a8']

interface PersistedShape {
  functionId: string
  layers: SurfaceLayer[]
  currentLayerId: string | null
  currentStep: number
  nextId: number
}

function loadPersisted(): Partial<PersistedShape> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.layers)) return {}
    return data
  } catch {
    return {}
  }
}

function errorMessage(e: any): string {
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string' && detail) return detail
  if (e?.code === 'ERR_NETWORK' || /network/i.test(e?.message || '')) return '无法连接后端服务，请确认后端已启动'
  if (e?.response) return `后端返回错误（HTTP ${e.response.status}）`
  return e?.message || '未知错误'
}

export const useSurfaceModuleStore = defineStore('surfaceModule', () => {
  const saved = loadPersisted()
  const functionId = ref(typeof saved.functionId === 'string' ? saved.functionId : 'rosenbrock')
  const layers = ref<SurfaceLayer[]>(
    (saved.layers || []).filter(l => l && typeof l.id === 'string' && l.params)
  )
  // 刷新会中断进行中的加载：把卡在 loading 的分层标记为失败并说明原因，其余分层原样保留
  for (const l of layers.value) {
    if (l.status === 'loading') {
      l.status = 'error'
      l.error = '上次加载被页面刷新中断，可点击重试'
    }
  }
  const currentLayerId = ref<string | null>(typeof saved.currentLayerId === 'string' ? saved.currentLayerId : null)
  const currentStep = ref(typeof saved.currentStep === 'number' ? saved.currentStep : 0)
  let nextId = typeof saved.nextId === 'number' ? saved.nextId : layers.value.length + 1

  // 曲面网格不持久化，进入模块时按当前函数重新拉取
  const surface = ref<SurfaceGrid | null>(null)
  const surfaceLoading = ref(false)
  const surfaceError = ref<string | null>(null)

  const functionLayers = computed(() => layers.value.filter(l => l.functionId === functionId.value))
  const currentLayer = computed(() => layers.value.find(l => l.id === currentLayerId.value) || null)

  async function loadSurface() {
    const fid = functionId.value
    surfaceLoading.value = true
    surfaceError.value = null
    try {
      const { data } = await axios.get<SurfaceGrid>('/api/surface', {
        params: { functionId: fid, resolution: 80 }
      })
      // 加载期间用户可能已切换函数，过期结果直接丢弃
      if (functionId.value === fid) surface.value = data
    } catch (e) {
      if (functionId.value === fid) {
        surface.value = null
        surfaceError.value = errorMessage(e)
      }
    } finally {
      if (functionId.value === fid) surfaceLoading.value = false
    }
  }

  function setFunction(id: string) {
    if (id === functionId.value) return
    functionId.value = id
    currentStep.value = 0
    const candidates = functionLayers.value
    currentLayerId.value = (candidates.find(l => l.status === 'ok') || candidates[0])?.id ?? null
    loadSurface()
  }

  /** 单个分层的请求：失败只记录该层原因，不影响其他分层 */
  async function requestLayer(layer: SurfaceLayer) {
    layer.status = 'loading'
    layer.error = null
    try {
      const { data } = await axios.post<OptimizationResult>('/api/optimize', {
        ...layer.params,
        functionId: layer.functionId
      })
      layer.result = data
      layer.range = [0, Math.max(0, data.path.length - 1)]
      layer.status = 'ok'
    } catch (e) {
      layer.result = null
      layer.status = 'error'
      layer.error = errorMessage(e)
    }
  }

  async function addLayer(params: Omit<OptimizationParams, 'functionId'>) {
    const id = `L${nextId++}`
    const algoName = ALGORITHMS.find(a => a.id === params.algorithm)?.name || params.algorithm
    layers.value.push({
      id,
      name: `${id} · ${algoName}`,
      functionId: functionId.value,
      params: { ...params, functionId: functionId.value },
      visible: true,
      color: PALETTE[layers.value.length % PALETTE.length],
      lineStyle: 'solid',
      range: [0, 0],
      status: 'loading',
      error: null,
      result: null,
    })
    currentLayerId.value = id
    // 取回响应式代理后再异步更新，保证视图联动
    const layer = layers.value.find(l => l.id === id)!
    await requestLayer(layer)
    if (layer.status === 'ok' && layer.result) {
      currentStep.value = Math.min(currentStep.value, layer.result.path.length - 1)
    }
  }

  async function retryLayer(id: string) {
    const layer = layers.value.find(l => l.id === id)
    if (!layer || layer.status === 'loading') return
    await requestLayer(layer)
  }

  function removeLayer(id: string) {
    const idx = layers.value.findIndex(l => l.id === id)
    if (idx === -1) return
    layers.value.splice(idx, 1)
    if (currentLayerId.value === id) {
      const rest = functionLayers.value
      currentLayerId.value = rest.length ? rest[rest.length - 1].id : null
    }
  }

  function setCurrentLayer(id: string) {
    currentLayerId.value = id
    const layer = layers.value.find(l => l.id === id)
    if (layer?.result) currentStep.value = Math.min(currentStep.value, layer.result.path.length - 1)
  }

  function setCurrentStep(step: number) { currentStep.value = step }

  // 持久化：刷新后重新打开模块可恢复全部分层、开关组合与截取范围
  watch([functionId, layers, currentLayerId, currentStep], () => {
    const state: PersistedShape = {
      functionId: functionId.value,
      layers: layers.value,
      currentLayerId: currentLayerId.value,
      currentStep: currentStep.value,
      nextId,
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* 存储不可用时静默忽略 */ }
  }, { deep: true })

  return {
    functionId, layers, currentLayerId, currentStep,
    surface, surfaceLoading, surfaceError,
    functionLayers, currentLayer,
    loadSurface, setFunction, addLayer, retryLayer, removeLayer, setCurrentLayer, setCurrentStep,
  }
})
