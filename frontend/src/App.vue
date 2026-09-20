<template>
  <div class="app-container">
    <header class="app-header">
      <h1>📐 数值优化算法逐帧可视化教学平台</h1>
      <p class="subtitle">梯度下降 · 牛顿法 · 共轭梯度 · 模拟退火 | 2D等高线 + 3D曲面分层</p>
    </header>
    <nav class="module-nav">
      <button
        v-for="m in MODULES" :key="m.id"
        class="nav-btn" :class="{ active: activeModule === m.id }"
        @click="activeModule = m.id"
      >{{ m.icon }} {{ m.name }}</button>
    </nav>
    <main class="app-main">
      <ControlPanel v-show="activeModule !== 'surface'" />
      <keep-alive>
        <component :is="activeView" />
      </keep-alive>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import OverviewView from './views/OverviewView.vue'
import ConvergenceView from './views/ConvergenceView.vue'
import SurfaceModule from './components/SurfaceModule.vue'

const MODULES = [
  { id: 'overview', name: '总览', icon: '🧭' },
  { id: 'surface', name: '三维曲面分层', icon: '🏔️' },
  { id: 'convergence', name: '收敛曲线', icon: '📉' },
] as const

const activeModule = ref<string>('overview')
const views = { overview: OverviewView, surface: SurfaceModule, convergence: ConvergenceView }
const activeView = computed(() => views[activeModule.value as keyof typeof views])
</script>

<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#f5f6fa}
.app-container{min-height:100vh}
.app-header{background:linear-gradient(135deg,#0f2027,#203a43,#2c5364);color:#fff;padding:20px 40px}
.app-header h1{font-size:1.6rem}
.subtitle{opacity:.8;margin-top:4px;font-size:.85rem}
.module-nav{display:flex;gap:8px;padding:10px 40px;background:#fff;border-bottom:1px solid #e8e8e8}
.nav-btn{border:1px solid #dcdfe6;background:#fff;border-radius:6px;padding:7px 18px;font-size:13px;cursor:pointer;color:#606266;transition:all .15s}
.nav-btn:hover{border-color:#409eff;color:#409eff}
.nav-btn.active{background:#409eff;border-color:#409eff;color:#fff}
.app-main{padding:16px 40px}
</style>
