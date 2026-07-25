"""
手写 property 描述符。

考点：
- 描述符协议：__get__、__set__、__delete__。
- property 把 getter/setter/deleter 绑定到类属性访问。
- 实现只读 property（没有 setter 时抛 AttributeError）。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, overload


class Property:
    """Teaching implementation of ``property``."""

    def __init__(
        self,
        fget: Callable[[Any], Any] | None = None,
        fset: Callable[[Any, Any], None] | None = None,
        fdel: Callable[[Any], None] | None = None,
        doc: str | None = None,
    ) -> None:
        self.fget = fget
        self.fset = fset
        self.fdel = fdel
        self.__doc__ = doc or (fget.__doc__ if fget is not None else None)

    def __get__(self, instance: object | None, owner: type | None = None) -> Any:
        if instance is None:
            return self
        if self.fget is None:
            raise AttributeError("unreadable attribute")
        return self.fget(instance)

    def __set__(self, instance: object, value: Any) -> None:
        if self.fset is None:
            raise AttributeError("can't set attribute")
        self.fset(instance, value)

    def __delete__(self, instance: object) -> None:
        if self.fdel is None:
            raise AttributeError("can't delete attribute")
        self.fdel(instance)

    def getter(self, fget: Callable[[Any], Any]) -> "Property":
        return Property(fget, self.fset, self.fdel, self.__doc__)

    def setter(self, fset: Callable[[Any, Any], None]) -> "Property":
        return Property(self.fget, fset, self.fdel, self.__doc__)

    def deleter(self, fdel: Callable[[Any], None]) -> "Property":
        return Property(self.fget, self.fset, fdel, self.__doc__)


if __name__ == "__main__":
    class Rectangle:
        def __init__(self, width: float, height: float) -> None:
            self.width = width
            self.height = height

        @Property
        def area(self) -> float:
            return self.width * self.height

        @area.setter
        def area(self, value: float) -> None:
            scale = (value / self.area) ** 0.5
            self.width *= scale
            self.height *= scale

    r = Rectangle(2, 3)
    print(r.area)  # 6
    r.area = 24
    print(r.width, r.height)  # 4.0 6.0
