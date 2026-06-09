# GIL & Asyncio

Python 的并发模型与 Go/Node.js 截然不同：GIL（全局解释器锁）限制了真正的并行计算，asyncio 提供了协作式多任务。

## GIL 本质

```python
# gil_demo.py
"""
GIL (Global Interpreter Lock) 确保同一时间只有一个线程执行 Python 字节码。
这意味着：
- 多线程不能并行执行 CPU 密集型任务
- 多线程适合 I/O 密集型任务（阻塞时释放 GIL）
- 多进程可以绕过 GIL（每个进程有自己的解释器）
"""

import threading
import time

# 多线程 CPU 密集型：比单线程还慢（因为 GIL 切换开销）
def cpu_task(n):
    count = 0
    for i in range(n):
        count += i
    return count

# 多线程版本（慢）
def multithreaded_cpu():
    threads = []
    for _ in range(4):
        t = threading.Thread(target=cpu_task, args=(10_000_000,))
        threads.append(t)
        t.start()
    for t in threads:
        t.join()

# 多进程版本（快，利用多核）
from multiprocessing import Pool

def multiprocess_cpu():
    with Pool(4) as p:
        p.map(cpu_task, [10_000_000] * 4)
```

## Asyncio 核心

```python
# asyncio_core.py
import asyncio

# 1. 基本 coroutine
async def say_hello():
    await asyncio.sleep(1)
    print("Hello")

asyncio.run(say_hello())

# 2. 并发执行
async def concurrent_tasks():
    task1 = asyncio.create_task(say_hello())
    task2 = asyncio.create_task(say_hello())
    await asyncio.gather(task1, task2)

# 3. 超时控制
async def with_timeout():
    try:
        await asyncio.wait_for(say_hello(), timeout=0.5)
    except asyncio.TimeoutError:
        print("Timeout!")

# 4. 任务取消
async def cancellable_task():
    try:
        while True:
            print("Working...")
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        print("Cancelled")
        raise

# 5. 事件循环底层操作
async def low_level():
    loop = asyncio.get_event_loop()
    
    # 将同步函数放入线程池执行
    result = await loop.run_in_executor(None, cpu_task, 1_000_000)
    
    # 等待文件描述符可读
    # reader, writer = await asyncio.open_connection('localhost', 8080)
```

## Asyncio vs Threading vs Multiprocessing

| 场景 | 推荐 |
| --- | --- |
| I/O 密集（HTTP、DB） | asyncio |
| I/O 密集（阻塞库） | threading |
| CPU 密集 | multiprocessing |
| CPU 密集 + 共享数据 | multiprocessing + shared memory |
| 混合场景 | asyncio + ProcessPoolExecutor |

## 与 Node.js / Go 的对比

| 维度 | Python asyncio | Node.js Event Loop | Go GMP |
| --- | --- | --- | --- |
| 调度 | 协作式（await 让出） | 协作式（回调） | 抢占式（runtime） |
| 语法 | `async/await` | `async/await` | 同步写法 |
| 多核利用 | 需 multiprocessing | 需 worker_threads/cluster | 自动 |
| 生态 | 需 async 库支持 | 原生异步 | 原生并发 |
| 性能瓶颈 | GIL | event loop 阻塞 | 无 |
