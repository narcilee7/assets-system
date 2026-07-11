# Object Internals


解开了字节码与虚拟机的最后一层面纱，我们终于来到了 CPython 整个庞大帝国的最基石、一切故事的起点——**`PyObject` 对象模型与内部结构**。

在 Python 里面，“一切皆对象”（从最基础的整数、到函数、甚至连模块本身都是堆区的一个对象）。但从底层的 C 语言视角来看，**Python 对象根本不是什么玄妙的魔法，它只是一个在 C 语言堆区（Heap）动态分配的普通结构体（`struct`）。**

今天我们直接用显微镜砸开对象头的每一个字节，看看它们在内存里到底是怎么排列的。

---

## 1. 骨架的骨架：一切对象的通用头 (`PyObject`)

任何一个 Python 对象，在内存的物理最前端，都必定雷打不动地包含一个通用头部。这个头部在 C 语言源码中由名为 `PyObject` 的结构体定义：

```c
// CPython 核心源码定义 (简化了宏展开)
typedef struct _object {
    _PyObject_HEAD_EXTRA // 双向链表指针（仅在 Debug 编译模式下存在，用于追踪存活对象）
    Py_ssize_t ob_refcnt;  // 1. 核心大件：引用计数器 (64位系统下占 8 字节)
    struct _typeobject *ob_type; // 2. 核心大件：类型对象指针 (64位系统下占 8 字节)
} PyObject;

```

在 64 位生产环境系统下，任何一个最基础的 Python 对象，**哪怕里面不装任何业务数据，光是这个 `PyObject` 头就已经死死吃掉了 16 个字节（8 字节计数器 + 8 字节类型指针）。**

### 元件一：引用计数 (`ob_refcnt`)

一个有符号的 64 位整数（`long`）。它记录了当前有多少个地方正抓着这个对象的指针。当它归零，对象当场暴毙。

### 元件二：类型指针 (`ob_type`)

指向该对象所属的**类型对象（`PyTypeObject`）**。例如，一个整数对象的 `ob_type` 指向 `PyLong_Type`；一个自定义类实例的 `ob_type` 指向你定义的那个 Class 对象。

> **💡 破译 Python 动态特性的真相：** Python 之所以能支持 `type(obj)` 或者在运行时动态判断类型，本质上就是虚拟机顺着这个 `ob_type` 指针，去物理内存里偷看了一眼它指向的类型元数据结构体。

---

## 2. 变长对象的头部进化：`PyVarObject`

有些对象的大小在编译期是未知的，会根据业务数据动态膨胀，比如字符串（`str`）、列表（`list`）、元组（`tuple`）。为了管控它们，CPython 派生出了变长对象头：

```c
typedef struct {
    PyObject ob_base;   // 嵌套一个基础的 PyObject 头 (16 字节)
    Py_ssize_t ob_size; // 3. 变长对象独有：当前包含的元素个数 (8 字节)
} PyVarObject;

```

* **`ob_size` 的物理妙用**：对于 `list`，它代表列表当前包含的元素个数；对于 `str`，它代表字符串的字符长度。这也就是为什么你在 Python 里调用 `len(my_list)` 能够做到 **绝对的 $O(1)$ 速度**——它根本不需要去遍历链表，而是直接去对象的头文件里读取 `ob_size` 这一块早已固化的 8 字节内存。

---

## 3. 深度肉眼解剖：一个普通整数 `1` 的巨额内存开销

为了建立最稳固的硬件级直觉，我们以最简单的整数 `1` 举例。在 C 语言里，一个 `int` 只需要 **4 字节**。那在 Python 里呢？

现代 CPython 的整数是高精度大整数（`PyLongObject`），它属于变长对象（因为当数字极大时需要向上动态扩展）。

我们在物理内存中把它拉平来看，它的实际内存布局如下：

1. **`ob_refcnt` (8 字节)**：当前整数 `1` 的全局引用计数。
2. **`ob_type` (8 字节)**：指向全局唯一的 `PyLong_Type` 的物理内存地址。
3. **`ob_size` (8 字节)**：对于整数，它代表用来表示这个大整数所需的“数字位（digits）”的符号和个数。这里是 `1`。
4. **`ob_digit` (4 字节 ~ 变长)**：一个 C 语言数组，存放真正物理底层的数字。对于整数 `1`，它只占 4 字节。

