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

## 核心追问

1. **压测应该用真实数据还是模拟数据？** 真实数据更准确；如果无法获取，至少要模拟数据分布（Zipfian vs Uniform）
2. **QPS 和并发用户数的区别？** QPS 是每秒请求数；并发用户数是同时在操作的用户数；通常 QPS = 并发用户数 × 每用户请求率
3. **压测发现问题时应该继续还是停止？** 应该停止，记录问题，分析根因，修复后再继续
4. **如何模拟峰值？** 使用阶梯加压（ramp-up），让系统有时间自动扩容；避免瞬间峰值导致误判
5. **为什么要持续压测 5-10 分钟？** 短期压测可能漏掉：缓存预热问题、连接池耗尽、内存泄漏、GC 问题

## 状态

| 资产 | 状态 |
|---|---|
| performance profiling toolkit | done |
| flame graph lab | done |
| latency budget worksheet | done |
| load test methodology | done |
| capacity estimation template | done |