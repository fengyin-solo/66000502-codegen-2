<template>
  <div>
    <div class="vis-grid" v-if="store.result">
      <div class="vis-item"><ContourPlot /></div>
      <div class="vis-item"><Surface3D /></div>
    </div>
    <el-empty v-else description="先在上方设置参数并点击「开始优化」，这里会展示等高线与 3D 轨迹" />
  </div>
</template>

<script setup lang="ts">
import ContourPlot from '../components/ContourPlot.vue'
import Surface3D from '../components/Surface3D.vue'
import { useOptimizationStore } from '../store/optimization'
const store = useOptimizationStore()
</script>

<style scoped>
.vis-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px }
</style>
