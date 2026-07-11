import functools
from typing import Any, Callable, ParamSpec, Protocol, TypeVar

P = ParamSpec("P")
R = TypeVar("R")


def async_retry(retries: int = 3) -> Callable[[Callable[P, R]], Callable[P, R]]:
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            for _ in range(retries):
                try:
                    return func(*args, **kwargs)
                except Exception:
                    continue
            raise Exception("Failed to retry")

        return wrapper

    return decorator


class BaseEntity:
    def __init__(self, entity_id: str) -> None:
        self.entity_id = entity_id


class Repository[T: BaseEntity](Protocol):
    def find_by_id(self, entity_id: str) -> T | None: ...

    def save(self, entity: T) -> None: ...


class UserEntity(BaseEntity):
    def __init__(self, entity_id: str, username: str) -> None:
        super().__init__(entity_id)
        self.username = username


# 具体实现类，自动对齐泛型约束
class UserRepository:
    def __init__(self) -> None:
        self._store: dict[str, UserEntity] = {}

    def find_by_id(self, entity_id: str) -> UserEntity | None:
        return self._store.get(entity_id)

    def save(self, entity: UserEntity) -> None:
        self._store[entity.entity_id] = entity
