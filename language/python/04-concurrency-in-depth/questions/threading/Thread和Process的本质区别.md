这是 Python 并发中最经典的问题，但如果是 **Python 专家/架构师** 面试，面试官期待的绝不是一句「线程共享内存，进程不共享」。

一个完整回答应该从 **操作系统 → CPython → 工程实践** 三个层面展开。

---

# 一、先说结论

| 对比维度 | Thread（线程）              | Process（进程）                         |
| ---- | ----------------------- | ----------------------------------- |
| 调度单位 | CPU 调度的最小单位             | 资源分配的最小单位                           |
| 地址空间 | 同一进程共享                  | 每个进程独立                              |
| GIL  | 同一个解释器共享一个 GIL（CPython） | 每个进程一个独立 GIL                        |
| 创建成本 | 低                       | 高                                   |
| 切换成本 | 低                       | 高                                   |
| 通信   | 共享内存即可                  | IPC（Queue/Pipe/Socket/SharedMemory） |
| 崩溃影响 | 一个线程崩溃可能导致整个进程退出        | 一个进程崩溃通常不影响其他进程                     |
| 适用场景 | I/O 密集                  | CPU 密集                              |

真正的区别，不在 Python，而在 **操作系统**。

---

# 二、什么是 Process（进程）

操作系统中：

> **进程（Process）是资源分配的基本单位。**

一个进程拥有：

```
Process
│
├── Virtual Memory
│
├── Heap
│
├── Stack（每个线程自己的）
│
├── File Descriptor Table
│
├── Signal Handler
│
├── Environment
│
└── 一个或多个 Thread
```

例如：

```
Chrome

├── Renderer Process
├── GPU Process
├── Network Process
└── Utility Process
```

每个都是独立地址空间。

互相不能直接访问内存。

必须：

```
IPC

Socket

Pipe

Shared Memory

Message Queue
```

---

# 三、什么是 Thread（线程）

线程：

> **CPU 调度执行代码的最小单位。**

线程没有自己的：

* Heap
* 全局变量
* 文件描述符

它们共享：

```
Process

    Heap
      ↑
Thread1
Thread2
Thread3
```

只有：

```
Thread

Registers

Program Counter

Stack
```

属于线程自己。

所以：

```
global x

Thread1

Thread2
```

都能访问。

---

# 四、线程为什么共享内存？

例如：

```python
x = 0

def work():
    global x
    x += 1
```

两个线程：

```
Thread1

↓

Heap

↓

x
```

```
Thread2

↓

Heap

↓

x
```

访问的是同一块内存。

所以：

```
Race Condition
```

就出现了。

需要：

```python
Lock
```

保护。

---

# 五、进程为什么不能共享？

例如：

```
Process A

Heap

x = 10
```

```
Process B

Heap

x = 10
```

它们只是：

看起来

变量一样。

实际上：

```
Virtual Address

0x1000
```

对应：

不同物理页。

操作系统：

MMU

页表

保证：

互相隔离。

因此：

```python
global
```

对于 multiprocessing：

完全没意义。

---

# 六、Python Thread 为什么不是绿色线程？

很多人容易误解：

Python Thread

是不是 asyncio？

不是。

Python：

```python
threading.Thread
```

实际上：

直接调用：

```
pthread_create()
```

Linux

或者：

```
CreateThread()
```

Windows

所以：

Python Thread

是真正：

OS Native Thread。

不是：

Go

Goroutine

不是：

Java Loom

Virtual Thread

不是：

Erlang Process

---

# 七、CPython 为什么 Thread 不能真正并行？

这里进入：

Python 特有。

CPython：

一个解释器：

```
Interpreter

↓

GIL
```

所有线程：

```
Thread1

↓

GIL
```

```
Thread2

↓

GIL
```

执行 Python Bytecode：

必须：

```
拿到 GIL
```

所以：

```
CPU

Core1

Thread1
```

```
CPU

Core2

Thread2
```

虽然：

OS 调度：

两个线程

可以跑。

但是：

Python 字节码：

一次：

只能：

一个线程执行。

所以：

```
CPU Bound

Thread

≈

串行
```

这也是：

为什么：

CPU：

推荐：

```
multiprocessing
```

---

# 八、为什么 Process 可以真正并行？

例如：

```
Process1

↓

Interpreter

↓

GIL1
```

```
Process2

↓

Interpreter

↓

GIL2
```

每个：

都有：

自己的：

解释器。

自己的：

GIL。

所以：

```
Core1

Process1
```

```
Core2

Process2
```

真正：

同时运行。

---

# 九、通信方式有什么区别？

Thread：

共享内存：

```python
queue.Queue()

Lock()

Condition()

Event()
```

Process：

不能：

共享对象。

需要：

```python
multiprocessing.Queue
```

或者：

```python
Pipe()
```

或者：

```python
shared_memory
```

或者：

Socket。

---

# 十、创建成本为什么不同？

线程：

只需要：

```
创建 Stack

创建 TCB(Thread Control Block)
```

即可。

几百 KB。

进程：

需要：

```
创建地址空间

复制页表

初始化解释器

导入模块
```

即使：

Linux：

```
fork()
```

用了：

Copy-On-Write。

仍然：

远高于：

线程。

Windows：

甚至：

没有：

fork。

只能：

spawn。

成本：

更高。

---

# 十一、稳定性有什么区别？

线程：

```
Segmentation Fault
```

整个：

Python：

退出。

因为：

一个进程。

一个地址空间。

而：

Process：

```
Worker Crash
```

Master：

还能：

继续运行。

例如：

Gunicorn：

```
Master

↓

Worker1

Worker2

Worker3
```

Worker：

挂了。

Master：

重新拉起。

---

# 十二、什么时候选 Thread？什么时候选 Process？

| 场景             | 推荐                             |
| -------------- | ------------------------------ |
| HTTP 请求        | Thread 或 asyncio               |
| WebSocket      | asyncio                        |
| 数据库访问          | Thread 或 asyncio               |
| 文件下载           | Thread                         |
| 爬虫             | Thread 或 asyncio               |
| 图像处理（纯 Python） | Process                        |
| NumPy 矩阵计算     | 先测试 Thread（很多 NumPy 操作会释放 GIL） |
| AI 推理          | Process（尤其 GPU、多模型隔离）          |
| ETL 数据处理       | Process                        |

一个经验法则是：**瓶颈在等待（I/O）时，线程能够在等待期间切换到其他任务；瓶颈在解释器执行 Python 字节码（CPU）时，多线程会受到 GIL 限制，应优先考虑多进程。**

---

## 面试中的高质量总结

可以用一句话收尾：

> **Thread 和 Process 的本质区别首先来自操作系统，而不是 Python。线程共享同一进程的地址空间，创建和切换成本低，适合 I/O 密集型任务；进程拥有独立的地址空间和资源，通信成本更高，但隔离性更好。在 CPython 中，由于 GIL 的存在，多线程执行 Python 字节码无法充分利用多核，而多进程由于每个进程都有独立的解释器和 GIL，因此能够实现真正的 CPU 并行。这也是 Python 并发模型选型时最重要的依据之一。**
