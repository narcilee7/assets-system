"""
手写 mini router。

考点：
- 路由注册 → dispatch。
- 支持路径参数、中间件、404/405 处理。
- 与 WSGI/ASGI 抽象兼容。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

Handler = Callable[[dict[str, Any]], tuple[int, dict[str, str], bytes]]
Middleware = Callable[[Handler], Handler]


class Router:
    """Minimal HTTP router with path parameters and middleware."""

    def __init__(self) -> None:
        self._routes: dict[tuple[str, str], tuple[Handler, list[str]]] = {}
        self._middlewares: list[Middleware] = []
        self._not_found: Handler = lambda _env: (404, {"Content-Type": "text/plain"}, b"not found")
        self._method_not_allowed: Handler = lambda _env: (405, {"Content-Type": "text/plain"}, b"method not allowed")

    def use(self, middleware: Middleware) -> None:
        self._middlewares.append(middleware)

    def add(self, method: str, path: str, handler: Handler) -> None:
        segments = self._split(path)
        param_names: list[str] = []
        for seg in segments:
            if seg.startswith("{") and seg.endswith("}"):
                param_names.append(seg[1:-1])
        self._routes[(method.upper(), path)] = (handler, param_names)

    def get(self, path: str, handler: Handler) -> None:
        self.add("GET", path, handler)

    def post(self, path: str, handler: Handler) -> None:
        self.add("POST", path, handler)

    def dispatch(self, method: str, path: str, environ: dict[str, Any] | None = None) -> tuple[int, dict[str, str], bytes]:
        environ = environ or {}
        environ["REQUEST_METHOD"] = method
        environ["PATH_INFO"] = path

        handler, params = self._match(method.upper(), path)
        if handler is None:
            return self._not_found(environ)

        environ["router.params"] = params
        wrapped = self._wrap(handler)
        return wrapped(environ)

    def _match(self, method: str, path: str) -> tuple[Handler | None, dict[str, str]]:
        request_segments = self._split(path)
        for (route_method, route_path), (handler, param_names) in self._routes.items():
            if route_method != method:
                continue
            route_segments = self._split(route_path)
            if len(route_segments) != len(request_segments):
                continue
            params: dict[str, str] = {}
            matched = True
            for rs, ps in zip(route_segments, request_segments):
                if rs.startswith("{") and rs.endswith("}"):
                    params[rs[1:-1]] = ps
                elif rs != ps:
                    matched = False
                    break
            if matched:
                return handler, params
        return None, {}

    def _wrap(self, handler: Handler) -> Handler:
        for mw in reversed(self._middlewares):
            handler = mw(handler)
        return handler

    @staticmethod
    def _split(path: str) -> list[str]:
        return [seg for seg in path.split("/") if seg]


if __name__ == "__main__":
    router = Router()

    @router.get("/")
    def index(env):
        return 200, {"Content-Type": "text/plain"}, b"home"

    @router.get("/users/{user_id}")
    def get_user(env):
        user_id = env["router.params"]["user_id"]
        return 200, {"Content-Type": "text/plain"}, f"user {user_id}".encode()

    def json_middleware(handler):
        def wrapper(env):
            status, headers, body = handler(env)
            headers["Content-Type"] = "application/json"
            return status, headers, body
        return wrapper

    router.use(json_middleware)

    print(router.dispatch("GET", "/"))
    print(router.dispatch("GET", "/users/42"))
    print(router.dispatch("GET", "/missing"))
