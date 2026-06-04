# Schema Bridge

## 目标

实现一个极简的运行时 schema 校验器，同时从 schema 定义中推导出 TypeScript 类型，做到“一份定义，两端受益”。

## 题目 / 场景

前后端协作时，需要保证 API 响应的结构符合预期。与其手写类型定义再单独写校验逻辑，不如用 schema 对象同时提供运行时校验和编译期类型。

## 核心考点

- 构造函数 + 泛型推导：让 `string()` 返回既有 `check` 方法又有 `infer` 类型的对象。
- 对象 schema 的递归校验和类型推导。
- 可选字段的处理：运行时缺失和 `undefined` 的区分。

## 边界条件

- 嵌套对象：需要递归调用子 schema 的 check。
- 数组：元素 schema 需要逐个校验。
- 未知字段：是否允许对象包含 schema 未定义的字段（当前实现宽松）。

## 实现思路

1. 定义基础 schema 类 `Schema<T>`，包含 `check(value: unknown): T` 方法。
2. 提供 `string()`、`number()`、`boolean()`、`object(fields)`、`array(item)` 等工厂函数。
3. `object` 的返回类型通过 mapped type 从 fields 定义中推导。

## 复杂度

- 时间复杂度：O(n)，n 为被校验数据的节点数量。
- 空间复杂度：O(d)，d 为嵌套深度（递归调用栈）。

## 面试追问

- 如果 schema 需要支持联合类型（如 `string | number`），如何设计？
- 如果校验失败需要返回所有错误路径而不是第一个，如何改造？
- 和 zod 相比，这个极简实现的差距在哪里？

## 工程迁移

- 封装为 `fetchWithSchema(url, schema)`，在 API 调用处统一校验。
- 在 CLI 工具中校验配置文件的结构。
