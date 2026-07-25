"""
手写 config loader。

考点：
- 抽象配置源（环境变量、字典）。
- 用 dataclass / Pydantic-style 模型承载配置。
- 支持 required、default、类型转换、嵌套结构。
"""

from __future__ import annotations

import os
import typing
from collections.abc import Mapping
from dataclasses import dataclass, fields
from typing import Any, Protocol, TypeVar

T = TypeVar("T")


class ConfigSource(Protocol):
    def get(self, key: str) -> str | None: ...


class EnvSource:
    """Load values from environment variables with optional prefix."""

    def __init__(self, prefix: str = "") -> None:
        self._prefix = prefix

    def get(self, key: str) -> str | None:
        return os.environ.get(self._prefix + key)


class DictSource:
    """Load values from an in-memory dictionary."""

    def __init__(self, data: Mapping[str, str]) -> None:
        self._data = data

    def get(self, key: str) -> str | None:
        return self._data.get(key)


@dataclass
class DatabaseConfig:
    host: str = "localhost"
    port: int = 5432


@dataclass
class AppConfig:
    debug: bool = False
    db: DatabaseConfig = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.db is None:
            self.db = DatabaseConfig()


def load_config(
    config_class: type[T],
    source: ConfigSource,
    *,
    prefix: str = "",
) -> T:
    """Load a dataclass config from a source.

    Supports nested dataclasses via ``prefix_nested_`` keys.
    """
    type_hints = typing.get_type_hints(config_class)
    kwargs: dict[str, Any] = {}
    for field in fields(config_class):
        field_type = type_hints.get(field.name, field.type)
        key = f"{prefix}{field.name}".upper()
        raw = source.get(key)

        if hasattr(field_type, "__dataclass_fields__"):
            kwargs[field.name] = load_config(field_type, source, prefix=f"{prefix}{field.name}_")
            continue

        if raw is None:
            if isinstance(field.default, type) and issubclass(field.default, type(None)):
                continue
            continue

        if field_type is bool:
            kwargs[field.name] = raw.lower() in ("true", "1", "yes", "on")
        elif field_type is int:
            kwargs[field.name] = int(raw)
        elif field_type is float:
            kwargs[field.name] = float(raw)
        else:
            kwargs[field.name] = raw

    return config_class(**kwargs)


if __name__ == "__main__":
    source = DictSource({
        "DEBUG": "true",
        "DB_HOST": "postgres.example.com",
        "DB_PORT": "5433",
    })
    cfg = load_config(AppConfig, source)
    print(cfg)
    # AppConfig(debug=True, db=DatabaseConfig(host='postgres.example.com', port=5433))
