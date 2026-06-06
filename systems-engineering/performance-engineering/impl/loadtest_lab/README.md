# Load Test Lab — Chain-1 L3

可运行的负载测试实验，验证压测方法论中的核心概念。

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动目标服务（终端 A）
python3 target_server.py --port 8080

# 3. 运行压测（终端 B）

## 实验 1：Closed vs Open Model 差异
# Closed model：200 并发循环请求
python3 load_tester.py --url http://localhost:8080/api/slow \
    --model closed --concurrency 200 --duration 30 --json report_closed.json

# Open model：固定 100 RPS
python3 load_tester.py --url http://localhost:8080/api/slow \
    --model open --rps 100 --duration 30 --json report_open.json

# 对比两个报告的 P99：open model 通常更高，因为它不会因为响应慢而自动降速

## 实验 2：阶梯加压（找到崩溃点）
python3 load_tester.py --url http://localhost:8080/api/variable \
    --model closed --stages "10:10,50:15,100:15,200:15,300:15" \
    --json report_stages.json

## 实验 3：Coordinated Omission 演示
# 对 /api/timeout 端点（10% 概率 3s 延迟）分别用两种模型压测
python3 load_tester.py --url http://localhost:8080/api/timeout \
    --model closed --concurrency 50 --duration 30

python3 load_tester.py --url http://localhost:8080/api/timeout \
    --model open --rps 50 --duration 30
# 注意 open model 的 "CO Corrected P99" 与原始 P99 的差异

## 实验 4：CPU 瓶颈定位
python3 load_tester.py --url http://localhost:8080/api/cpu \
    --model closed --concurrency 100 --duration 30
# QPS 不再随并发线性增长时，说明到达 CPU 瓶颈
```

## 实验设计原理

| 端点 | 模拟场景 | 预期现象 |
|---|---|---|
| `/api/fast` | 纯内存缓存命中 | QPS 极高，延迟稳定 |
| `/api/slow` | 数据库查询（100ms） | QPS 上限 ≈ 并发/0.1s |
| `/api/cpu` | CPU 密集型计算 | QPS 与并发非线性增长，CPU 饱和 |
| `/api/error` | 50% 错误率 | 错误率应稳定在 50% 左右 |
| `/api/variable` | 长尾延迟 | P99 显著高于 P50 |
| `/api/timeout` | 偶发超时 | 测试压测工具的超时处理能力 |

## 核心观察点

1. **Closed Model 的 P99 幻觉**：
   - 当服务端变慢时，closed model 的客户端会"配合"等待，导致测出的 P99 偏低。
   - 对 `/api/timeout` 用 closed model 压测，P99 可能只有 ~300ms（因为慢请求拖住了 worker，减少了新请求）。
   - 用 open model 压测，P99 会接近 3000ms（真实超时时间），且 CO 修正后会更高。

2. **QPS 与并发数的关系**：
   - `/api/fast`：QPS ∝ 并发数（线性）
   - `/api/slow`：QPS 有上限（并发 × 1000ms / 100ms = 并发 × 10）
   - `/api/cpu`：QPS 很快饱和（CPU 核心数限制）

3. **错误预算**：
   - `/api/error` 的 50% 错误率可以帮助理解：当系统过载时，SLO 错误预算如何被消耗。
