# Load Test Methodology

## 目标

掌握负载测试的方法：建立基线、压测设计、瓶颈定位、调优验证。

## 场景

- 如何设计压测场景？
- 怎么知道系统能承受多少 QPS？
- 瓶颈怎么定位（CPU/内存/数据库/网络）？
- 如何验证优化效果？

## 压测类型

### 1. 基准测试（Benchmark）

```
目的：建立性能基线
方法：固定 QPS，持续运行
关注：响应时间、吞吐量稳定性
```

### 2. 负载测试（Load Test）

```
目的：验证正常负载下的性能
方法：模拟真实流量，逐渐增加
关注：是否满足 SLO
```

### 3. 压力测试（Stress Test）

```
目的：找到系统上限
方法：持续加压直到崩溃
关注：崩溃点、优雅降级
```

### 4. 浸泡测试（Soak Test）

```
目的：发现内存泄漏、资源耗尽
方法：持续低负载长时间运行
关注：性能随时间的变化
```

## 压测工具

### wrk

```bash
# 基本压测
wrk -t12 -c400 -d30s http://localhost:8080/api/users

# 高级配置
wrk -t12 -c400 -d30s \
  --latency \
  -s post.lua http://localhost:8080/api/users

# Lua 脚本自定义请求
wrk.method = "POST"
wrk.body   = '{"name":"test"}'
wrk.headers["Content-Type"] = "application/json"
```

### hey

```bash
# GET 请求
hey -n 10000 -c 100 http://localhost:8080/api/users

# POST 请求
hey -n 1000 -c 10 -m POST -T "application/json" \
  -d '{"name":"test"}' http://localhost:8080/api/users
```

### k6

```javascript
// k6 脚本示例
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // 2 分钟升到 100 QPS
    { duration: '5m', target: 100 },  // 5 分钟保持 100 QPS
    { duration: '2m', target: 0 },   // 2 分钟降到 0
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],  // P99 < 500ms
    http_req_failed: ['rate<0.01'],      // 错误率 < 1%
  },
};

export default function() {
  const res = http.get('http://localhost:8080/api/users');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

## 压测设计

### 1. 确定目标

```python
# 压测目标计算
def calculate_load_target(
    peak_qps: int,           # 峰值 QPS
    safety_margin: float, 1.5,  # 安全系数
) -> dict:
    
    target_qps = peak_qps * safety_margin
    
    return {
        "peak_qps": peak_qps,
        "target_qps": target_qps,
        "concurrent_users": int(target_qps * 2),  # 假设每个用户 2 个请求/秒
        "test_duration_sec": 300,  # 5 分钟稳态
    }
```

### 2. 设计场景

```yaml
压测场景：
  - 场景 1：纯读（80% 读，20% 写）
  - 场景 2：纯写
  - 场景 3：混合读写
  - 场景 4：峰值突增
```

### 3. 监控指标

```
必须监控：
  - QPS（请求/秒）
  - P50/P90/P99 延迟
  - Error Rate
  - CPU / Memory 使用率

可选监控：
  - 数据库连接池
  - Redis 连接数
  - 队列深度
  - GC 频率
```

## 瓶颈定位

### 定位流程

```
1. 监控整体指标（QPS、Latency、Error）
2. 确认瓶颈方向（Latency 高 vs Error 高）
3. 逐层排查：
   a. 网络层（抓包、延迟分布）
   b. 服务层（CPU/内存/GC）
   c. 数据库层（慢查询、连接池）
   d. 缓存层（命中率、延迟）
```

### 常见瓶颈

```
CPU bound：
  - CPU 使用率 > 80%
  - 延迟随 CPU 线性增长
  - 优化：减少计算、算法优化、水平扩容

Memory bound：
  - Memory 使用率 > 90%
  - GC 频繁（jstat -gc）
  - 优化：减少内存分配、对象池、缓存

I/O bound：
  - Disk I/O 高（iostat）
  - 网络 I/O 高
  - 优化：异步 I/O、批处理

数据库 bound：
  - 连接池耗尽
  - 慢查询多
  - 优化：加索引、改 SQL、连接池调优
