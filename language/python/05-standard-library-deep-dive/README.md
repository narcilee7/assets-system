# Python 标准库深度解析

这一层理解 Python 核心 API 的设计与陷阱：collections、itertools、functools、contextlib。

---

## 目录

| 文件 | 主题 |
|------|------|
| `collections-module.md` | defaultdict、Counter、deque、OrderedDict、namedtuple |
| `itertools-and-functools.md` | 迭代工具、偏函数、reduce、lru_cache |
| `contextlib.md` | 上下文管理器、contextmanager 装饰器、ExitStack |
| `inspect-and-reflection.md` | 运行时 introspection、签名检查、帧对象 |
| `io-and-filesystem.md` | pathlib、io、tempfile、shutil |

---

## 核心问题

1. `collections.deque` 为什么比 `list` 更适合队列操作？
2. `functools.lru_cache` 的底层实现是什么？
3. 上下文管理器的 `__enter__` 和 `__exit__` 协议？
4. `inspect.signature` 如何获取函数签名？
5. `pathlib` 与 `os.path` 的对比与迁移策略？

---

## 关联训练场

- `../standard-library/` — 数据结构、算法、工具类手写实现
