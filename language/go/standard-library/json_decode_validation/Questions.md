# Go `encoding/json` 深度全解

## 一、核心接口：控制序列化的钥匙

```go
type Marshaler interface {
    MarshalJSON() ([]byte, error)
}

type Unmarshaler interface {
    UnmarshalJSON([]byte) error
}
```

**实现这两个接口，你就完全接管了该类型的 JSON 表示**。

---

## 二、结构体标签（Struct Tag）完整规则

```go
type User struct {
    ID        int       `json:"id"`                // 小写键名
    Name      string    `json:"name,omitempty"`     // 空值时省略
    Email     string    `json:"-"`                 // 完全忽略该字段
    Password  string    `json:"-,omitempty"`       // ❌ 无效：- 和 omitempty 不能共存
    Age       int       `json:"age,string"`        // 编码为 JSON 字符串 "25"
    Score     float64   `json:"score,omitempty"`   // 0 会被省略！
    CreatedAt time.Time `json:"created_at"`        // 自动 RFC3339
    Tags      []string  `json:"tags"`              // 切片 null vs []
    Metadata  map[string]any `json:"metadata"`     // 任意 JSON 对象
}
```

### `omitempty` 的"空值"定义（面试高频陷阱）

| 类型 | 被认为是 empty 的值 |
|------|-------------------|
| `bool` | `false` |
| `int/float` | `0` |
| `string` | `""` |
| `slice/map/pointer/interface` | `nil` |
| `struct` | 永远不为 empty（即使字段全零值）|

```go
// 陷阱：想保留 0 分，但 omitempty 把它吞了
type Score struct {
    Points int `json:"points,omitempty"`
}
json.Marshal(Score{Points: 0}) // {}  ← 0 被省略了！

// 解决：用指针
type Score struct {
    Points *int `json:"points,omitempty"`
}
p := 0
json.Marshal(Score{Points: &p}) // {"points":0}
```

---

## 三、编码解码：Marshal vs Encoder

### `json.Marshal` — 全量内存

```go
data, err := json.Marshal(v) // 返回 []byte
```

### `json.NewEncoder` — 流式写入（面试常问区别）

```go
// 直接写入 io.Writer，不经过中间 []byte
enc := json.NewEncoder(w)
enc.SetIndent("", "  ") // 格式化缩进
enc.Encode(v) // 末尾自动加换行
```

**关键区别**：
- `Marshal`：先编码到内存 `[]byte`，再复制给调用方
- `Encoder`：编码后直接写入 `io.Writer`，**零拷贝**到输出流

---

## 四、解码：Unmarshal vs Decoder

### `json.Unmarshal` — 全量内存

```go
var user User
err := json.Unmarshal(data, &user)
```

### `json.NewDecoder` — 流式读取 + 关键能力

```go
dec := json.NewDecoder(r)

// 1. 禁用科学计数法转 float64（处理大整数）
dec.UseNumber()

// 2. 流式解码多个 JSON 对象
for dec.More() {
    var item Item
    dec.Decode(&item)
}

// 3. Token 遍历（不反序列化到 struct，直接遍历 JSON 结构）
for {
    tok, err := dec.Token()
    if err == io.EOF { break }
    // tok 可能是 Delim('{')、string、float64 等
}
```

---

## 五、底层原理：reflect 与缓存

### 编码流程

```
Marshal(v)
  │
  ▼
typeEncoder(v.Type())  ← 查询缓存
  │
  ├─ 命中缓存 → 直接返回编码器
  │
  └─ 未命中 → 反射分析类型 → 生成编码器 → 存入缓存
              │
              ▼
         对 struct 每个字段：
           - 解析 json tag
           - 确定字段偏移量
           - 生成闭包编码器
```

**面试考点**：`json` 包用 `sync.Map` 缓存类型到编码器的映射，**同类型第二次编码不再反射**，所以性能并非想象中那么差。

### `Decoder.UseNumber()` 的原理

```go
// 默认行为：JSON number → float64
// 问题：大整数（如 9223372036854775807）会丢失精度

// UseNumber 后：JSON number → json.Number（string 包装）
type Number string
func (n Number) Int64() (int64, error)
func (n Number) Float64() (float64, error)
```

