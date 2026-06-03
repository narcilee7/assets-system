# Go Core Abstractions

这一层训练 Go 的抽象方式：struct、method、interface、embedding、generic 和 error。

## 必会概念

- interface 是行为约束，不是继承层级。
- interface 值包含动态类型和动态值。
- nil interface 和 typed nil 是高频陷阱。
- embedding 提供组合式复用。
- error 是普通值，错误处理应该显式。
- 泛型适合容器和算法，不应该替代清晰接口。

## 题单

| 题目 | 文件 | 状态 | 关键点 |
| --- | --- | --- | --- |
| method set 示例 | `method_set/` | todo | value / pointer receiver |
| interface nil 陷阱 | `nil_interface/` | todo | dynamic type + dynamic value |
| error wrapping | `error_wrapping/` | todo | `%w`、`errors.Is`、`errors.As` |
| 泛型 Stack | `generic_stack/` | todo | type parameter、零值 |
| 泛型 Set | `generic_set/` | todo | comparable 约束 |

