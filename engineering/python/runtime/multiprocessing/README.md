# Python Multiprocessing & Threading

Python 提供多种并发方式，选择正确的模型是性能关键。

## 核心实现

```python
# concurrency_patterns.py
import asyncio
import threading
import multiprocessing
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

# 1. ThreadPoolExecutor（I/O 密集）
def thread_pool_io():
    def fetch_url(url):
        import requests
        return requests.get(url).status_code

    urls = ['https://a.com', 'https://b.com', 'https://c.com']
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(fetch_url, urls))
    return results

# 2. ProcessPoolExecutor（CPU 密集）
def process_pool_cpu():
    def heavy_compute(n):
        return sum(i * i for i in range(n))

    inputs = [1_000_000, 2_000_000, 3_000_000]
    with ProcessPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(heavy_compute, inputs))
    return results

# 3. Asyncio + ProcessPoolExecutor 混合
async def hybrid_approach():
    loop = asyncio.get_event_loop()
    
    # I/O 操作
    async with aiohttp.ClientSession() as session:
        async with session.get('https://api.example.com') as resp:
            data = await resp.json()
    
    # CPU 操作放入进程池
    with ProcessPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, heavy_compute, 1_000_000)
    
    return result

# 4. 共享内存（multiprocessing）
def shared_memory():
    from multiprocessing import Manager, Process
    
    def worker(d, l):
        d['count'] += 1
        l.append(d['count'])
    
    manager = Manager()
    shared_dict = manager.dict()
    shared_dict['count'] = 0
    shared_list = manager.list()
    
    processes = []
    for _ in range(4):
        p = Process(target=worker, args=(shared_dict, shared_list))
        processes.append(p)
        p.start()
    
    for p in processes:
        p.join()
    
    print(f"Count: {shared_dict['count']}")
    print(f"List: {list(shared_list)}")
```

## 进程间通信

```python
# ipc.py
import multiprocessing as mp

# Queue
queue = mp.Queue()
queue.put("message")
msg = queue.get()

# Pipe（双向）
parent_conn, child_conn = mp.Pipe()
child_conn.send("hello")
print(parent_conn.recv())

# Lock
lock = mp.Lock()
with lock:
    # critical section
    pass
```

## 选择指南

```python
# decision_tree.py
"""
决策树：
- 主要是 I/O 操作？
  - 库支持 async？→ asyncio
  - 库是阻塞的？→ ThreadPoolExecutor
- 主要是 CPU 计算？
  - 数据独立？→ ProcessPoolExecutor
  - 需要共享状态？→ multiprocessing + Manager/共享内存
- 需要长时间运行？
  - 考虑 Celery / RQ（见 background-jobs）
"""
```
