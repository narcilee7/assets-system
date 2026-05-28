from __future__ import annotations

from types import BuiltinFunctionType, FunctionType, ModuleType
from typing import Any

_ATOMIC_TYPES = (type(None), bool, int, float, complex, str, bytes, range)
_RETURN_AS_IS_TYPES = (FunctionType, BuiltinFunctionType, type, ModuleType)

def _iter_slots(cls: type) -> list[str]:
    slots: list[str] = []
    for base in cls.__mro__:
        raw_slots = getattr(base, '__slots__', ())
        if isinstance(raw_slots, str):
            raw_slots = (raw_slots,)
        for slot in raw_slots:
            if slot not in {"__dict__", "__weakref__"}:
                slots.append(slot)
    return slots

def deep_cv(obj: Any, memo: dict[int, Any] | None = None) -> Any:
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
        copied_list: list[Any] = []
        memo[obj_id] = copied_list
        copied_list.extend(deep_cv(item, memo) for item in obj)
        return copied_list
    
    if isinstance(obj, dict):
        copied_dict: dict[Any, Any] = {}
        memo[obj_id] = copied_dict
        for key, value in obj.items():
            copied_dict[deep_cv(key, memo)] = deep_cv(value, memo)
        return copied_dict
    
    if isinstance(obj, set):
        copied_set: set[Any] = set()
        memo[obj_id] = copied_set
        for item in obj:
            copied_set.add(deep_cv(item, memo))
        return copied_set
    
    if isinstance(obj, tuple):
        copied_tuple: tuple[Any, ...] = tuple(deep_cv(item, memo) for item in obj)
        memo[obj_id] = copied_tuple
        return copied_tuple
    
    cls = obj.__class__
    copied = cls.__new__(cls)
    memo[obj_id] = copied
    
    if hasattr(obj, '__dict__'):
        copied.__dict__.update(deep_cv(obj.__dict__, memo))

    for slot in _iter_slots(cls):
        if hasattr(obj, slot):
            setattr(copied, slot, deep_cv(getattr(obj, slot), memo))

    return copied

deepcopy = deep_cv

if __name__ == '__name__':
    data: list[Any] = [1, {"name": "python"}]
    data.append(data)

    copied_data = deepcopy(data)
    print(copied_data)
    print(copied_data is data)
    print(copied_data[2] is copied_data)