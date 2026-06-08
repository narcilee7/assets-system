# Python Performance Profiling

Python 的性能优化工具有 cProfile、line_profiler、memory_profiler 等。

## cProfile 基础分析

```python
# profile_example.py
import cProfile
import pstats
from io import StringIO

def slow_function():
    result = []
    for i in range(10000):
        result.append(sum(range(i)))
    return result

# 方法1: 运行时分析
profiler = cProfile.Profile()
profiler.enable()
slow_function()
profiler.disable()

s = StringIO()
ps = pstats.Stats(profiler, stream=s).sort_stats("cumulative")
ps.print_stats(10)
print(s.getvalue())

# 方法2: 命令行
# python -m cProfile -s cumulative myscript.py
```

## 异步性能分析

```python
# async_profile.py
import asyncio
import time

async def fetch_data(id: int):
    await asyncio.sleep(0.1)
    return {"id": id}

async def main():
    # 串行: 1s
    # for i in range(10):
    #     await fetch_data(i)
    
    # 并行: 0.1s
    tasks = [fetch_data(i) for i in range(10)]
    results = await asyncio.gather(*tasks)
    return results

if __name__ == "__main__":
    start = time.time()
    asyncio.run(main())
    print(f"Time: {time.time() - start:.2f}s")
```

## GIL 与多进程

```python
# multiprocessing_example.py
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import time

def cpu_bound(n):
    """CPU 密集型：多进程优于多线程"""
    return sum(i * i for i in range(n))

def io_bound(url):
    """IO 密集型：多线程/协程足够"""
    import requests
    return requests.get(url).status_code

# CPU 密集型用多进程
with ProcessPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(cpu_bound, [10**6] * 4))

# IO 密集型用 asyncio / ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(io_bound, urls))
```
