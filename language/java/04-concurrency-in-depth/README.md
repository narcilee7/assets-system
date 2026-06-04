# Java 并发编程深度解析

这一层不仅讲「怎么用 Thread/synchronized」，而是讲「JMM、锁优化、无锁编程、Reactive 模型」。

---

## 目录

| 文件 | 主题 |
|------|------|
| `jmm.md` | Java 内存模型、happens-before、重排序 |
| `locks-and-aqs.md` | synchronized、ReentrantLock、AQS 原理 |
| `cas-and-atomic.md` | CAS、原子类、ABA 问题、LongAdder |
| `thread-pool.md` | ThreadPoolExecutor、参数、拒绝策略、ForkJoinPool |
| `completable-future.md` | 异步组合、异常处理、超时控制 |
| `reactive-streams.md` | Reactive 规范、背压、Publisher/Subscriber |

---

## 核心问题

1. JMM 中的 happens-before 规则有哪些？
2. synchronized 的锁升级过程（无锁 → 偏向锁 → 轻量级锁 → 重量级锁）？
3. AQS 的核心设计：state + CLH 队列？
4. CompletableFuture 的 thenCompose 与 thenCombine 区别？
5. Reactive Streams 的背压机制如何实现？

---

## 关联训练场

- `../concurrency/` — 线程池、锁、CompletableFuture 实践
