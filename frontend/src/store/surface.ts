import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import axios, { type AxiosError } from 'axios'
import {
  ALGORITHMS,
  TEST_FUNCTIONS,
  type OptimizationParams,
  type OptimizationResult,
  type IterationPoint,
  type SurfaceLayer,
  type SurfaceLineStyle,
  type SurfaceWorkspace
} from '@/types'

const STORAGE_KEY = 'optimization-surface-workspaces-v1'
const LAYER_COLORS = ['#00ffcc', '#ff7043', '#ba68c8', '#4fc3f7', '#fdd835', '#f06292', '#81c784', '#ffb74d']

interface PersistedState {
  activeFunctionId: string
  workspaces: Record<string, SurfaceWorkspace>
}

function defaultParams(functionId: string): OptimizationParams {
  return {
    algorithm: 'gradient_descent',
    functionId,
    x0: -1.5,
    y0: 2.5,
    learningRate: 0.01,
    iterations: 100,
    momentum: 0.9,
    temperature: 100,
    coolingRate: 0.95
  }
}

function emptyWorkspace(): SurfaceWorkspace {
  return { layers: [], selectedLayerId: null, currentStep: 0 }
}

function isFinitePoint(point: Partial<IterationPoint> | null | undefined): point is IterationPoint {
  return !!point
    && typeof point.step === 'number'
    && Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && Number.isFinite(point.z)
}

function validResult(result: unknown): result is OptimizationResult {
  if (!result || typeof result !== 'object') return false
  const path = (result as OptimizationResult).path
  return Array.isArray(path) && path.length > 0 && path.every(isFinitePoint)
}

function normalizeLayer(input: Partial<SurfaceLayer>, index: number): SurfaceLayer | null {
  if (!input || typeof input !== 'object' || !input.params) return null
  const params = { ...defaultParams(String(input.params.functionId || 'rosenbrock')), ...input.params }
  const rawResult = input.status === 'ready' ? input.result : undefined
  const ready = validResult(rawResult)
  const result = ready ? rawResult : undefined
  const maxStep = result ? result.path.length - 1 : 0
  const colors = LAYER_COLORS
  const status = ready ? 'ready' : 'error'
  const layer: SurfaceLayer = {
    id: typeof input.id === 'string' ? input.id : `layer-${Date.now()}-${index}`,
    name: typeof input.name === 'string' && input.name ? input.name : `分层 ${index + 1}`,
    params,
    visible: input.visible !== false,
    color: typeof input.color === 'string' ? input.color : colors[index % colors.length],
    lineStyle: ['solid', 'dashed', 'dotted'].includes(String(input.lineStyle))
      ? input.lineStyle as SurfaceLineStyle
      : 'solid',
    clipStart: Number.isFinite(input.clipStart) ? Number(input.clipStart) : 0,
    clipEnd: Number.isFinite(input.clipEnd) ? Number(input.clipEnd) : maxStep,
    status,
    error: ready ? undefined : (typeof input.error === 'string' ? input.error : '刷新前该分层尚未完成加载，请重试。'),
    result,
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : Date.now()
  }
  layer.clipStart = Math.min(maxStep, Math.max(0, Math.round(layer.clipStart)))
  layer.clipEnd = Math.min(maxStep, Math.max(layer.clipStart, Math.round(layer.clipEnd)))
  return layer
}

