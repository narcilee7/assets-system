# Python

Python 这条线训练对象模型、协议、装饰器、描述符、asyncio、工程模式和 mini framework。

## 定位

它是当前语言层里最接近“资产化”的样板：已经有能力分层、核心题单、实现和测试约定。

---

# Python 手写题体系

这套目录不是普通题库，而是按 Python 能力层搭出来的训练系统。目标是用小题复现 Python 生态里的核心抽象：对象模型、协议、装饰器、描述符、并发、工程模式和 mini framework。

每道题都按同一个节奏练：

1. 先写清楚题目、输入输出、边界条件。
2. 手写第一版可运行实现。
3. 补测试，覆盖正常路径、边界路径和易错点。
4. 复盘复杂度、Python 机制、工程取舍。

## 目录

| 层级 | 目录 | 能力目标 | 代表题 |
| --- | --- | --- | --- |
| 1 | `object_model/` | 名字绑定、引用、可变对象、拷贝、常用容器处理 | `deep_copy`、`flatten`、`chunk`、`group_by` |
| 2 | `iterators/` | 迭代协议、生成器、惰性计算 | `range`、`enumerate`、`zip`、分页迭代器 |
| 3 | `decorators/` | 闭包、函数包装、横切逻辑 | `timer`、`retry`、`memoize`、`rate_limit` |
| 4 | `descriptors/` | 属性访问、描述符、类创建机制 | `property`、`cached_property`、字段校验器 |
| 5 | `concurrency/` | 线程安全、asyncio、限流、背压 | 安全计数器、生产者消费者、`bounded_gather` |
| 6 | `engineering_patterns/` | 后端工程抽象和业务边界 | Repository、Unit of Work、Event Bus、DI Container |
| 7 | `data_structures/` | 常用算法与结构的工程实现 | LRU、Top K、Trie、BFS、拓扑排序 |
| 8 | `mini_framework/` | 小框架级组合能力 | mini FastAPI、mini ORM、mini pytest、mini Agent Runtime |

## 推荐路线

```text
对象模型
-> 迭代器 / 生成器
-> 装饰器
-> 描述符 / OOP
-> 并发 / asyncio
-> 工程模式
-> 数据结构
-> mini framework
```

这个顺序的好处是：先把 Python 的运行模型吃透，再练抽象能力，最后把多个抽象组合成工程代码。

## 核心 30 题

| 序号 | 题目 | 推荐目录 | 状态 |
| --- | --- | --- | --- |
| 1 | 手写 `deep_copy` | `object_model/` | done |
| 2 | 手写 `flatten` | `object_model/` | todo |
| 3 | 手写 `dedup` | `object_model/` | todo |
| 4 | 手写 `group_by` | `object_model/` | todo |
| 5 | 手写 `chunk` | `object_model/` | todo |
| 6 | 手写 `range` | `iterators/` | todo |
| 7 | 手写 `enumerate` | `iterators/` | todo |
| 8 | 手写 `zip` | `iterators/` | todo |
| 9 | 手写 `chain` | `iterators/` | todo |
| 10 | 手写 `timer` | `decorators/` | todo |
| 11 | 手写 `retry` | `decorators/` | todo |
| 12 | 手写 `memoize` | `decorators/` | todo |
| 13 | 手写 `once` | `decorators/` | todo |
| 14 | 手写 `property` | `descriptors/` | todo |
| 15 | 手写 `cached_property` | `descriptors/` | todo |
| 16 | 手写字段校验描述符 | `descriptors/` | todo |
| 17 | 手写简化版 `dataclass` | `descriptors/` | todo |
| 18 | 手写 LRU Cache | `data_structures/` | todo |
| 19 | 手写 Trie | `data_structures/` | todo |
| 20 | 手写 Top K | `data_structures/` | todo |
| 21 | 手写二分查找 | `data_structures/` | todo |
| 22 | 手写 BFS / DFS | `data_structures/` | todo |
| 23 | 手写拓扑排序 | `data_structures/` | todo |
| 24 | 手写线程安全计数器 | `concurrency/` | todo |
| 25 | 手写生产者消费者 | `concurrency/` | todo |
| 26 | 手写 `bounded_gather` | `concurrency/` | todo |
| 27 | 手写 async retry | `concurrency/` | todo |
| 28 | 手写 Event Bus | `engineering_patterns/` | todo |
| 29 | 手写 Unit of Work | `engineering_patterns/` | todo |
| 30 | 手写 mini Router / mini FastAPI | `mini_framework/` | todo |

## 单题文件约定

每个实现文件尽量保持这个结构：

```python
"""
题目：
考点：
边界：
"""


def solution(...):
    ...


if __name__ == "__main__":
    ...
```

测试放在 `tests/` 下，优先用标准库 `unittest`，这样不依赖额外包。

## 运行测试

在仓库根目录执行：

```bash
python -m unittest discover -s python/tests
```

如果只想跑某一题：

```bash
python -m unittest python.tests.test_deep_copy
```

## 训练重点

对你当前的 Python 后端、SQLAlchemy、Agent Runtime、SSE、事件一致性场景，优先级建议是：

1. 装饰器：日志、重试、事务、限流、trace 都绕不开。
2. 迭代器 / 生成器：分页、流式处理、懒加载会直接用到。
3. 描述符：理解 ORM、Pydantic、FastAPI 参数系统的底层模型。
4. asyncio：并发任务、超时、取消、限流、背压。
5. Unit of Work / Event Bus：业务一致性和事务边界。
6. mini framework：把零散机制组合成小系统。
