# Python concurrency question domain

Python 并发编程的场景可以从**问题域**（你要解决什么）和**技术域**（你用什么工具）两个维度拆解。下面按实际工程需求分类，覆盖从传统到前沿的所有场景。

---

## 一、按任务类型分类

### 1. I/O 密集型（网络、磁盘、数据库）
这是 Python 并发最常见的战场，核心矛盾是**等待**。

| 场景 | 推荐方案 | 关键考量 |
|------|---------|---------|
| **高并发 HTTP 客户端**（爬虫、API 聚合） | `asyncio` + `aiohttp`/`httpx` | 连接池复用、限流、优雅降级 |
| **数据库并发访问** | `asyncio` + `asyncpg`/`aiomysql` / 连接池 | 事务隔离、连接数爆炸、悲观锁 |
| **文件系统监控与批量处理** | `asyncio` + `aiofiles` 或 `ThreadPoolExecutor` | 大文件内存映射、磁盘 I/O 瓶颈 |
| **子进程管道**（调用外部命令） | `asyncio.create_subprocess_exec` / `subprocess` + threads | 死锁（pipe buffer 满）、僵尸进程 |
| **WebSocket/长连接服务器** | `asyncio` + `websockets`/`fastapi` | 心跳、断线重连、背压(backpressure) |

### 2. CPU 密集型（计算、转换、推理）
核心矛盾是**GIL**（全局解释器锁）。

| 场景 | 推荐方案 | 关键考量 |
|------|---------|---------|
| **数值计算/矩阵运算** | `multiprocessing` / `ProcessPoolExecutor` + NumPy/Numba | NumPy 本身释放 GIL，但纯 Python 循环不释放 |
| **图片/视频处理** | `ProcessPool` / `concurrent.futures` + Pillow/OpenCV | 内存拷贝开销、共享内存 (`shared_memory`) |
| **数据序列化/反序列化** | `ProcessPool` / C 扩展（如 `orjson`） | JSON 解析在 C 层释放 GIL |
| **机器学习推理** | `ProcessPool` / `torch.multiprocessing` / `onnxruntime` | GPU 显存隔离、CUDA context fork 安全 |
| **大规模数据 ETL** | `multiprocessing` + `Queue` / `Pipe` / `Manager` | 进程间通信开销、数据分片策略 |

### 3. 混合型（既有 I/O 等待又有 CPU 计算）
最复杂的场景，需要**分层架构**。

| 场景 | 架构模式 |
|------|---------|
| **Web 服务中调用 ML 模型** | `asyncio` 处理 HTTP + `ThreadPoolExecutor`/`ProcessPoolExecutor` 跑模型 |
| **实时数据管道**（采集→清洗→存储） | 生产者-消费者多阶段：`asyncio` 采集 → `ProcessPool` 清洗 → `asyncio` 写入 |
| **游戏服务器/模拟器** | 主循环 `asyncio` + 物理计算 `ProcessPool` + 状态共享 `Manager` |

---

## 二、按并发模型分类

### 1. 基于线程（Threading）
适用：**I/O 密集型**、**已有同步代码改造**、**C 扩展释放 GIL 的操作**

```python
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

# 场景 A：批量下载（I/O 密集）
def fetch(url):
    import requests
    return requests.get(url, timeout=10).status_code

with ThreadPoolExecutor(max_workers=20) as executor:
    futures = {executor.submit(fetch, url): url for url in urls}
    for future in as_completed(futures):
        url = futures[future]
        try:
            status = future.result()
        except Exception as e:
            print(f"{url} failed: {e}")

# 场景 B：线程同步原语
lock = threading.RLock()  # 可重入锁
cond = threading.Condition()  # 条件变量
barrier = threading.Barrier(3)  # 屏障（多阶段计算）
```

**高级场景：**
- **线程本地存储**：`threading.local()` 实现上下文隔离（如数据库会话）
- **定时任务/调度**：`threading.Timer` 或 `sched` 模块
- **守护线程**：后台日志、心跳检测

### 2. 基于进程（Multiprocessing）
适用：**CPU 密集型**、**真正并行**、**隔离性要求高**

