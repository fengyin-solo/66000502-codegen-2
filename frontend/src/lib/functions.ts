import { TEST_FUNCTIONS } from '@/types'

export function evaluateFunction(functionId: string, x: number, y: number): number {
  switch (functionId) {
    case 'rosenbrock':
      return (1 - x) ** 2 + 100 * (y - x ** 2) ** 2
    case 'himmelblau':
      return (x ** 2 + y - 11) ** 2 + (x + y ** 2 - 7) ** 2
    case 'rastrigin':
      return 20 + x ** 2 - 10 * Math.cos(2 * Math.PI * x) + y ** 2 - 10 * Math.cos(2 * Math.PI * y)
    case 'sphere':
      return x ** 2 + y ** 2
    case 'beale':
      return (1.5 - x + x * y) ** 2 + (2.25 - x + x * y ** 2) ** 2 + (2.625 - x + x * y ** 3) ** 2
    case 'booth':
      return (x + 2 * y - 7) ** 2 + (2 * x + y - 5) ** 2
    default:
      return evaluateFunction('rosenbrock', x, y)
  }
}

export function getTestFunction(functionId: string) {
  return TEST_FUNCTIONS.find(f => f.id === functionId) || TEST_FUNCTIONS[0]
}
