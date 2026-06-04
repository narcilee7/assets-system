# UnionToIntersection

## 目标

实现 `UnionToIntersection<T>`，将联合类型转换为交叉类型。例如 `A | B` → `A & B`。

## 题目 / 场景

在高阶组件或 mixin 模式中，需要将多个独立的 props 接口合并为一个交叉类型，以便组件同时接收所有接口的属性。

## 核心考点

- 逆变位置（contravariant position）的分配律：函数参数位置是逆变的。
- `extends` 在逆变位置的行为差异。
- 利用 `(x: T) => void extends (x: infer U) => void ? U : never` 提取交叉类型。

## 边界条件

- 空联合：`never`。
- 单一类型：结果应为原类型本身。
- 包含 `unknown` 或 `any`：需要测试行为是否符合预期。

## 实现思路

1. 利用函数参数位置的逆变特性：`(x: A) => void & (x: B) => void` 等价于 `(x: A & B) => void`。
2. 将联合类型 `T` 放入逆变位置，通过 `infer` 提取合并后的交叉类型。

## 复杂度

- 类型复杂度：O(1)，利用 TypeScript 内置的逆变合并机制。

## 面试追问

- 为什么函数参数位置是逆变的？协变和逆变在什么场景下会出现？
- 如果不使用逆变位置，还有其他方式实现 UnionToIntersection 吗？
- 如果联合类型中包含重复属性但类型不同（如 `{ a: string } | { a: number }`），交叉后的 `a` 是什么类型？

## 工程迁移

- React HOC 中合并多个增强组件的 props 类型。
- 将多个独立接口的事件处理器合并为一个统一的事件映射。
