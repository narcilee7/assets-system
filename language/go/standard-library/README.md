# Go Standard Library

这一层训练 Go 标准库里最常用于工程面试和真实开发的部分。

## 必会模块

| 模块 | 能力 |
| --- | --- |
| `testing` | table-driven test、benchmark、subtest |
| `context` | cancellation、timeout、deadline |
| `net/http` | handler、middleware、server shutdown |
| `io` | Reader / Writer、copy、pipe |
| `encoding/json` | decode、unknown field、validation |
| `time` | timer、ticker、deadline |
| `sync` | mutex、wait group、once、pool |

## 题单

| 题目 | 文件 | 状态 | 关键点 |
| --- | --- | --- | --- |
| table-driven tests | `table_tests/` | todo | case、subtest |
| benchmark | `benchmark/` | todo | `b.N`、allocs |
| HTTP handler | `http_handler/` | todo | request / response |
| JSON decode validation | `json_validation/` | todo | decoder、schema-like check |
| io adapter | `io_adapter/` | todo | Reader / Writer |

