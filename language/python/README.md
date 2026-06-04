# Python 全栈体系

这一资产覆盖 Python 从**语言设计哲学**到**解释器底层**，从**对象模型**到**工程实践**的完整知识图谱。

对 AI 全栈工程师来说，Python 的价值在于：数据科学、AI/ML、Agent Runtime、后端服务、自动化工具链。

---

## 体系架构

### Part I — 理论体系：广度 + 深度

| 编号 | 目录 | 主题 | 深度 |
|------|------|------|------|
| 01 | [`01-language-philosophy/`](01-language-philosophy/) | 设计哲学、GIL、与其他语言对比 | 设计层面 |
| 02 | [`02-type-system-theory/`](02-type-system-theory/) | 鸭子类型、协议、类型提示、 gradual typing | 类型理论 |
| 03 | [`03-interpreter-and-runtime/`](03-interpreter-and-runtime/) | CPython 解释器、GIL、内存管理、引用计数 | 解释器底层 |
| 04 | [`04-concurrency-in-depth/`](04-concurrency-in-depth/) | GIL 影响、线程、进程、asyncio、协程 | 并发深度 |
| 05 | [`05-standard-library-deep-dive/`](05-standard-library-deep-dive/) | collections、itertools、functools、contextlib | 标准库 |
| 06 | [`06-packaging-and-toolchain/`](06-packaging-and-toolchain/) | pip、setuptools、pyproject.toml、虚拟环境 | 打包与工具链 |
| 07 | [`07-engineering-and-design/`](07-engineering-and-design/) | 项目结构、测试、FastAPI、Pydantic、可观测性 | 工程化 |
| 08 | [`08-advanced-topics/`](08-advanced-topics/) | 元类、描述符、C 扩展、Cython、GIL 绕过 | 高级主题 |

### Part II — 动手训练场：代码 + 面试

| 层级 | 目录 | 内容 |
|------|------|------|
| Runtime Model | [`runtime-model/`](runtime-model/) | 对象模型、名字绑定、引用、拷贝、可变/不可变 |
| Core Abstractions | [`core-abstractions/`](core-abstractions/) | 迭代器、生成器、装饰器、描述符、闭包 |
| Type System Gymnastics | [`type-system-gymnastics/`](type-system-gymnastics/) | 类型提示进阶、Protocol、泛型、TypeVar |
| Concurrency | [`concurrency/`](concurrency/) | 线程安全、asyncio、限流、背压 |
| Standard Library | [`standard-library/`](standard-library/) | 数据结构、LRU、Trie、Top K、BFS/DFS |
| Engineering Patterns | [`engineering-patterns/`](engineering-patterns/) | Repository、UoW、Event Bus、DI Container |
| Mini Runtime | [`mini-runtime/`](mini-runtime/) | mini FastAPI、mini ORM、mini pytest、mini Agent |
| Tests | [`tests/`](tests/) | 体系级测试与验证 |

---

## 学习路线

### 路线 A：从语言到系统（推荐）

```text
01 设计哲学          → 建立 Pythonic 直觉
  → 02 类型系统理论   → 鸭子类型、Protocol、gradual typing
    → 03 解释器与运行时 → CPython、GIL、引用计数、内存管理
      → 04 并发深度     → 线程、进程、asyncio、协程
        → 05 标准库深度   → collections、itertools、functools
          → 06 打包与工具链 → pip、setuptools、pyproject.toml
            → 07 工程与设计   → FastAPI、Pydantic、测试、可观测性
              → 08 高级主题     → 元类、描述符、C 扩展、Cython
```

### 路线 B：面试导向（快速）

```text
03 解释器与运行时 + 04 并发 → 面经核心
  → 02 类型系统 + 05 标准库   → 展示深度
    → 07 工程化               → 展示工程能力
      → 动手训练场 30 题       → 手写代码 + 运行验证
```

### 路线 C：动手优先（工程导向）

