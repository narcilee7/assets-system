"""
手写 Repository 模式。

考点：
- 抽象数据访问层，业务逻辑不依赖具体存储。
- 提供内存实现方便测试。
- 用 Protocol 或抽象基类表达接口。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")
ID = TypeVar("ID")


class Repository(ABC, Generic[T, ID]):
    """Abstract repository for entity type ``T`` keyed by ``ID``."""

    @abstractmethod
    def get(self, id: ID) -> T | None: ...

    @abstractmethod
    def add(self, entity: T) -> None: ...

    @abstractmethod
    def remove(self, id: ID) -> None: ...

    @abstractmethod
    def list(self) -> list[T]: ...


@dataclass  # type: ignore[misc]
class User:
    id: int
    name: str


class InMemoryUserRepository(Repository[User, int]):
    def __init__(self) -> None:
        self._users: dict[int, User] = {}

    def get(self, id: int) -> User | None:
        return self._users.get(id)

    def add(self, entity: User) -> None:
        self._users[entity.id] = entity

    def remove(self, id: int) -> None:
        self._users.pop(id, None)

    def list(self) -> list[User]:
        return list(self._users.values())


if __name__ == "__main__":
    repo = InMemoryUserRepository()
    repo.add(User(1, "Ada"))
    repo.add(User(2, "Bob"))
    print(repo.get(1))
    print(repo.list())
