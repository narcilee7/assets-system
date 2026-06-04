# Java 全栈体系

这一资产覆盖 Java 从**语言设计哲学**到**JVM 底层**，从**类型系统**到**工程实践**的完整知识图谱。

对 AI 全栈工程师来说，Java 的价值在于：企业级后端、Spring 生态、大数据、分布式系统、高并发服务。

---

## 体系架构

### Part I — 理论体系：广度 + 深度

| 编号 | 目录 | 主题 | 深度 |
|------|------|------|------|
| 01 | [`01-language-philosophy/`](01-language-philosophy/) | 设计哲学、OOP 本质、与 Kotlin/Scala 对比 | 设计层面 |
| 02 | [`02-type-system-theory/`](02-type-system-theory/) | 名义类型、泛型擦除、类型边界、通配符 | 类型理论 |
| 03 | [`03-jvm-and-runtime/`](03-jvm-and-runtime/) | 类加载器、内存模型、GC、JIT、字节码 | JVM 底层 |
| 04 | [`04-concurrency-in-depth/`](04-concurrency-in-depth/) | JMM、锁、CAS、AQS、线程池、ForkJoin、Reactive | 并发深度 |
| 05 | [`05-standard-library-deep-dive/`](05-standard-library-deep-dive/) | Collections、Stream、NIO、Optional、并发包 | 标准库 |
| 06 | [`06-compiler-and-build-tools/`](06-compiler-and-build-tools/) | javac、Maven/Gradle、注解处理器、模块化 | 编译与构建 |
| 07 | [`07-engineering-and-design/`](07-engineering-and-design/) | Spring、设计模式、测试、DDD、可观测性 | 工程化 |
| 08 | [`08-advanced-topics/`](08-advanced-topics/) | 反射、代理、Unsafe、SPI、JVM 调优、GraalVM | 高级主题 |

### Part II — 动手训练场：代码 + 面试

| 层级 | 目录 | 内容 |
|------|------|------|
| Runtime Model | [`runtime-model/`](runtime-model/) | 值/引用、String 池、GC Root、类加载、反射基础 |
| Core Abstractions | [`core-abstractions/`](core-abstractions/) | 类/接口/抽象类、泛型、Lambda、Stream、Optional |
| Concurrency | [`concurrency/`](concurrency/) | 线程、锁、CAS、线程池、CompletableFuture、Reactive |
| Standard Library | [`standard-library/`](standard-library/) | Collections、Stream、NIO、Comparator、Function |
| Engineering Patterns | [`engineering-patterns/`](engineering-patterns/) | Singleton、Factory、Strategy、Observer、模板方法 |
| Mini Runtime | [`mini-runtime/`](mini-runtime/) | mini IoC、mini ORM、mini Stream、mini WebFlux |
| Tests | [`tests/`](tests/) | 体系级测试与验证 |

---

## 学习路线

### 路线 A：从语言到系统（推荐）

```text
01 设计哲学          → 建立 OOP 直觉
  → 02 类型系统理论   → 理解泛型擦除、类型边界、通配符
    → 03 JVM 与运行时  → 掌握类加载、内存模型、GC、JIT
      → 04 并发深度     → JMM、锁、CAS、线程池、Reactive
        → 05 标准库深度   → Collections、Stream、NIO
          → 06 编译与构建   → javac、Maven/Gradle、注解处理
            → 07 工程与设计   → Spring、DDD、测试、可观测性
              → 08 高级主题     → 反射、代理、Unsafe、GraalVM
```

### 路线 B：面试导向（快速）

```text
02 类型系统 + 03 JVM 内存模型 → 面经核心
  → 04 并发                   → Java 最大卖点
    → 05 标准库 + 07 工程       → 展示工程能力
      → 动手训练场 30 题         → 手写代码 + 运行验证
```

### 路线 C：动手优先（工程导向）

```text
runtime-model/        → 值/引用、String 池、GC Root、类加载
  → core-abstractions/  → 泛型、Lambda、Stream、Optional
    → concurrency/        → 线程池、CompletableFuture、Reactive
      → standard-library/   → Collections、Stream、NIO
        → engineering-patterns/ → 设计模式实现
          → mini-runtime/       → mini IoC、mini ORM、mini Stream
            → 配合 Part I 理论深化
```

