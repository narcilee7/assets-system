# Runtime Model

这一层训练 JavaScript 运行时直觉 + TypeScript 类型擦除后的真实行为：值/引用、原型链、this、闭包、变量提升、typeof/instanceof 与 TS 类型的差距。

## 必会概念

- TypeScript 编译后类型信息完全擦除，运行时只有 JavaScript。
- `typeof` / `instanceof` 是运行时操作符，与 TS 的静态类型系统不完全对齐。
- 闭包捕获的是变量引用，不是值拷贝（TS 的类型系统不会告诉你这一点）。
- `var` 有变量提升，`let`/`const` 有 TDZ（暂时性死区）。
- 原型链是 JavaScript 对象模型的核心，`class` 只是语法糖。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 值/引用与 const/let/var 对比 | `value-vs-reference/` | todo | 不可变绑定 vs 可变值 |
| 类型擦除后的 typeof/instanceof | `type-erasure-runtime/` | todo | 运行时类型 ≠ 静态类型 |
| 原型链与 class 语法糖 | `prototype-chain/` | todo | `__proto__`、prototype、class 转换 |
| this 的四种绑定规则 | `this-binding/` | todo | 默认、隐式、显式、new 绑定 |
| 闭包与变量捕获 | `closure-capture/` | todo | 循环变量陷阱、TDZ |
| 变量提升与 TDZ | `hoisting-tdz/` | todo | var vs let/const 的生命周期 |
| 运行时输入校验（Guard + Assert） | `guard-and-assert/` | ready | 类型守卫、断言函数、unknown 渐进收窄 |
| Schema 校验与类型推导 | `schema-bridge/` | ready | 运行时 schema + 编译期类型推导 |
