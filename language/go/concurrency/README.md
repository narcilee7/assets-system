# Go Concurrency

这一层训练 goroutine、channel、select、sync、context、取消、超时和资源限制。

## 必会概念

- goroutine 很轻，但不是免费的。
- channel 用于通信和同步，但要明确关闭责任。
- select 可以表达超时、取消和多路等待。
- context 负责跨调用链传播取消和 deadline。
- sync.Mutex / RWMutex / WaitGroup / Once 是工程常用基础。
- 并发题必须关注 goroutine 泄漏和资源释放。

## 题单

| 题目 | 文件 | 状态 | 关键点 |
| --- | --- | --- | --- |
| fan-out / fan-in | `fan_in_out/` | todo | WaitGroup、channel close |
| pipeline | `pipeline/` | todo | stage、取消、关闭 |
| select timeout | `select_timeout/` | todo | time.After、timer 释放 |
| worker pool | `worker_pool/` | todo | job queue、result queue |
| bounded parallel map | `bounded_parallel_map/` | todo | semaphore、错误处理 |
| sync.Once | `once/` | todo | 初始化、并发安全 |
| safe counter | `safe_counter/` | todo | Mutex / atomic |
| context cancellation | `context_cancel/` | todo | Done、Err、传播 |
| graceful shutdown | `graceful_shutdown/` | todo | signal、server shutdown |

## 工程追问

- 如何避免 goroutine 泄漏？
- channel 应该由谁关闭？
- 如果 worker 中某个任务失败，其他任务要不要取消？
- time.After 在循环里有什么问题？
- context value 适合放什么，不适合放什么？

