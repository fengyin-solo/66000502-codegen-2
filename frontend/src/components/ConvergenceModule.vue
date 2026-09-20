<template>
  <section class="convergence-module card">
    <div class="header">
      <div>
        <h3>📉 分层收敛曲线</h3>
        <p>按曲面模块中的开关与截取范围同步展示；修改后回到曲面仍保持原组合。</p>
      </div>
      <el-tag>{{ currentFunction.name }}</el-tag>
    </div>
    <div ref="chartEl" class="chart"></div>
    <el-empty v-if="!store.visibleReadyLayers.length" description="请先在三维曲面模块加入并显示分层" :image-size="80" />
  </section>
</template>

<script setup lang="ts">
import { onActivated, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { useSurfaceStore } from '@/store/surface'
import { getTestFunction } from '@/lib/functions'

const store = useSurfaceStore()
const chartEl = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

const currentFunction = ref(getTestFunction(store.activeFunctionId))

function updateChart() {
  if (!chart) return
  currentFunction.value = getTestFunction(store.activeFunctionId)
  const layers = store.visibleReadyLayers

  if (!layers.length) {
    chart.clear()
    return
  }

  const selectedId = store.workspace.selectedLayerId
  chart.setOption({
    backgroundColor: 'transparent',
    color: layers.map(l => l.color),
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number | string) => typeof value === 'number' ? value.toFixed(5) : value
    },
    legend: {
      top: 0,
      data: layers.map(l => l.name)
    },
    grid: { left: 60, right: 28, top: 52, bottom: 48 },
    xAxis: {
      type: 'value',
      name: '迭代步数',
      nameLocation: 'middle',
      nameGap: 28,
      min: Math.min(...layers.map(l => l.clipStart)),
      max: Math.max(...layers.map(l => l.clipEnd))
    },
    yAxis: {
      type: 'value',
      name: 'f(x, y)',
      nameLocation: 'middle',
      nameGap: 45,
      scale: true
    },
    series: layers.map(layer => ({
      name: layer.name,
      type: 'line',
      showSymbol: false,
      data: store.clippedPath(layer).map(p => [p.step, p.z]),
      lineStyle: {
        color: layer.color,
        width: 2.2,
        type: layer.lineStyle === 'solid' ? 'solid' : layer.lineStyle
      },
      itemStyle: { color: layer.color },
      emphasis: { focus: 'series' as const },
      markLine: layer.id === selectedId ? {
        symbol: 'none',
        silent: true,
        label: { formatter: '当前步', color: '#334155' },
        lineStyle: { color: '#334155', type: 'dashed', width: 1.2 },
        data: [{ xAxis: store.workspace.currentStep }]
      } : undefined,
      markPoint: layer.id === selectedId && layer.visible ? {
        symbolSize: 48,
        label: { fontSize: 10 },
        data: [{ coord: [store.workspace.currentStep, layer.result?.path[store.workspace.currentStep]?.z ?? 0] }]
      } : undefined
    })),
    animation: false
  }, true)
}

function resize() {
  chart?.resize()
}

onMounted(() => {
  chart = echarts.init(chartEl.value)
  updateChart()
  window.addEventListener('resize', resize)
})
onActivated(() => {
  updateChart()
  requestAnimationFrame(resize)
})
watch(() => [store.activeFunctionId, store.workspace, store.layers], updateChart, { deep: true })
onUnmounted(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.convergence-module { min-height:380px; position:relative }
.header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:8px }
.header h3 { font-size:15px; color:#1e293b }
.header p { margin-top:4px; font-size:12px; color:#64748b }
.chart { width:100%; height:360px }
.convergence-module :deep(.el-empty) { position:absolute; inset:48px 0 0; pointer-events:none }
</style>
