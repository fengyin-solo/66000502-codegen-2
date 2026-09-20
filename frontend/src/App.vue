<template>
  <div class="app-container">
    <header class="app-header">
      <div>
        <h1>📐 数值优化算法逐帧可视化教学平台</h1>
        <p class="subtitle">梯度下降 · 牛顿法 · 共轭梯度 · 模拟退火 | 等高线 · 三维曲面 · 分层收敛</p>
      </div>
      <el-radio-group v-model="activeView" size="large">
        <el-radio-button label="experiment">单次实验</el-radio-button>
        <el-radio-button label="surface">三维曲面</el-radio-button>
        <el-radio-button label="convergence">收敛曲线</el-radio-button>
      </el-radio-group>
    </header>
    <main class="app-main">
      <KeepAlive include="SurfaceModule,ConvergenceModule">
        <component :is="currentComponent" @open-surface="activeView = 'surface'" />
      </KeepAlive>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ExperimentModule from './components/ExperimentModule.vue'
import SurfaceModule from './components/SurfaceModule.vue'
import ConvergenceModule from './components/ConvergenceModule.vue'

const activeView = ref<'experiment' | 'surface' | 'convergence'>('surface')
const currentComponent = computed(() => {
  if (activeView.value === 'surface') return SurfaceModule
  if (activeView.value === 'convergence') return ConvergenceModule
  return ExperimentModule
})
</script>

<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#f5f6fa}
.app-container{min-height:100vh}
.app-header{background:linear-gradient(135deg,#0f2027,#203a43,#2c5364);color:#fff;padding:18px 40px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.app-header h1{font-size:1.55rem}
.subtitle{opacity:.8;margin-top:4px;font-size:.85rem}
.app-main{padding:16px 40px}
@media (max-width: 980px) {
  .app-header { align-items:flex-start; flex-direction:column }
  .app-main { padding:16px }
}
</style>
