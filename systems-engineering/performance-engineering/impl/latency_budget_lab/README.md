# Latency Budget Lab — Chain-1 L3

可运行的延迟预算实验，训练"把端到端延迟拆解到组件"的能力。

## 快速开始

```bash
# 安装依赖（复用 loadtest_lab 的 venv 或新建）
pip install -r requirements.txt

# 实验 1：内置场景延迟预算分析
python3 budget_calculator.py --scenario web_api
python3 budget_calculator.py --scenario microservice
python3 budget_calculator.py --scenario ai_inference

# 实验 2：交互式构建自定义预算
python3 budget_calculator.py --interactive

# 实验 3：端到端追踪真实 URL
python3 trace_request.py --url https://httpbin.org/get --samples 50
python3 trace_request.py --url https://your-api.com/endpoint --samples 100 --output trace.json

# 实验 4：追踪本地服务（配合 loadtest_lab/target_server.py）
# 终端 A: python3 ../loadtest_lab/target_server.py --port 8080
# 终端 B:
python3 trace_request.py --url http://localhost:8080/api/slow --samples 50
```

## 实验设计原理

### budget_calculator.py

输入请求链路的各组件延迟（P50/P99），自动计算：
- **总延迟预算**：串行组件累加，并行组件取 max
- **瓶颈识别**：贡献占比 > 20% 的组件
- **敏感性分析**：每个组件优化 50% 后，总延迟降低多少

内置场景：
| 场景 | 组件数 | 关键瓶颈 | 训练目标 |
|---|---|---|---|
| web_api | 8 | App Logic (31.6%) | Web 全链路预算拆解 |
| microservice | 5 | Payment (38.8%) | 链式调用预算叠加 |
| ai_inference | 5 | GPU Inference (57.1%) | 异步队列 + 推理延迟 |

### trace_request.py

使用 aiohttp 的 `TraceConfig` 拆解真实 HTTP 请求的各阶段：
- **DNS Lookup**：域名解析时间
- **TCP+TLS Connect**：连接建立时间（含 TLS 握手）
- **Wait TTFB**：首字节等待时间（服务器处理时间）
- **Receive Body**：响应体下载时间

关键设计：每次采样使用独立 session + `force_close=True`，确保测到完整 TCP/TLS 握手（不依赖 keep-alive 复用）。

## 核心观察点

1. **TTFB 占比**：
   - 如果 TTFB > 50%，服务器处理是瓶颈（优化应用逻辑）
   - 如果 Connect > 50%，网络/握手是瓶颈（优化连接池、TLS session resumption）

2. **DNS 长尾**：
   - DNS P99 通常比 P50 高 3-5 倍（递归查询、缓存失效）
   - 真实系统中 DNS 经常被忽略，但它是首包延迟的重要组成部分

3. **延迟预算的非线性**：
   - 优化贡献占比最大的组件，收益最高（Amdahl's Law）
   - 把一个 10ms 组件优化到 5ms，对总延迟 200ms 的场景几乎无感

4. **P99 叠加的保守性**：
   - 本实验采用 `P99_total = Σ P99_component`（保守估计）
   - 实际随机情况下，多个独立组件同时到达 P99 的概率很低
   - 工程上保守估计更安全：如果预算充裕，实际 P99 通常低于估计值
