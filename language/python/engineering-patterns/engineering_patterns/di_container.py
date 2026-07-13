"""
手写 DI Container。

考点：
- 注册类型/工厂到容器。
- 按签名自动解析依赖（constructor injection）。
- 支持单例和 transient 生命周期。
"""

from __future__ import annotations

import inspect
from collections.abc import Callable
from enum import Enum, auto
from typing import Any, TypeVar

T = TypeVar("T")


class Lifetime(Enum):
    TRANSIENT = auto()
    SINGLETON = auto()


class DIContainer:
    """Minimal dependency injection container."""

    def __init__(self) -> None:
        self._registrations: dict[type, tuple[Lifetime, Callable[[], Any]]] = {}
        self._singletons: dict[type, Any] = {}

    def register(
        self,
        interface: type[T],
        factory: Callable[..., T] | type[T],
        *,
        lifetime: Lifetime = Lifetime.TRANSIENT,
    ) -> None:
        def factory_wrapper() -> T:
            return self._construct(factory)

        self._registrations[interface] = (lifetime, factory_wrapper)

    def resolve(self, interface: type[T]) -> T:
        if interface not in self._registrations:
            # Auto-registration: treat interface as a concrete type.
            return self._construct(interface)

        lifetime, factory = self._registrations[interface]
        if lifetime == Lifetime.SINGLETON:
            if interface not in self._singletons:
                self._singletons[interface] = factory()
            return self._singletons[interface]

        return factory()

    def _construct(self, cls: Callable[..., T]) -> T:
        if not inspect.isclass(cls) and not callable(cls):
            raise TypeError(f"Cannot construct {cls!r}")

        try:
            signature = inspect.signature(cls)
        except ValueError:
            return cls()

        kwargs: dict[str, Any] = {}
        for name, param in signature.parameters.items():
            if param.default is not inspect.Parameter.empty:
                continue
            annotation = param.annotation
            if annotation is inspect.Parameter.empty:
                raise ValueError(f"Cannot resolve parameter {name!r} of {cls!r}")
            kwargs[name] = self.resolve(annotation)

        return cls(**kwargs)


if __name__ == "__main__":
    class Database:
        def __init__(self, url: str = "sqlite://") -> None:
            self.url = url

    class UserService:
        def __init__(self, db: Database) -> None:
            self.db = db

    container = DIContainer()
    container.register(Database, Database, lifetime=Lifetime.SINGLETON)
    container.register(UserService, UserService)

    service = container.resolve(UserService)
    print(service.db.url)
