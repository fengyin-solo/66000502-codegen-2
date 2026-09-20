<template>
  <div>
    <ConvergenceChart v-if="store.result" />
    <el-empty v-else description="先在上方运行一次优化，再查看收敛曲线" />
  </div>
</template>

<script setup lang="ts">
import ConvergenceChart from '../components/ConvergenceChart.vue'
import { useOptimizationStore } from '../store/optimization'
const store = useOptimizationStore()
</script>
