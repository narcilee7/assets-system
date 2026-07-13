# Python 并发面试题集

---

## Level 1：线程基础

### 题 1：`threading` 模块中 Lock 和 RLock 的区别？

**答案**：
- `Lock`：普通互斥锁，同一线程不能重复获取，否则死锁。
- `RLock`：可重入锁，同一线程可以多次获取，必须释放相同次数。

```python
import threading
lock = threading.RLock()
with lock:
    with lock:  # RLock 允许，Lock 会死锁
        pass
```

---

### 题 2：`Queue` 的 `task_done` 和 `join` 有什么用？

**答案**：
- `queue.Queue` 跟踪未完成的任务数。
- `task_done()` 表示一个任务完成。
- `join()` 阻塞直到所有任务都完成。

---

## Level 2：GIL 与并发选择

### 题 3：CPU 密集型任务应该用什么？

**答案**：
- **多进程**（`multiprocessing` / `ProcessPoolExecutor`），每个进程有独立 GIL。
- 或者把核心逻辑写成 C 扩展 / Cython，在计算时释放 GIL。

---

### 题 4：I/O 密集型任务应该用什么？

**答案**：
- **多线程**：适合阻塞 I/O（如网络请求）。
- **asyncio**：单线程事件循环，适合大量并发连接，资源占用更低。

---

## Level 3：asyncio 深入

### 题 5：`await asyncio.sleep(0)` 有什么用？

**答案**：
- 显式让出控制权，让事件循环调度其他任务。
- 常用于协程中长时间运行的计算，避免阻塞事件循环。

---

### 题 6：`asyncio.run` 做了什么？

**答案**：
- 创建新的事件循环。
- 运行传入的协程直到完成。
- 关闭事件循环。

**注意**：
- `asyncio.run` 应该只作为入口调用一次。
- 不能在已有事件循环中调用（如 Jupyter 中可能需要 `await` 直接运行）。

---

### 题 7：如何处理 asyncio 中的取消？

```python
async def task():
    try:
        await asyncio.sleep(10)
    except asyncio.CancelledError:
        print("cancelled")
        raise
```

**考点**：
- `asyncio.CancelledError` 需要重新抛出，确保任务真正结束。
- `asyncio.shield` 可以保护某个协程不被取消。

---

## Level 4：限流与背压

### 题 8：如何实现并发限制？

**答案**：
- 使用 `asyncio.Semaphore`。

```python
async def bounded_gather(coro_factory, items, limit=5):
    sem = asyncio.Semaphore(limit)
    async def wrapper(item):
        async with sem:
            return await coro_factory(item)
    return await asyncio.gather(*(wrapper(i) for i in items))
```

---

### 题 9：什么是背压（backpressure）？

**答案**：
- 当生产速度超过消费速度时，通过阻塞或丢弃来防止系统过载。
- `asyncio.Queue(maxsize=N)` 是常见实现：队列满时 `put` 阻塞。

---

## Level 5：线程安全陷阱

### 题 10：`+=` 是线程安全的吗？

**答案**：
- **不是**。
- `i += 1` 在字节码层面是 `LOAD_FAST + BINARY_OP + STORE_FAST`，不是原子操作。
- 多线程下需要加锁或用 `threading.local`。

---

## 并发速查卡

| 考点 | 一句话 | 陷阱 |
|------|--------|------|
| Lock vs RLock | RLock 可重入 | 同线程重复拿 Lock 死锁 |
| GIL | 多线程不并行 | CPU 密集用多进程 |
| asyncio | 单线程事件循环 | 阻塞操作会卡住整个循环 |
| 取消 | `CancelledError` 要重抛 | 吞掉取消导致资源泄漏 |
| Semaphore | 限制并发数 | limit 太大失去意义 |
| 背压 | 防止生产过快 | 队列无界会 OOM |
| `+=` | 非原子 | 多线程要加锁 |

---
