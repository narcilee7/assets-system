# 一、线程生命周期（OS 视角）

线程完整的生命周期通常可以表示为：

```text
                +----------------+
                |      NEW       |
                +----------------+
                        |
                    start()
                        |
                        v
                +----------------+
                |    RUNNABLE    |
                +----------------+
                   |         ^
        CPU调度    |         | 时间片结束
                   v         |
                +----------------+
                |    RUNNING     |
                +----------------+
                 |      |      |
       sleep()   |      | lock |
       wait()    |      | I/O  |
                 v      v
        +----------------------+
        | BLOCKED / WAITING    |
        +----------------------+
                 |
          条件满足/锁释放
                 |
                 v
            RUNNABLE
                 |
         run()执行结束
                 |
                 v
            TERMINATED
```

需要注意：

**Running 并不是一直存在。**

真正运行 CPU 指令时才是 Running。

时间片结束后：

```
Running
    ↓
Runnable
```

等待下一次调度。

---

# 二、Python Thread 对应生命周期

Python：

```python
import threading

def work():
    ...

t = threading.Thread(target=work)
```

此时：

```
NEW
```

线程对象已经创建：

但是：

* 没有 OS Thread
* 没有执行
* 不能 join()

---

调用：

```python
t.start()
```

发生了什么？

实际上：

CPython：

```
Thread.start()

↓

_start_new_thread()

↓

pthread_create()

↓

创建 OS Thread
```

线程进入：

```
RUNNABLE
```

等待 CPU 调度。

---

CPU 调度以后：

```
RUNNING
```

真正执行：

```python
work()
```

中的代码。

---

如果：

```python
time.sleep(1)
```

或者：

```python
lock.acquire()
```

或者：

```python
socket.recv()
```

线程进入：

```
WAITING
```

等待：

* 时间到
* 数据到
* 锁释放

之后：

```
WAITING

↓

RUNNABLE

↓

RUNNING
```

继续执行。

---

函数执行完成：

```
return
```

线程：

```
TERMINATED
```

结束。

---

# 三、Python Thread 生命周期图

```text
Thread()

↓

NEW

↓

start()

↓

RUNNABLE

↓

CPU 调度

↓

RUNNING

↓

sleep()
join()
Condition.wait()
Lock.acquire()
I/O

↓

WAITING / BLOCKED

↓

条件满足

↓

RUNNABLE

↓

RUNNING

↓

run() 返回

↓

TERMINATED
```

---

# 四、start() 做了什么？

很多人认为：

```python
start()
```

就是执行：

```python
run()
```

实际上不是。

真正过程：

```
start()

↓

创建 OS Thread

↓

pthread_create()

↓

新线程开始执行

↓

调用 run()
```

所以：

```
start()

≠

run()
```

---

# 五、run() 做了什么？

默认：

```python
class Thread:

    def run(self):
        self._target(*args)
```

也就是说：

```python
Thread(target=f)
```

最后：

真正执行的是：

```python
f()
```

---

# 六、join() 是生命周期里的什么？

很多人误以为：

```
join()

↓

结束线程
```

这是错误的。

join：

只是：

**等待线程结束。**

例如：

```python
t.start()

t.join()
```

主线程：

```
WAITING
```

等待：

```
Worker

↓

TERMINATED
```

之后：

join()返回。

线程不是：join()结束的。

而是：

```
run()

return
```

自然结束。

---

# 七、什么时候进入 Waiting？

很多 API 都会：

```
RUNNING

↓

WAITING
```

例如：

```python
time.sleep()
```

等待时间。

---

```python
lock.acquire()
```

锁被别人占用。

---

```python
condition.wait()
```

等待通知。

---

```python
event.wait()
```

等待事件。

---

```python
queue.get()
```

等待队列数据。

---

```python
socket.recv()
```

等待网络数据。

---

```python
join()
```

等待其他线程结束。

---

# 八、Python 有没有 Suspend？

Java：

以前：

```
suspend()

resume()
```

后来废弃。

Python：

没有。

Python：

线程：

不能：

```
暂停

恢复
```

只能：

自己：

```
Event

Condition

Queue
```

协作。

---

# 九、Python Thread 能重新 start() 吗？

经典面试题。

```python
t = Thread(...)

t.start()

t.join()

t.start()
```

结果：

```text
RuntimeError:

threads can only be started once
```

为什么？

因为：

OS Thread：

已经销毁。

Python Thread：

生命周期：

```
NEW

↓

RUNNING

↓

TERMINATED
```

结束以后：

不能：

回到：

```
NEW
```

只能：

重新：

```python
Thread(...)
```

创建。

---

# 十、daemon Thread 生命周期有什么区别？

例如：

```python
t.daemon = True
```

生命周期：

一样。

区别：

主线程退出：

```
Main Thread

↓

Exit
```

daemon：

直接：

结束。

不会：

等待：

```python
join()
```

---

# 十一、架构师面试容易追问的问题

## ① 为什么线程创建后不是立即运行？

因为 `start()` 只是向操作系统注册了一个可运行线程。什么时候真正执行，由操作系统调度器决定，因此线程进入的是 **RUNNABLE** 而不是 **RUNNING**。

---

## ② `join()` 会不会释放 GIL？

如果等待的是另一个线程结束，`join()` 内部会阻塞当前线程，在阻塞等待期间 CPython 会释放 GIL，让其他线程继续运行；否则等待线程自身结束就没有意义了。

---

## ③ 为什么 `Thread` 对象不能重复 `start()`？

`Thread` 对象和底层 OS Thread 是一一对应的。线程结束后，底层线程资源已经释放，CPython 不会重新绑定一个新的 OS Thread 到同一个 `Thread` 对象，因此规定一个 `Thread` 实例只能启动一次。

---

## 面试中的标准回答

> Python 的 `threading.Thread` 生命周期可以理解为 **NEW → RUNNABLE → RUNNING → WAITING/BLOCKED（可多次往返）→ TERMINATED**。创建 `Thread` 对象时仅处于 NEW 状态，调用 `start()` 后会创建底层 OS Native Thread 并进入 RUNNABLE，由操作系统调度执行 `run()`。执行过程中可能因 `sleep()`、锁竞争、I/O 或 `Condition.wait()` 等进入 WAITING/BLOCKED，条件满足后重新进入 RUNNABLE，最终 `run()` 返回后进入 TERMINATED。`join()` 不会结束线程，它只是让调用者等待目标线程结束；而一个 `Thread` 对象在结束后不能再次 `start()`，因为它对应的底层 OS 线程已经销毁。
