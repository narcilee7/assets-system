# Java 编译器与构建工具

这一层理解 javac 编译流程、注解处理器、Maven/Gradle 构建生命周期、以及 Java 模块化系统。

---

## 目录

| 文件 | 主题 |
|------|------|
| `javac-pipeline.md` | 词法分析 → 语法分析 → 语义分析 → 字节码生成 |
| `annotation-processing.md` | 注解处理器、编译时代码生成 |
| `maven-and-gradle.md` | 生命周期、依赖管理、插件机制 |
| `java-modules.md` | JPMS、module-info.java、服务提供者 |

---

## 核心问题

1. javac 的编译流程是什么？注解处理器在哪个阶段介入？
2. Maven 的依赖仲裁（最近定义、最短路径）规则？
3. Gradle 的增量构建和构建缓存如何工作？
4. Java 模块化系统解决了什么问题？

---

## 关联训练场

- `../mini-runtime/` — 注解处理器实验、模块化项目结构
