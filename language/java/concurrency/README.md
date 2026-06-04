# Concurrency

这一层训练 Java 并发模型：线程、锁、CAS、线程池、CompletableFuture、Reactive。

## 必会概念

- JMM 定义了线程间共享变量的可见性和有序性规则。
- synchronized 锁升级：无锁 → 偏向锁 → 轻量级锁 → 重量级锁。
- CAS 是无锁算法的基础，但存在 ABA 问题。
- 线程池的 7 个参数：核心线程数、最大线程数、存活时间、队列、拒绝策略等。
- CompletableFuture 提供声明式异步组合能力。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| synchronized 底层 | `synchronized-internals/` | todo | 对象头、Mark Word、锁升级 |
| ReentrantLock | `reentrant-lock/` | todo | AQS、公平锁、可中断 |
| CAS 与原子类 | `cas-and-atomic/` | todo | AtomicInteger、LongAdder |
| 线程池参数 | `thread-pool/` | todo | 7 参数、拒绝策略 |
| CompletableFuture | `completable-future/` | todo | thenApply、thenCompose、exceptionally |
| 生产者消费者 | `producer-consumer/` | todo | BlockingQueue、Condition |
