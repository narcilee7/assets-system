# Core Abstractions

这一层训练 Java 的核心抽象：类、接口、抽象类、泛型、Lambda、Stream、Optional。

## 必会概念

- 接口定义行为契约，抽象类提供默认实现。
- 泛型擦除：编译后类型参数被替换为边界或 Object。
- Lambda 是函数式接口的语法糖，编译为 invokedynamic。
- Stream 的惰性计算：中间操作不执行，终止操作触发流水线。
- Optional 用于明确表达可能缺失的值，避免 null。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 接口 vs 抽象类设计 | `interface-vs-abstract/` | todo | is-a vs can-do |
| 泛型擦除与边界 | `generics-erasure/` | todo | 桥方法、类型参数 |
| Lambda 与函数式接口 | `lambda-and-functional/` | todo | @FunctionalInterface、方法引用 |
| Stream 惰性计算 | `stream-laziness/` | todo | 中间操作、终止操作、短路 |
| Optional 正确使用 | `optional-usage/` | todo | orElse/orElseGet、flatMap |
