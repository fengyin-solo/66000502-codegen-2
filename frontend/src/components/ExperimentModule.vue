<template>
  <section class="experiment-module">
    <ControlPanel />
    <div class="vis-grid" v-if="store.result">
      <div class="vis-item"><ContourPlot /></div>
      <div class="hint-card">
        <h3>🏔️ 三维分层曲面</h3>
        <p>
          多次设置的路径可在“三维曲面”模块中叠加、分层开关、分段截取与单独配色。
        </p>
        <el-button type="primary" @click="$emit('openSurface')">进入三维曲面模块</el-button>
      </div>
    </div>
    <ConvergenceChart v-if="store.result" />
    <el-empty v-else description="配置参数并开始优化，先得到一条优化路径" :image-size="90" />
  </section>
</template>

<script setup lang="ts">
import ControlPanel from './ControlPanel.vue'
import ContourPlot from './ContourPlot.vue'
import ConvergenceChart from './ConvergenceChart.vue'
import { useOptimizationStore } from '@/store/optimization'

defineEmits<{ openSurface: [] }>()
const store = useOptimizationStore()
</script>

<style scoped>
.experiment-module { min-height:430px }
.vis-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:16px; margin-top:16px }
.vis-item, .hint-card { background:#fff; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,.06) }
.hint-card { padding:24px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; text-align:center; color:#475569 }
.hint-card h3 { color:#1e293b }
.hint-card p { line-height:1.7 }
@media (max-width: 900px) {
  .vis-grid { grid-template-columns:1fr }
}
</style>
