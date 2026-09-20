export interface TestFunction {
  id: string
  name: string
  formula: string
  xRange: [number, number]
  yRange: [number, number]
  minima?: [number, number][]
}

export interface Algorithm {
  id: string
  name: string
  description: string
}

export interface OptimizationParams {
  algorithm: string
  functionId: string
  x0: number
  y0: number
  learningRate: number
  iterations: number
  momentum?: number
  temperature?: number
  coolingRate?: number
}

export interface IterationPoint {
  step: number
  x: number
  y: number
  z: number
}

export interface OptimizationResult {
  params: OptimizationParams
  path: IterationPoint[]
  finalPoint: [number, number]
  finalValue: number
  iterations: number
  converged: boolean
}

export type SurfaceLayerStatus = 'ready' | 'loading' | 'error'
export type SurfaceLineStyle = 'solid' | 'dashed' | 'dotted'

export interface SurfaceLayer {
  id: string
  name: string
  params: OptimizationParams
  visible: boolean
  color: string
  lineStyle: SurfaceLineStyle
  clipStart: number
  clipEnd: number
  status: SurfaceLayerStatus
  error?: string
  result?: OptimizationResult
  createdAt: number
}

export interface SurfaceWorkspace {
  layers: SurfaceLayer[]
  selectedLayerId: string | null
  currentStep: number
}

export const TEST_FUNCTIONS: TestFunction[] = [
  { id: 'rosenbrock', name: 'Rosenbrock 香蕉函数', formula: 'f=(1-x)²+100(y-x²)²', xRange: [-2, 2], yRange: [-1, 3], minima: [[1, 1]] },
  { id: 'himmelblau', name: 'Himmelblau函数', formula: 'f=(x²+y-11)²+(x+y²-7)²', xRange: [-6, 6], yRange: [-6, 6], minima: [[3, 2], [-2.805118, 3.131312], [-3.77931, -3.283186], [3.584428, -1.848126]] },
  { id: 'rastrigin', name: 'Rastrigin函数', formula: 'f=20+x²-10cos(2πx)+y²-10cos(2πy)', xRange: [-5.12, 5.12], yRange: [-5.12, 5.12], minima: [[0, 0]] },
  { id: 'sphere', name: 'Sphere球函数', formula: 'f=x²+y²', xRange: [-5, 5], yRange: [-5, 5], minima: [[0, 0]] },
  { id: 'beale', name: 'Beale函数', formula: 'f=(1.5-x+xy)²+(2.25-x+xy²)²+(2.625-x+xy³)²', xRange: [-4.5, 4.5], yRange: [-4.5, 4.5], minima: [[3, 0.5]] },
  { id: 'booth', name: 'Booth函数', formula: 'f=(x+2y-7)²+(2x+y-5)²', xRange: [-10, 10], yRange: [-10, 10], minima: [[1, 3]] },
]

export const ALGORITHMS: Algorithm[] = [
  { id: 'gradient_descent', name: '梯度下降', description: '沿负梯度方向迭代更新，包含动量项' },
  { id: 'newton', name: '牛顿法', description: '利用Hessian二阶导数加速收敛' },
  { id: 'conjugate_gradient', name: '共轭梯度', description: '共轭方向搜索，适合大规模问题' },
  { id: 'simulated_annealing', name: '模拟退火', description: '概率接受劣解跳出局部最优' },
]