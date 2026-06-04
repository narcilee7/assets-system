# Review

## 我一开始容易写错什么

1. **数组判断顺序**：如果把 `T extends object` 放在 `T extends (infer R)[]` 前面，数组会被先匹配为对象，导致结果变成 `{ readonly [K in keyof T]: ... }` 而不是 `ReadonlyArray`。
2. **函数被递归**：没有提前排除 `Function`，导致函数的属性和 prototype 被递归 mapped，产生无意义的结果。
3. **忘记 ReadonlyArray**：直接写成 `readonly R[]`，虽然等价，但不如 `ReadonlyArray<R>` 语义明确。

## 这个实现为什么成立

- 类型系统的模式匹配是从上到下的，先处理数组、再处理函数、再处理对象，最后是基本类型的透传，构成了完整的类型分类。
- 递归终止条件由 TypeScript 内置类型保护保证：当 T 不能分解为基本类型时停止。

## 和标准库 / 框架实现的差距

- 标准库中没有官方的 DeepReadonly，社区实现（如 ts-essentials）会额外处理 `Set`、`Map` 等内置集合类型。
- 对于循环引用类型，任何纯类型层的递归都会在编译时报错，需要运行时 `Object.freeze` 配合。

## 工程里怎么取舍

- 在 Redux 或 Zustand 状态管理中，优先使用 Immer 做运行时不可变，DeepReadonly 仅作为类型约束。
- 如果项目已经引入 ts-essentials，优先使用库实现而非自建，减少维护成本。

## 下次复习重点

1. 手写时先写数组分支，再写对象分支，顺序不能反。
2. 思考 `T extends readonly (infer R)[]` 是否需要支持（只读数组的递归）。
3. 对比 `DeepPartial`、`DeepRequired` 的实现差异。
