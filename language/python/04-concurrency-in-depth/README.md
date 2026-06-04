# Python 并发编程深度解析

这一层不仅讲「怎么用 threading」，而是讲「GIL 影响、asyncio 事件循环、协程、进程池」。

---

## 目录

| 文件 | 主题 |
|------|------|
| `threading-and-gil.md` | 线程、锁、GIL 对多线程的限制 |
| `multiprocessing.md` | 进程池、IPC、共享内存、队列 |
| `asyncio-deep-dive.md` | 事件循环、协程、Task、Future、并发原语 |
| `async-patterns.md` | async context manager、async iterator、backoff |
| `concurrent-futures.md` | ThreadPoolExecutor、ProcessPoolExecutor |

---

## 核心问题

1. 为什么 Python 多线程不能利用多核 CPU？
2. asyncio 的事件循环如何调度协程？
3. `async`/`await` 在字节码层面是如何实现的？
4. `asyncio.gather` vs `asyncio.wait` 的区别？
5. 什么时候用多线程、什么时候用多进程、什么时候用 asyncio？

---

## 关联训练场

- `../concurrency/` — 线程安全、asyncio、限流、背压实践
