# 同步原语与锁

Go 语言作为一个原生支持用户态进程（Goroutine）的语言，当提到并发编程、多线程编程时，往往都离不开锁这一概念。锁是一种并发编程中的同步原语（Synchronization Primitives），它能保证多个 Goroutine 在访问同一片内存时不会出现竞争条件（Race condition）等问题。

## 基本原语

Go 语言在 sync 包中提供了用于同步的一些基本原语，包括常见的 sync.Mutex、sync.RWMutex、sync.WaitGroup、sync.Once 和 sync.Cond：

### Mutex 互斥锁

Go 语言的 sync.Mutex 由两个字段 state 和 sema 组成。其中 state 表示当前互斥锁的状态，而 sema 是用于控制锁状态的信号量。

```go
type Mutext struct {
  state int32
  sema uint32
}
```

上述两个加起来只占 8 字节空间的结构体表示了 Go 语言中的互斥锁。

#### 状态

互斥锁的状态比较复杂，如下图所示，最低三位分别表示 mutexLocked、mutexWoken 和 mutexStarving，剩下的位置用来表示当前有多少个 Goroutine 在等待互斥锁的释放：

在默认情况下，互斥锁的所有状态位都是 0，int32 中的不同位分别表示了不同的状态：

mutexLocked — 表示互斥锁的锁定状态；
mutexWoken — 表示从正常模式被从唤醒；
mutexStarving — 当前的互斥锁进入饥饿状态；
waitersCount — 当前互斥锁上等待的 Goroutine 个数；

#### 正常模式与饥饿模式

##### 正常模式

在正常模式下，锁的等待者会按照先进先出的顺序获取锁。但是刚被唤起的 Goroutine 与新创建的 Goroutine 竞争时，大概率会获取不到锁，为了减少这种情况的出现，一旦 Goroutine 超过 1ms 没有获取到锁，它就会将当前互斥锁切换饥饿模式，防止部分 Goroutine 被『饿死』。
