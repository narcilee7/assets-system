# Concurrency

这一层训练 Python 并发模型：线程安全、asyncio、限流、背压。

## 必会概念

- GIL 限制：同一时刻只有一个线程执行 Python 字节码。
- 多线程适合 I/O 密集型，多进程适合 CPU 密集型。
- asyncio 是单线程事件循环 + 协程的并发模型。
- `async`/`await` 语法使异步代码看起来像同步代码。
- 背压（backpressure）防止生产速度超过消费速度。

## 已有资产

| 资产 | 目录 | 状态 | 目标 |
|------|------|------|------|
| 并发基础 | `concurrency/` | seed | 线程安全、asyncio、限流 |

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 线程安全计数器 | `safe_counter.py` | todo | Lock、atomic、GIL |
| 生产者消费者 | `producer_consumer.py` | todo | Queue、Condition |
| bounded_gather | `bounded_gather.py` | todo | 并发限制、信号量 |
| async retry | `async_retry.py` | todo | 异步重试、指数退避 |
