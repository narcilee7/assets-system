# 第一部分 基础（1~4）

## 1. Python 中 Thread 和 Process 的本质区别是什么？

希望回答：

不仅是

> Thread 共享内存
>
> Process 不共享

还应该讲：

* 地址空间
* 文件描述符
* GIL影响
* 创建成本
* IPC成本
* 调度单位（OS Thread）

进一步：

为什么 Python Thread 实际上还是 OS Native Thread？

为什么不是绿色线程？

---

## 2. 什么是 GIL？

要求回答：

* 为什么存在
* CPython 为什么需要 GIL
* GIL 保护什么
* GIL 是否保护对象线程安全
* GIL 如何切换
* I/O 为什么释放 GIL
* 哪些 C Extension 会释放 GIL

进一步：

为什么 list.append 看起来线程安全？

是不是永远安全？

---

## 3. Thread 生命周期是什么？

画出来：

```
NEW

 ↓

START

 ↓

RUNNABLE

 ↓

RUNNING

 ↓

BLOCKED
WAITING
TIMED_WAITING

 ↓

TERMINATED
```

Python里面

```
Thread()

start()

run()

join()
```

对应哪些状态？

---

## 4. start() 和 run() 有什么区别？

经典题。

为什么：

```
Thread(target=f).run()
```

没有启动线程？

---

# 第二部分 GIL 深入（5~7）

---

## 5. 为什么 CPU 密集型不适合 Thread？

例如：

```
def calc():
    while True:
        x += 1
```

两个线程

是不是一定比一个线程快？

为什么？

画：

```
Thread1

↓

拿到 GIL

↓

执行

↓

释放

↓

Thread2

↓

拿到 GIL
```

涉及：

* switch interval
* sys.setswitchinterval()

---

## 6. 哪些操作会释放 GIL？

例如：

```
time.sleep()

socket.recv()

requests.get()

numpy.dot()

sqlite.execute()

hashlib.md5()

```

哪些释放？

哪些不释放？

为什么？

---

## 7. Thread 在 NumPy 中为什么可以并行？

这是专家题。

希望回答：

NumPy

↓

C

↓

释放 GIL

↓

OpenBLAS

↓

SIMD

↓

真正多核

---

# 第三部分 同步原语（8~11）

---

## 8. Lock 和 RLock 有什么区别？

例如：

```
class A:

    def f():

        with lock:

            g()

    def g():

        with lock:
```

为什么：

Lock

死锁

RLock

不会？

底层如何实现？

---

## 9. Condition 的原理是什么？

什么时候：

```
notify()

notify_all()

wait()
```

会释放锁？

为什么：

Condition

必须绑定 Lock？

经典：

Producer Consumer

不用 Queue

自己实现。

---

## 10. Semaphore 的应用场景？

例如：

限制：

```
最多10个HTTP请求
```

为什么不用 Lock？

Semaphore 底层是什么？

为什么：

```
Semaphore(1)

≈ Lock
```

但不是完全一样？

---

## 11. Event、Barrier 分别解决什么问题？

举例：

Barrier

```
4个线程

↓

全部准备完成

↓

一起开始
```

Event

```
线程等待

↓

收到信号

↓

继续执行
```

实际项目哪里用？

---

# 第四部分 ThreadPool（12~13）

---

## 12. ThreadPoolExecutor 的工作原理？

不要回答：

"线程池"

希望回答：

```
submit()

↓

Future

↓

Work Queue

↓

Worker Thread

↓

执行

↓

结果放回 Future
```

线程什么时候创建？

什么时候销毁？

队列无限吗？

Worker 怎么退出？

---

## 13. executor.map 和 submit 有什么区别？

例如：

```
executor.map()

```

为什么：

结果顺序一定一致？

而：

```
as_completed()
```

为什么最快返回？

什么时候应该用哪个？

---

# 第五部分 工程实践（14~15）

---

## 14. Thread Local 是什么？

例如：

```
threading.local()
```

为什么：

数据库 Session

日志 TraceID

都喜欢放 ThreadLocal？

ThreadLocal

是不是共享变量？

底层怎么实现？

---

## 15. 如何排查 Python 线程死锁？

这是架构师最喜欢的问题。

希望回答：

### 第一层

打印：

```
threading.enumerate()
```

---

第二层

```
faulthandler.dump_traceback()
```

查看所有线程栈。

---

第三层

```
gdb

py-bt
```

查看 GIL。

---

第四层

分析：

* 谁拿着 Lock
* 谁等待 Lock
* 是否循环等待

画：

```
T1

↓

LockA

↓

等待 LockB

↑

↓

T2

↓

LockB

↓

等待 LockA
```

---

# 专家加分题（建议继续扩展）

如果你的目标是 Python 专家/高级架构师，我建议 Threading 后续继续深入这几个专题（每个专题都值得再出 10~20 道题）：

1. **ThreadPoolExecutor 源码**

   * `_worker()`
   * `Future`
   * `WorkItem`
   * `_threads_queues`
   * shutdown 流程

2. **GIL 源码**

   * ceval.c
   * gil_drop_request
   * eval breaker
   * switch interval
   * Python 3.12/3.13 的变化

3. **CPython 内存模型**

   * 引用计数
   * 原子性
   * 对象生命周期
   * GC 与线程

4. **线程安全数据结构**

   * `queue.Queue`
   * `SimpleQueue`
   * `deque`
   * `collections`
   * 无锁与锁保护的权衡

5. **生产级实践**

   * 优雅停止线程（graceful shutdown）
   * 线程池饥饿（thread pool starvation）
   * Backpressure（背压）
   * Cancellation（取消）
   * Timeout（超时）
   * Context propagation（上下文传播）
   * 线程泄漏检测

这 15 道题构成了一个较完整的 Threading 面试题库，从基础 API 一直到工程实践和底层原理，覆盖了高级 Python 工程师和架构师面试中最常见的考点。
****