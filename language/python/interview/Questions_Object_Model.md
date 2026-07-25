# Python 对象模型面试题集

---

## Level 1：名字绑定与引用语义

### 题 1：变量是盒子还是标签？

```python
a = [1, 2, 3]
b = a
b.append(4)
print(a)  # ?
```

**答案**：`[1, 2, 3, 4]`。

**解析**：Python 中变量是指向对象的**引用（标签）**，不是装值的盒子。`b = a` 让 `b` 和 `a` 指向同一个列表对象，因此通过 `b` 修改会影响 `a`。

**考点**：
- 赋值不会复制对象，只是复制引用。
- 可变对象和不可变对象的行为差异。

---

### 题 2：`is` 与 `==` 的区别？

```python
a = 1000
b = 1000
print(a == b)  # ?
print(a is b)  # ?

c = 10
d = 10
print(c is d)  # ?
```

**答案**：`True, False, True`（通常情况下）。

**解析**：
- `==` 调用 `__eq__`，比较值是否相等。
- `is` 比较对象标识（内存地址），即 `id(a) == id(b)`。
- 小整数（通常 `-5 ~ 256`）会被 CPython 缓存复用，所以 `c is d` 为 `True`。

**考点**：
- 不要用 `is` 比较值，除非比较 `None`、`True`、`False` 等单例。
- 整数驻留是 CPython 实现细节，不可依赖。

---

### 题 3：参数传递是值传递还是引用传递？

```python
def foo(x):
    x.append(1)

a = []
foo(a)
print(a)  # ?


def bar(x):
    x = x + [1]

b = []
bar(b)
print(b)  # ?
```

**答案**：`[1]` 和 `[]`。

**解析**：
- Python 是 **"按对象引用传递"**（call by object reference）。
- `foo(a)` 中 `x` 和 `a` 指向同一个列表，`x.append(1)` 修改原对象。
- `bar(b)` 中 `x = x + [1]` 创建新列表并重新绑定局部变量 `x`，不影响 `b`。

**考点**：
- 能否修改传入对象取决于对象是否可变，以及操作是原地修改还是新建对象。

---

## Level 2：可变与不可变

### 题 4：哪些类型是不可变的？

**答案**：
- 不可变：`int`, `float`, `str`, `bytes`, `tuple`, `frozenset`。
- 可变：`list`, `dict`, `set`, `bytearray`, 大多数自定义对象。

**追问**：`tuple` 里的元素可变，这个 tuple 还算不可变吗？

**答案**：
- `tuple` 本身不可变：不能增删元素，不能重新赋值某个位置。
- 但如果 tuple 里存的是可变对象（如列表），列表内容可以改变。
- 这称为 **"浅不可变"**。

---

### 题 5：默认参数陷阱

```python
def append_item(item, lst=[]):
    lst.append(item)
    return lst

print(append_item(1))
print(append_item(2))
```

**答案**：`[1]` 和 `[1, 2]`。

**解析**：
- 默认参数在函数定义时求值，且只创建一次。
- 如果默认参数是可变对象，所有调用共享同一个对象。
- 修正：`def append_item(item, lst=None):` 并在函数体内 `if lst is None: lst = []`。

**考点**：
- 默认参数只初始化一次。
- 永远不要用可变对象作为默认参数。

---

## Level 3：拷贝

### 题 6：浅拷贝与深拷贝

```python
import copy
a = [[1], [2]]
b = copy.copy(a)
c = copy.deepcopy(a)
b[0].append(3)
print(a)  # ?
print(c)  # ?
```

**答案**：`[[1, 3], [2]]` 和 `[[1], [2]]`。

**解析**：
- `copy.copy`（浅拷贝）创建新容器，但元素仍引用原对象。`b[0]` 和 `a[0]` 指向同一个子列表。
- `copy.deepcopy` 递归复制所有对象，完全独立。

**考点**：
- 浅拷贝 vs 深拷贝的差异。
- 面试常考自定义对象的 `__copy__` / `__deepcopy__`。

---

### 题 7：实现一个深拷贝

见 `runtime-model/object_model/deep_copy.py`。

核心要点：
1. 不可变原子类型直接复用。
2. 可变容器递归复制。
3. 用 `memo` 处理循环引用和共享引用。
4. 支持 `__dict__` 和 `__slots__`。

---

## Level 4：描述符与属性访问

### 题 8：`property` 的原理是什么？

**答案**：`property` 是一个**数据描述符**（data descriptor），实现了 `__get__`、`__set__`、`__delete__`。

**解析**：
- 属性查找顺序：`obj.__dict__` → 类 → 父类 MRO。
- 如果类属性是描述符，实例属性访问会被描述符拦截。
- `property` 把 `fget/fset/fdel` 绑定到属性访问上。

**考点**：
- 描述符是 Python 属性系统的核心。
- `property` 比 Java 的 getter/setter 更简洁，但原理相同。

---

### 题 9：`__getattr__`、`__getattribute__`、`__setattr__` 的调用顺序？

**答案**：
- `__getattribute__`：所有属性访问都会先调用它。
- `__getattr__`：只有在 `__getattribute__` 抛 `AttributeError` 时才调用。
- `__setattr__`：所有属性赋值都会调用它。

**解析**：
- 在 `__getattribute__` / `__setattr__` 内部访问属性时，必须用 `object.__getattribute__` 或 `super().__getattribute__`，否则会无限递归。

```python
class C:
    def __getattribute__(self, name):
        print("get", name)
        return object.__getattribute__(self, name)
```

---

## Level 5：元类与类创建

### 题 10：`type` 和 `class` 的关系？

**答案**：
- 所有类都是 `type` 的实例。
- `type` 本身也是类，所以 `type` 是 `type` 的实例。

```python
class Foo: pass
print(type(Foo))   # <class 'type'>
print(type(type))  # <class 'type'>
```

**考点**：
- Python 的"一切皆对象"哲学。
- 类是对象，`type` 是元类。

---

## 对象模型速查卡

| 考点 | 一句话 | 陷阱 |
|------|--------|------|
| 变量 | 变量是引用，不是盒子 | `a = b` 不复制对象 |
| `is` vs `==` | `is` 比地址，`==` 比值 | 用 `is` 比较值 |
| 参数传递 | 按对象引用传递 | 可变对象在函数内可被修改 |
| 默认参数 | 函数定义时求值 | 可变默认参数共享 |
| 拷贝 | 浅拷贝复制容器，深拷贝递归复制 | 循环引用、共享引用 |
| 描述符 | 拦截属性访问 | `__getattr__` 只在失败时调用 |
| 元类 | `type` 创建类 | 类的类是 `type` |

---
