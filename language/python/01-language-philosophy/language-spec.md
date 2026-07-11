# Python 语言规范核心定义 (`language-spec.md`)

## 1. 动态强类型系统 (Type System)

Python 是一门**动态类型（Dynamic Typing）**、**强类型（Strong Typing）**语言，并支持**渐进式类型提示（Gradual Typing）**。

### 内存模型：一切皆对象 (Everything is an Object)

在 CPython 中，变量名不是内存空间的别名，而是一个**指向对象的指针**（即 C 语言中的 `PyObject*`）。

```text
    【变量名 / 名字空间】              【堆内存 (Heap)】
     a = [1, 2] ---------->  PyListObject (引用计数=1, 类型=list)
     b = a      ---------->  (两个指针指向同一个内存地址)

```

* **所有的对象都包含两个核心公共头部**：
1. `ob_refcnt`：引用计数（用于垃圾回收）。
2. `ob_type`：指向类型结构体（`PyTypeObject`）的指针（用于运行时动态类型确定）。


* **强类型行为**：运行时拒绝隐式类型转换。例如 `1 + "2"` 会触发 `TypeError`，因为 `int` 的 `__add__` 协议在发现对方是 `str` 且自身无法处理时，不会隐式变动数据。
* **可变性 (Mutability) 分水岭**：
* **不可变对象 (Immutable)**：`int`, `float`, `str`, `tuple`, `bytes`, `frozenset`。一旦创建，其内部值无法修改。若对其进行“修改”操作（如 `s += "bar"`），实际上是开辟新内存铸造新对象，并重定向指针。
* **可变对象 (Mutable)**：`list`, `dict`, `set`, `bytearray`。其内部维护的 C 指针数组或哈希表可以原地（In-place）扩容或修改，地址（`id()`）保持不变。



---

## 2. 名字绑定与生命周期声明 (Declarations & Binding)

Python 没有显式的“变量声明”关键字（如 `var`, `let`），它的变量声明隐含在名字绑定（Name Binding）动作中。

### 名字绑定机制

* **赋值即绑定**：执行 `x = 10` 时，虚拟机会在当前作用域的名称空间（Namespace，底层是一个 `PyDictObject` 或栈帧的局部数组）中，建立字符串 `"x"` 到数字对象 `10` 的映射。
* **作用域感知 (LEGB 规则)**：
编译期，Python 编译器会扫描函数体，确定变量属于 **L**ocal（局部）、**E**nclosing（闭包嵌套）、**G**lobal（全局）还是 **B**uilt-in（内置）。

### 作用域显式突破

* **`global x`**：迫使虚拟机在当前作用域的赋值操作直接作用于模块级的 `f_globals` 字典。
* **`nonlocal x`**：用于闭包（Closure），告诉虚拟机该名字绑定属于外层嵌套函数的自由变量（Cell Variable），在底层通过 `PyCellObject` 保持生命周期，即使外层函数已执行完毕，该变量依然存活在堆中。

---

## 3. 控制流的底层契约 (Control Flow & Protocols)

Python 的控制流除了基础的条件分支跳转，其高级控制流（循环、解构）完全基于**协议机制（Protocols）**。

### `for...in` 迭代协议契约

任何对象若想被 `for` 循环遍历，必须履行迭代协议：

1. 虚拟机先调用 `iter(obj)`，底层寻找对象的 `__iter__` 方法，返回一个**迭代器对象（Iterator）**。
2. 虚拟机循环调用该迭代器的 `__next__` 方法（对应字节码 `FOR_ITER`）。
3. 当数据耗尽，`__next__` 必须抛出 `StopIteration` 异常，虚拟机会捕获该异常并优雅地终止循环。

### `match...case` 结构化模式匹配契约（3.10+）

* 不仅是值相等性比较。当匹配类模式时（如 `case Point(x=1, y=y)`），虚拟机会调用类上的 `__match_args__` 属性来做位置参数映射，并动态解构匹配对象的内部属性。

---

## 4. 面向对象模型 (OOP & Object Model)

Python 的面向对象非常彻底且高度动态，其类本身也是运行时的对象（元类的实例）。

### 属性查找链 (MRO - Method Resolution Order)

当执行 `obj.attr` 时，CPython 遵循极其严格的查找顺序：

1. 如果该属性在类上定义，且是一个**数据描述符（Data Descriptor，实现了 `__set__`）**，优先使用描述符。
2. 查找 `obj.__dict__`（实例的局部属性空间）。
3. 查找类及其所有父类的 `__dict__`。这一步的搜索顺序由 **C3 线性化算法（C3 Linearization）** 计算出的 **MRO 列表** 决定（可通过 `Class.__mro__` 查看）。
4. 如果上述地方都没找到，且类上定义了非数据描述符（如普通方法），则调用描述符。
5. 最终若皆落空，触发 `__getattr__` 降级兜底逻辑。

### 开放性控制：`__slots__`

为了打破“一切皆对象导致字典内存膨胀”的代价，类可以声明 `__slots__ = ('x', 'y')`。

* *底层真相*：虚拟机会取消为每个实例创建 `__dict__` 字典，转而在 C 层面为实例分配固定大小的紧凑指针槽位。这使得对象内存大幅下降，常用于万级、亿级 AI Agent 实例或大量数据实体的长驻内存优化。

---

## 5. 结构化异常与资源安全 (Exceptions & Resource Management)

Python 的异常处理不是破坏执行流的灾难，而是控制流的常态（例如 `StopIteration`）。

### 异常表（Exception Table）机制

* 在 Python 3.11 之后，`try...except` 引入了零成本异常处理（Zero-cost Exceptions）。在没有发生异常时，`try` 块的执行速度与普通代码完全一致，不再有显式的运行时开销。
* 当异常发生时，虚拟机会去查当前代码块的 **Exception Table**，跳转到对应 `except` 字节码。

### `with` 上下文管理器契约

用于确定性的资源释放，其核心底层逻辑等价于：

```python
mgr = expression
exit_func = mgr.__exit__
value = mgr.__enter__()
try:
    # with 块内部代码
    ...
except Exception as e:
    # 如果内部崩溃，将异常三元组传给 __exit__
    if not exit_func(type(e), e, e.__traceback__):
        raise
else:
    exit_func(None, None, None)

```

---

## 专家视角：资产审查表

在实现你的 Part II 训练场时，所有手写组件都必须通过此规范的检验：

| 语法特性 | 必须通过的底层单测点 | 对应题单 |
| --- | --- | --- |
| **可变性** | 修改子对象时，父对象的 `id()` 不变；不可变对象修改时引发地址漂移。 | 01 手写 `deep_copy` |
| **迭代协议** | 手写组件必须能在捕获 `StopIteration` 后正常闭合，绝不泄露状态。 | 06-09 手写迭代器系列 |
| **属性查找链** | 确保私有变量（`__var`）名字修饰后不被外界简单覆写。 | 14-16 手写描述符系列 |
| **异常安全** | 在上下文管理中崩溃时，`__exit__` 必须被 100% 触发执行。 | 10 手写 `timer` 装饰器 |

---

这份规范文档已经为你理清了整个语言特性的运行机制底座。接下来，你是想继续丰富 Part I 里的其他理论架构（比如内存管理），还是直接挑一道手写题，用无懈可击的代码把这些规范跑通？
