"""
手写 Unit of Work。

考点：
- 聚合多个 Repository 操作，统一提交/回滚。
- 用上下文管理器保证事务边界。
- 内存实现用于测试。
"""

from __future__ import annotations

from collections.abc import Callable
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Generator


@dataclass
class User:
    id: int
    name: str


class UnitOfWork:
    """In-memory unit of work with commit/rollback semantics."""

    def __init__(self) -> None:
        self._users: dict[int, User] = {}
        self._pending: list[Callable[[], None]] = []

    def register_add(self, user: User) -> None:
        self._pending.append(lambda: self._users.__setitem__(user.id, user))

    def register_remove(self, user_id: int) -> None:
        self._pending.append(lambda: self._users.pop(user_id, None))

    def commit(self) -> None:
        for action in self._pending:
            action()
        self._pending.clear()

    def rollback(self) -> None:
        self._pending.clear()

    def get_user(self, user_id: int) -> User | None:
        return self._users.get(user_id)

    def list_users(self) -> list[User]:
        return list(self._users.values())


@contextmanager
def uow_context() -> Generator[UnitOfWork, Any, None]:
    uow = UnitOfWork()
    try:
        yield uow
        uow.commit()
    except Exception:
        uow.rollback()
        raise


if __name__ == "__main__":
    with uow_context() as uow:
        uow.register_add(User(1, "Ada"))
        uow.register_add(User(2, "Bob"))
    print(uow.list_users())

    try:
        with uow_context() as uow:
            uow.register_add(User(3, "Charlie"))
            raise ValueError("boom")
    except ValueError:
        pass
    print(uow.list_users())  # Charlie not present
