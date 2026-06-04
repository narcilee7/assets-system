# JVM 与运行时底层

这一层深入 Java 的「黑盒」：类加载器、内存区域、垃圾回收、JIT 编译、字节码执行。

---

## 目录

| 文件 | 主题 |
|------|------|
| `class-loader.md` | 双亲委派、破坏双亲委派、自定义类加载器 |
| `jvm-memory-model.md` | 堆、栈、方法区、直接内存、运行时常量池 |
| `garbage-collection.md` | GC 算法、G1、ZGC、Shenandoah、调优 |
| `jit-compiler.md` | 解释执行 vs JIT、热点代码、分层编译 |
| `bytecode-basics.md` | 字节码结构、常用指令、ASM 入门 |

---

## 核心问题

1. 双亲委派模型是什么？如何破坏？
2. JVM 内存区域如何划分？各区域存放什么？
3. G1 和 ZGC 的核心区别？适用场景？
4. JIT 编译的触发条件？分层编译的 5 个层次？
5. 字节码层面的 `invokedynamic` 是什么？

---

## 关联训练场

- `../runtime-model/` — 值/引用、GC Root、类加载实验
