# Python asyncio 性能优化

asyncio 是 Python IO 密集型应用的利器，但需要正确使用才能发挥性能。

## 并发模式对比

```python
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

async def fetch(url: str):
    await asyncio.sleep(0.1)  # 模拟 IO
    return f"Result of {url}"

# 1. 串行：1.0s
async def sequential():
    results = []
    for i in range(10):
        results.append(await fetch(f"url-{i}"))
    return results

# 2. asyncio gather：0.1s
async def parallel_async():
    tasks = [fetch(f"url-{i}") for i in range(10)]
    return await asyncio.gather(*tasks)

# 3. Semaphore 限流
async def limited_parallel():
    semaphore = asyncio.Semaphore(5)  # 最多5个并发
    
    async def fetch_limited(url):
        async with semaphore:
            return await fetch(url)
    
    tasks = [fetch_limited(f"url-{i}") for i in range(100)]
    return await asyncio.gather(*tasks)

# 4. 批量处理
async def batch_process():
    async def process_batch(batch):
        return await asyncio.gather(*[fetch(url) for url in batch])
    
    urls = [f"url-{i}" for i in range(100)]
    batch_size = 10
    results = []
    for i in range(0, len(urls), batch_size):
        batch = urls[i:i + batch_size]
        results.extend(await process_batch(batch))
    return results
```

## CPU 密集型任务

```python
# ❌ 错误：在 asyncio 中运行 CPU 密集型任务会阻塞事件循环
def cpu_intensive(n):
    return sum(i * i for i in range(n))

# ✅ 正确：使用 run_in_executor 或 ProcessPoolExecutor
async def cpu_task_async(n):
    loop = asyncio.get_event_loop()
    with ProcessPoolExecutor() as pool:
        return await loop.run_in_executor(pool, cpu_intensive, n)

# ✅ 使用 asyncio.to_thread（Python 3.9+）
async def io_bound_task():
    return await asyncio.to_thread(blocking_io_function)
```

## uvloop

```python
# uvloop 是 C 实现的事件循环，性能提升 2-4 倍
import uvloop
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

# 或命令行
# uvicorn app.main:app --loop uvloop
```