---

## 六、自定义序列化：完整 Demo

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
	"time"
)

// ==================== 1. 自定义时间格式 ====================

type CustomTime struct {
	time.Time
}

const ctLayout = "2006-01-02 15:04:05"

func (ct CustomTime) MarshalJSON() ([]byte, error) {
	// 输出 "2024-01-15 10:30:00" 而不是默认的 RFC3339
	return []byte(`"` + ct.Format(ctLayout) + `"`), nil
}

func (ct *CustomTime) UnmarshalJSON(data []byte) error {
	// 去掉两边的引号
	s := strings.Trim(string(data), `"`)
	t, err := time.Parse(ctLayout, s)
	if err != nil {
		return err
	}
	ct.Time = t
	return nil
}

// ==================== 2. 敏感字段脱敏 ====================

type User struct {
	ID       int       `json:"id"`
	Name     string    `json:"name"`
	Email    string    `json:"email"`
	Password Password  `json:"password"` // 自定义类型，Marshal 时脱敏
}

type Password string

func (p Password) MarshalJSON() ([]byte, error) {
	// 序列化时永远输出 "***"
	return []byte(`"***"`), nil
}

// ==================== 3. 多态反序列化：根据 type 字段实例化不同结构 ====================

// 原始 JSON: {"type":"email","to":"a@b.com","subject":"hi"}
//            {"type":"sms","phone":"123","content":"hello"}

type Event struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"` // 延迟解析，先保留原始字节
}

type EmailEvent struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
}

type SMSEvent struct {
	Phone   string `json:"phone"`
	Content string `json:"content"`
}

func parseEvents(raw []byte) ([]any, error) {
	var events []Event
	if err := json.Unmarshal(raw, &events); err != nil {
		return nil, err
	}

	var result []any
	for _, e := range events {
		switch e.Type {
		case "email":
			var ev EmailEvent
			if err := json.Unmarshal(e.Data, &ev); err != nil {
				return nil, err
			}
			result = append(result, ev)
		case "sms":
			var ev SMSEvent
			if err := json.Unmarshal(e.Data, &ev); err != nil {
				return nil, err
			}
			result = append(result, ev)
		}
	}
	return result, nil
}

// ==================== 4. 流式解码：处理超大 JSON 数组 ====================

func streamDecode(r io.Reader) {
	dec := json.NewDecoder(r)

	// 期望 '['
	tok, err := dec.Token()
	if err != nil {
		log.Fatal(err)
	}
	if tok != json.Delim('[') {
		log.Fatal("expected [")
	}

	// 逐个解码数组元素，内存占用固定
	for dec.More() {
		var item map[string]any
		if err := dec.Decode(&item); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("流式读取: %v\n", item)
	}

	// 期望 ']'
	tok, err = dec.Token()
	if err != nil {
		log.Fatal(err)
	}
	if tok != json.Delim(']') {
		log.Fatal("expected ]")
	}
}

// ==================== 5. 编码器复用 + 缓冲区池 ====================

var bufPool = make(chan *bytes.Buffer, 10)

func encodeWithPool(v any) []byte {
	var buf *bytes.Buffer
	select {
	case buf = <-bufPool:
		buf.Reset()
	default:
		buf = new(bytes.Buffer)
	}

	enc := json.NewEncoder(buf)
	enc.Encode(v)

	data := make([]byte, buf.Len())
	copy(data, buf.Bytes())

	select {
	case bufPool <- buf:
	default:
	}

	return data
}

// ==================== Main ====================

