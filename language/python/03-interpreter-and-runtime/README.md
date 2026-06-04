# Python 解释器与运行时底层

这一层深入 Python 的「黑盒」：CPython 解释器、GIL、内存管理、引用计数、字节码。

---

## 目录

| 文件 | 主题 |
|------|------|
| `cpython-overview.md` | 解释器架构、REPL、编译流程 |
| `gil-deep-dive.md` | GIL 实现、影响、多线程陷阱、绕过策略 |
| `memory-management.md` | 引用计数、循环引用、分代 GC、__del__ |
| `bytecode-and-vm.md` | 字节码结构、dis 模块、PVM 执行模型 |
| `object-internals.md` | PyObject、引用计数、对象头、内存布局 |

---

## 核心问题

1. CPython 的解释执行流程：源码 → 解析 → 编译 → 字节码 → VM 执行？
2. GIL 在什么情况下释放？（I/O、固定时间片、C 扩展）
3. 引用计数如何处理循环引用？分代 GC 的角色？
4. 字节码层面的 `LOAD_FAST`、`STORE_FAST`、`BINARY_ADD` 是什么？
5. `__slots__` 如何优化内存使用？

---

## 关联训练场

- `../runtime-model/` — 对象模型、深拷贝、名字绑定实验