function loadPersistedState(): { activeFunctionId: string; workspaces: Record<string, SurfaceWorkspace> } {
  const workspaces: Record<string, SurfaceWorkspace> = {}
  for (const fn of TEST_FUNCTIONS) workspaces[fn.id] = emptyWorkspace()

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>

      for (const fn of TEST_FUNCTIONS) {
        const saved = parsed.workspaces?.[fn.id]
        if (!saved || !Array.isArray(saved.layers)) continue
        const layers = saved.layers
          .map((layer, index) => normalizeLayer(layer, index))
          .filter((layer): layer is SurfaceLayer => !!layer)
        const selected = layers.some(l => l.id === saved.selectedLayerId) ? saved.selectedLayerId : (layers[0]?.id || null)
        const maxClip = selected ? layers.find(l => l.id === selected)?.clipEnd ?? 0 : 0
        workspaces[fn.id] = {
          layers,
          selectedLayerId: selected,
          currentStep: Number.isFinite(saved.currentStep)
            ? Math.min(maxClip, Math.max(0, Math.round(saved.currentStep as number)))
            : 0
        }
      }

      return {
        activeFunctionId: TEST_FUNCTIONS.some(f => f.id === parsed.activeFunctionId)
          ? parsed.activeFunctionId as string
          : 'rosenbrock',
        workspaces
      }
    }
    return { activeFunctionId: 'rosenbrock', workspaces }
  } catch {
    return { activeFunctionId: 'rosenbrock', workspaces }
  }
}

