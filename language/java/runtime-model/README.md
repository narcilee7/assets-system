# Runtime Model

这一层训练 Java 运行时直觉：值/引用、String 池、GC Root、类加载、反射基础。

## 必会概念

- Java 中只有值传递：对象引用也是按值传递。
- String 不可变且常量池化：`new String("a")` 与 `"a"` 的区别。
- GC Root：栈上局部变量、静态变量、JNI 引用等。
- 类加载器双亲委派模型：Bootstrap → Extension → Application → Custom。
- 反射绕过编译期检查，但有性能代价。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 值/引用与 String 不可变性 | `value-vs-reference/` | todo | 常量池、new String、intern |
| GC Root 与可达性分析 | `gc-roots/` | todo | 四种 GC Root |
| 类加载器双亲委派 | `class-loader/` | todo | 加载流程、破坏委派 |
| 反射基础与性能 | `reflection-basics/` | todo | Class、Method、Field |
