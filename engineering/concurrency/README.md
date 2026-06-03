# Concurrency Engineering

并发工程层训练任务调度、资源限制、取消、背压和共享状态保护。

## 核心构件

| 构件 | 状态 | 关键点 |
| --- | --- | --- |
| worker pool | todo | 并发限制、结果收集、关闭 |
| bounded queue | todo | 背压、拒绝策略 |
| rate limiter | todo | token bucket、leaky bucket |
| scheduler | todo | timer、cron、取消 |
| singleflight | todo | 请求合并 |
| circuit breaker | todo | 熔断、半开、恢复 |

## 追问

- 队列满了怎么办？
- 任务失败后是否重试？
- 如何取消正在运行的任务？
- 如何观察积压和耗时？

