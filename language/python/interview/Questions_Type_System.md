# Python 类型系统面试题集

---

## Level 1：动态类型与鸭子类型

### 题 1：Python 是强类型还是弱类型？动态还是静态？

**答案**：
- **强类型**：不同类型之间不会隐式转换，如 `"1" + 2` 会报错。
- **动态类型**：变量类型在运行时确定，可以随时指向不同类型的对象。

```python
x = 1
x = "hello"  # 合法
"1" + 2       # TypeError
```

**考点**：
- 强类型 ≠ 静态类型。
- Python 是动态强类型语言。

---

### 题 2：什么是鸭子类型？

**答案**：
- "如果它走起来像鸭子，叫起来像鸭子，那它就是鸭子。"
- Python 不关注对象的类型，而关注对象是否有需要的方法/属性。

```python
class Duck:
    def quack(self): print("quack")

class Person:
    def quack(self): print("I can quack")

def make_it_quack(obj):
    obj.quack()

make_it_quack(Duck())
make_it_quack(Person())
```

---

## Level 2：类型提示

### 题 3：`typing.List` 和 `list` 有什么区别？

**答案**：
- Python 3.9+ 支持内置泛型：`list[int]` 等价于 `typing.List[int]`。
- `typing.List` 是为了兼容 Python 3.8 及更早版本。

**考点**：
- 类型提示是**可选的**，运行时不会检查。
- 需要用 `mypy`、`pyright` 等静态类型检查器。

---

### 题 4：`Optional[int]` 是什么意思？

**答案**：`Optional[int]` 等价于 `int | None`（Python 3.10+）。

```python
def find(items: list[int], target: int) -> int | None:
    return target if target in items else None
```

---

## Level 3：Protocol 与结构子类型

### 题 5：什么是 Protocol？

**答案**：
- `typing.Protocol` 定义一个接口，只要类实现了接口要求的方法，就视为该接口的子类型。
- 这是 Python 的**结构子类型**（structural subtyping），与 nominal subtyping（显式继承）相对。

```python
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None: ...

class Circle:
    def draw(self) -> None:
        print("circle")

def render(obj: Drawable) -> None:
    obj.draw()

render(Circle())  # 通过，因为 Circle 有 draw 方法
```

---

## Level 4：泛型

### 题 6：`TypeVar` 的作用是什么？

**答案**：
- `TypeVar` 定义类型变量，用于泛型函数和泛型类。

```python
from typing import TypeVar

T = TypeVar("T")

def first(items: list[T]) -> T | None:
    return items[0] if items else None
```

**考点**：
- `T` 是占位符，类型推断器会根据实际参数推断。
- 可以给 `TypeVar` 加约束：`T = TypeVar("T", int, float)`。

---

### 题 7：`Generic[T]` 和 `TypeVar` 结合使用？

```python
from typing import Generic, TypeVar

T = TypeVar("T")

class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()
```

---

## Level 5：运行时类型检查

### 题 8：`isinstance` 和 `type()` 的区别？

**答案**：
- `isinstance(obj, cls)`：考虑继承关系。
- `type(obj) == cls`：不考虑继承，严格匹配。

```python
class Animal: pass
class Dog(Animal): pass

d = Dog()
print(isinstance(d, Animal))  # True
print(type(d) == Animal)      # False
```

**考点**：
- 多态场景下应使用 `isinstance`。
- `type()` 严格匹配在需要精确类型时使用。

---

### 题 9：`typing.cast` 有什么用？

**答案**：
- `cast(T, value)` 是给类型检查器的提示，告诉它把 `value` 当作类型 `T`。
- 运行时不做任何转换或检查。

```python
from typing import cast

x: object = "hello"
s = cast(str, x)  # 类型检查器认为 s 是 str
```

---

## 类型系统速查卡

| 考点 | 一句话 | 陷阱 |
|------|--------|------|
| 鸭子类型 | 看行为不看类型 | 没有接口也能用 |
| 类型提示 | 静态检查，运行时不生效 | 认为加了类型就安全 |
| Protocol | 结构子类型 | 需要静态检查器识别 |
| TypeVar | 泛型占位符 | 约束写错导致推断失败 |
| isinstance | 考虑继承 | 与 `type()` 混淆 |
| cast | 只影响类型检查 | 运行时不检查 |

---
