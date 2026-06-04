# 迭代器与生成器层

这一层训练 Python 协议意识。很多 Pythonic 写法都来自迭代协议和惰性计算。

## 必会概念

- `iter(obj)` 会调用 `obj.__iter__()`。
- `next(iterator)` 会调用 `iterator.__next__()`。
- 可迭代对象不一定是迭代器，迭代器一定可迭代。
- 生成器会保存函数执行现场，按需产出值。
- 迭代器通常只能消费一次。

## 题单

| 题目 | 文件 | 状态 | 关键点 |
| --- | --- | --- | --- |
| 手写 `range` | `my_range.py` | todo | `__iter__`、`__next__`、步长 |
| 手写 `enumerate` | `my_enumerate.py` | todo | 计数状态、惰性产出 |
| 手写 `zip` | `my_zip.py` | todo | 多迭代器同步、最短停止 |
| 手写 `map` | `my_map.py` | todo | 函数应用、惰性 |
| 手写 `filter` | `my_filter.py` | todo | 谓词判断、惰性 |
| 手写 `chain` | `chain.py` | todo | 多 iterable 串联 |
| 手写分页迭代器 | `page_iterator.py` | todo | 拉取下一页、停止条件 |
