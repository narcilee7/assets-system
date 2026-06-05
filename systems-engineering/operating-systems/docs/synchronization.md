# Lock Primitives Comparison

## 目标

理解操作系统和并发编程中的同步原语：mutex、semaphore、condition variable、RWLock、spinlock，以及它们的适用场景和实现原理。

## 场景

- 什么时候用 mutex，什么时候用 semaphore？
- 自旋锁和互斥锁的区别？
- 条件变量为什么必须配合 mutex 使用？
- 读写锁的写饥饿问题怎么解决？
- 无锁编程（CAS）什么时候比锁更好？

## Mutex（互斥锁）

### 定义

```
mutex = 互斥访问临界区的锁

状态：
  - locked：被某个线程持有
  - unlocked：空闲

操作：
  - lock()：获取锁，如果已被持有则阻塞
  - unlock()：释放锁，唤醒等待的线程

特性：
  - 同一时刻只有一个线程进入临界区
  - 持有者才能释放（非递归 mutex）
```

### 实现（futex）

```
Linux futex（Fast Userspace muTEX）：

  1. 用户态尝试 CAS 修改锁状态（无竞争时无需内核介入）
  2. 如果 CAS 失败（锁被持有）：
     - 调用 futex_wait 进入内核等待队列
  3. unlock 时：
     - CAS 释放锁
     - 如果有等待者，调用 futex_wake 唤醒

优势：
  - 无竞争时：纯用户态，零 syscall
  - 有竞争时：才进入内核阻塞
```

### 示例

```c
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;

void* thread_func(void* arg) {
    pthread_mutex_lock(&mutex);
    // 临界区：访问共享资源
    counter++;
    pthread_mutex_unlock(&mutex);
    return NULL;
}
```

## Spinlock（自旋锁）

### 定义

```
spinlock = 获取锁失败时忙等待（自旋），不阻塞

实现：
  while (!atomic_cas(&lock, 0, 1)) {
      // 自旋：CPU 空转
      cpu_relax();  // 提示 CPU 降低功耗
  }

释放：
  lock = 0;  // 或 memory barrier + store
```

### 适用场景

```
适用：
  - 临界区极短（几个指令）
  - 多核 CPU（一个核自旋，另一个核很快释放）
  - 中断上下文（不能睡眠）
  - 内核底层（调度器、定时器）

不适用：
  - 临界区长（自旋浪费 CPU）
  - 单核 CPU（自旋的线程占着 CPU，持有锁的线程无法运行）
  - 用户态通常不用（除非极高性能场景）
```

### 对比

| 特性 | Mutex | Spinlock |
|---|---|---|
| 获取失败 | 阻塞，让出 CPU | 忙等待，占用 CPU |
| 上下文切换 | 有 | 无 |
| 适用临界区 | 长 | 极短 |
| 多核 | 都可以 | 必须多核 |
| 中断上下文 | 否（可能睡眠） | 是 |
| 用户态 | 常用 | 极少 |

## Semaphore（信号量）

### 定义

```
semaphore = 计数器，控制同时访问资源的线程数

操作：
  - P() / wait() / down()：计数器 -1，如果 < 0 则阻塞
  - V() / signal() / up()：计数器 +1，如果有等待线程则唤醒

特性：
  - 计数器 > 0：表示可用资源数
  - 计数器 = 0：无可用资源，后续 P() 阻塞
  - 计数器 < 0：绝对值 = 等待线程数
```

### Binary Semaphore vs Mutex

```
Binary Semaphore（初始值 = 1）：
  - 类似 mutex，但任何人都可以 signal
  - 没有"持有者"概念

Mutex：
  - 只有持有者才能 unlock
  - 有所有权概念
  
工程建议：
  - 保护临界区：用 mutex（更安全）
  - 资源池控制（连接池、缓冲区）：用 semaphore
```

### 示例：限制并发数

```c
sem_t sem;
sem_init(&sem, 0, 10);  // 最多 10 个线程并发

void* worker(void* arg) {
    sem_wait(&sem);     // P()，获取一个槽位
    // 执行任务
    sem_post(&sem);     // V()，释放槽位
    return NULL;
}
```

## Condition Variable（条件变量）

### 定义

```
condition variable = 让线程等待某个条件成立，然后被唤醒

操作：
  - wait(mutex)：原子地释放 mutex 并阻塞，直到被唤醒
  - signal()：唤醒一个等待线程
  - broadcast()：唤醒所有等待线程

必须配合 mutex 使用：
  - 检查条件和 wait 必须是原子的
  - 防止 signal 在 wait 之前发送（丢失唤醒）
```

### 为什么必须配 mutex？