```python
from multiprocessing import Pool, shared_memory, Queue
import numpy as np

# 场景 A：并行计算（CPU 密集）
def heavy_compute(data_chunk):
    return np.fft.fft(data_chunk)

with Pool(processes=4) as pool:
    results = pool.map(heavy_compute, chunks)

# 场景 B：共享内存（避免序列化开销）
# Python 3.8+ 的 shared_memory，适合大数组零拷贝共享
arr = np.array([1, 2, 3, 4])
shm = shared_memory.SharedMemory(create=True, size=arr.nbytes)
shared_arr = np.ndarray(arr.shape, dtype=arr.dtype, buffer=shm.buf)
shared_arr[:] = arr[:]
```

**高级场景：**
- **进程池持久化**：`Pool` 的 `initializer` 参数预加载大模型，避免每个任务重复初始化
- **进程间通信**：`Queue`（有缓冲）、`Pipe`（双向）、`Manager`（分布式代理）
- **进程同步**：`Lock`/`Semaphore` 跨进程（基于操作系统信号量）

### 3. 基于协程（Asyncio）
适用：**超高并发 I/O**、**长连接**、**现代 Python 服务端**

```python
import asyncio
import aiohttp

# 场景 A：万级并发 HTTP
async def fetch(session, url):
    async with session.get(url) as resp:
        return await resp.text()

async def main():
    connector = aiohttp.TCPConnector(limit=100, limit_per_host=10)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [fetch(session, url) for url in urls]
        # Python 3.11+ 推荐 TaskGroup，自动异常传播和取消
        async with asyncio.TaskGroup() as tg:
            results = [tg.create_task(fetch(session, url)) for url in urls]
        # 或者传统方式
        # results = await asyncio.gather(*tasks, return_exceptions=True)

# 场景 B：背压控制与流控
async def producer(queue):
    for item in data_source:
        await queue.put(item)  # 队列满时自动阻塞，天然背压

async def consumer(queue):
    while True:
        item = await queue.get()
        await process(item)
        queue.task_done()

queue = asyncio.Queue(maxsize=100)  # 限制内存爆炸
```

**高级场景：**
- **信号量限流**：`asyncio.Semaphore(10)` 控制并发数
- **超时与取消**：`asyncio.wait_for` / `asyncio.shield` 保护关键操作
- **事件循环嵌套**：`loop.run_in_executor` 桥接同步代码
- **子进程管理**：`asyncio.create_subprocess_exec` 非阻塞调用 shell

### 4. 结构化并发（Trio / AnyIO）
适用：**复杂生命周期管理**、**取消传播**、**超大型异步项目**

```python
import trio

# 场景：nursery 保证所有子任务完成或全部取消
async def main():
    async with trio.open_nursery() as nursery:
        nursery.start_soon(producer, send_channel)
        nursery.start_soon(consumer, receive_channel)
        # 任一任务异常，其他任务自动取消，无孤儿任务
```

**优势**：严格的"父任务存活则子任务必须存活"语义，避免 `asyncio` 中常见的任务泄漏。

---

## 三、按架构模式分类

### 1. 生产者-消费者（Producer-Consumer）
最经典的解耦模式。

| 变体 | 实现 | 适用场景 |
|------|------|---------|
| **单生产者-多消费者** | `asyncio.Queue` / `multiprocessing.Queue` | 任务分发、爬虫 |
| **多生产者-单消费者** | `queue.SimpleQueue` + `threading` | 日志聚合、监控上报 |
| **多生产者-多消费者** | `Redis` / `RabbitMQ` + 多进程 | 分布式任务队列（Celery 模式） |
| **背压版** | `asyncio.Queue(maxsize=N)` | 内存敏感型流处理 |

### 2. 主从/工作者（Master-Worker）
```python
from concurrent.futures import ProcessPoolExecutor

# 场景：MapReduce 风格
def worker(partition):
    return map_func(partition)

with ProcessPoolExecutor() as executor:
    # executor.map 保持输入顺序，适合需要顺序保证的场景
    results = executor.map(worker, partitions, chunksize=10)
```

### 3. 发布-订阅（Pub-Sub）
```python
# asyncio 版
import asyncio

class EventBus:
    def __init__(self):
        self._subscribers = {}
    
    def subscribe(self, event_type, queue):
        self._subscribers.setdefault(event_type, []).append(queue)
    
    async def publish(self, event_type, message):
        for queue in self._subscribers.get(event_type, []):
            await queue.put(message)  # 非阻塞或丢弃策略
```

