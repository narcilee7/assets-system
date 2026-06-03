# Go 的诞生背景与设计初衷

## 1. 历史坐标

2007 年，Robert Griesemer、Rob Pike、Ken Thompson 在 Google 开始设计 Go。当时的痛点：

- **C++ 编译速度极慢**：Google 的 C++ 单体代码库编译需要数小时
- **依赖管理混乱**：C/C++ 的头文件依赖地狱，Java 的 classpath 爆炸
- **并发编程困难**：多线程共享内存模型复杂且易错
- **语言特性膨胀**：C++ 每三年增加大量特性，学习曲线陡峭
- **工具链落后**：没有统一的格式化、测试、文档工具

> "The goals of the Go project were to eliminate the slowness and clumsiness of software development at Google, and thereby to make the process more productive and scalable. The language was designed by and for people who write—and read and debug and maintain—large software systems." — *Go at Google: Language Design in the Service of Software Engineering*

## 2. 设计目标优先级

```text
1. 编译速度      → 秒级编译大型项目
2. 执行速度      → 接近 C 的性能
3. 开发速度      → 简洁语法，快速理解他人代码
4. 并发支持      → 原生、简洁、安全
5. 垃圾回收      → 自动内存管理，降低认知负担
```

## 3. 明确不追求的目标

Go 团队在选择**不做什么**上同样果断：

- **语法糖最大化**（对比 Perl/Ruby）
- **类型系统表达力极限**（对比 Haskell/Scala）
- **零成本抽象**（对比 Rust/C++）
- **极致运行时性能**（接受 GC 的停顿换取开发效率）
- **开创性理论贡献**（Go 是工程语言，不是研究语言）

> "Go is not an innovative language. It is a productive language." — 社区总结
