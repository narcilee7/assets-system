# Core Abstractions

这一层训练 Python 的核心抽象：迭代器、生成器、装饰器、描述符、闭包。

## 必会概念

- 迭代协议：`__iter__` + `__next__`，StopIteration 终止。
- 生成器是迭代器的语法糖：函数中使用 `yield` 即成为生成器。
- 装饰器是闭包的高阶应用：接收函数，返回包装函数。
- 描述符协议：`__get__`、`__set__`、`__delete__`，控制属性访问。
- 闭包捕获的是变量对象，不是值拷贝。

## 已有资产

| 资产 | 目录 | 状态 | 目标 |
|------|------|------|------|
| 迭代器与生成器 | `iterators/` | seed | range、enumerate、zip、chain |
| 装饰器 | `decorators/` | seed | timer、retry、memoize、once |
| 描述符 | `descriptors/` | seed | property、cached_property、字段校验 |

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| 手写 range | `iterators/range.py` | todo | 惰性计算、索引 |
| 手写 enumerate | `iterators/enumerate.py` | todo | 计数器、迭代器 |
| 手写 zip | `iterators/zip.py` | todo | 多序列并行迭代 |
| 手写 chain | `iterators/chain.py` | todo | 迭代器拼接 |
| 手写 timer | `decorators/timer.py` | todo | 闭包、时间测量 |
| 手写 retry | `decorators/retry.py` | todo | 异常捕获、指数退避 |
| 手写 memoize | `decorators/memoize.py` | todo | lru_cache 简化版 |
| 手写 once | `decorators/once.py` | todo | 单例执行 |
| 手写 property | `descriptors/property.py` | todo | 描述符协议 |
| 手写 cached_property | `descriptors/cached_property.py` | todo | 惰性计算、缓存 |
| 手写字段校验描述符 | `descriptors/field_validator.py` | todo | 类型检查、范围校验 |
| 手写简化 dataclass | `descriptors/mini_dataclass.py` | todo | 自动属性生成 |
