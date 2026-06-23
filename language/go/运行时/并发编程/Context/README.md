# Context

```go
type Context interface {
	Deadline() (deadline time.Time, ok bool)
	Done() <-chan struct{}
	Err() error
	Value(key interface{}) interface{}
}
```

context.Context 是 Go 语言在 1.7 版本中引入标准库的接口1，该接口定义了四个需要实现的方法，其中包括：

1. Deadline — 返回 context.Context 被取消的时间，也就是完成工作的截止日期；
2. Done — 返回一个 Channel，这个 Channel 会在当前工作完成或者上下文被取消后关闭，多次调用 Done 方法会返回同一个 Channel；
3. Err — 返回 context.Context 结束的原因，它只会在 Done 方法对应的 Channel 关闭时返回非空的值；
如果 context.Context 被取消，会返回 Canceled 错误；
如果 context.Context 超时，会返回 DeadlineExceeded 错误；
4. Value — 从 context.Context 中获取键对应的值，对于同一个上下文来说，多次调用 Value 并传入相同的 Key 会返回相同的结果，该方法可以用来传递请求特定的数据；

## 设计原理

在 Goroutine 构成的树形结构中对信号进行同步以减少计算资源的浪费是 context.Context 的最大作用。
Go 服务的每一个请求都是通过单独的 Goroutine 处理的，HTTP/RPC 请求的处理器会启动新的 Goroutine 访问数据库和其他服务。

们可能会创建多个 Goroutine 来处理一次请求，而 context.Context 的作用是**在不同 Goroutine 之间同步请求特定数据、取消信号以及处理请求的截止日期**。

每一个 context.Context 都会从最顶层的 Goroutine 一层一层传递到最下层。context.Context 可以在上层 Goroutine 执行出现错误时，将信号及时同步给下层。

当最上层的 Goroutine 因为某些原因执行失败时，下层的 Goroutine 由于没有接收到这个信号所以会继续工作；但是当我们正确地使用 context.Context 时，就可以在下层及时停掉无用的工作以减少额外资源的消耗：

## 默认上下文 

context 包中最常用的方法还是 context.Background、context.TODO，这两个方法都会返回预先初始化好的私有变量 background 和 todo，它们会在同一个 Go 程序中被复用：

```go
func Backgroun() Context {
  return background
}

func TODO() Context {
  return todo
}
```

这两个私有的变量都是通过new(emptyCtx)初始化，指向私有结构体context.emptyCtx的指针

```go
type emptyCtx int

func (*emptyCtx) Deadline() (deadline time.Time, ok bool) {
	return
}

func (*emptyCtx) Done() <-chan struct{} {
	return nil
}

func (*emptyCtx) Err() error {
	return nil
}

func (*emptyCtx) Value(key interface{}) interface{} {
	return nil
}
```

从源代码来看，context.Background 和 context.TODO 也只是互为别名，没有太大的差别，只是在使用和语义上稍有不同：

context.Background 是上下文的默认值，所有其他的上下文都应该从它衍生出来；
context.TODO 应该仅在不确定应该使用哪种上下文时使用；
在多数情况下，如果当前函数没有上下文作为入参，我们都会使用 context.Background 作为起始的上下文向下传递。

## 取消信号

`context.WithCancel`函数能够从`context.Context`中衍生出一个新的子上下文并返回用于取消该上下文的函数。
一旦我们执行返回的取消函数，当前上下文以及它的子上下文都会被取消，所有的 Goroutine 都会**同步**收到这一取消信号。

### Context子树的取消

```go
func WithCancel(parent Context) (ctx Context, cancel CancelFunc) {
  c := newCancel(parent)
  propagateCancel(parent, &c)
  return &c, func() { c.cancel(true, Canceled ) }
}
```

- context.newCancelCtx 将传入的上下文包装成私有结构体 context.cancelCtx；
- context.propagateCancel 会构建父子上下文之间的关联，当父上下文被取消时，子上下文也会被取消：

```go
func propagateCancel(parent Context, child canceler) {
  done := parent.Done()
  if done == nil {
    return // parent 不会触发取消事件时，当前函数会直接返回
  }
  select {
    case <-done:
      child.cancel(false, parent.Err())
      return
    default:
  }
  if p, ok := parentCancelCtx(parent); ok {
    p.mu.Lock()
    if p.err != nil {
      child.Cancel(false, p.err)
    } else {
      p.children[child] = struct{}{}
    }
    p.mu.Unlock()
  } else {
    go func() {
      select {
        case <-parent.Done():
          child.cancel(false, parent.Err())
        case <-child.Done():
      }
    }()
  }
}
```

1. 当 parent.Done() == nil，也就是 parent 不会触发取消事件时，当前函数会直接返回；
2. 当 child 的继承链包含可以取消的上下文时，会判断 parent 是否已经触发了取消信号；
   - 如果已经被取消，child 会立刻被取消；
   - 如果没有被取消，child 会被加入 parent 的 children 列表中，等待 parent 释放取消信号；
3. 当父上下文是开发者自定义的类型、实现了 context.Context 接口并在 Done() 方法中返回了非空的管道时；
   - 运行一个新的 Goroutine 同时监听 parent.Done() 和 child.Done() 两个 Channel；
   - 在 parent.Done() 关闭时调用 child.cancel 取消子上下文；

#### cancel


```go
func (c *cancelCtx) cancel(removeFromParent bool, err error) {
  c.mu.Lock()
  if c.err != nil {
    c.mu.Unlock()
    return
  }
  c.err = err
  if c.done == nil {
    c.done = closedchan
  } else {
    close(c.done)
  }
  for child := range c.children {
    child.cancel(false, err)
  }
  c.children = nil
  c.mu.Unlock()

  if removeFromParent {
    removeChild(c.Context, c)
  }
}
```

#### WithTimeout

```go
func WithTimeout(parent Context, timeout time.Duration) (Context, CancelFunc) {
	return WithDeadline(parent, time.Now().Add(timeout))
}

func WithDeadline(parent Context, d time.Time) (Context, CancelFunc) {
	if cur, ok := parent.Deadline(); ok && cur.Before(d) {
		return WithCancel(parent)
	}
	c := &timerCtx{
		cancelCtx: newCancelCtx(parent),
		deadline:  d,
	}
	propagateCancel(parent, c)
	dur := time.Until(d)
	if dur <= 0 {
		c.cancel(true, DeadlineExceeded) // 已经过了截止日期
		return c, func() { c.cancel(false, Canceled) }
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.err == nil {
		c.timer = time.AfterFunc(dur, func() {
			c.cancel(true, DeadlineExceeded)
		})
	}
	return c, func() { c.cancel(true, Canceled) }
}
```