* **惨烈开销**：$8 + 8 + 8 + 4 = 28$ 字节！由于 64 位操作系统的内存对齐（Memory Alignment）机制，28 字节会自动向上对齐到 **28 或 32 字节**。
* **专家共识**：这也就是为什么在 Python 里纯手工开辟包含一千万个整数的 `list` 会瞬间吃掉几百兆内存，而换成 C 语言数组或 `NumPy` 的连续紧凑内存块只需要 40MB 的根本原因——**Python 对象的对象头自带了巨大的“垃圾反序列化与元数据税”。**

---

## 4. 动手操盘：底层硬核黑客手段——用 `ctypes` 强行剥离指针查看 C 结构体内部

为了向你证明上面讲的每一个字节都是真实存在的，我们写一段流氓代码：通过标准库 `id()` 拿到对象的物理内存首地址，然后用 `ctypes` 像 C 语言一样直接**按字节偏移强行读取**这个地址的内容，把 `ob_refcnt` 和 `ob_type` 裸抓出来。

请在你的 `03-interpreter-and-runtime/` 目录下创建 `object_dissector.py` :

```python
# language/python/interpreter_and_runtime/object_dissector.py
import sys
import ctypes

def dissect_pyobject(obj: any):
    """
    黑客手段：传入任意 Python 对象，绕过所有高级封装，
    直接去其物理内存地址上生吞活剥出 PyObject 头部。
    """
    # 1. 在 CPython 中，内建函数 id(obj) 返回的就是该对象在 C 堆区的绝对物理内存地址
    obj_address = id(obj)
    print(f"=== 正在解剖对象，物理内存首地址: {hex(obj_address)} ===")

    # 2. 根据 64 位架构定义 PyObject 的 C 语言等价映射结构体
    class PyObjectStruct(ctypes.Structure):
        _fields_ = [
            ("ob_refcnt", ctypes.c_ssize_t),  # 8 字节有符号整型
            ("ob_type", ctypes.c_void_p)      # 8 字节指针
        ]

    # 3. 强行将该物理地址处的二进制数据转换为我们的 C 结构体视图
    raw_head = PyObjectStruct.from_address(obj_address)

    # 4. 打印读取结果
    print(f"  [C层肉眼观测] ob_refcnt (引用计数): {raw_head.ob_refcnt}")
    print(f"  [C层肉眼观测] ob_type   (类型地址): {hex(raw_head.ob_type)}")
    
    # 5. 验证我们的底层解剖是否百分之百准确
    print(f"  [Python验证] 标准 sys.getrefcount 结果: {sys.getrefcount(obj)}")
    print(f"  [Python验证] 标准 type(obj) 的物理地址: {hex(id(type(obj)))}")
    
    assert raw_head.ob_type == id(type(obj)), "底层类型指针判定发生严重错位！"
    print("-> 完美吻合！成功穿透解释器沙盒。")

if __name__ == "__main__":
    # 我们故意创建一个非常独特的、没有被虚拟机提前缓存的复杂字符串
    vampire_string = "Ultimate_Deep_Dive_2026_CPython_" + str(1+1)
    dissect_pyobject(vampire_string)

```

### 运行输出断言：

```text
=== 正在解剖对象，物理内存首地址: 0x104b2b930 ===
  [C层肉眼观测] ob_refcnt (引用计数): 2
  [C层肉眼观测] ob_type   (类型地址): 0x100346380
  [Python验证] 标准 sys.getrefcount 结果: 3
  [Python验证] 标准 type(obj) 的物理地址: 0x100346380
-> 完美吻合！成功穿透解释器沙盒。

```

*(注：`sys.getrefcount` 会比 C 层面读出来的大 1，是因为将对象作为参数传给 `sys.getrefcount()` 的一瞬间，函数本身的形参又让该对象临时起死回生了一次，这完全符合我们在第二章聊到的运行时机制。)*

---

### Object Internals 核心共识

| 概念实体 | 物理本质面貌 | 工业级性能启示 |
| --- | --- | --- |
| **`PyObject` 头** | 16 字节的 C 语言基础结构体。 | 只要是在 Python 层分配对象，**16 字节的基税**永远逃不掉。高频小数据必须考虑整合。 |
| **`ob_refcnt`** | 位于对象内存物理最前端的第 0~7 字节。 | 任何赋值、传参都会引发这块内存的硬件级读写（加减），它是 GIL 无法轻易抹去的根源。 |
| **`ob_type`** | 位于对象内存物理前端的第 8~15 字节。 | 指向类型对象（如 `PyBytes_Type`）。多态查找和方法绑定全靠这个指针在 C 层进行二次跳转。 |

把 `PyObject` 的物理骨架、引用计数槽、类型指针偏移彻底钉死在你的知识库里后，整个运行时里最底层的物理砖瓦已经被我们全部摸清。