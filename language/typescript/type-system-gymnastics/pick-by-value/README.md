# PickByValue

## 目标

实现 `PickByValue<T, V>`，从对象类型 `T` 中选取值类型匹配 `V` 的所有属性。

## 题目 / 场景

从后端返回的 DTO 中，提取所有值为 `string` 的字段用于搜索条件，或提取所有值为 `number` 的字段用于统计计算。

## 核心考点

- Mapped type + 条件类型结合使用。
- `as` 关键字（key remapping）在 TypeScript 4.1+ 中的用法。
- 严格相等 vs 兼容性匹配：是否使用 `extends` 的分配律。

## 边界条件

- 可选属性：可选属性的值类型包含 `undefined`，是否匹配 `V`？
- `never` key 的处理：条件不满足时通过 `never` 过滤 key。
- 联合类型值：如 `string | number` 是否同时匹配 `string` 和 `number`？

## 实现思路

1. 遍历 `T` 的所有 key。
2. 对每个 key，检查 `T[K] extends V` 是否成立。
3. 如果成立保留原 key，否则映射为 `never` 并通过 `as` 过滤。

## 复杂度

- 类型复杂度：O(K)，K 为对象属性数量。

## 面试追问

- 如果需要“排除”某些值类型而不是选取，如何实现（OmitByValue）？
- 如果 V 是联合类型，行为会有什么变化？
- 如何处理值类型为 `string | undefined` 的可选属性？

## 工程迁移

- 表单验证：从接口类型中提取所有 `string` 字段，生成对应的校验规则。
- ORM 类型：从实体类型中提取所有 `Date` 字段，做自动序列化/反序列化。
