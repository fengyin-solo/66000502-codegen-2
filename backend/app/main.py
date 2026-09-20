import math
import random
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Optimization Visualizer")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

FUNCTIONS = {
    "rosenbrock": lambda x, y: (1 - x) ** 2 + 100 * (y - x ** 2) ** 2,
    "himmelblau": lambda x, y: (x ** 2 + y - 11) ** 2 + (x + y ** 2 - 7) ** 2,
    "rastrigin": lambda x, y: 20 + x ** 2 - 10 * math.cos(2 * math.pi * x) + y ** 2 - 10 * math.cos(2 * math.pi * y),
    "sphere": lambda x, y: x ** 2 + y ** 2,
    "beale": lambda x, y: (1.5 - x + x * y) ** 2 + (2.25 - x + x * y ** 2) ** 2 + (2.625 - x + x * y ** 3) ** 2,
    "booth": lambda x, y: (x + 2 * y - 7) ** 2 + (2 * x + y - 5) ** 2,
}

GRADIENTS = {
    "rosenbrock": lambda x, y: np.array([-2 * (1 - x) - 400 * x * (y - x ** 2), 200 * (y - x ** 2)]),
    "himmelblau": lambda x, y: np.array([4 * x * (x ** 2 + y - 11) + 2 * (x + y ** 2 - 7), 2 * (x ** 2 + y - 11) + 4 * y * (x + y ** 2 - 7)]),
    "rastrigin": lambda x, y: np.array([2 * x + 20 * math.pi * math.sin(2 * math.pi * x), 2 * y + 20 * math.pi * math.sin(2 * math.pi * y)]),
    "sphere": lambda x, y: np.array([2 * x, 2 * y]),
    "beale": lambda x, y: np.array([
        2 * (1.5 - x + x * y) * (-1 + y) + 2 * (2.25 - x + x * y ** 2) * (-1 + y ** 2) + 2 * (2.625 - x + x * y ** 3) * (-1 + y ** 3),
        2 * (1.5 - x + x * y) * x + 2 * (2.25 - x + x * y ** 2) * (2 * x * y) + 2 * (2.625 - x + x * y ** 3) * (3 * x * y ** 2)
    ]),
    "booth": lambda x, y: np.array([2 * (x + 2 * y - 7) + 4 * (2 * x + y - 5), 4 * (x + 2 * y - 7) + 2 * (2 * x + y - 5)]),
}

HESSIANS = {
    "rosenbrock": lambda x, y: np.array([
        [2 - 400 * y + 1200 * x ** 2, -400 * x],
        [-400 * x, 200]
    ]),
    "sphere": lambda x, y: np.array([[2, 0], [0, 2]]),
    "booth": lambda x, y: np.array([[10, 8], [8, 10]]),
}

RANGES = {
    "rosenbrock": (-2, 2, -1, 3),
    "himmelblau": (-6, 6, -6, 6),
    "rastrigin": (-5.12, 5.12, -5.12, 5.12),
    "sphere": (-5, 5, -5, 5),
    "beale": (-4.5, 4.5, -4.5, 4.5),
    "booth": (-10, 10, -10, 10),
}


class OptimizationRequest(BaseModel):
    algorithm: str = "gradient_descent"
    functionId: str = "rosenbrock"
    x0: float = -1.5
    y0: float = 2.5
    learningRate: float = Field(default=0.01, gt=0, le=10)
    iterations: int = Field(default=100, ge=1, le=1000)
    momentum: float = Field(default=0.9, ge=0, lt=1)
    temperature: float = Field(default=100.0, gt=0, le=10000)
    coolingRate: float = Field(default=0.95, gt=0, lt=1)


