# Protobuf 完全参考手册

> 目标：覆盖 Protobuf 从语法到编码、从工具链到工程实践的全部细节。

---

## 目录

1. [核心设计哲学](#1-核心设计哲学)
2. [语法规范（proto3 为主）](#2-语法规范proto3-为主)
3. [标量类型与 Wire 类型映射](#3-标量类型与-wire-类型映射)
4. [复合类型详解](#4-复合类型详解)
5. [字段规则与编号机制](#5-字段规则与编号机制)
6. [编码机制（二进制格式）](#6-编码机制二进制格式)
7. [向后兼容与版本演进](#7-向后兼容与版本演进)
8. [选项系统（Options）](#8-选项系统options)
9. [服务定义与 gRPC](#9-服务定义与-grpc)
10. [工具链与代码生成](#10-工具链与代码生成)
11. [JSON 映射规范](#11-json-映射规范)
12. [工程实践与最佳实践](#12-工程实践与最佳实践)
13. [高频面试题与深度解析](#13-高频面试题与深度解析)
14. [完整示例：从 .proto 到 gRPC 服务](#14-完整示例从-proto-到-grpc-服务)

---

## 1. 核心设计哲学

### 1.1 为什么需要 Protobuf？

| 维度 | JSON | XML | Protobuf |
|------|------|-----|----------|
| 序列化大小 | 大（文本+键名） | 极大 | 小（二进制+编号） |
| 解析速度 | 慢（字符串解析） | 极慢 | 快（直接内存映射） |
| Schema 约束 | 无 | DTD/XSD | `.proto` 强约束 |
| 向后兼容 | 人工维护 | 人工维护 | 内置字段编号机制 |
| 多语言支持 | 通用 | 通用 | 代码生成 |
| 可读性 | 好 | 一般 | 差（需工具） |

### 1.2 核心设计原则

1. **字段编号即契约**：字段名可以改，编号不能复用。编号是二进制编码的标识符。
2. **二进制优先**：牺牲人类可读性，换取极致的序列化/反序列化性能。
3. **Schema 驱动**：先定义契约，再生成代码。编译期即发现接口不匹配。
4. **版本透明**：新增字段对旧代码透明；删除字段通过 `reserved` 保护。

---

## 2. 语法规范（proto3 为主）

### 2.1 文件结构

```protobuf
syntax = "proto3";                    // 语法版本声明，必须在第一行

package example.v1;                   // 包名，防止命名冲突，支持嵌套

option go_package = "github.com/example/api/v1";  // 生成选项
option java_package = "com.example.api.v1";
option java_multiple_files = true;

import "google/protobuf/timestamp.proto";  // 导入标准库
import "other/custom.proto";               // 导入自定义 proto
import public "shared/base.proto";          // 公开导入（传递依赖）

// 定义从这里开始...
```

### 2.2 语法版本对比：proto2 vs proto3

| 特性 | proto2 | proto3 | 说明 |
|------|--------|--------|------|
| 字段规则 | `required` / `optional` / `repeated` | 默认 `optional`，无 `required` | proto3 简化语义 |
| 默认值 | 可自定义 `default = xxx` | 固定零值 | proto3 无法自定义默认值 |
| 未知字段 | 保留在解析结果中 | 默认丢弃 | proto3 可用 `proto3_optional` 保留 |
| 枚举 | 支持别名（默认） | 默认不支持别名 | proto3 需 `option allow_alias = true` |
| 组（Group） | 支持 | 已移除 | 用嵌套 message 替代 |
| 扩展（Extension） | 支持 | 移除 | 用 `Any` 替代 |
| JSON 映射 | 有限 | 完整规范 | proto3 定义了标准 JSON 映射 |

### 2.3 标量类型

```protobuf
message ScalarTypes {
  // 整数类型
  double   d = 1;   // 64-bit IEEE 754
  float    f = 2;   // 32-bit IEEE 754
  int32    i32 = 3;   // 变长编码，负数效率低
  int64    i64 = 4;   // 变长编码
  uint32   u32 = 5;   // 变长编码
  uint64   u64 = 6;   // 变长编码
  sint32   s32 = 7;   // ZigZag 编码，负数效率高
  sint64   s64 = 8;   // ZigZag 编码
  fixed32  fx32 = 9;  // 4 字节定长，>2^28 时比 uint32 小
  fixed64  fx64 = 10; // 8 字节定长
  sfixed32 sfx32 = 11; // 4 字节定长有符号
  sfixed64 sfx64 = 12; // 8 字节定长有符号

  // 其他类型
  bool     b = 13;    // 变长编码，0/1
  string   str = 14;  // UTF-8 编码，长度前缀
  bytes    raw = 15;  // 原始字节，长度前缀
}
```

### 2.4 复合类型

#### Message（消息）

```protobuf
message Person {
  int64 id = 1;
  string name = 2;

  // 嵌套 message
  message Address {
    string street = 1;
    string city = 2;
  }
  Address address = 3;
}
```

#### Enum（枚举）

```protobuf
enum Status {
  option allow_alias = true;  // 允许别名（proto3 默认不允许）

  UNKNOWN = 0;      // 第一个值必须是 0（默认零值）
  PENDING = 1;
  RUNNING = 2;
  ACTIVE = 2;       // 别名，指向同一个值
  DONE = 3;
}
```

> **注意**：proto3 枚举第一个值必须是 0，且 0 是默认值。如果 0 不是有效业务状态，建议定义为 `UNKNOWN = 0` 或 `UNSPECIFIED = 0`。

#### Oneof（互斥字段）

```protobuf
message Result {
  oneof payload {
    string text = 1;
    bytes binary = 2;
    Error error = 3;
  }
}
```

- 设置其中一个字段，其他字段自动清空（设为默认值）
- 内存优化：只分配最大字段的空间
- 不能同时使用 `repeated` 和 `map`
- 生成的代码中有一个 `case` 字段标识当前哪个字段被设置

#### Map（映射）

```protobuf
message Config {
  map<string, string> metadata = 1;
  map<int32, string> index_map = 2;
}
```

- 键类型：只能是整数或字符串（不能是 `bytes`、`float`、`double`、枚举、message）
- 值类型：任意类型
- 底层编码为 `repeated MapEntry`（键值对 message）
- 不支持 `repeated map`（map 本身已经是 repeated 的）

#### Repeated（数组）

```protobuf
message Tags {
  repeated string labels = 1;
  repeated int32 scores = 2 [packed = true];  // 打包编码，更紧凑
}
```

- `packed = true`：标量类型的 repeated 字段使用连续打包编码，减少 tag 开销
- proto3 默认 `packed = true`（标量类型）
- 非标量类型（message、string、bytes）不能 packed

#### Any（泛型容器）

```protobuf
import "google/protobuf/any.proto";

message Wrapper {
  google.protobuf.Any detail = 1;
}
```

- 可包装任意 message
- 序列化后包含类型 URL（如 `type.googleapis.com/example.Person`）和序列化后的值
- 运行时类型安全（反序列化时验证类型）

### 2.5 标准类型（Well-Known Types）

```protobuf
import "google/protobuf/timestamp.proto";    // 时间戳
import "google/protobuf/duration.proto";      // 时间段
import "google/protobuf/empty.proto";          // 空消息
import "google/protobuf/struct.proto";         // JSON-like 结构（Value, Struct, ListValue）
import "google/protobuf/wrappers.proto";      // 包装类型（StringValue, Int32Value, BoolValue 等）
import "google/protobuf/field_mask.proto";    // 字段掩码（部分更新）
```

---

## 3. 标量类型与 Wire 类型映射

### 3.1 Wire Type（二进制编码类型）

Protobuf 二进制编码中，每个字段以 `tag + value` 形式存储。Tag 包含字段编号和 wire type：

| Wire Type | 编号 | 说明 | 适用类型 |
|-----------|------|------|----------|
| Varint | 0 | 变长整数 | int32, int64, uint32, uint64, sint32, sint64, bool, enum |
| Fixed64 | 1 | 8 字节定长 | fixed64, sfixed64, double |
| Length-delimited | 2 | 长度前缀 | string, bytes, embedded message, packed repeated |
| Start Group | 3 | 组开始（已废弃） | proto2 group |
| End Group | 4 | 组结束（已废弃） | proto2 group |
| Fixed32 | 5 | 4 字节定长 | fixed32, sfixed32, float |

### 3.2 Tag 编码

Tag = `(field_number << 3) | wire_type`

例如：字段编号 1，wire type 0（Varint）：
- Tag = `(1 << 3) | 0` = 8 = `00001000`（二进制）
- 使用 Varint 编码存储

---

## 4. 复合类型详解

### 4.1 Message 的内存布局（概念）

```
[Tag1][Value1][Tag2][Value2][Tag3][Value3]...
```

- 字段顺序不保证与 `.proto` 定义一致
- 同一字段可能出现多次（repeated 非 packed 时）
- 未知字段：proto2 保留，proto3 默认丢弃

### 4.2 Oneof 的底层实现

```protobuf
message OneofDemo {
  oneof choice {
    string name = 1;
    int32 id = 2;
  }
}
```

生成的 Go 代码：

```go
type OneofDemo struct {
    Choice isOneofDemo_Choice  // 接口类型，标识当前哪个字段有效
}

type OneofDemo_Name struct { Name string }
type OneofDemo_Id struct { Id int32 }

func (x *OneofDemo) GetName() string {
    if x, ok := x.GetChoice().(*OneofDemo_Name); ok {
        return x.Name
    }
    return ""
}
```

### 4.3 Map 的编码细节

Map 底层编码为 `repeated MapEntry`，其中 `MapEntry` 是自动生成的 message：

```protobuf
message MapEntry {
  KeyType key = 1;
  ValueType value = 2;
}
```

### 4.4 Any 的使用与类型安全

```protobuf
import "google/protobuf/any.proto";

message Event {
  google.protobuf.Any payload = 1;
}
```

Go 代码：

```go
import (
    "google.golang.org/protobuf/types/known/anypb"
)

// 打包
person := &Person{Name: "Alice"}
anyMsg, err := anypb.New(person)

// 解包
person2 := &Person{}
if err := anyMsg.UnmarshalTo(person2); err != nil {
    // 类型不匹配
}
```

---

## 5. 字段规则与编号机制

### 5.1 字段编号范围

| 范围 | 字节数 | 用途 |
|------|--------|------|
| 1-15 | 1 字节 | 高频字段，优先使用 |
| 16-2047 | 2 字节 | 普通字段 |
| 19000-19999 | 禁用 | Protobuf 预留（`Descriptor` 等内部类型） |
| ≥ 19000 | 不可用 | 编译器报错 |

### 5.2 编号分配策略

```protobuf
message Order {
  // 高频核心字段用 1-15
  int64 id = 1;           // 查询最频繁
  string status = 2;      // 状态判断频繁

  // 次高频用 16-2047
  double amount = 16;
  string currency = 17;

  // 低频/扩展字段
  string note = 100;
  map<string, string> metadata = 101;
}
```

### 5.3 Reserved（保留字段）

```protobuf
message User {
  reserved 4, 5, 6;           // 保留编号
  reserved "email", "phone";  // 保留字段名（辅助提示）
  reserved 10 to 20;          // 保留范围
  reserved 30 to max;         // 保留到最大编号

  int64 id = 1;
  string name = 2;
  // 4,5,6 已被占用，不能复用
}
```

> **规则**：删除字段后必须 `reserved` 其编号，防止后续复用导致旧代码解析错误。

---

## 6. 编码机制（二进制格式）

### 6.1 Varint 编码

Varint 是一种变长整数编码，每个字节最高位为 continuation bit（1 表示后续还有字节，0 表示结束）。

**示例：编码 300**

```
300 = 256 + 32 + 8 + 4 = 0b00000001 00101100

Varint 编码（小端序，7 位一组）：
  00101100 00000001
  | 低 7 位 | 高 7 位 |

字节 1: 00101100 | 1 = 10101100 (0xAC)  ← continuation bit = 1
字节 2: 00000001 | 0 = 00000001 (0x01)  ← continuation bit = 0

结果：AC 02
```

### 6.2 ZigZag 编码（sint32/sint64）

负数用 Varint 编码需要大量字节（符号位扩展）。ZigZag 将负数映射到正数：

| 原始值 | 编码值 | 公式 |
|--------|--------|------|
| 0 | 0 | `(n << 1) ^ (n >> 31)` |
| -1 | 1 | |
| 1 | 2 | |
| -2 | 3 | |
| 2 | 4 | |
| -3 | 5 | |

**使用建议**：如果字段可能为负数，优先使用 `sint32`/`sint64` 而非 `int32`/`int64`。

### 6.3 字符串/字节编码（Length-delimited）

```
[Tag: wire_type=2][Length: Varint][Data: 原始字节]
```

示例：字段 2（string），值 "testing"：
```
Tag: (2 << 3) | 2 = 18 = 0x12
Length: 7 = 0x07
Data: "testing" = 0x74 65 73 74 69 6E 67

结果：12 07 74 65 73 74 69 6E 67
```

### 6.4 Embedded Message 编码

与字符串相同，也是 Length-delimited：

```
[Tag][Length][Message 的序列化字节]
```

### 6.5 Packed Repeated 编码

```protobuf
repeated int32 scores = 1 [packed = true];
```

编码：
```
[Tag: wire_type=2][Total Length][Value1(Varint)][Value2(Varint)]...
```

所有值连续存储，只用一个 Tag，大幅节省空间。

### 6.6 完整编码示例

```protobuf
message Test {
  int32 a = 1;      // 150
  string b = 2;     // "hello"
}
```

编码结果：
```
a=150:  Tag=(1<<3)|0=8,  Value=150=0x96+0x01 → 08 96 01
b="hello": Tag=(2<<3)|2=18, Length=5, Data="hello" → 12 05 68 65 6C 6C 6F

完整: 08 96 01 12 05 68 65 6C 6C 6F
```

---

## 7. 向后兼容与版本演进

### 7.1 安全变更（向后兼容）

| 操作 | 影响 | 说明 |
|------|------|------|
| 新增字段 | ✅ 安全 | 旧代码忽略未知字段 |
| 删除字段 | ⚠️ 需 reserved | 必须保留编号 |
| 重命名字段 | ✅ 安全 | 只改名字，不改编号 |
| 将字段改为 `oneof` | ⚠️ 谨慎 | 需确保语义兼容 |
| 将 `optional` 改为 `repeated` | ✅ 安全 | 旧代码读取第一个元素 |
| 修改字段类型 | ❌ 不安全 | 可能导致解析错误 |
| 修改字段编号 | ❌ 不安全 | 完全破坏兼容性 |

### 7.2 字段类型变更的安全规则

| 从 | 到 | 是否安全 | 说明 |
|----|----|----------|------|
| int32 | int64 | ✅ | 扩展范围 |
| uint32 | uint64 | ✅ | 扩展范围 |
| int32 | uint32 | ❌ | 符号语义改变 |
| string | bytes | ⚠️ | UTF-8 验证可能失败 |
| fixed32 | fixed64 | ✅ | 扩展 |
| sint32 | int32 | ❌ | 编码方式不同 |
| enum | int32 | ⚠️ | 可能丢失语义 |

### 7.3 版本管理策略

```protobuf
// 版本化包名
package example.v1;
// → 升级时改为 example.v2

// 或在服务层面版本化
service UserService {
  rpc GetUserV1(GetUserRequest) returns (User);
  rpc GetUserV2(GetUserRequestV2) returns (UserV2);
}
```

---

## 8. 选项系统（Options）

### 8.1 文件级选项

```protobuf
option go_package = "github.com/example/api/v1";
option java_package = "com.example.api";
option java_multiple_files = true;
option java_outer_classname = "UserProto";
option csharp_namespace = "Example.Api";
option objc_class_prefix = "EX";
option optimize_for = SPEED;  // SPEED / CODE_SIZE / LITE_RUNTIME
```

### 8.2 字段级选项

```protobuf
message User {
  int64 id = 1 [(validate.rules).int64.gt = 0];  // protoc-gen-validate
  string email = 2 [(validate.rules).string.email = true];

  string name = 3 [deprecated = true];  // 标记废弃

  int32 score = 4 [json_name = "user_score"];  // JSON 序列化名
}
```

### 8.3 自定义选项（Custom Options）

```protobuf
import "google/protobuf/descriptor.proto";

extend google.protobuf.MessageOptions {
  string my_option = 51234;
}

extend google.protobuf.FieldOptions {
  bool sensitive = 51235;
}

message MyMessage {
  option (my_option) = "Hello world";

  string password = 1 [(sensitive) = true];
}
```

---

## 9. 服务定义与 gRPC

### 9.1 四种流模式

```protobuf
service Calculator {
  // 1. Unary（一元）
  rpc Add(AddRequest) returns (AddResponse);

  // 2. Server Streaming（服务端流）
  rpc PrimeFactors(NumberRequest) returns (stream NumberResponse);

  // 3. Client Streaming（客户端流）
  rpc Average(stream NumberRequest) returns (AverageResponse);

  // 4. Bidirectional Streaming（双向流）
  rpc Chat(stream ChatMessage) returns (stream ChatMessage);
}
```

### 9.2 gRPC 状态码

| 状态码 | 含义 | 场景 |
|--------|------|------|
| OK (0) | 成功 | |
| CANCELLED (1) | 取消 | 客户端取消 |
| UNKNOWN (2) | 未知错误 | |
| INVALID_ARGUMENT (3) | 参数无效 | 请求参数校验失败 |
| DEADLINE_EXCEEDED (4) | 超时 | 超过 deadline |
| NOT_FOUND (5) | 未找到 | 资源不存在 |
| ALREADY_EXISTS (6) | 已存在 | 重复创建 |
| PERMISSION_DENIED (7) | 权限不足 | |
| RESOURCE_EXHAUSTED (8) | 资源耗尽 | 限流 |
| FAILED_PRECONDITION (9) | 前置条件失败 | 状态不匹配 |
| ABORTED (10) | 中止 | 并发冲突 |
| OUT_OF_RANGE (11) | 超出范围 | 分页参数 |
| UNIMPLEMENTED (12) | 未实现 | 方法不存在 |
| INTERNAL (13) | 内部错误 | 服务端异常 |
| UNAVAILABLE (14) | 服务不可用 | 网络/服务故障 |
| DATA_LOSS (15) | 数据丢失 | |
| UNAUTHENTICATED (16) | 未认证 | 缺少凭证 |

### 9.3 元数据（Metadata）

```go
// 客户端发送
md := metadata.Pairs("authorization", "Bearer token123", "x-request-id", uuid.New().String())
ctx := metadata.NewOutgoingContext(context.Background(), md)

// 服务端读取
md, ok := metadata.FromIncomingContext(ctx)
auth := md.Get("authorization")
```

---

## 10. 工具链与代码生成

### 10.1 protoc 编译器

```bash
# 基础编译
protoc --go_out=. --go_opt=paths=source_relative person.proto

# 带 gRPC 插件
protoc --go_out=. --go_opt=paths=source_relative \
       --go-grpc_out=. --go-grpc_opt=paths=source_relative \
       service.proto

# 多文件批量编译
protoc --go_out=. --go-grpc_out=. api/*.proto

# 使用第三方插件
protoc --go_out=. --validate_out=. api/*.proto  # protoc-gen-validate
```

### 10.2 常用插件

| 插件 | 用途 | 命令 |
|------|------|------|
| protoc-gen-go | Go message 代码 | `--go_out` |
| protoc-gen-go-grpc | Go gRPC 服务代码 | `--go-grpc_out` |
| protoc-gen-validate | 字段校验规则 | `--validate_out` |
| protoc-gen-grpc-gateway | RESTful 网关 | `--grpc-gateway_out` |
| protoc-gen-openapiv2 | OpenAPI 文档 | `--openapiv2_out` |
| protoc-gen-doc | 文档生成 | `--doc_out` |

### 10.3 Buf（现代替代方案）

```yaml
# buf.yaml
version: v1
name: buf.build/example/api
deps:
  - buf.build/googleapis/googleapis
breaking:
  use:
    - FILE
lint:
  use:
    - DEFAULT
```

```bash
buf generate      # 生成代码
buf lint        # 检查规范
buf breaking --against '.git#branch=main'  # 兼容性检查
buf push        # 推送到 BSR（Buf Schema Registry）
```

---

## 11. JSON 映射规范

### 11.1 默认映射规则

| Protobuf 类型 | JSON 类型 | 示例 |
|---------------|-----------|------|
| message | object | `{"name":"Alice"}` |
| enum | string | `{"status":"ACTIVE"}` |
| map<K,V> | object | `{"metadata":{"key":"value"}}` |
| repeated | array | `{"tags":["a","b"]}` |
| bool | true/false | `{"active":true}` |
| string | string | `{"name":"Alice"}` |
| bytes | base64 字符串 | `{"data":"SGVsbG8="}` |
| int32/64 | number | `{"id":123}` |
| float/double | number | `{"score":3.14}` |
| Timestamp | RFC 3339 字符串 | `{"created":"2024-01-01T00:00:00Z"}` |
| Duration | 字符串 | `{"timeout":"1.5s"}` |
| FieldMask | 字符串 | `{"mask":"field1,field2.sub"}` |
| Empty | {} | `{"result":{}}` |
| Any | object（含 @type） | `{"detail":{"@type":"...","value":"..."}}` |
| Struct | object | `{"config":{"key":"value"}}` |
| Value | any | `{"value":123}` 或 `{"value":"str"}` |
| NullValue | null | `{"value":null}` |
| Wrapper | 对应类型或 null | `{"name":"Alice"}` 或 `{"name":null}` |

### 11.2 选项控制

```protobuf
message User {
  string name = 1 [json_name = "user_name"];  // JSON 字段名映射

  // 使用 protojson 库时
  // - 枚举默认输出字符串名（非数字）
  // - 字段默认输出零值（proto3 默认值）
  // - 未知字段默认丢弃
}
```

---

## 12. 工程实践与最佳实践

### 12.1 命名规范

```protobuf
// 包名：小写，用点分隔域名反转
package com.example.api.v1;

// Message：PascalCase
message UserProfile {}

// 字段：snake_case
string first_name = 1;

// Enum：PascalCase，值：UPPER_SNAKE_CASE
enum Status {
  STATUS_UNSPECIFIED = 0;
  STATUS_ACTIVE = 1;
}

// Service：PascalCase
service UserService {}

// RPC 方法：PascalCase
rpc GetUser(GetUserRequest) returns (User);
```

### 12.2 版本化策略

```
api/
├── v1/
│   ├── user.proto
│   └── order.proto
├── v2/
│   ├── user.proto      # 独立版本，不引用 v1
│   └── order.proto
└── buf.yaml
```

### 12.3 错误处理模式

```protobuf
// 标准错误详情（google.golang.org/genproto/googleapis/rpc/errdetails）
import "google/protobuf/any.proto";
import "google/rpc/error_details.proto";

// gRPC 返回 Status + 详细错误
// Go 代码：
// st, _ := status.New(codes.InvalidArgument, "invalid request").
//     WithDetails(&errdetails.BadRequest{...})
```

### 12.4 部分更新（FieldMask）

```protobuf
import "google/protobuf/field_mask.proto";

message UpdateUserRequest {
  User user = 1;
  google.protobuf.FieldMask update_mask = 2;  // 指定更新哪些字段
}

// 调用：update_mask: "name", "email"
// 只更新 name 和 email，其他字段忽略
```

### 12.5 性能优化

1. **字段编号分配**：高频字段用 1-15
2. **使用 packed repeated**：标量数组默认 packed
3. **负数用 sint**：`sint32`/`sint64` 比 `int32`/`int64` 编码负数更高效
4. **避免过大 message**：单个 message 建议 < 1MB
5. **使用 `bytes` 而非 `string` 存储二进制数据**：避免 UTF-8 验证开销

---

## 13. 高频面试题与深度解析

### Q1：Protobuf 为什么比 JSON 快？

**答**：
1. **二进制编码**：无需字符串解析，直接内存映射
2. **字段编号替代键名**：JSON 每个字段都传输完整键名字符串，Protobuf 只传 1-2 字节编号
3. **无反射开销**：编译期生成解析代码，运行时直接调用
4. **Varint 压缩**：小整数用更少字节
5. **Packed repeated**：数组元素共享一个 Tag

### Q2：proto3 为什么移除了 `required`？

**答**：`required` 是破坏性变更的温床。一旦标记为 `required`，后续无法安全移除（旧代码会拒绝缺少该字段的消息）。proto3 通过默认零值简化语义，用应用层校验替代语言层强制。

### Q3：如何保证向后兼容？

**答**：
1. 新增字段用新编号
2. 删除字段后立即 `reserved` 编号和字段名
3. 不修改已有字段的编号和类型
4. 重命名字段只改名字不改编号
5. 版本化包名或服务名（`v1` → `v2`）

### Q4：`int32` 和 `sint32` 的区别？

**答**：编码方式不同。`int32` 用标准 Varint，负数会变成很大的正数（补码表示），需要 10 字节。`sint32` 用 ZigZag 编码，将负数映射到小正数，只需 1-2 字节。

### Q5：Protobuf 的默认值陷阱？

**答**：proto3 中所有字段都有默认值，无法区分「未设置」和「设置为默认值」。例如 `int32 count = 1`，无法区分「count=0」和「count 未设置」。解决方案：
- 使用 `google.protobuf.Int32Value` 等 Wrapper 类型
- 使用 `proto3_optional`（proto3 可选字段）
- 业务层约定（如 0 表示未设置）

### Q6：Protobuf 的未知字段怎么处理？

**答**：proto2 保留未知字段，可以序列化后重新发出。proto3 默认丢弃，但可以通过 `proto3_optional` 或设置 `DiscardUnknown: false` 保留。在代理/网关场景中，保留未知字段很重要。

### Q7：如何处理 Protobuf 的循环依赖？

**答**：
1. 使用 `import` 引入依赖的 proto
2. 如果 A.proto 引用 B.proto 且 B.proto 引用 A.proto，需要重构：
   - 提取公共类型到 C.proto
   - 使用 `Any` 类型延迟解析
3. 避免消息类型之间的循环引用

### Q8：Protobuf 的枚举为什么第一个值必须是 0？

**答**：proto3 的默认值机制要求。未设置的枚举字段默认值为 0，所以 0 必须对应一个有效值。建议定义为 `UNSPECIFIED = 0` 或 `UNKNOWN = 0`，表示「未指定」。

### Q9：gRPC 的四种流模式适用场景？

| 模式 | 场景 |
|------|------|
| Unary | 普通 CRUD |
| Server Streaming | 服务端推送、实时通知、大列表分批返回 |
| Client Streaming | 客户端上传、批量写入、文件上传 |
| Bidirectional | 聊天、实时游戏、协同编辑 |

### Q10：Protobuf 的 `Any` 和 `oneof` 怎么选？

| 场景 | 推荐 |
|------|------|
| 类型在编译期确定 | `oneof` |
| 类型在运行时动态确定 | `Any` |
| 需要类型安全 | `oneof` |
| 需要插件化/扩展性 | `Any` |
| 消息体积敏感 | `oneof`（更紧凑） |

---

## 14. 完整示例：从 .proto 到 gRPC 服务

### 14.1 定义（api/v1/user.proto）

```protobuf
syntax = "proto3";

package example.api.v1;
option go_package = "github.com/example/api/v1";

import "google/protobuf/timestamp.proto";
import "google/protobuf/field_mask.proto";
import "google/protobuf/empty.proto";

message User {
  int64 id = 1;
  string name = 2;
  string email = 3;
  int32 age = 4;
  google.protobuf.Timestamp created_at = 5;
  map<string, string> metadata = 6;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
  int32 age = 3;
}

message GetUserRequest {
  int64 id = 1;
}

message UpdateUserRequest {
  User user = 1;
  google.protobuf.FieldMask update_mask = 2;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
}

message ListUsersResponse {
  repeated User users = 1;
  string next_page_token = 2;
}

service UserService {
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc GetUser(GetUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(GetUserRequest) returns (google.protobuf.Empty);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);

  // 流式示例：实时用户状态推送
  rpc WatchUsers(google.protobuf.Empty) returns (stream User);
}
```

### 14.2 编译

```bash
protoc --go_out=. --go_opt=paths=source_relative \
       --go-grpc_out=. --go-grpc_opt=paths=source_relative \
       api/v1/user.proto
```

### 14.3 Go 服务端实现

```go
package main

import (
    "context"
    "log"
    "net"

    "google.golang.org/grpc"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
    "google.golang.org/protobuf/types/known/emptypb"
    "google.golang.org/protobuf/types/known/timestamppb"

    pb "github.com/example/api/v1"
)

type userServer struct {
    pb.UnimplementedUserServiceServer
    users map[int64]*pb.User
    nextID int64
}

func (s *userServer) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.User, error) {
    s.nextID++
    user := &pb.User{
        Id:        s.nextID,
        Name:      req.Name,
        Email:     req.Email,
        Age:       req.Age,
        CreatedAt: timestamppb.Now(),
    }
    s.users[user.Id] = user
    return user, nil
}

func (s *userServer) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    user, ok := s.users[req.Id]
    if !ok {
        return nil, status.Errorf(codes.NotFound, "user %d not found", req.Id)
    }
    return user, nil
}

func (s *userServer) UpdateUser(ctx context.Context, req *pb.UpdateUserRequest) (*pb.User, error) {
    user, ok := s.users[req.User.Id]
    if !ok {
        return nil, status.Errorf(codes.NotFound, "user not found")
    }

    // 根据 FieldMask 选择性更新
    for _, path := range req.UpdateMask.GetPaths() {
        switch path {
        case "name":
            user.Name = req.User.Name
        case "email":
            user.Email = req.User.Email
        case "age":
            user.Age = req.User.Age
        }
    }
    return user, nil
}

func (s *userServer) DeleteUser(ctx context.Context, req *pb.GetUserRequest) (*emptypb.Empty, error) {
    delete(s.users, req.Id)
    return &emptypb.Empty{}, nil
}

func (s *userServer) ListUsers(ctx context.Context, req *pb.ListUsersRequest) (*pb.ListUsersResponse, error) {
    var users []*pb.User
    for _, u := range s.users {
        users = append(users, u)
    }
    return &pb.ListUsersResponse{Users: users}, nil
}

func (s *userServer) WatchUsers(_ *emptypb.Empty, stream pb.UserService_WatchUsersServer) error {
    for _, u := range s.users {
        if err := stream.Send(u); err != nil {
            return err
        }
    }
    return nil
}

func main() {
    lis, err := net.Listen("tcp", ":50051")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }

    s := grpc.NewServer()
    pb.RegisterUserServiceServer(s, &userServer{
        users: make(map[int64]*pb.User),
    })

    log.Println("Server starting on :50051")
    if err := s.Serve(lis); err != nil {
        log.Fatalf("failed to serve: %v", err)
    }
}
```

### 14.4 Go 客户端

```go
package main

import (
    "context"
    "log"
    "time"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
    pb "github.com/example/api/v1"
)

func main() {
    conn, err := grpc.Dial("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    client := pb.NewUserServiceClient(conn)
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    // Create
    user, err := client.CreateUser(ctx, &pb.CreateUserRequest{
        Name:  "Alice",
        Email: "alice@example.com",
        Age:   30,
    })
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Created: %v", user)

    // Get
    got, err := client.GetUser(ctx, &pb.GetUserRequest{Id: user.Id})
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Got: %v", got)

    // Watch (streaming)
    stream, err := client.WatchUsers(ctx, &emptypb.Empty{})
    if err != nil {
        log.Fatal(err)
    }
    for {
        u, err := stream.Recv()
        if err != nil {
            break
        }
        log.Printf("Stream: %v", u)
    }
}
```

---

## 附录 A：Wire Format 速查表

```
Varint:        [tag][varint-value]
Fixed64:       [tag][8-bytes]
Length-delimited: [tag][length(varint)][data]
Fixed32:       [tag][4-bytes]

Tag encoding:  (field_number << 3) | wire_type
```

## 附录 B：proto3 默认值表

| 类型 | 默认值 |
|------|--------|
| string | `""`（空字符串） |
| bytes | 空字节数组 |
| bool | `false` |
| 数值类型 | `0` |
| enum | 第一个定义的值（必须是 0） |
| message | 空 message（非 nil） |
| repeated | 空列表 |
| map | 空 map |

---

> 文档版本：proto3 为主，兼容 proto2 差异说明
> 生成日期：2026-07-13
