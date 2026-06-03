# 值语义与引用语义

## 1. Go 的默认行为：一切按值传递

```go
func modify(x int) {
    x = 100  // 修改的是副本
}

func main() {
    a := 1
    modify(a)
    fmt.Println(a)  // 1，原值不变
}
```

## 2. "描述符类型"的引用语义

以下类型的值本身是**描述符**（包含指针+元数据），按值传递描述符不会复制底层数据：

| 类型 | 值的内容 | 底层数据 |
|------|---------|---------|
| `slice` | ptr + len + cap | 底层数组 |
| `map` | 指针 + 元数据 | 哈希桶 |
| `channel` | 指针 + 元数据 | 环形缓冲 |
| `function` | 代码指针 + 上下文指针 | 闭包捕获的变量 |
| `interface` | 类型指针 + 数据指针 | 动态值 |

**经典陷阱**：

```go
func appendOne(s []int) {
    s = append(s, 1)  // 如果 cap 足够，修改的是底层数组
    // 但 s 本身（header）不会传回调用者
}

func main() {
    s := make([]int, 0, 10)
    appendOne(s)
    fmt.Println(s)  // []，不是 [1]
}
```

## 3. 内存布局直觉

```go
type Point struct{ X, Y int }

p := Point{1, 2}
// 栈上的布局：[8 bytes X][8 bytes Y]

func move(p Point) {
    // 传入的是 Point 的完整副本（16 bytes）
}
```

```go
var m map[string]int
// m 本身是一个指针大小的描述符
// 底层哈希表在堆上
```

## 4. 工程启示

- 小结构体（< 64 bytes）按值传递通常更快（避免指针间接寻址 + GC 压力）
- 大结构体或需要修改的用指针
- 函数返回值优先用值（逃逸分析会决定是否在栈上分配）
