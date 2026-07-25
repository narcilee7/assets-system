# Go `io` 标准库深度全解

## 一、四大核心接口：整个 Go IO 生态的基石

```go
// 1. Reader：读取数据到 p
type Reader interface {
    Read(p []byte) (n int, err error)
}

// 2. Writer：将 p 的数据写入
type Writer interface {
    Write(p []byte) (n int, err error)
}

// 3. Closer：关闭资源
type Closer interface {
    Close() error
}

// 4. Seeker：随机访问
type Seeker interface {
    Seek(offset int64, whence int) (int64, error)
}
```

### 组合接口（面试常问）

```go
type ReadWriter     interface { Reader; Writer }
type ReadCloser     interface { Reader; Closer }
type WriteCloser    interface { Writer; Closer }
type ReadWriteCloser interface { Reader; Writer; Closer }
type ReadSeeker     interface { Reader; Seeker }
type ReadWriteSeeker interface { Reader; Writer; Seeker }
```

---

## 二、`Read` 的契约：面试最容易踩的坑

### 核心契约（必须遵守）

| 规则 | 说明 |
|------|------|
| **返回 `n > 0` 时优先处理数据** | 即使 `err != nil`，也要先处理已读到的 `n` 字节 |
| **`err == io.EOF` 不是错误** | 表示**正常结束**，可能伴随 `n > 0`（最后一次有数据） |
| **`Read` 可能返回 `n < len(p)`** | 即使没读完，也不代表错误 |
| **`Read` 可能返回 `n == 0, err == nil`** | 只是暂时没数据，不等于 EOF |

```go
// ❌ 错误：先判断 err，可能漏掉最后一次数据
n, err := r.Read(buf)
if err != nil {
    return err // 如果 err == io.EOF 且 n > 0，就丢了最后一块数据！
}

// ✅ 正确：先处理 n，再判断 err
n, err := r.Read(buf)
process(buf[:n]) // 先处理读到的数据
if err == io.EOF {
    break // 正常结束
}
if err != nil {
    return err // 真正的错误
}
```

### 标准读取模式：`io.ReadFull`

```go
// 保证读到指定长度，否则返回错误
buf := make([]byte, 1024)
n, err := io.ReadFull(r, buf)
// err == io.ErrUnexpectedEOF 表示数据不够
```

---

## 三、高频工具函数

### 1. `io.Copy` — 数据搬运之王

```go
// 从 src 读到 dst，直到 EOF 或错误
written, err := io.Copy(dst, src)
```

**底层实现**：如果 `dst` 实现了 `io.ReaderFrom`，或 `src` 实现了 `io.WriterTo`，会直接用对应方法（零拷贝优化）。

```go
// 等价于 io.Copy，但只拷贝 N 字节
written, err := io.CopyN(dst, src, 1024)

// 读取全部内容到内存
data, err := io.ReadAll(r)
```

### 2. `io.WriteString` — 字符串优化

```go
// 如果 w 实现了 io.StringWriter，直接调用 WriteString（避免 []byte 转换）
io.WriteString(w, "hello")
```

### 3. `io.MultiReader / MultiWriter` — 聚合

```go
// 顺序读取多个 Reader
mr := io.MultiReader(r1, r2, r3)
data, _ := io.ReadAll(mr) // 先读 r1，再 r2，再 r3

// 同时写入多个 Writer（广播）
mw := io.MultiWriter(w1, w2, w3)
mw.Write([]byte("hello")) // w1 w2 w3 都收到
```

---

## 四、装饰器 Reader：功能增强

### 1. `io.LimitReader` — 限制读取量

```go
// 最多读 100 字节，防止大文件/恶意输入耗尽内存
lr := io.LimitReader(r, 100)
data, _ := io.ReadAll(lr) // 最多 100 字节
```

### 2. `io.TeeReader` — 边读边写（监控/日志）

