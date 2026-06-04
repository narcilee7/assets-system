# Standard Library

这一层训练 TypeScript 内置工具类型的实现原理：不是记住它们，而是能从条件类型和映射类型推导出来。

## 必会概念

- `Partial<T>` 利用 mapped type 的 `?` 修饰符将所有属性变为可选。
- `Required<T>` 利用 `-?` 移除可选修饰符。
- `Pick<T, K>` 和 `Omit<T, K>` 是 mapped type 的基础应用。
- `Record<K, T>` 构造键值对类型。
- `Parameters<T>` 和 `ReturnType<T>` 利用 `infer` 从函数类型中提取。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 手写 Partial | `implement-partial/` | todo | mapped type + `?` 修饰符 |
| 手写 Pick / Omit | `implement-pick-omit/` | todo | mapped type + key filtering |
| 手写 Record | `implement-record/` | todo | 索引签名 + 键联合 |
| 手写 Parameters / ReturnType | `implement-parameters/` | todo | infer 提取函数签名 |