```

## 优化验证

```python
def verify_improvement(
    before_latency_p99: float,
    after_latency_p99: float,
    target_improvement: float = 0.2,  # 期望提升 20%
) -> dict:
    
    improvement = (before_latency_p99 - after_latency_p99) / before_latency_p99
    
    return {
        "before_ms": before_latency_p99,
        "after_ms": after_latency_p99,
        "improvement_pct": round(improvement * 100, 1),
        "target_met": improvement >= target_improvement,
    }
```

## L2 深挖：压测工具并发模型与 Coordinated Omission

### 主流工具并发模型源码锚定

| 工具 | 语言 | 并发模型 | 关键源码 | 适用场景 |
|---|---|---|---|---|
| **wrk** | C | 每线程一个 epoll/kqueue event loop，预先创建固定连接池 | `wrk.c:thread_main()` → `ae_epoll.c:aeApiPoll()`（类似 Redis 的 ae 事件库） | 超高 QPS 基准测试（单核 100K+ QPS） |
| **k6** | Go | 每个 VU 一个 goroutine，JS 脚本在 `dop251/goja` 引擎中运行 | `core/engine.go:Run()` → `js/runner.go:runVU()` → `goja.Runtime.RunProgram()` | 复杂业务场景压测（session、cookie、动态参数） |
| **JMeter** | Java | 每个线程一个 `ThreadGroup`，阻塞式 HTTP 客户端 | `core/JMeterThread.java:run()` → `protocol/http/sampler/HTTPSamplerBase.java` | 协议多样性（JDBC、JMS、SOAP） |
| **Locust** | Python | gevent（协程）或 asyncio，每个 user 一个 greenlet/task | `runners.py:LocalRunner.spawn_users()` → `user/task.py:run()` | 快速编写复杂用户行为 |

**wrk 为什么是单进程压测的标杆？**

```c
// wrk 核心线程逻辑（简化自 wrk.c + ae.c）
void *thread_main(void *arg) {
    thread *t = arg;
    aeEventLoop *loop = aeCreateEventLoop(1024);
    // 预先创建所有连接，避免压测中途建连开销
    for (int i = 0; i < t->connections; i++) {
        connection *c = calloc(1, sizeof(connection));
        aeCreateFileEvent(loop, c->fd, AE_WRITABLE, socket_writeable, c);
    }
    // event loop：写请求 -> 等可读 -> 读响应 -> 统计 -> 再写
    while (!t->stop) {
        aeProcessEvents(loop, AE_ALL_EVENTS);
    }
}
```

wrk 的**连接预热**设计：压测开始前就把所有 TCP 连接建立好（`--latency` 还会做连接建立时间的独立统计），因此测出的 QPS 是纯请求处理 QPS，不含三次握手开销。

### 数字锚定：压测工具自身开销

```
测试条件：localhost, 128B payload, 单核 CPU 限制

工具                最大 QPS     工具自身 CPU 占用
─────────────────────────────────────────────────────
wrk (1 thread)      ~120,000     ~80%  （接近单核极限）
wrk (4 threads)     ~400,000     ~300% （多核扩展性好）
hey (Go)            ~80,000      ~90%
k6 (1 VU)           ~5,000       ~10%  （VU 开销在 goja JS 引擎）
Locust (async)      ~3,000       ~40%  （Python GIL 限制）
Python asyncio      ~15,000      ~60%  （aiohttp client 纯异步）
```

关键结论：
- **wrk 的瓶颈在目标服务，不在工具本身**（C + epoll + 零拷贝发送）。
- **k6 的 VU 模式适合业务逻辑，但单 VU QPS 上限低**；需要大量 VU（>1000）才能达到高并发。
- **Python 压测适合快速原型，不适合极限 QPS**；aiohttp client 比 requests 快 10x 以上。

### Coordinated Omission（协同遗漏）

**问题定义**：

很多压测工具使用 **Closed Model**（固定并发用户，发完请求等响应回来再发下一个）。当目标服务变慢时，客户端会自动"配合"减速——等待响应期间不会发送新请求。这导致测出的延迟分布比真实用户感受到的**更乐观**。

```
真实用户视角（Open Model）：
  用户按固定节奏发请求，不管上一个是否回来
  t=0ms  发请求1 -> 服务端处理 100ms -> 用户感受到 100ms
  t=10ms 发请求2 -> 服务端已慢，排队 90ms + 处理 100ms = 190ms
  t=20ms 发请求3 -> 排队 180ms + 处理 100ms = 280ms
  测出的 P99 = 280ms

