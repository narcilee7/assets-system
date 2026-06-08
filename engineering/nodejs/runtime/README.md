# Node.js Runtime

## 必会主题

| 主题 | 关键点 |
| --- | --- |
| Event Loop | timers、poll、check、close、microtask、nextTick |
| Module System | CJS、ESM、resolution、dual package |
| Stream | readable、writable、transform、pipeline、backpressure |
| Buffer | binary、encoding、zero-copy |
| Worker | worker_threads、child_process、cluster |
| Diagnostics | async_hooks、perf_hooks、inspector |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| event loop ordering lab | `event-loop-lab/` | 时序实验、I/O 上下文 race、nextTick 饥饿 |
| stream backpressure demo | `stream-pipeline/` | 手动背压、pipeline API、transform stream |
| worker_threads CPU isolation | `worker-threads/` | Worker Pool、斐波那契计算示例 |
| memory leak diagnosis | *(见 `../performance/event-loop-lag`)* | perf_hooks 监测 event loop lag |
