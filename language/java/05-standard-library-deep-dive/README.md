# Java 标准库深度解析

这一层理解 Java 核心 API 的设计与陷阱：Collections、Stream、NIO、并发包、函数式接口。

---

## 目录

| 文件 | 主题 |
|------|------|
| `collections-framework.md` | List、Set、Map、Queue 的继承体系与实现 |
| `stream-api.md` | 惰性计算、短路、并行流、收集器 |
| `nio-and-netty.md` | Buffer、Channel、Selector、Netty 基础 |
| `concurrent-package.md` | ConcurrentHashMap、CopyOnWriteArrayList、BlockingQueue |
| `optional-and-functional.md` | Optional 正确用法、函数式接口组合 |

---

## 核心问题

1. HashMap 的 put 流程：hash → 索引 → 链表/红黑树？
2. Stream 的惰性计算在什么情况下触发？
3. NIO 的 Selector 如何实现单线程处理多连接？
4. ConcurrentHashMap 的 size() 为什么是估计值？
5. Optional 不应该用于哪些场景？

---

## 关联训练场

- `../standard-library/` — Collections、Stream、NIO 手写实验
