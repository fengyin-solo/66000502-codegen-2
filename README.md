# 数值优化算法逐帧可视化教学平台

基于Vue 3 + FastAPI的优化算法交互式教学工具，支持梯度下降/牛顿法/共轭梯度/模拟退火四种算法的2D等高线、3D曲面与多参数分层路径对比。

## 目标用户
机器学习方向学生、优化理论研究者、算法教学者

## 技术栈
- 前端: Vue 3 + TypeScript + Vite + Pinia + Element Plus + ECharts + Three.js
- 后端: Python FastAPI + NumPy + SciPy

## 核心功能
1. 四种优化算法实现：梯度下降、牛顿法、共轭梯度、模拟退火
2. 2D函数等高线绘制(Canvas) + 3D曲面(Three.js)双视图渲染
3. 独立三维曲面模块：多次运行结果分层叠加，支持逐层显隐、区间截取、颜色/线型调整
4. 曲面标注函数最低点与当前播放位置，并在分层收敛曲线中同步当前步数
5. 步长、动量、初始点等参数实时调节，单个分层失败时只显示该层错误并保留其他分层
6. 分层配置、截取范围与当前组合持久化到 localStorage，模块切换和页面刷新后自动恢复
7. 预设6种测试函数(Rosenbrock/Himmelblau/Rastrigin/Sphere/Beale/Booth)
8. 收敛曲线(ECharts)显示每步函数值下降

## 项目结构
```
solo-6600050/
├── frontend/         Vue 3 + TypeScript + Vite
│   └── src/components/
│       ├── ExperimentModule.vue  # 单次实验模块
│       ├── SurfaceModule.vue     # Three.js 三维曲面分层模块
│       ├── ConvergenceModule.vue # 多分层收敛曲线
│       ├── ContourPlot.vue       # Canvas 2D等高线
│       ├── Surface3D.vue         # 旧版单路径3D曲面
│       ├── ControlPanel.vue      # 参数面板
│       └── ConvergenceChart.vue  # ECharts收敛曲线
│   ├── store/
│   │   ├── optimization.ts       # 单次实验状态
│   │   └── surface.ts            # 分层状态与localStorage持久化
│   └── lib/
│       ├── functions.ts          # 前端函数求值
│       └── surfaceGeometry.ts    # 3D曲面网格构建
└── backend/          FastAPI + NumPy + SciPy
    └── app/main.py
```