@app.post("/api/optimize")
def optimize(req: OptimizationRequest):
    if req.functionId not in FUNCTIONS:
        raise HTTPException(status_code=400, detail=f"不支持的测试函数：{req.functionId}")
    if req.algorithm not in {"gradient_descent", "newton", "conjugate_gradient", "simulated_annealing"}:
        raise HTTPException(status_code=400, detail=f"不支持的算法：{req.algorithm}")

    fn = FUNCTIONS[req.functionId]
    grad_fn = GRADIENTS.get(req.functionId)
    g_fn = grad_fn if grad_fn else (lambda x, y: np.array([
        (fn(x + 1e-5, y) - fn(x - 1e-5, y)) / 2e-5,
        (fn(x, y + 1e-5) - fn(x, y - 1e-5)) / 2e-5
    ]))

    x_min, x_max, y_min, y_max = RANGES[req.functionId]

    def reject(message: str) -> None:
        raise HTTPException(status_code=400, detail=message)

    def finite_value(vx: float, vy: float) -> float:
        try:
            z = float(fn(vx, vy))
        except (OverflowError, ValueError) as exc:
            reject("函数值溢出：请调小步长、温度或迭代次数后重试此分层。")
        if not np.isfinite(z):
            reject("函数值不是有限数：路径已发散，请调整参数后重试此分层。")
        return z

    def record(step: int, vx: float, vy: float):
        if not (np.isfinite(vx) and np.isfinite(vy)):
            reject(f"第 {step} 步坐标不是有限数：路径已发散，请调小步长后重试此分层。")
        if not (x_min <= vx <= x_max and y_min <= vy <= y_max):
            reject(f"第 {step} 步离开了当前函数曲面的显示范围，请调整初始点或步长后重试此分层。")
        z = finite_value(vx, vy)
        path.append({"step": step, "x": float(vx), "y": float(vy), "z": z})

    x, y = float(req.x0), float(req.y0)
    path: list[dict] = []
    record(0, x, y)

    if req.algorithm == "gradient_descent":
        vx, vy = 0.0, 0.0
        for i in range(req.iterations):
            g = g_fn(x, y)
            vx = req.momentum * vx - req.learningRate * g[0]
            vy = req.momentum * vy - req.learningRate * g[1]
            x += vx; y += vy
            record(i + 1, x, y)

    elif req.algorithm == "newton":
        hess_fn = HESSIANS.get(req.functionId)
        if hess_fn is None:
            # fallback to gradient descent
            for i in range(req.iterations):
                g = g_fn(x, y)
                x -= req.learningRate * g[0]
                y -= req.learningRate * g[1]
                record(i + 1, x, y)
        else:
            for i in range(req.iterations):
                g = g_fn(x, y)
                H = hess_fn(x, y)
                try:
                    dx = np.linalg.solve(H, -g)
                except np.linalg.LinAlgError:
                    dx = -g * req.learningRate
                x += dx[0]; y += dx[1]
                record(i + 1, x, y)

    elif req.algorithm == "conjugate_gradient":
        g = g_fn(x, y)
        d = -g.copy()
        for i in range(req.iterations):
            # Line search (simple)
            alpha = req.learningRate
            x_new = x + alpha * d[0]
            y_new = y + alpha * d[1]
            g_new = g_fn(x_new, y_new)
            if not np.all(np.isfinite(g_new)):
                reject(f"第 {i + 1} 步梯度不是有限数：路径已发散，请调小步长后重试此分层。")
            beta = max(0, (g_new @ g_new) / (g @ g + 1e-10))
            d = -g_new + beta * d
            x, y, g = x_new, y_new, g_new
            record(i + 1, x, y)

    elif req.algorithm == "simulated_annealing":
        T = req.temperature
        best_x, best_y = x, y
        best_z = path[0]["z"]
        for i in range(req.iterations):
            nx = x + random.gauss(0, T / req.temperature * 2)
            ny = y + random.gauss(0, T / req.temperature * 2)
            valid_candidate = x_min <= nx <= x_max and y_min <= ny <= y_max
            if valid_candidate:
                try:
                    nz = finite_value(nx, ny)
                except HTTPException:
                    valid_candidate = False
                    nz = path[-1]["z"]
            else:
                nz = path[-1]["z"]
            current_z = finite_value(x, y)
            if valid_candidate and (nz < current_z or random.random() < math.exp(-(nz - current_z) / max(T, 1e-5))):
                x, y = nx, ny
                if nz < best_z:
                    best_x, best_y = x, y
                    best_z = nz
            T *= req.coolingRate
            record(i + 1, x, y)

    final = path[-1]
    return {
        "params": req.model_dump(),
        "path": path,
        "finalPoint": [final["x"], final["y"]],
        "finalValue": final["z"],
        "iterations": len(path) - 1,
        "converged": abs(final["z"]) < 1e-3 or len(path) >= req.iterations
    }
