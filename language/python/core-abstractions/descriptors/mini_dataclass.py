"""
手写简化 dataclass。

考点：
- 用类装饰器扫描类属性，自动生成 __init__、__repr__、__eq__。
- 识别 Field 描述符或简单默认值。
- 支持类型注解读取（__annotations__）。
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, TypeVar

try:
    from descriptors.field_validator import Field
except ImportError:
    # When run as a standalone script, ``descriptors`` is not on sys.path.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from field_validator import Field

T = TypeVar("T")


def mini_dataclass(cls: type[T]) -> type[T]:
    """Teaching implementation of a simplified ``dataclasses.dataclass``."""
    annotations = getattr(cls, "__annotations__", {})
    defaults: dict[str, Any] = {}

    # Collect explicit default values from class body.
    for name in list(cls.__dict__):
        if name.startswith("__"):
            continue
        value = getattr(cls, name)
        if not callable(value) and not isinstance(value, (staticmethod, classmethod, property)):
            defaults[name] = value
            if not isinstance(value, Field):
                delattr(cls, name)

    # Build __init__.
    init_params: list[str] = []
    init_body: list[str] = ["    self.__dict__.update(kwargs)"]

    for name, typ in annotations.items():
        if name in defaults:
            default = defaults[name]
            if isinstance(default, Field):
                init_params.append(f"{name}=None")
                init_body.append(f"    if {name} is not None: self.{name} = {name}")
            else:
                init_params.append(f"{name}={default!r}")
                init_body.append(f"    self.{name} = {name}")
        else:
            init_params.append(name)
            init_body.append(f"    self.{name} = {name}")

    init_source = "def __init__(self, " + ", ".join(init_params) + ", **kwargs):\n"
    init_source += "\n".join(init_body)

    namespace: dict[str, Any] = {}
    exec(init_source, namespace)
    cls.__init__ = namespace["__init__"]

    # Build __repr__.
    field_names = list(annotations.keys())
    repr_parts = ", ".join(f"{name}={{self.{name}!r}}" for name in field_names)
    repr_source = f"def __repr__(self):\n    return f\"{cls.__name__}({repr_parts})\""
    exec(repr_source, namespace)
    cls.__repr__ = namespace["__repr__"]

    # Build __eq__.
    eq_checks = " and ".join(
        f"self.{name} == other.{name}" for name in field_names
    ) or "True"
    eq_source = (
        "def __eq__(self, other):\n"
        "    if not isinstance(other, self.__class__):\n"
        "        return NotImplemented\n"
        f"    return {eq_checks}\n"
    )
    exec(eq_source, namespace)
    cls.__eq__ = namespace["__eq__"]

    return cls


if __name__ == "__main__":
    @mini_dataclass
    class Person:
        name: str
        age: int = 0

    p1 = Person("Ada", age=30)
    p2 = Person("Ada", age=30)
    print(p1)  # Person(name='Ada', age=30)
    print(p1 == p2)  # True

    @mini_dataclass
    class Config:
        host: str = "localhost"
        port: int = Field(type_=int, min_value=1, max_value=65535)

    cfg = Config(port=8080)
    print(cfg)
    try:
        cfg.port = 0
    except Exception as e:
        print("caught:", e)
