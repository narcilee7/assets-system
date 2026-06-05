# Performance Engineering

## 方法论

```text
明确目标
-> 建立基线
-> 找瓶颈
-> 单点优化
-> 回归验证
-> 建立预算和监控
```

## 主题

| 方向 | 关键点 |
| --- | --- |
| CPU | profiling、flame graph、hot path |
| Memory | heap、allocation、GC、leak |
| I/O | disk、network、syscall、buffer |
| Concurrency | contention、queueing、backpressure |
| Capacity | QPS、latency、saturation、cost |

## 资产

| 资产 | 状态 |
| --- | --- |
| performance profiling toolkit | `docs/profiling.md` |
| flame graph lab | `docs/flamegraph.md` |
| latency budget worksheet | `docs/latency-budget.md` |
| load test methodology | `docs/loadtest.md` |
| capacity estimation template | `docs/capacity-estimation.md` |