Closed Model 压测视角（200 并发）：
  worker1 发请求1 -> 等待 100ms -> 收到响应 -> 发请求2
  worker2 发请求1 -> 等待 100ms -> 收到响应 -> 发请求2
  ...
  服务端始终只有 200 个并发请求，不会堆积
  测出的 P99 = 100ms  （严重低估！）
```

**检测方法**：

1. 对比 Open Model 和 Closed Model 的 P99。
2. 计算 **effective latency** = 响应时间 + (实际发送时间 - 计划发送时间)。
3. 如果 corrected P99 > raw P99 × 1.2，说明存在显著的 Coordinated Omission。

**修正方案**：

- **wrk2**（Gil Tene 改进版）：使用恒定吞吐率（CPS）发送请求，不受响应时间影响。
- **k6**：支持 `scenarios` 的 `constant-arrival-rate` 执行器（Open Model）。
- **自定义压测器**：按固定速率生成请求（见 L3 实验 `load_tester.py --model open`）。

### 压测设计的边界陷阱

1. **Warmup 缺失**：JVM、连接池、缓存都需要预热。直接压测前 1 分钟的数据不可信。
2. **本地回环偏差**：`localhost` 压测不走真实网卡，TCP 栈行为不同（延迟更低、无丢包）。
3. **单核工具瓶颈**：wrk 默认单线程，如果目标服务是多核的，要用 `-t` 匹配核心数。
4. **Payload 太小**：128B 请求测出的 QPS 不代表现实（真实 API 通常 1-10KB）。
5. **忽略错误响应**：只看 QPS 不看错误率。服务过载时可能 500 错误但 QPS 仍高。

## L3：可运行实验

见 `impl/loadtest_lab/`：

```bash
cd systems-engineering/performance-engineering/impl/loadtest_lab
pip install -r requirements.txt

# 启动目标服务
python3 target_server.py --port 8080

# 实验 1：Closed vs Open Model 对比
python3 load_tester.py --url http://localhost:8080/api/slow \
    --model closed --concurrency 200 --duration 30
python3 load_tester.py --url http://localhost:8080/api/slow \
    --model open --rps 100 --duration 30

# 实验 2：阶梯加压找到崩溃点
python3 load_tester.py --url http://localhost:8080/api/variable \
    --model closed --stages "10:10,50:15,100:15,200:15,300:15"

# 实验 3：Coordinated Omission 演示
python3 load_tester.py --url http://localhost:8080/api/timeout \
    --model open --rps 50 --duration 30
# 观察 "CO Corrected P99" 与原始 P99 的差异
```

实验设计覆盖：
- `/api/fast`：验证理想状态下的 QPS 上限
- `/api/slow`：验证延迟固定时的吞吐量公式 `QPS ≈ 并发 / 延迟`
- `/api/cpu`：验证 CPU 瓶颈的非线性饱和
- `/api/variable`：验证长尾延迟下的 P99 膨胀
- `/api/timeout`：验证 CO 修正的必要性

## 核心追问

1. **压测应该用真实数据还是模拟数据？** 真实数据更准确；如果无法获取，至少要模拟数据分布（Zipfian vs Uniform）
2. **QPS 和并发用户数的区别？** QPS 是每秒请求数；并发用户数是同时在操作的用户数；通常 QPS = 并发用户数 × 每用户请求率
3. **压测发现问题时应该继续还是停止？** 应该停止，记录问题，分析根因，修复后再继续
4. **如何模拟峰值？** 使用阶梯加压（ramp-up），让系统有时间自动扩容；避免瞬间峰值导致误判
5. **为什么要持续压测 5-10 分钟？** 短期压测可能漏掉：缓存预热问题、连接池耗尽、内存泄漏、GC 问题

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| performance profiling toolkit | L2 | done |
| flame graph lab | L2 | done |
| latency budget worksheet | L1 | todo |
| load test methodology | **L2+L3** | **done** |
| capacity estimation template | L1 | todo |