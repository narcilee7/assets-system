"""
手写字段校验描述符。

考点：
- 在 __set__ 时执行类型和范围校验。
- 把校验错误延迟到赋值时，而不是实例化时。
- 支持链式校验规则：类型、范围、正则、枚举等。
"""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any, TypeVar

T = TypeVar("T")


class ValidationError(Exception):
    """Raised when a field value fails validation."""


class Field:
    """Descriptor that validates values on assignment."""

    def __init__(
        self,
        *,
        type_: type[T] | tuple[type[T], ...] | None = None,
        min_value: Any = None,
        max_value: Any = None,
        min_len: int | None = None,
        max_len: int | None = None,
        regex: str | None = None,
        choices: tuple[Any, ...] | None = None,
        validator: Callable[[Any], bool] | None = None,
    ) -> None:
        self.type_ = type_
        self.min_value = min_value
        self.max_value = max_value
        self.min_len = min_len
        self.max_len = max_len
        self.regex = re.compile(regex) if regex is not None else None
        self.choices = choices
        self.validator = validator
        self.name = ""
        self.private_name = ""

    def __set_name__(self, owner: type, name: str) -> None:
        self.name = name
        self.private_name = f"_field_{name}"

    def __get__(self, instance: object | None, owner: type | None = None) -> Any:
        if instance is None:
            return self
        return getattr(instance, self.private_name, None)

    def __set__(self, instance: object, value: Any) -> None:
        self._validate(value)
        setattr(instance, self.private_name, value)

    def _validate(self, value: Any) -> None:
        if self.type_ is not None and not isinstance(value, self.type_):
            raise ValidationError(
                f"{self.name} must be of type {self.type_}, got {type(value).__name__}"
            )

        if self.min_value is not None and value < self.min_value:
            raise ValidationError(f"{self.name} must be >= {self.min_value}")
        if self.max_value is not None and value > self.max_value:
            raise ValidationError(f"{self.name} must be <= {self.max_value}")

        if self.min_len is not None and len(value) < self.min_len:
            raise ValidationError(f"{self.name} length must be >= {self.min_len}")
        if self.max_len is not None and len(value) > self.max_len:
            raise ValidationError(f"{self.name} length must be <= {self.max_len}")

        if self.regex is not None and not self.regex.match(value):
            raise ValidationError(f"{self.name} does not match pattern {self.regex.pattern}")

        if self.choices is not None and value not in self.choices:
            raise ValidationError(f"{self.name} must be one of {self.choices}")

        if self.validator is not None and not self.validator(value):
            raise ValidationError(f"{self.name} failed custom validation")


if __name__ == "__main__":
    class User:
        age = Field(type_=int, min_value=0, max_value=150)
        name = Field(type_=str, min_len=1, max_len=20)
        email = Field(type_=str, regex=r"^[^@]+@[^@]+$")

    u = User()
    u.age = 30
    u.name = "Ada"
    u.email = "ada@example.com"
    print(u.age, u.name, u.email)

    try:
        u.age = -1
    except ValidationError as e:
        print("caught:", e)
