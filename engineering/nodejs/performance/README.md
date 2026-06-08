# Node.js Performance

## 主题

| 主题 | 关键点 |
| --- | --- |
| Event Loop Lag | CPU blocking、sync API |
| Memory | heap、leak、closure、cache |
| Stream | backpressure、pipeline |
| Cluster | process model、sticky session |
| Worker Threads | CPU isolation |
| Serialization | JSON cost、schema serializer |
| Caching | cache-aside、穿透、击穿、雪崩 |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| Event loop lag diagnosis | `event-loop-lag/` | perf_hooks 监测、Prometheus 指标端点 |
| Worker thread CPU benchmark | `worker-benchmark/` | 单线程 vs Worker Pool 基准测试 |
| Heap diagnosis & memory leak | `heap-diagnosis/` | Heap Snapshot、LRU Cache、常见泄漏源 |
| Cluster mode | `cluster-mode/` | 原生 Cluster、PM2、Sticky Session |
| Caching strategy | `cache-strategy/` | Cache-Aside、穿透/击穿/雪崩防护、HTTP 缓存头 |
| Stream vs buffer benchmark | *(见 `../runtime/stream-pipeline`)* | pipeline 性能对比 |