### 4. Actor 模型
Python 没有内置 Actor，但可用 `multiprocessing` + `Queue` 模拟：
```python
class Actor:
    def __init__(self):
        self.mailbox = multiprocessing.Queue()
        self.process = multiprocessing.Process(target=self._run)
        self.process.start()
    
    def send(self, message):
        self.mailbox.put(message)
    
    def _run(self):
        while True:
            msg = self.mailbox.get()
            if msg is None: break
            self.handle(msg)
    
    def handle(self, message): ...
```

### 5. Fork-Join
`concurrent.futures` 的本质：
```python
with ThreadPoolExecutor() as executor:
    futures = [executor.submit(task) for task in tasks]
    # 等待所有完成
    results = [f.result() for f in futures]
```

---

## 四、特殊与前沿场景

### 1. 子解释器（Subinterpreters）— Python 3.12+
PEP 734 引入的 `interpreters` 模块，提供**真正的并行线程**（每个子解释器有独立 GIL）。

```python
import interpreters

# 场景：绕过 GIL 而不付出进程 fork 的开销
interp = interpreters.create()
interp.run(t"""import numpy as np; ...""")
```

**现状**：3.13 仍在实验阶段，生态不成熟，但值得关注。

### 2. No-GIL 构建（PEP 703）
Python 3.13 支持 `--disable-gil` 编译。在此模式下：
- `threading` 真正实现多核并行
- 所有线程安全数据结构需要重新考虑（原子操作、无锁队列）

**场景**：高性能计算、游戏引擎、实时系统。

### 3. C 扩展释放 GIL
如果你写 Cython/C 扩展：
```c
Py_BEGIN_ALLOW_THREADS
// 长时间运行的 C 代码
Py_END_ALLOW_THREADS
```
**场景**：`hashlib`（哈希计算）、`zlib`（压缩）、`sqlite3`（查询）都在内部释放 GIL，所以这些操作的 `threading` 可以并行。

### 4. JIT 编译器（Python 3.13+）
`PYTHON_JIT=1` 启用实验性 JIT。对并发的影响：
- 纯 Python CPU 代码速度提升，可能减少使用 `multiprocessing` 的必要性
- 但 GIL 仍在（除非 No-GIL 构建）

---

## 五、选型决策树

```
是否需要多核并行利用？
├── 是 → 任务是否纯 Python CPU 计算？
│   ├── 是 → multiprocessing / ProcessPool / 子解释器(实验性)
│   └── 否（NumPy/C 扩展）→ threading 可能已释放 GIL，测试先
└── 否（I/O 等待为主）→ 并发量是否 > 1000？
    ├── 是 → asyncio（协程级轻量）
    └── 否 → ThreadPoolExecutor（代码简单，兼容性好）
    
是否需要跨机器？
└── 是 → Ray / Dask / Celery（分布式，非标准库）
    
是否实时性要求高（低延迟）？
└── 是 → asyncio + 无锁数据结构 / 预分配内存池
```

---

## 六、常见陷阱与高级对策

| 陷阱 | 场景 | 对策 |
|------|------|------|
| **GIL  contention** | 多线程纯 Python 计算 | 改用 ProcessPool；或 Cython 释放 GIL |
| **序列化开销** | `multiprocessing` 传大对象 | `shared_memory` / `multiprocessing.Array` / `mmap` |
| **事件循环阻塞** | `asyncio` 中调用同步函数 | `loop.run_in_executor` / `asyncio.to_thread` (3.9+) |
| **上下文切换爆炸** | 线程数 > 核心数 × 2 | 协程替代；或 `Semaphore` 限流 |
| **僵尸进程** | 子进程未 `wait()` | `asyncio` 自动管理；或 `signal(SIGCHLD, SIG_IGN)` |
| **内存泄漏** | `ThreadPoolExecutor` 未关闭 | 上下文管理器 `with`；或显式 `shutdown(wait=True)` |
| **死锁** | 锁的获取顺序不一致 | 全局锁层级；或用 `asyncio` 避免锁（单线程） |

---

如果你需要，我可以针对其中**任意一个场景**展开完整工程代码（包括错误处理、优雅关闭、监控指标），或者结合你当前的具体业务（比如 Web 后端、数据管道、实时系统）做针对性架构设计。