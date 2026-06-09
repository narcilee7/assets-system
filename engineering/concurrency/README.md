# Concurrency Engineering

并发工程训练体系 —— 从经典同步原语到现代高并发模式。

## 训练哲学

1. **先手写，后对照**：每个题目只提供骨架代码（skeleton），核心逻辑处标有 `TODO`。先尝试独立完成，再查阅参考实现。
2. **多语言视角**：同一问题用 Go（CSP+Goroutine）、Node.js（Event Loop+Worker Threads）、Python（threading/asyncio）分别实现，理解不同并发模型的取舍。
3. **可验证**：每个题目附带 `Makefile` 和自测用例，写完即可运行验证。

## 体系索引

### 第一阶段：同步原语（Primitive Synchronization）
| 编号 | 题目 | 核心概念 | Go | Python | Node.js |
|------|------|----------|----|--------|---------|
| 01 | [mutex-and-lock](01-mutex-and-lock/) | 互斥、临界区保护 | ✅ | ✅ | ✅ |
| 02 | [rwlock](02-rwlock/) | 读共享、写独占 | ✅ | ✅ | ✅ |
| 03 | [semaphore](03-semaphore/) | 资源配额控制 | ✅ | ✅ | ✅ |

### 第二阶段：经典同步问题（Classical Problems）
| 编号 | 题目 | 核心概念 | Go | Python | Node.js |
|------|------|----------|----|--------|---------|
| 04 | [producer-consumer](04-producer-consumer/) | 有界缓冲区、条件同步 | ✅ | ✅ | ✅ |
| 05 | [readers-writers](05-readers-writers/) | 读写公平、饥饿避免 | ✅ | ✅ | ✅ |
| 06 | [dining-philosophers](06-dining-philosophers/) | 死锁避免、资源排序 | ✅ | ✅ | ✅ |
| 07 | [barrier](07-barrier/) | 分阶段同步、集结点 | ✅ | ✅ | ✅ |

### 第三阶段：现代并发模式（Modern Patterns）
| 编号 | 题目 | 核心概念 | Go | Python | Node.js |
|------|------|----------|----|--------|---------|
| 08 | [worker-pool](08-worker-pool/) | 任务调度、 graceful shutdown | ✅ | ✅ | ✅ |
| 09 | [pipeline](09-pipeline/) | 数据流、阶段解耦 | ✅ | ✅ | ✅ |
| 10 | [fan-in-fan-out](10-fan-in-fan-out/) | 并行化、结果聚合 | ✅ | ✅ | ✅ |
| 11 | [rate-limiter-token-bucket](11-rate-limiter-token-bucket/) | 限流、令牌桶算法 | ✅ | ✅ | ✅ |

### 第四阶段：高级并发控制（Advanced Control）
| 编号 | 题目 | 核心概念 | Go | Python | Node.js |
|------|------|----------|----|--------|---------|
| 12 | [context-cancellation](12-context-cancellation/) | 取消传播、超时控制 | ✅ | ✅ | ✅ |
| 13 | [singleflight](13-singleflight/) | 请求合并、缓存击穿防护 | ✅ | ✅ | ✅ |
| 14 | [circuit-breaker](14-circuit-breaker/) | 熔断、半开探测、恢复 | ✅ | ✅ | ✅ |

## 追问清单（训练后自测）

- 队列满了怎么办？背压策略有哪些？
- 任务失败后是否重试？重试的退避策略？
- 如何取消正在运行的任务？取消信号如何传播？
- 如何观察积压、耗时和吞吐？需要暴露哪些指标？
- 你的实现是否公平？是否存在饥饿或活锁？
- 扩展性如何？从 10 并发到 10k 并发需要改什么？

## 快速开始

```bash
cd engineering/concurrency/01-mutex-and-lock
# 阅读题目
make run      # 运行当前骨架（预期会失败或输出不正确）
# 打开 skeleton/ 下的目标语言文件，补全 TODO
make test     # 验证你的实现
```

更多环境细节见 [ENV.md](ENV.md)。
