
# CPython 运行时全局鸟瞰 (`cpython_overview.md`)

## 1. 宏观双核架构：编译器 vs 虚拟机

很多开发者对 Python 有一个长期的误解：“Python 是纯解释型语言，一行行读，一行行执行。” **这在 CPython 里是完全错误的。**

CPython 实际上是一个经典的**两阶段混合执行引擎**。它的内部清晰地划分为两大部分：**编译器（Compiler）前台**与**虚拟机（Virtual Machine）后台**。

```
                    【 编译期 (Frontend) 】
 源码 (.py) ──> AST ──> 控制流图 (CFG) ──> 字节码 (.pyc)
                                              │
                                              ▼
                    【 运行期 (Backend) 】
             CPython 虚拟机 (字节码驱动的栈式架构)
                    [ PyEval_EvalFrameDefault ]

```

### 阶段一：前台编译器（将文本坍缩为字节码）

当你运行 `python main.py` 时，CPython 的前台会经历以下硬核的三步流转，且这一步完全由 C 语言编写：

1. **解析（Parsing）**：将你的 Python 源代码解析为 **AST（抽象语法树，Abstract Syntax Tree）**。
2. **符号表构建（Symbol Table）**：扫描变量作用域（局部、全局、闭包），确定每个符号的存储性质。
3. **字节码生成（Bytecode Generation）**：将 AST 转化为**控制流图（CFG）**，最后坍缩为一条条紧凑的、平台无关的 **字节码指令（Bytecode）**。这些指令会被序列化并缓存到 `__pycache__` 目录下的 `.pyc` 文件中。

### 阶段二：后台虚拟机（永不停歇的万能轮询器）

一旦字节码生成完毕，前台编译器立即功成身退。接力棒交给了 CPython 的灵魂——**栈式虚拟机（Stack-based VM）**。

* 虚拟机的核心是一个被称作 **`PyEval_EvalFrameDefault`** 的巨型 C 语言函数。
* 在它的内部，躺着一个巨大的、长达数千行的 `switch-case` 循环（在启用计算跳转指令的平台上，通过 GNU C 的 `goto *labels` 优化）。它不知疲倦地轮询输入的字节码，将其翻译为对应的 C 级底层硬件动作。

---

## 2. C 语言层面的世界观：万物皆可 `PyObject`

在 CPython 的大一统设计中，**“万物皆对象”** 不是一句抽象的标语，而是一行实实在在的 C 语言结构体定义。你在 Python 里创建的 `int`、`str`、`function`、甚至是顶层的 `module`，在 C 层面，**本质上全部都是 `PyObject` 结构体指针。**

我们来看 CPython 源码中，最底层的两大骨架：

```c
// CPython 核心源码精简表述

// 1. 所有普通对象的基石
struct _object {
    _PyObject_HEAD_EXTRA // 双向链表指针，用于垃圾回收跟踪
    Py_ssize_t ob_refcnt;   // 核心机制一：引用计数 (Reference Count)
    struct _typeobject *ob_type; // 核心机制二：类型指针 (指向该对象的类型对象)
};
typedef struct _object PyObject;

// 2. 所有可变/变长对象（如 list, str, bytes）的基石
struct _varobject {
    PyObject ob_base;    // 嵌套一个普通对象头
    Py_ssize_t ob_size;  // 变长部分元素的计数（例如列表里元素的个数）
};
typedef struct _varobject PyVarObject;

```

### 拆解 CPython 对象头的两大天条：

1. **`ob_refcnt`（引用计数）**：一个 `Py_ssize_t`（长整型）。只要在 Python 里把这个对象赋值给一个新变量，它就 `+1`；变量作用域结束或被 `del`，它就 `-1`。一旦归零，C 层面立刻释放该内存。
2. **`ob_type`（类型槽位指针）**：指向一个 **`PyTypeObject`**。这个类型对象决定了当前对象是个什么东西（比如指向 `PyLong_Type` 说明它是整型）。它内部挂满了各种 C 级别的函数指针槽位（Slots），比如 `tp_add` 对应 `__add__`。

> **硬核真相：** 在 Python 里，当两个数字相加 `a + b` 时，虚拟机的底层动作是：拿到 `a->ob_type->tp_as_number->nb_add` 这一行 C 语言函数指针，然后把 `a` 和 `b` 作为参数传进去执行。

---

## 3. 2026 现代 Runtime 进化：自适应特化与第 3 层进化

既然进入了 2026 年的现代语境，我们就必须了解 **Python 3.11 - 3.13 架构重写**带来的惊人蜕变。以前的 CPython 常年因为“慢”被诟病，但现代 CPython 引入了 **PEP 659 (Specializing Adaptive Interpreter)**。

### 字节码的“热度进化论”

现代 CPython 虚拟机在执行字节码时，不再是一成不变的死板执行，它会玩**元编程特化**：

1. **冷代码（Cold）**：当一条指令刚执行时，它是通用的（例如 `BINARY_OP`），需要经历昂贵的类型动态查找。
2. **观察期（Warm）**：如果一条指令被连续执行了 8 次（热点代码循环），虚拟机就会启动**自适应（Adaptive）机制**，开始窥探传入对象的真实 C 级类型。
3. **特化爆发（Hot）**：如果发现传入的全是原生 `int`，虚拟机会在内存中**直接把这条通用字节码擦除、重写替换为特化后的字节码**（例如 `BINARY_OP_ADD_INT`）。该指令直接在 C 层面跳过一切属性字典查找，直奔硬件加法。

---

## 4. 下一阶段硬核实战演练场

为了让我们对 CPython 的“全局开门”具备实感，我们直接用标准库的 **`dis` (Bytecode Disassembler)** 库，来把一段 Python 代码的肉身剥离，看看它在虚拟机眼里的“字节码真身”。

请在你的根目录下创建 `03-interpreter-and-runtime/` 目录，并写下第一份窥探黑盒的脚本：

```python
# language/python/interpreter_and_runtime/bytecode_peeker.py
import dis

def optimize_target(a: int, b: int) -> int:
    """一个简单的加法计算，用来观测现代 CPython 的字节码布局"""
    return a + b

if __name__ == "__main__":
    print("=== 查看 optimize_target 函数的纯粹虚拟机字节码 ===")
    # dis.dis 会把函数的 CPython 虚拟机指令集以可读形式打印出来
    dis.dis(optimize_target)

```

### 运行它，你会看到：

```text
  2           0 RESUME                   0

  4           2 LOAD_FAST                0 (a)
              4 LOAD_FAST                1 (b)
              6 BINARY_OP                0 (+)
             10 RETURN_VALUE

```

* **`LOAD_FAST`**：这是 CPython 虚拟机的快速局部变量局部栈操作，直接利用了 C 语言层面的数组索引查找，速度极快。
* **`BINARY_OP`**：这就是等待被“自适应特化”的通用加法操作。

---

## 5. 接下来，我们要去哪？

全局的大门已经轰然打开，你现在已经拥有了看待 Python 运行时的“C 语言天眼”。

在这条深入黑盒的铁血长廊里，下面两个方向，哪一个是你想立刻攻克下一座堡垒？

1. **深度压榨 `PyObject` 底层**：手写一段代码，通过 Python 的 `ctypes` 库**强行穿透 C 层面，去肉眼查看任意变量的 `ob_refcnt` 引用计数和 MRO 类型槽地址**，观察它们是如何随着赋值而实时变化的。
2. **深入巨型轮询器**：拆解 `PyEval_EvalFrameDefault` 的 Frame（栈帧）结构，看看到底什么是 Python 的“求值栈”与“局部变量表”。
