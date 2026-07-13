"""
手写 mini FastAPI。

考点：
- 在 router 基础上增加依赖注入、JSON 请求体解析、响应模型。
- 用类型注解做参数绑定。
- 支持 Pydantic-style dataclass 响应模型。
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, get_type_hints

try:
    from mini_framework.mini_router import Handler, Middleware, Router
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from mini_router import Handler, Middleware, Router


class MiniFastAPI:
    """Minimal FastAPI-like framework built on top of ``Router``."""

    def __init__(self) -> None:
        self._router = Router()

    def get(self, path: str, handler: Handler | None = None) -> Callable[[Handler], Handler] | None:
        return self._route("GET", path, handler)

    def post(self, path: str, handler: Handler | None = None) -> Callable[[Handler], Handler] | None:
        return self._route("POST", path, handler)

    def _route(self, method: str, path: str, handler: Handler | None = None) -> Callable[[Handler], Handler] | None:
        if handler is not None:
            self._router.add(method, path, handler)
            return None

        def decorator(handler: Handler) -> Handler:
            self._router.add(method, path, handler)
            return handler
        return decorator

    def use(self, middleware: Middleware) -> None:
        self._router.use(middleware)

    def dispatch(self, method: str, path: str, body: bytes = b"", environ: dict[str, Any] | None = None) -> tuple[int, dict[str, str], bytes]:
        environ = environ or {}
        if body:
            try:
                environ["json.body"] = json.loads(body.decode())
            except (json.JSONDecodeError, UnicodeDecodeError):
                return 400, {"Content-Type": "application/json"}, b'{"error":"invalid json"}'
        return self._router.dispatch(method, path, environ)


def json_response(model: Any) -> tuple[int, dict[str, str], bytes]:
    """Serialize a dataclass/dict to JSON response."""
    if hasattr(model, "__dataclass_fields__"):
        data = asdict(model)
    else:
        data = model
    return 200, {"Content-Type": "application/json"}, json.dumps(data).encode()


def depends(factory: Callable[..., Any]) -> Any:
    """Marker for dependency injection (simplified)."""
    return Depends(factory)


class Depends:
    def __init__(self, factory: Callable[..., Any]) -> None:
        self.factory = factory


if __name__ == "__main__":
    app = MiniFastAPI()

    @dataclass
    class User:
        id: int
        name: str

    @app.get("/users/{user_id}")
    def get_user(env):
        user_id = int(env["router.params"]["user_id"])
        return json_response(User(id=user_id, name="Ada"))

    @app.post("/users")
    def create_user(env):
        body = env.get("json.body", {})
        return json_response({"created": body})

    print(app.dispatch("GET", "/users/1"))
    print(app.dispatch("POST", "/users", body=b'{"name":"Bob"}'))
