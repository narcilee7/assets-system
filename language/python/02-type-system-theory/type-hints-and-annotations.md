# type-hints-and-annotations

---

## 1. 进化编年史：从“花絮”到“基础设施”

Python 的类型提示经历了一条从“运行时完全无感”到“渐进式静态分析 + 运行时元编程双轮驱动”的漫长演进之路：

| 版本 / PEP | 核心引入 | 工业级改变与底座影响 |
| --- | --- | --- |
| **Python 3.0**<br>

<br>(PEP 3107) | 函数注解语法（Function Annotations） | 仅提供语法支持，Python 自身不赋予任何语义，注解存放在 `__annotations__` 字典中。 |
| **Python 3.5**<br>

<br>(PEP 484) | 引入 `typing` 模块与静态检查标准 | 奠定了渐进式类型（Gradual Typing）的基调，引入 `List`, `Dict`, `Tuple`, `Any`，催生了 Mypy。 |
| **Python 3.6**<br>

<br>(PEP 526) | 变量注解语法（Variable Annotations） | 支持对类变量、实例变量和局部变量进行直接注解：`x: int = 1`。 |
| **Python 3.9**<br>

<br>(PEP 585) | 内置集合类型泛型化 | 彻底废弃 `typing.List` / `typing.Dict`，允许直接使用原生集合类型：`list[int]`，大幅降低运行时导入开销。 |
| **Python 3.10**<br>

<br>(PEP 604) | 联合类型联合运算符 `|` | 废弃 `typing.Union` 与 `typing.Optional`，改用 `int | str` 和 `str | None`，语法全面向现代语言看齐。 |
| **Python 3.12**<br>

<br>(PEP 695) | 显式泛型语法（Type Parameter Syntax） | 引入全新 `type` 关键字与原生泛型声明：`def get_first[T](items: list[T]) -> T:`，彻底淘汰了繁琐的 `TypeVar` 显式初始化。 |

---

## 2. 运行时底层表征：`__annotations__` 与延迟计算的恩怨

在 CPython 运行时，类型提示本质上是附着在函数或类对象上的一个**普通属性字典**。

### 2.1 传统的立即求值痛点与循环引用

默认情况下，Python 解释器在编译字节码并执行到函数定义时，会**立即计算**参数和返回值的表达式：

```python
# 致命痛点：前向引用（Forward Reference）
class Node:
    def set_parent(self, parent: Node) -> None: ... 
    # ❌ 报错：NameError: name 'Node' is not defined（因为此时类 Node 还未构建完毕）

```

在旧版本中，开发者被迫写成字符串 `parent: 'Node'` 来绕过，这种妥协极其不优雅。

### 2.2 PEP 563 与 `from __future__ import annotations`

为了解决前向引用和导入开销，PEP 563 引入了注解的**延迟求值（Postponed Evaluation）**：

* 开启此开关后，所有类型提示在编译期会被 CPython 自动包装为**纯字符串**存入 `__annotations__`，不再在模块加载时实例化类型对象。
* **副作用**：这直接击碎了基于运行时反射的框架（如 Pydantic v1）。因为在运行时读取 `__annotations__` 拿到的全是字符串，必须依赖极其脆弱的 `typing.get_type_hints(fn, globals(), locals())` 进行动态上下文逆向求值。

### 2.3 PEP 749 / 2026 年的现代共识

目前的 Python 生态在运行时元编程中，普遍采取**双轨制**：

1. **静态检查器** 拥有完整的符号表，完全不受延迟求值影响。
2. **运行时框架（如 Pydantic v2、FastAPI）** 通过内置的 C 级解析器或直接审查原生类型的内部 `__args__` 和 `__origin__` 槽位，在模块初始化时进行一次性的类型树重构。

---

## 3. 静态推导核心算法：双向类型推导 (Bidirectional Type Checking)

静态类型检查器（如 Mypy、Pyright）在扫描你的源码时，并不是盲目地从左到右或从右到左，而是采用**双向类型推导算法**：

1. **类型合成（Type Synthesis - 自底向上）**：
检查器根据表达式的叶子节点推导其类型。例如，遇到表达式 `1 + 2.0`，合成算法知道 `int + float` 必然产出 `float`。
2. **类型检查/分析（Type Analysis - 自顶向下）**：
检查器利用上下文期望的目标类型（Expected Type / Contextual Type）去约束子表达式。例如：
```python
def process_scores(scores: list[float]) -> None: ...

process_scores([1, 2, 3]) 
# 💡 自顶向下推导：上下文期望 list[float]，因此字面量列表中的整型 1, 2, 3 被安全地隐式提升（Promoted）为 float

```



---

## 4. 核心全貌避坑与工程契约

在长周期的全栈大型工程（百万行级别）中，类型系统必须遵守以下高阶防御规范：

1. **绝对克制 `Any` 传染**：
`Any` 是破坏双向类型推导算法的罪魁祸首。一旦一个表达式被合成算法判定为 `Any`，它将彻底使其下游的所有自顶向下类型分析失效。应优先使用 `object`（代表“任何对象，但如果要使用它，你必须先显式做类型收窄（Type Narrowing）”）。
2. **警惕泛型集合的运行时谎言**：
```python
def process_data(payload: Any):
    # ❌ 运行时误区：isinstance 无法检查泛型内部参数
    if isinstance(payload, list[int]): # TypeError: isinstance() argument 2 cannot be a parameterized generic
        pass

```


运行时必须回退到基础类型 `isinstance(payload, list)`，而将元素强类型校验交给 EAFP 或验证框架。

---