```
错误用法（无 mutex）：
  Thread A:                    Thread B:
    while (!ready)               ready = true
      cond_wait()   // 阻塞       cond_signal()  // 信号丢失！

正确用法：
  Thread A:                    Thread B:
    lock(mutex)                  lock(mutex)
    while (!ready)               ready = true
      cond_wait(mutex)  // 原子释放锁+阻塞    cond_signal()
    unlock(mutex)                unlock(mutex)

cond_wait 的原子性：
  1. 释放 mutex
  2. 加入等待队列
  3. 阻塞
  （这三步原子，防止 signal 在中间插入）
```

### 示例：生产者-消费者

```c
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t not_full = PTHREAD_COND_INITIALIZER;
pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;
int buffer[SIZE];
int count = 0;

void* producer(void* arg) {
    pthread_mutex_lock(&mutex);
    while (count == SIZE) {
        pthread_cond_wait(&not_full, &mutex);
    }
    buffer[count++] = produce_item();
    pthread_cond_signal(&not_empty);
    pthread_mutex_unlock(&mutex);
    return NULL;
}

void* consumer(void* arg) {
    pthread_mutex_lock(&mutex);
    while (count == 0) {
        pthread_cond_wait(&not_empty, &mutex);
    }
    int item = buffer[--count];
    pthread_cond_signal(&not_full);
    pthread_mutex_unlock(&mutex);
    consume_item(item);
    return NULL;
}
```

## Read-Write Lock（读写锁）

### 定义

```
RWLock = 区分读和写的锁

规则：
  - 读锁：多个线程可同时持有（共享）
  - 写锁：独占，写时不能读，读时不能写
  - 写锁优先级通常高于读锁（防止写饥饿）

操作：
  - read_lock() / read_unlock()
  - write_lock() / write_unlock()
```

### 写饥饿问题

```
场景：读线程持续不断，写线程永远拿不到锁

解决方案：
  1. 写优先：有写等待时，新读请求阻塞
  2. 公平锁：按请求顺序排队（如 Linux pthread_rwlock）
  3. 升级限制：不允许读锁升级为写锁（防止死锁）
```

### 适用场景

```
适用：
  - 读多写少（缓存、配置表）
  
不适用：
  - 读少写多（性能不如 mutex）
  - 临界区极短（RWLock 本身开销大）
```

## 原子操作与 CAS

### CAS（Compare-And-Swap）

```
CAS(addr, expected, new):
  if *addr == expected:
    *addr = new
    return true
  else:
    return false

硬件支持：x86 LOCK CMPXCHG
```

### 无锁计数器

```c
void atomic_inc(atomic_t *v) {
    int old, new;
    do {
        old = atomic_read(v);
        new = old + 1;
    } while (!atomic_cas(v, old, new));
}
```

### ABA 问题

```
场景：
  1. 线程 A 读取值为 A
  2. 线程 B 修改为 B，又改回 A
  3. 线程 A CAS 成功，但中间有变化

解决方案：
  - 版本号（Tagged Pointer）：低 48 位指针 + 高 16 位版本
  - Hazard Pointer：延迟释放
  - RCU：读时复制，延迟回收
```

## 同步原语选择指南

| 场景 | 推荐原语 | 理由 |
|---|---|---|
| 保护共享变量 | mutex | 简单安全 |
| 读多写少 | RWLock | 读并发 |
| 限制资源池大小 | semaphore | 计数语义 |
| 等待某个条件 | condition variable | 精准唤醒 |
| 极短临界区、内核 | spinlock | 避免上下文切换 |
| 高频计数、队列 | atomic / CAS | 无锁，高吞吐 |
| 单生产者单消费者 | ring buffer + memory barrier | 零锁开销 |

## 核心追问

1. **mutex 和 binary semaphore 的本质区别？** mutex 有所有权（只有持有者能释放），semaphore 没有（任何人都能 signal）
2. **为什么 spinlock 在单核上不能用？** 持有锁的线程需要运行才能释放，但自旋线程占着 CPU 不释放，死锁
3. **条件变量为什么要用 while 而不是 if 检查条件？** 防止虚假唤醒（spurious wakeup）和多个线程被唤醒后的竞争
4. **CAS 为什么比 mutex 快？** 无竞争时纯用户态原子指令，无需进入内核；有竞争时自旋重试，适合极短操作
5. **读写锁的写饥饿怎么解决？** 写优先策略（新读在有写等待时阻塞），或公平排队锁

## 状态

| 资产 | 状态 |
|---|---|
| process vs thread notes | done |
| virtual memory deep dive | done |
| epoll and event loop bridge | done |
| file system and page cache | done |
| lock primitives comparison | done |
