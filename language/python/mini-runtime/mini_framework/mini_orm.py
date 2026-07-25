"""
手写 mini ORM。

考点：
- Model 元类/描述符定义字段。
- Query 构造器支持链式 filter、limit、order_by。
- 内存存储实现。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class Field:
    """Descriptor representing a model column."""

    def __init__(self, name: str | None = None) -> None:
        self.name = name
        self.public_name = ""

    def __set_name__(self, owner: type, name: str) -> None:
        self.public_name = name
        if self.name is None:
            self.name = name

    def __get__(self, instance: object | None, owner: type | None = None) -> Any:
        if instance is None:
            return self
        return instance.__dict__.get(self.public_name)

    def __set__(self, instance: object, value: Any) -> None:
        instance.__dict__[self.public_name] = value


@dataclass
class Query:
    """Simple query builder."""

    table: "InMemoryTable"
    filters: list[tuple[str, Any]] = field(default_factory=list)
    _limit: int | None = None
    _order_by: str | None = None
    _desc: bool = False

    def filter(self, **kwargs: Any) -> "Query":
        for key, value in kwargs.items():
            self.filters.append((key, value))
        return self

    def limit(self, n: int) -> "Query":
        self._limit = n
        return self

    def order_by(self, field: str, desc: bool = False) -> "Query":
        self._order_by = field
        self._desc = desc
        return self

    def execute(self) -> list[dict[str, Any]]:
        rows = list(self.table._rows)
        for key, value in self.filters:
            rows = [r for r in rows if r.get(key) == value]
        if self._order_by:
            rows = sorted(rows, key=lambda r: r.get(self._order_by), reverse=self._desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows


class InMemoryTable:
    """In-memory table backing a model."""

    def __init__(self) -> None:
        self._rows: list[dict[str, Any]] = []

    def insert(self, row: dict[str, Any]) -> None:
        self._rows.append(row.copy())

    def query(self) -> Query:
        return Query(self)


if __name__ == "__main__":
    users = InMemoryTable()
    users.insert({"id": 1, "name": "Ada", "age": 30})
    users.insert({"id": 2, "name": "Bob", "age": 25})
    users.insert({"id": 3, "name": "Charlie", "age": 30})

    results = users.query().filter(age=30).order_by("name").execute()
    print(results)
    # [{'id': 1, 'name': 'Ada', 'age': 30}, {'id': 3, 'name': 'Charlie', 'age': 30}]
