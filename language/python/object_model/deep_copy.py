"""
手写 deep_copy。

考点：
- 不可变对象可以直接复用。
- 可变容器需要递归复制。
- 用 memo 记录已经复制过的对象，解决循环引用并保留共享引用关系。
"""

from __future__ import annotations

from types import BuiltinFunctionType, FunctionType, ModuleType
from typing import Any


_ATOMIC_TYPES = (type(None), bool, int, float, complex, str, bytes, range)
_RETURN_AS_IS_TYPES = (FunctionType, BuiltinFunctionType, type, ModuleType)


def deep_copy(obj: Any, memo: dict[int, Any] | None = None) -> Any:
    """Return a recursive copy of ``obj``.

    This is a teaching implementation, not a full replacement for
    ``copy.deepcopy``. It covers the common interview cases: builtin
    containers, custom objects, shared references, and circular references.
    """

    if isinstance(obj, _ATOMIC_TYPES):
        return obj

    if isinstance(obj, _RETURN_AS_IS_TYPES):
        return obj

    if memo is None:
        memo = {}

    obj_id = id(obj)
    if obj_id in memo:
        return memo[obj_id]

    if isinstance(obj, list):
        copied: list[Any] = []
        memo[obj_id] = copied
        copied.extend(deep_copy(item, memo) for item in obj)
        return copied

    if isinstance(obj, dict):
        copied: dict[Any, Any] = {}
        memo[obj_id] = copied
        for key, value in obj.items():
            copied[deep_copy(key, memo)] = deep_copy(value, memo)
        return copied

    if isinstance(obj, set):
        copied: set[Any] = set()
        memo[obj_id] = copied
        for item in obj:
            copied.add(deep_copy(item, memo))
        return copied

    if isinstance(obj, tuple):
        copied = tuple(deep_copy(item, memo) for item in obj)
        memo[obj_id] = copied
        return copied

    cls = obj.__class__
    copied = cls.__new__(cls)
    memo[obj_id] = copied

    if hasattr(obj, "__dict__"):
        copied.__dict__.update(deep_copy(obj.__dict__, memo))

    for slot in _iter_slots(cls):
        if hasattr(obj, slot):
            setattr(copied, slot, deep_copy(getattr(obj, slot), memo))

    return copied


def _iter_slots(cls: type) -> list[str]:
    slots: list[str] = []
    for base in cls.__mro__:
        raw_slots = getattr(base, "__slots__", ())
        if isinstance(raw_slots, str):
            raw_slots = (raw_slots,)
        for slot in raw_slots:
            if slot not in {"__dict__", "__weakref__"}:
                slots.append(slot)
    return slots


deepcopy = deep_copy


if __name__ == "__main__":
    data: list[Any] = [1, {"name": "python"}]
    data.append(data)

    copied_data = deep_copy(data)
    print(copied_data)
    print(copied_data is data)
    print(copied_data[2] is copied_data)
