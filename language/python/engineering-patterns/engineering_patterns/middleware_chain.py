"""
手写 middleware chain。

考点：
- 洋葱模型：请求从外到内，响应从内到外。
- 每个 middleware 接收 handler，返回新的 handler。
- 用 reduce 或循环构建调用链。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")
R = TypeVar("R")

Middleware = Callable[[Callable[[T], R]], Callable[[T], R]]


def build_middleware_chain(
    handler: Callable[[T], R],
    *middlewares: Middleware[T, R],
) -> Callable[[T], R]:
    """Compose middlewares around a handler.

    Middlewares are applied from last to first so that the first middleware
    is the outermost layer.
    """
    for mw in reversed(middlewares):
        handler = mw(handler)
    return handler


if __name__ == "__main__":
    def logging_middleware(handler):
        def wrapper(request):
            print(f"[log] request: {request}")
            response = handler(request)
            print(f"[log] response: {response}")
            return response
        return wrapper

    def uppercase_middleware(handler):
        def wrapper(request):
            return handler(request).upper()
        return wrapper

    def app(request):
        return f"hello {request}"

    chain = build_middleware_chain(app, logging_middleware, uppercase_middleware)
    print(chain("world"))
    # [log] request: world
    # [log] response: HELLO WORLD
    # HELLO WORLD
