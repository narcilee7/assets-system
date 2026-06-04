# Review

## 我一开始容易写错什么

1. **不用 `as` 关键字**：在 TS < 4.1 中无法直接用条件过滤 key，只能生成 `never: T[K]` 的怪异对象。`as` 是 key remapping 的核心。
2. **联合类型值的分配律误解**：以为 `string | number extends string` 会分配判断，实际上整体判断是不成立的（除非用 `T[K] extends infer U ? U extends V ? ...` 显式分配）。
3. **可选属性的 undefined**：可选属性的值类型是 `X | undefined`，不会匹配 `X`，如果需要匹配，要改写成 `NonNullable<T[K]> extends V`。

## 这个实现为什么成立

- `as T[K] extends V ? K : never` 利用 key remapping，在不满足条件时将 key 映射为 `never`，TypeScript 会自动过滤 `never` key。
- 只使用了标准的 mapped type 和 conditional type，不依赖外部库。

## 和标准库 / 框架实现的差距

- ts-essentials 的 `PickByValueExact` 使用更严格的匹配逻辑（双向 extends），避免子类型意外匹配。
- 社区实现通常还会提供 `OmitByValue`、`PickByValueExact` 等变体。

## 工程里怎么取舍

- 在类型体操面试中，简洁版本即可；在工程代码中，如果已有 ts-essentials 或 type-fest，优先使用库实现。
- 对于 API 类型提取，通常需要 `Exact` 版本，防止子类型污染。

## 下次复习重点

1. 手写 `OmitByValue`：把条件反一下即可。
2. 思考 `PickByValueExact` 如何用双向 extends 实现。
3. 对比 `Pick<T, K>` 和 `PickByValue<T, V>` 的使用场景差异。
