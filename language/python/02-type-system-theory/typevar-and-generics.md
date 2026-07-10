# Python 泛型与高级类型参数化全貌指南 (`typevar-and-generics.md`)

## 1. 泛型演进化：从显式声明到原生语法（PEP 695）

Python 泛型的声明方式在 Python 3.12 迎来了一次破坏性的优雅升级。我们必须同时掌握新老两套标准库语法，以应对长周期项目的重构：

### 传统流派 (Python 3.5 - 3.11)

依赖标准库 `typing.TypeVar` 和 `typing.Generic` 进行手动绑定，具有极高的侵入性，且声明必须放在全局作用域。

```python
from typing import Generic, TypeVar

T = TypeVar("T")  # 必须显式实例化一个全局变量

class Stack(Generic[T]):
    def __init__(self) -> None:
        self.items: list[T] = []
        
    def push(self, item: T) -> None:
        self.items.append(item)

```

### 现代流派 (Python 3.12+ / PEP 695 标准)

引入原生 **Type Parameter Syntax（类型参数语法）**。类型变量作为类名或函数名的后缀直接声明，隐式完成 `TypeVar` 实例化，代码更加精简。

```python
# 💡 Python 3.12+ 原生泛型类声明
class Stack[T]:
    def __init__(self) -> None:
        self.items: list[T] = []
        
    def push(self, item: T) -> None:
        self.items.append(item)

```

---

## 2. 核心底座：型变（Variance）的数学本质与推导规则

型变控制着当**泛型参数存在父子关系时，泛型复合类型本身是否还能保持这种父子关系**。这是编写可扩展框架（如数据管道、中间件）时最容易让 Mypy 飘红的重灾区。

假设 `Dog` 是 `Animal` 的子类（$Dog \subseteq Animal$），我们定义一个泛型容器 `Container[T]`：

| 型变分类 (Variance) | 数学定义 | Mypy 推导规则 | 生产级典型场景 | 传统语法声明 |
| --- | --- | --- | --- | --- |
| **协变**<br>

<br>(Covariant) | $Container[Dog] \subseteq Container[Animal]$ | 容器只负责**产出/读取**（只读型容器），绝不接受写入。 | 只读数据流、生成器、HTTP Response | `TypeVar("T", covariant=True)` |
| **逆变**<br>

<br>(Contravariant) | $Container[Animal] \subseteq Container[Dog]$ | 容器只负责**消费/写入**（只写型容器），绝不向外吐出。 | 消费队列、序列化器、HTTP Request 消费者 | `TypeVar("T", contravariant=True)` |
| **不型变**<br>

<br>(Invariant) | 两者毫无血缘关系，Mypy 严格对齐。 | 容器**既可读又可写**。由于可写，必须锁死类型以防类型污染。 | 原生 `list[T]`、`dict[K, V]`、可变状态机 | `TypeVar("T")` (默认) |

### 💡 PEP 695 的自动型变推导 (Autodetection)

在 Python 3.12+ 中，如果你使用 `class Container[T]: ...`，Mypy 会自动审查你这个类内部所有的方法签名：

* 如果 `T` 只出现在返回值中，Mypy 自动将 `T` 视为**协变**。
* 如果 `T` 只出现在入参中，Mypy 自动将其视为**逆变**。
* 如果都有，则是**不型变**。你不需要再手动纠结 `covariant=True`。

---

## 3. 标准库四大天王：解决高阶工程的全部痛点

随着工业级全栈框架的沉淀，Python 陆续推出了四个极其硬核的泛型标准工具。我们将逐一击破它们的工程黑幕：

### 3.1 `TypeVar(bounds, co/contra)` 与 `TypeVar` 约束

* **`bound=Animal` (上界约束)**：接受 `Animal` 及其任何子类。类型推导出的结果是**动态收窄的子类本身**。
* **`constraints=(int, str)` (硬性限定)**：只能是 `int` 或 `str` 二选一，不能是它们的子类。

### 3.2 `ParamSpec` (PEP 612 — 装饰器类型擦除的救星)

* **生产痛点**：在编写高阶函数（如通用日志、异步重试、权限校验装饰器）时，传统的 `TypeVar` 只能捕获返回值，被装饰函数的**入参签名会被彻底擦除（变成 `Any`）**，导致 IDE 丢失入参提示。
* **解法**：`ParamSpec` 专门用来捕获、流转、并完整还原任意可调用对象的入参签名（包括位置参数和关键字参数）。

### 3.3 `TypeVarTuple` (PEP 646 — 矩阵与张量维度校验)

* **生产痛点**：在 AI / 机器学习的张量（Tensor）计算中，多维矩阵的形状（Shape）极易出错（例如 `[BatchSize, Channels, Height, Width]`）。普通的泛型只能约束单个元素类型，无法约束变长元组的结构。
* **解法**：`TypeVarTuple` 允许泛型捕获**任意长度的类型元组**，从而在静态期拦截 Shape 不匹配的 Bug。

### 3.4 `TypeAlias` (PEP 613 / PEP 695 泛型别名)

* 现代 Python 使用 `type` 关键字直接声明高保真的泛型别名，替代过去脆弱的赋值语句：
`type JsonDict[T] = dict[str, T]`

---