export const useSurfaceStore = defineStore('surface', () => {
  const initial = loadPersistedState()
  const activeFunctionId = ref(initial.activeFunctionId)
  const workspaces = ref<Record<string, SurfaceWorkspace>>(initial.workspaces)

  const workspace = computed(() => workspaces.value[activeFunctionId.value] || emptyWorkspace())
  const layers = computed(() => workspace.value.layers)
  const selectedLayer = computed(() => layers.value.find(l => l.id === workspace.value.selectedLayerId) || null)
  const readyLayers = computed(() => layers.value.filter(l => l.status === 'ready' && l.result))
  const visibleReadyLayers = computed(() => readyLayers.value.filter(l => l.visible))

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  function persist() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => flushPersist(), 250)
  }

  function flushPersist() {
    const payload: PersistedState = {
      activeFunctionId: activeFunctionId.value,
      workspaces: workspaces.value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }
  window.addEventListener('beforeunload', flushPersist)

  watch([activeFunctionId, workspaces], persist, { deep: true })

  function setFunction(functionId: string) {
    if (!TEST_FUNCTIONS.some(f => f.id === functionId) || functionId === activeFunctionId.value) return
    activeFunctionId.value = functionId
  }

  function algorithmName(algorithmId: string) {
    return ALGORITHMS.find(a => a.id === algorithmId)?.name || algorithmId
  }

  async function addLayer(params: OptimizationParams) {
    const functionId = activeFunctionId.value
    const ws = workspaces.value[functionId]
    const layerParams = { ...params, functionId }
    const count = ws.layers.length + 1
    const layer: SurfaceLayer = {
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${algorithmName(layerParams.algorithm)} ${count}`,
      params: layerParams,
      visible: true,
      color: LAYER_COLORS[(count - 1) % LAYER_COLORS.length],
      lineStyle: 'solid',
      clipStart: 0,
      clipEnd: 0,
      status: 'loading',
      createdAt: Date.now()
    }
    ws.layers.push(layer)
    ws.selectedLayerId = layer.id
    ws.currentStep = 0
    persist()

    try {
      const { data } = await axios.post<OptimizationResult>('/api/optimize', layerParams)
      if (!workspaces.value[functionId].layers.some(l => l.id === layer.id)) return
      if (!validResult(data)) throw new Error('返回路径为空或包含无效坐标')

      const target = workspaces.value[functionId].layers.find(l => l.id === layer.id)
      if (!target) return
      target.result = data
      target.status = 'ready'
      target.error = undefined
      target.clipEnd = data.path.length - 1
      ws.currentStep = 0
    } catch (err) {
      const target = workspaces.value[functionId].layers.find(l => l.id === layer.id)
      if (!target) return
      target.status = 'error'
      target.error = errorMessage(err)
    } finally {
      flushPersist()
    }
  }

  function errorMessage(err: unknown) {
    const axiosError = err as AxiosError<{ detail?: string }>
    if (axiosError.response?.data?.detail) return axiosError.response.data.detail
    if (axiosError.request) return '后端没有响应：请确认服务已启动，然后重试此分层。'
    return axiosError.message || '该分层加载失败，请检查参数后重试。'
  }

  async function retryLayer(layerId: string) {
    const functionId = activeFunctionId.value
    const ws = workspaces.value[functionId]
    const layer = ws.layers.find(l => l.id === layerId)
    if (!layer || layer.status === 'loading') return
    layer.status = 'loading'
    layer.error = undefined
    try {
      const { data } = await axios.post<OptimizationResult>(`/api/optimize`, { ...layer.params, functionId })
      if (!validResult(data)) throw new Error('返回路径为空或包含无效坐标')
      layer.result = data
      layer.status = 'ready'
      const maxStep = data.path.length - 1
      layer.clipStart = Math.min(maxStep, layer.clipStart)
      layer.clipEnd = Math.min(maxStep, Math.max(layer.clipStart, layer.clipEnd || maxStep))
      ws.selectedLayerId = layer.id
    } catch (err) {
      layer.status = 'error'
      layer.error = errorMessage(err)
    } finally {
      flushPersist()
    }
  }

  function removeLayer(layerId: string) {
    const ws = workspace.value
    const index = ws.layers.findIndex(l => l.id === layerId)
    if (index === -1) return
    ws.layers.splice(index, 1)
    if (ws.selectedLayerId === layerId) ws.selectedLayerId = ws.layers[0]?.id || null
    if (ws.selectedLayerId) {
      const selected = ws.layers.find(l => l.id === ws.selectedLayerId)
      ws.currentStep = Math.min(selected?.clipEnd || 0, Math.max(selected?.clipStart || 0, ws.currentStep))
    } else {
      ws.currentStep = 0
    }
  }

  function selectLayer(layerId: string) {
    const layer = layers.value.find(l => l.id === layerId)
    if (!layer) return
    const step = workspace.value.currentStep
    workspace.value.selectedLayerId = layerId
    workspace.value.currentStep = Math.min(layer.clipEnd, Math.max(layer.clipStart, step))
  }

  function toggleLayer(layerId: string) {
    const layer = layers.value.find(l => l.id === layerId)
    if (layer) layer.visible = !layer.visible
  }

  function setLayerColor(layerId: string, color: string) {
    const layer = layers.value.find(l => l.id === layerId)
    if (layer) layer.color = color
  }

  function setLayerLineStyle(layerId: string, lineStyle: SurfaceLineStyle) {
    const layer = layers.value.find(l => l.id === layerId)
    if (layer) layer.lineStyle = lineStyle
  }

  function setClipRange(layerId: string, start: number, end: number) {
    const layer = layers.value.find(l => l.id === layerId)
    if (!layer?.result) return
    const maxStep = layer.result.path.length - 1
    const clipStart = Math.min(maxStep, Math.max(0, Math.round(start)))
    const clipEnd = Math.min(maxStep, Math.max(clipStart, Math.round(end)))
    layer.clipStart = clipStart
    layer.clipEnd = clipEnd
    if (workspace.value.selectedLayerId === layerId) {
      workspace.value.currentStep = Math.min(clipEnd, Math.max(clipStart, workspace.value.currentStep))
    }
  }

  function setCurrentStep(step: number) {
    const selected = selectedLayer.value
    const minStep = selected ? selected.clipStart : 0
    const maxStep = selected ? selected.clipEnd : 0
    workspace.value.currentStep = Math.min(maxStep, Math.max(minStep, Math.round(step)))
  }

  function clippedPath(layer: SurfaceLayer) {
    if (!layer.result) return []
    return layer.result.path.slice(layer.clipStart, layer.clipEnd + 1)
  }

  return {
    activeFunctionId,
    workspaces,
    workspace,
    layers,
    selectedLayer,
    readyLayers,
    visibleReadyLayers,
    setFunction,
    addLayer,
    retryLayer,
    removeLayer,
    selectLayer,
    toggleLayer,
    setLayerColor,
    setLayerLineStyle,
    setClipRange,
    setCurrentStep,
    clippedPath,
    flushPersist
  }
})