func main() {
	fmt.Println("=== 1. 自定义时间 ===")
	ct := CustomTime{Time: time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC)}
	data, _ := json.Marshal(ct)
	fmt.Println(string(data))

	var ct2 CustomTime
	json.Unmarshal(data, &ct2)
	fmt.Println(ct2.Format(ctLayout))

	fmt.Println("\n=== 2. 密码脱敏 ===")
	u := User{ID: 1, Name: "Alice", Email: "a@b.com", Password: "secret123"}
	data, _ = json.Marshal(u)
	fmt.Println(string(data))

	fmt.Println("\n=== 3. 多态反序列化 ===")
	raw := []byte(`[
		{"type":"email","data":{"to":"a@b.com","subject":"hi"}},
		{"type":"sms","data":{"phone":"123","content":"hello"}}
	]`)
	events, _ := parseEvents(raw)
	for _, e := range events {
		fmt.Printf("%T: %+v\n", e, e)
	}

	fmt.Println("\n=== 4. 流式解码 ===")
	streamDecode(strings.NewReader(`[
		{"id":1,"name":"a"},
		{"id":2,"name":"b"},
		{"id":3,"name":"c"}
	]`))

	fmt.Println("\n=== 5. 编码器复用 ===")
	d := encodeWithPool(map[string]int{"x": 1})
	fmt.Println(string(d))
}
```

---

## 七、高频面试题与深度答案

### Q1: `json:"-"` 和 `json:"-,omitempty"` 有什么区别？

**A**: `json:"-"` 表示**完全忽略**该字段（不编码也不解码）。`json:"-,omitempty"` 是**无效写法**，`-` 已经表示忽略，后面的 tag 不会生效。如果需要在编码时忽略但解码时保留，需要自定义 `MarshalJSON`。

### Q2: `omitempty` 对 `0` 和 `false` 的行为？怎么保留零值？

**A**: `omitempty` 会把 `0`、`false`、`""`、`nil` 都视为空值而省略。要保留零值：
1. 用**指针**：`*int` 的 `nil` 才省略，`&0` 会编码为 `0`
2. 自定义 `MarshalJSON` 方法
3. 用 `json.RawMessage` 手动控制

### Q3: `json.NewEncoder` 和 `json.Marshal` 的性能差异？

**A**: `Marshal` 需要分配 `[]byte` 返回给调用方。`Encoder` 直接写入 `io.Writer`，如果 `Writer` 是 `*os.File` 或 `net.Conn`，可以**避免中间缓冲**。高频场景（如 HTTP API）用 `Encoder` 更好，配合 `sync.Pool` 复用 `bytes.Buffer`。

### Q4: `Decoder.UseNumber()` 解决什么问题？

**A**: 默认 `Unmarshal` 把 JSON number 解析为 `float64`，大整数会丢失精度（`9007199254740993` 变成 `9007199254740992`）。`UseNumber()` 让 number 保持为 `json.Number`（底层是 string），按需转 `Int64()` 或 `Float64()`。

### Q5: `json.RawMessage` 的使用场景？

**A**: 延迟解析。当你需要：
1. **先读外层再读内层**：如上面的多态反序列化，先读 `type` 字段决定结构
2. **透传未知结构**：代理服务收到 JSON，只改头部，body 保持 `RawMessage` 原样转发
3. **条件解析**：根据业务逻辑决定后续解析方式

### Q6: 为什么嵌套 `struct` 的零值不会被 `omitempty` 省略？

**A**: `encoding/json` 的源码里，`struct` 永远不被视为 empty（没有零值概念）。即使所有字段都是零值，整个 struct 依然会被编码为 `{}`。解决：用指针 `*InnerStruct`，`nil` 时会被省略。

```go
type Outer struct {
    Inner Inner `json:"inner,omitempty"` // 即使 Inner 全零值，也会输出 {}
}

type Outer struct {
    Inner *Inner `json:"inner,omitempty"` // nil 时省略
}
```

---

## 快速记忆卡片

```
接口: Marshaler / Unmarshaler
标签: name,omitempty / - / name,string
omitempty 空值: false, 0, "", nil, (struct 永不为空)
流式: Encoder(w) / Decoder(r) / UseNumber / Token
延迟: json.RawMessage
精度: json.Number (替代 float64)
零值保留: *int / *bool / *Struct / 自定义 Marshal
```

需要我继续深挖 `json` 的 **反射缓存机制源码**（`typeEncoder` 的 `sync.Map` 实现），或者来一个 **HTTP API 场景下的完整最佳实践**（请求绑定 + 验证 + 错误处理 + 流式响应）吗？