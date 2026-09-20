<template>
  <div class="layer-panel">
    <div class="lp-add">
      <h4>＋ 添加分层（同一函数、不同设置各跑一次）</h4>
      <div class="lp-form">
        <span class="lp-label">算法</span>
        <el-select v-model="form.algorithm" size="small">
          <el-option v-for="a in ALGORITHMS" :key="a.id" :label="a.name" :value="a.id" />
        </el-select>
        <span class="lp-label">起点</span>
        <div class="lp-xy">
          <el-input-number v-model="form.x0" :min="-10" :max="10" :step="0.5" size="small" :controls="false" />
          <el-input-number v-model="form.y0" :min="-10" :max="10" :step="0.5" size="small" :controls="false" />
        </div>
        <span class="lp-label">学习率</span>
        <el-input-number v-model="form.learningRate" :min="0.001" :max="1" :step="0.01" :precision="3" size="small" :controls="false" />
        <span class="lp-label">迭代</span>
        <el-input-number v-model="form.iterations" :min="10" :max="500" :step="10" size="small" :controls="false" />
        <template v-if="form.algorithm === 'gradient_descent'">
          <span class="lp-label">动量</span>
          <el-input-number v-model="form.momentum" :min="0" :max="0.99" :step="0.1" :precision="1" size="small" :controls="false" />
        </template>
        <template v-if="form.algorithm === 'simulated_annealing'">
          <span class="lp-label">温度</span>
          <el-input-number v-model="form.temperature" :min="1" :max="1000" :step="10" size="small" :controls="false" />
        </template>
      </div>
      <el-button type="primary" size="small" style="width:100%;margin-top:10px" :loading="adding" @click="add">
        添加分层
      </el-button>
    </div>

    <div class="lp-list">
      <el-empty
        v-if="!store.functionLayers.length" :image-size="56"
        description="还没有分层：用不同设置各跑一次，路径会分层叠在同一张曲面上"
      />
      <div
        v-for="layer in store.functionLayers" :key="layer.id"
        class="lp-item" :class="{ current: layer.id === store.currentLayerId }"
        @click="store.setCurrentLayer(layer.id)"
      >
        <div class="lp-head">
          <el-color-picker v-model="layer.color" size="small" @click.stop />
          <span class="lp-name">{{ layer.name }}</span>
          <el-switch
            v-model="layer.visible" :disabled="layer.status !== 'ok'"
            style="margin-left:auto" @click.stop
          />
          <el-button link type="danger" size="small" @click.stop="store.removeLayer(layer.id)">删除</el-button>
        </div>
        <div class="lp-meta">{{ metaText(layer) }}</div>

        <div v-if="layer.status === 'loading'" class="lp-status">⏳ 正在计算该分层…</div>
        <div v-else-if="layer.status === 'error'" class="lp-error" @click.stop>
          <el-alert type="error" :closable="false" :title="`该分层加载失败：${layer.error}`" />
          <el-button size="small" style="margin-top:6px" @click="store.retryLayer(layer.id)">重试</el-button>
        </div>
        <template v-else>
          <div class="lp-row">
            <span class="lp-label">样式</span>
            <el-select v-model="layer.lineStyle" size="small" style="width:96px" @click.stop>
              <el-option label="实线" value="solid" />
              <el-option label="虚线" value="dashed" />
              <el-option label="散点" value="points" />
            </el-select>
            <span class="lp-label">末值</span>
            <span class="lp-value">{{ fmtFinal(layer) }}</span>
          </div>
          <div class="lp-row" @click.stop>
            <span class="lp-label">截取</span>
            <el-slider v-model="layer.range" range size="small" :min="0" :max="layerMax(layer)" style="flex:1" />
          </div>
          <div class="lp-range-text">第 {{ layer.range[0] }} – {{ layer.range[1] }} 步 / 共 {{ layerMax(layer) }} 步</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'
import { useSurfaceModuleStore } from '../store/surfaceModule'
import { ALGORITHMS } from '../types'
import type { SurfaceLayer } from '../types'

const store = useSurfaceModuleStore()

const form = reactive({
  algorithm: 'gradient_descent',
  x0: -1.5, y0: 2.5,
  learningRate: 0.01, iterations: 100,
  momentum: 0.9, temperature: 100, coolingRate: 0.95,
})

const adding = computed(() => store.functionLayers.some(l => l.status === 'loading'))

function add() { store.addLayer({ ...form }) }

function layerMax(layer: SurfaceLayer) {
  return layer.result ? Math.max(0, layer.result.path.length - 1) : 0
}

function metaText(layer: SurfaceLayer) {
  const p = layer.params
  return `lr=${p.learningRate} · 迭代${p.iterations} · 起点(${p.x0}, ${p.y0})`
}

function fmtFinal(layer: SurfaceLayer) {
  if (!layer.result) return '—'
  const z = layer.result.path[layer.result.path.length - 1].z
  if (!Number.isFinite(z)) return '—'
  return Math.abs(z) >= 1000 || (z !== 0 && Math.abs(z) < 1e-3) ? z.toExponential(2) : z.toFixed(4)
}
</script>

<style scoped>
.layer-panel { display:flex; flex-direction:column; gap:12px; min-width:0 }
.lp-add { border:1px solid #ebeef5; border-radius:8px; padding:12px }
.lp-add h4 { font-size:13px; color:#303133; margin-bottom:10px }
.lp-form { display:grid; grid-template-columns:auto 1fr auto 1fr; gap:8px; align-items:center }
.lp-label { font-size:12px; color:#909399; white-space:nowrap }
.lp-xy { display:flex; gap:4px }
.lp-xy .el-input-number { width:70px }
.lp-form .el-input-number { width:100% }
.lp-list { display:flex; flex-direction:column; gap:10px; max-height:560px; overflow-y:auto }
.lp-item { border:1px solid #ebeef5; border-radius:8px; padding:10px 12px; cursor:pointer; transition:border-color .15s }
.lp-item:hover { border-color:#c6e2ff }
.lp-item.current { border-color:#409eff; box-shadow:0 0 0 1px #409eff inset }
.lp-head { display:flex; align-items:center; gap:8px }
.lp-name { font-size:13px; font-weight:600; color:#303133; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.lp-meta { font-size:11px; color:#a0a4ab; margin-top:4px; font-family:ui-monospace,monospace }
.lp-status { font-size:12px; color:#909399; margin-top:8px }
.lp-error { margin-top:8px }
.lp-row { display:flex; align-items:center; gap:8px; margin-top:8px }
.lp-value { font-size:12px; color:#606266; font-family:ui-monospace,monospace }
.lp-range-text { font-size:11px; color:#a0a4ab; margin-top:2px; text-align:right }
</style>