---

## 核心 30 题（训练场索引）

| 序号 | 题目 | 推荐目录 | 状态 |
|------|------|---------|------|
| 1 | 值/引用与 String 不可变性 | `runtime-model/` | todo |
| 2 | GC Root 与可达性分析 | `runtime-model/` | todo |
| 3 | 类加载器双亲委派模型 | `runtime-model/` | todo |
| 4 | 反射基础与性能代价 | `runtime-model/` | todo |
| 5 | 接口 vs 抽象类设计 | `core-abstractions/` | todo |
| 6 | 泛型擦除与边界 | `core-abstractions/` | todo |
| 7 | Lambda 与函数式接口 | `core-abstractions/` | todo |
| 8 | Stream 惰性计算与短路 | `core-abstractions/` | todo |
| 9 | Optional 正确使用 | `core-abstractions/` | todo |
| 10 | HashMap 原理与扩容 | `standard-library/` | todo |
| 11 | ArrayList vs LinkedList | `standard-library/` | todo |
| 12 | ConcurrentHashMap 分段锁 | `standard-library/` | todo |
| 13 | Comparator 与排序稳定性 | `standard-library/` | todo |
| 14 | NIO Buffer 与 Channel | `standard-library/` | todo |
| 15 | synchronized 底层原理 | `concurrency/` | todo |
| 16 | ReentrantLock vs synchronized | `concurrency/` | todo |
| 17 | CAS 与 ABA 问题 | `concurrency/` | todo |
| 18 | 线程池参数与拒绝策略 | `concurrency/` | todo |
| 19 | CompletableFuture 组合 | `concurrency/` | todo |
| 20 | 生产者消费者模式 | `concurrency/` | todo |
| 21 | 单例模式 5 种写法 | `engineering-patterns/` | todo |
| 22 | 工厂模式与策略模式 | `engineering-patterns/` | todo |
| 23 | 观察者模式与事件驱动 | `engineering-patterns/` | todo |
| 24 | 模板方法模式 | `engineering-patterns/` | todo |
| 25 | 代理模式（静态/动态/CGLIB） | `engineering-patterns/` | todo |
| 26 | 手写 mini IoC 容器 | `mini-runtime/` | todo |
| 27 | 手写 mini ORM 映射 | `mini-runtime/` | todo |
| 28 | 手写 mini Stream API | `mini-runtime/` | todo |
| 29 | 手写 mini WebFlux 路由 | `mini-runtime/` | todo |
| 30 | 手写 mini 缓存（带过期） | `mini-runtime/` | todo |

---

## 面试主轴

| 主轴 | 必须能讲清楚的问题 | 对应 Part I 章节 |
|------|------------------|----------------|
| 内存模型 | JVM 内存区域、GC 算法、类加载机制、OOM 分析 | 03 |
| 类型模型 | 泛型擦除、类型边界、通配符 PECS 原则、接口与抽象类 | 02 |
| 并发模型 | JMM、happens-before、锁优化、线程池、CompletableFuture | 04 |
| 集合模型 | HashMap 原理、ConcurrentHashMap、CopyOnWriteArrayList | 05 |
| 工程模型 | Spring IoC/AOP、设计模式、DDD、测试、可观测性 | 07 |
| 编译模型 | javac、注解处理器、模块化、Maven/Gradle 生命周期 | 06 |

---

## 运行约定

### 训练场代码

```bash
cd <对应目录>
# Maven
mvn test

# Gradle
./gradlew test

# 或直接用 javac + java
javac Main.java && java Main
```

---

## 状态说明

| 标记 | 含义 |
|------|------|
| `seed` | 已建立目录与架构框架 |
| `todo` | 待补充代码实现或详细内容 |
| `done` | 已完成并可运行验证 |

当前状态：
- **Part I 理论体系**：8 个模块架构已建立，待逐层深化内容
- **Part II 训练场**：目录与题单已建立，待逐一实现代码与测试
