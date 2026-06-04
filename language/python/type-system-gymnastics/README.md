# Type System Gymnastics

这一层训练 Python 类型提示的进阶能力：Protocol、泛型、TypeVar、类型变换。

## 必会概念

- Protocol 定义结构类型，不需要显式继承。
- TypeVar 创建泛型参数，`bound` 限制上界，`constraints` 限制可接受类型。
- `@overload` 提供函数重载的类型提示（运行时不生效）。
- `typing` 模块提供了大量类型构造工具。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| Protocol 定义结构类型 | `protocol-structural/` | todo | 鸭子类型、类型检查 |
| 泛型函数与泛型类 | `generic-functions-classes/` | todo | TypeVar、绑定 |
| 类型变换工具 | `type-transforms/` | todo | Union、Optional、Callable |
| 函数重载类型 | `function-overloads/` | todo | @overload、签名匹配 |
