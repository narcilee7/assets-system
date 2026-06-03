# 并发与异步层

这一层训练线程安全、资源限制、异步调度、取消和超时。它和后端任务调度、SSE、Agent Runtime 都强相关。

## 必会概念

- 线程不等于 CPU 并行，GIL 会影响 CPU 密集任务。
- I/O 密集任务可以从多线程和 asyncio 中获益。
- 共享状态需要锁或线程安全队列。
- asyncio 里的并发来自事件循环协作调度。
- 生产系统要关注取消、超时、限流和背压。

## 题单

| 题目 | 文件 | 状态 | 关键点 |
| --- | --- | --- | --- |
| 手写线程安全计数器 | `safe_counter.py` | todo | `threading.Lock` |
| 手写生产者消费者 | `producer_consumer.py` | todo | `queue.Queue`、停止信号 |
| 手写简化线程池 | `thread_pool.py` | todo | worker、任务队列 |
| 手写 `bounded_gather` | `bounded_gather.py` | todo | `asyncio.Semaphore` |
| 手写 async retry | `async_retry.py` | todo | await、异常、延迟 |
| 手写 async rate limiter | `async_rate_limiter.py` | todo | 时间窗口、并发控制 |
