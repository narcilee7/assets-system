# Python 高级主题

这一层探索 Python 的边界能力：元类、描述符协议、C 扩展、Cython、内存优化。

---

## 目录

| 文件 | 主题 |
|------|------|
| `metaclasses.md` | 元类、类创建过程、`__new__` vs `__init__` |
| `descriptor-protocol.md` | `__get__`、`__set__`、`__delete__`、属性访问链 |
| `c-extensions.md` | Python C API、ctypes、cffi、SWIG |
| `cython-and-numba.md` | Cython 编译、类型声明、Numba JIT |
| `performance-optimization.md` | 性能分析、cProfile、line_profiler、内存优化 |

---

## 核心问题

1. 元类在框架中的典型应用（如 Django ORM、SQLAlchemy）？
2. 描述符协议如何实现 `property`、`classmethod`、`staticmethod`？
3. C 扩展的引用计数管理为什么容易出错？
4. Cython 的 `cdef`、`cpdef`、`def` 区别？
5. 如何定位 Python 程序中的内存泄漏？

---

## 关联训练场

- `../core-abstractions/descriptors/` — 描述符手写实现
- `../mini-runtime/` — C 扩展实验、性能优化实践
