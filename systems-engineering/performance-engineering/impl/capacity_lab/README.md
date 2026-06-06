# Capacity Lab — Chain-1 L3

可运行的容量估算实验，验证排队论在容量规划中的应用。

## 快速开始

```bash
# 实验 1：单场景容量估算
python3 capacity_calculator.py --scenario simple_api --target-qps 10000 --peak-factor 2.5
python3 capacity_calculator.py --scenario cpu_heavy --target-qps 5000 --peak-factor 3.0 --node-type large

# 实验 2：对比不同节点规格的成本和利用率
python3 capacity_calculator.py --scenario complex_api --target-qps 5000 --compare

# 实验 3：交互式容量规划
python3 capacity_calculator.py --interactive

# 实验 4：排队论模拟 — 单点运行
python3 capacity_simulator.py --lambda 1000 --mu 500 --servers 4 --time 30

# 实验 5：利用率-延迟扫描（核心实验）
python3 capacity_simulator.py --sweep --max-rho 0.95
```

## 实验设计原理

### capacity_calculator.py

基于工程容量公式 + 排队论修正：

```
单节点 CPU 承载 QPS = (effective_cores × 1000) / cpu_ms_per_request
单节点 Memory 承载 QPS = (memory_gb × 1024) / memory_mb_per_request
单节点容量 = min(CPU, Memory)
安全容量 = 单节点容量 × safety_threshold (默认 70%)
所需节点 = peak_qps / 安全容量
```

排队论修正：
```
利用率 ρ = peak_qps / (nodes × 单节点 CPU 承载 QPS)
M/M/1 平均排队延迟 = service_time × ρ / (1 - ρ)
```

关键洞察：
- **ρ < 50%**：过度配置，成本高但延迟低
- **ρ = 70%**：经典安全阈值（本计算器默认值）
- **ρ = 80%**：平均排队延迟 = 服务时间，开始感知
- **ρ > 90%**：P99 延迟指数级上升，系统脆弱

### capacity_simulator.py

离散事件模拟（DES）实现的 M/M/c 队列：
- **到达过程**：泊松过程（间隔服从指数分布）
- **服务过程**：指数分布服务时间
- **队列规则**：FIFO，无限队列（可配置最大长度）

验证目标：
1. **Little's Law**：`L = λ × W`（模拟结果误差 < 2%）
2. **利用率-延迟曲线**：ρ 接近 1 时延迟非线性上升
3. **安全阈值验证**：ρ = 80% 时排队延迟显著增加

## 核心观察点

1. **节点规格对比**：
   - `small` × N vs `large` × (N/4)：总成本相近，但大节点管理开销更低
   - 但如果服务是单线程的，大节点的多核无法利用，反而浪费

2. **超线程修正**：
   - 本计算器使用 `effective_cores = physical_cores × 1.2`（而非 × 2）
   - 因为超线程的两个逻辑核共享执行单元，不能达到 2x 性能

3. **瓶颈切换**：
   - 低 QPS 时：CPU 是瓶颈
   - 高 QPS 时：Memory 可能成为瓶颈（每个请求的内存占用累积）
   - 使用 `--compare` 可以看到不同节点规格下瓶颈是否变化

4. **排队延迟 vs 服务延迟**：
   - ρ = 50% 时：排队延迟 ≈ 0.1 × 服务时间（可忽略）
   - ρ = 80% 时：排队延迟 ≈ 1.0 × 服务时间（显著）
   - ρ = 95% 时：排队延迟 ≈ 20 × 服务时间（灾难）
