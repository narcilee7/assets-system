# 结构化类型系统与 Protocol 权威指南 (`protocol_and_structural.md`)

## 1. 类型系统双璧：名义类型 vs 结构类型

在计算机科学中，判定两个类型是否兼容（Subtyping）有两种核心范式：

### 名义类型系统 (Nominal Typing)

* **核心定义**：类型的兼容性完全取决于**显式的声明与继承树的血缘关系**。
* **经典代表**：Java, C++, Python 传统类继承（基于 `abc.ABCMeta`）。
* **代价**：引发**侵入式设计**。如果你想写一个插件适配第三方框架，你必须显式继承框架定义的 `BasePlugin`。一旦第三方框架发生变更，整条继承树上的类都需要被迫重构。

### 结构类型系统 (Structural Typing)

* **核心定义**：类型的兼容性完全取决于**对象的结构（即它拥有的属性和方法签名）**。
* **经典代表**：Go (Interfaces), TypeScript, Python 3.8+ (`typing.Protocol`)。
* **红利**：实现**极致的解耦**。生产者和消费者只需要对齐一份抽象的结构契约（契约甚至可以由第三方定义），两者的代码在物理上可以完全独立。

---

## 2. PEP 544 `typing.Protocol` 的底层运行机制

Python 3.8 引入的 `Protocol` 完美融合了结构化类型的灵活性与静态检查的安全。我们必须区分它在编译期（Mypy 阶段）**与**运行时（Runtime 阶段）的两个完全不同的世界：

### 编译期：Mypy 的鸭子图论推导

当你运行静态检查器（如 Mypy、Pyright）时，`Protocol` 本身**不产生任何实例**。静态检查器在内部维护了一张**类型属性图**。

当遇到声明为 `Protocol` 的形参时，Mypy 会提取该 Protocol 定义的所有方法名、参数类型、返回值。接着去审查传入的具体类，如果发现具体类的方法集合完全覆盖（Intersection）了 Protocol 的要求且函数签名一致，Mypy 就会在静态阶段亮起绿灯。

### 运行时：`@runtime_checkable` 的魔术

默认情况下，`Protocol` 在运行时是无法通过 `isinstance()` 进行校验的，因为结构类型本质上没有“血缘链（MRO）”。

但当你加上 `@typing.runtime_checkable` 装饰器后，Python 运用元编程手段改写了该 Protocol 的 `__instancecheck__` 魔术方法：

```python
# CPython 内部对 runtime_checkable 的大致模拟逻辑
def __instancecheck__(cls, instance):
    # 彻底放弃检查 mro，转向动态反射
    for attr in cls.__protocol_attrs__:
        if not hasattr(instance, attr):
            return False
    return True

```

* **代价感知**：在运行时频繁调用 `isinstance(obj, MyProtocol)` 是极其昂贵的 **$O(N)$** 操作（$N$ 为 Protocol 的属性数量），因为它在 C 层面涉及多轮 `PyObject_HasAttr` 的动态字典查找。**生产环境核心链路应尽量避免在运行时滥用 `runtime_checkable`。**

---

## 3. 高级进阶：泛型 Protocol 与 逆变/协变 体操

在大型 Agent 运行时或高阶数据管线中，`Protocol` 经常需要与 `Generic` 搭配使用，这时就会触发最硬核的型变（Variance）问题。

### 场景：可供大模型调用的通用工具（ToolExecutor）

我们需要定义一个工具执行器协议，它接收一种类型的输入，产出另一种类型的输出：

```python
from typing import Protocol, TypeVar

# T_in 是逆变的（Contravariant），因为输入参数可以接受更宽松的父类
T_in = TypeVar("T_in", contravariant=True)
# T_out 是协变的（Covariant），因为输出结果可以返回更具体的子类
T_out = TypeVar("T_out", covariant=True)

class ToolExecutor(Protocol[T_in, T_out]):
    def execute(self, payload: T_in) -> T_out: ...

```

* **专家级避坑契约**：
* 如果一个类型变量仅作为方法的**入参**，必须将其声明为 **逆变 (`contravariant=True`)**。
* 如果一个类型变量仅作为方法的**返回值**，必须将其声明为 **协变 (`covariant=True`)**。
* 如果两者皆有（可读可写），则是 **不型变 (Invariant)**。



---

## 4. 落地训练场方案与 Mypy 验证

让我们在你的训练场 `type-system-gymnastics/structural_protocol.py` 中写下一个无懈可击的 Case，供后续离线复习。

```python
# language/python/type_system_gymnastics/structural_protocol.py
from typing import Protocol, TypeVar, runtime_checkable

@runtime_checkable
class Closable(Protocol):
    """一个经典的结构化资源清理协议"""
    def close(self) -> None: ...


class ConnectionPool:
    """具体业务类 1：完全独立的第三方组件，无显式继承"""
    def close(self) -> None:
        print("Closing connection pool handles.")


class ThreadWorker:
    """具体业务类 2：结构完全不同的另一个组件"""
    def close(self) -> None:
        print("Stopping worker threads safely.")


def safe_shutdown(resource: Closable) -> None:
    """
    1. 业务消费方：声明了符合 Closable 协议。
    2. IDE 此时会复活代码提示：当输入 'resource.' 时，自动提示 'close()'。
    """
    resource.close()

```

### 自动化单测验证 (`tests/test_structural.py`)

```python
# language/python/tests/test_structural.py
import unittest
from type_system_gymnastics.structural_protocol import Closable, ConnectionPool, ThreadWorker, safe_shutdown

class TestStructuralProtocol(unittest.TestCase):
    
    def test_structural_compliance(self):
        pool = ConnectionPool()
        worker = ThreadWorker()
        
        # 1. 验证运行时 isinstance 能够成功穿透无继承关系的类（得益于 @runtime_checkable）
        self.assertTrue(isinstance(pool, Closable))
        self.assertTrue(isinstance(worker, Closable))
        
        # 2. 验证非合规鸭子被精准拦截
        class BadDuck: pass
        self.assertFalse(isinstance(BadDuck(), Closable))

if __name__ == "__main__":
    unittest.main()

```

---

## 专家级审视结论

通过沉淀这份 `protocol_and_structural.md`，我们彻底补齐了纯动态鸭子类型“没有开发提示、重构困难”的短板。它的核心心智模型是：

> **“在实现层，保持鸭子的绝对自由（无强耦合继承）；在接口层，拉起 Protocol 的铁丝网（提供全量 IDE 补全与静态检查拦截）。”**

至此，Part I — 02 类型系统理论的硬核内容已经完全闭环。接下来，我们要不要正式发起对 **Part I — 03 Interpreter and Runtime（CPython 解释器、对象头、分代垃圾回收、引用计数底层）** 的总攻？