```go
// 从 r 读数据时，同时写入 w（类似 tee 命令）
tr := io.TeeReader(r, w)
// 读 r 的数据会同时复制到 w（比如计算 hash 或打印日志）
```

### 3. `io.SectionReader` — 切片访问

```go
// 从 r 的 offset 处开始，最多读 n 字节（支持 Seek）
sr := io.NewSectionReader(r, offset, n)
```

### 4. `io.Pipe` — 内存管道

```go
pr, pw := io.Pipe()
// pr 是 Reader，pw 是 Writer
// 典型场景：goroutine 间传递流数据
go func() {
    pw.Write([]byte("hello"))
    pw.Close()
}()
data, _ := io.ReadAll(pr)
```

**Pipe 特性**：同步阻塞，无缓冲。`Write` 会阻塞直到 `Read` 消费。

---

## 五、`io.Discard` — 黑洞写入

```go
// 丢弃所有写入的数据，但实现了 Writer 接口
// 场景：不需要输出时，避免 nil 检查
io.Copy(io.Discard, r) // 读取并丢弃，比如只关心读取副作用
```

---

## 六、面试高频陷阱

### Q1: `Read` 返回 `n == 0, err == io.EOF` 是什么意思？

**A**: 表示**已经读完了，这次没有新数据**。`io.EOF` 可能在 `n > 0` 时返回（最后一次有数据），也可能在 `n == 0` 时返回（上次已经读完了，这次确认结束）。

### Q2: `io.ReadAll` 有什么风险？

**A**: 会把全部数据加载到内存。如果 `r` 是无限流（如 `/dev/zero`），会**OOM**。生产环境应该用 `io.CopyN` 或 `io.LimitReader` 限制。

### Q3: `io.Copy` 的零拷贝是怎么实现的？

**A**: `io.Copy` 源码会检查接口断言：
1. 如果 `dst` 实现了 `io.ReaderFrom`，调用 `dst.ReadFrom(src)`
2. 如果 `src` 实现了 `io.WriterTo`，调用 `src.WriteTo(dst)`
3. 否则用 32KB 缓冲区循环 `Read` + `Write`

```go
// 例如 *os.File 实现了 ReadFrom，直接走 sendfile 系统调用
func (f *File) ReadFrom(r Reader) (n int64, err error) {
    // 内部调用 syscall.Sendfile（零拷贝）
}
```

### Q4: `io.Pipe` 和 `bytes.Buffer` 的区别？

| | `io.Pipe` | `bytes.Buffer` |
|--|-----------|----------------|
| 缓冲 | 无缓冲（同步） | 有缓冲（异步） |
| 阻塞 | Write 阻塞到 Read | 不阻塞 |
| 并发 | 支持跨 goroutine | 需外部同步 |
| 场景 | 流式处理 | 数据拼接 |

### Q5: `io.MultiWriter` 的 Write 是并发还是顺序？

**A**: **顺序**写入每个 Writer。如果某个 Writer 返回错误，后续 Writer 不再执行，返回该错误。

### Q6: 为什么 `io.NopCloser` 存在？

```go
// 给没有 Close 方法的 Reader 包一个空 Close
rc := io.NopCloser(strings.NewReader("hello"))
// rc 实现了 io.ReadCloser，但 Close 什么都不做
```

---

## 七、快速记忆卡片

```
接口: Reader / Writer / Closer / Seeker
组合: ReadWriter / ReadCloser / ReadWriteCloser / ReadSeeker
函数: Copy / CopyN / ReadAll / WriteString / ReadFull
装饰: LimitReader / TeeReader / SectionReader / MultiReader / MultiWriter
管道: Pipe (pr, pw) — 同步无缓冲
黑洞: Discard — 实现 Writer 的空操作
```

需要我把 `io` 和 `bufio` 结合起来讲一个**带缓冲的流式处理 Demo**（比如逐行读取大文件 + 限流 + 进度监控），或者深挖 `io.Copy` 的 `sendfile` 零拷贝源码路径吗？