```text
runtime-model/           → 对象模型、深拷贝、名字绑定（写代码跑实验）
  → core-abstractions/     → 迭代器、装饰器、描述符（手写实现）
    → type-system-gymnastics/ → Protocol、泛型、TypeVar
      → concurrency/          → asyncio、线程安全、限流
        → standard-library/     → LRU、Trie、Top K、BFS/DFS
          → engineering-patterns/ → Repository、Event Bus、UoW
            → mini-runtime/       → mini FastAPI、mini ORM、mini pytest
              → 配合 Part I 理论深化
```

---

## 核心 30 题（训练场索引）

| 序号 | 题目 | 推荐目录 | 状态 |
|------|------|---------|------|
| 1 | 手写 `deep_copy` | `runtime-model/object_model/` | done |
| 2 | 手写 `flatten` | `runtime-model/object_model/` | todo |
| 3 | 手写 `dedup` | `runtime-model/object_model/` | todo |
| 4 | 手写 `group_by` | `runtime-model/object_model/` | todo |
| 5 | 手写 `chunk` | `runtime-model/object_model/` | todo |
| 6 | 手写 `range` | `core-abstractions/iterators/` | todo |
| 7 | 手写 `enumerate` | `core-abstractions/iterators/` | todo |
| 8 | 手写 `zip` | `core-abstractions/iterators/` | todo |
| 9 | 手写 `chain` | `core-abstractions/iterators/` | todo |
| 10 | 手写 `timer` | `core-abstractions/decorators/` | todo |
| 11 | 手写 `retry` | `core-abstractions/decorators/` | todo |
| 12 | 手写 `memoize` | `core-abstractions/decorators/` | todo |
| 13 | 手写 `once` | `core-abstractions/decorators/` | todo |
| 14 | 手写 `property` | `core-abstractions/descriptors/` | todo |
| 15 | 手写 `cached_property` | `core-abstractions/descriptors/` | todo |
| 16 | 手写字段校验描述符 | `core-abstractions/descriptors/` | todo |
| 17 | 手写简化版 `dataclass` | `core-abstractions/descriptors/` | todo |
| 18 | 手写 LRU Cache | `standard-library/data_structures/` | todo |
| 19 | 手写 Trie | `standard-library/data_structures/` | todo |
| 20 | 手写 Top K | `standard-library/data_structures/` | todo |
| 21 | 手写二分查找 | `standard-library/data_structures/` | todo |
| 22 | 手写 BFS / DFS | `standard-library/data_structures/` | todo |
| 23 | 手写拓扑排序 | `standard-library/data_structures/` | todo |
| 24 | 手写线程安全计数器 | `concurrency/` | todo |
| 25 | 手写生产者消费者 | `concurrency/` | todo |
| 26 | 手写 `bounded_gather` | `concurrency/` | todo |
| 27 | 手写 async retry | `concurrency/` | todo |
| 28 | 手写 Event Bus | `engineering-patterns/` | todo |
| 29 | 手写 Unit of Work | `engineering-patterns/` | todo |
| 30 | 手写 mini Router / mini FastAPI | `mini-runtime/mini_framework/` | todo |

---

## 面试主轴

| 主轴 | 必须能讲清楚的问题 | 对应 Part I 章节 |
|------|------------------|----------------|
| 对象模型 | 名字绑定、引用语义、可变/不可变、深拷贝、GIL | 01、03 |
| 类型模型 | 鸭子类型、Protocol、TypeVar、gradual typing | 02 |
| 并发模型 | GIL、线程 vs 进程、asyncio、协程、事件循环 | 04 |
| 标准库模型 | 迭代协议、生成器、装饰器、描述符、上下文管理器 | 05 |
| 工程模型 | FastAPI、Pydantic、测试、事件驱动、依赖注入 | 07 |
| 高级模型 | 元类、描述符协议、C 扩展、内存优化 | 08 |

---

## 运行约定

### 训练场代码

```bash
cd language/python
# 全部测试
python -m unittest discover -s tests

# 单题测试
python -m unittest tests.test_deep_copy
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
- **Part II 训练场**：目录与题单已建立，`deep_copy` 已完成，待逐一实现
