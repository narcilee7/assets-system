# Core Abstractions

这一层训练 TypeScript 的核心抽象机制：`interface` vs `type`、泛型、类、函数类型、模块解析。

## 必会概念

- `interface` 适合对象形状和声明合并，`type` 适合联合类型和条件类型。
- 泛型是「类型的函数」：参数化类型，延迟到调用时确定。
- 类的访问修饰符（public/private/protected）只在编译期检查，运行时不存在。
- 函数重载在编译期解析，运行时不存在。
- 模块解析策略（classic/node/nodenext/bundler）直接影响类型查找路径。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| interface vs type 使用场景 | `interface-vs-type/` | todo | 声明合并、扩展、联合、条件类型 |
| 泛型约束与默认参数 | `generics-in-depth/` | todo | extends、默认值、infer |
| 类的继承与抽象类 | `class-abstraction/` | todo | extends、implements、abstract |
| 函数类型与重载 | `function-types/` | todo | 重载解析、this 参数、泛型函数 |
| 模块解析实验 | `module-resolution-lab/` | todo | classic vs node vs nodenext |
