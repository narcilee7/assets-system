# Review

## 我一开始容易写错什么

1. **object schema 的类型推导**：一开始写成了 `{ [K in keyof T]: T[K] }`，没有通过 `infer` 从 `Schema<unknown>` 中提取实际类型。
2. **可选字段的 undefined**：optional schema 需要显式处理 `undefined`，否则 `object` 在校验缺失字段时会直接调用 `schema.check(undefined)`，而基础类型会报错。
3. **数组错误路径**：没有给数组元素校验加上索引前缀，导致错误信息无法定位。
4. **Schema.infer 的实现**：一开始写成了抽象属性，实际上 TS 类型系统不需要运行时值，用一个抛错的 getter 即可。

## 这个实现为什么成立

- `Schema<T>` 类封装了校验逻辑，通过泛型保留类型信息。
- `InferSchema<T>` 利用 conditional type 从 `Schema<unknown>` 的联合中提取实际类型，实现编译期推导。
- 工厂函数的组合方式与 zod 类似，但实现极简，无外部依赖。

## 和标准库 / 框架实现的差距

- zod 支持 `.refine`、`.transform`、`.default`、`.union`、`.enum` 等丰富特性，且错误路径报告更完善（ZodIssue 数组）。
- valibot 体积更小，tree-shaking 更好，但 API 设计不同。
- 手写版本适合面试和极轻量场景，生产环境优先使用成熟库。

## 工程里怎么取舍

- 新项目优先使用 zod 或 valibot，社区生态成熟，类型推导完善。
- 极度受限的环境（如不允许安装依赖的在线编辑器）可用手写版本作为 fallback。

## 下次复习重点

1. 手写 `InferSchema` 时记得用 `T[K] extends Schema<infer U> ? U : never`。
2. 思考如何添加 `.transform(fn)` 让 schema 在校验同时做数据转换。
3. 对比 zod 的 `z.object({}).parse()` 和本实现的差异。
