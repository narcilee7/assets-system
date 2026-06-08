# Starlette

Starlette 是轻量级 ASGI 框架，FastAPI 基于此构建。

## 核心实现

```python
# starlette_app.py
from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.responses import JSONResponse
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request

async def homepage(request):
    return JSONResponse({"hello": "world"})

async def users(request):
    return JSONResponse([{"id": 1, "name": "Alice"}])

async def create_user(request: Request):
    data = await request.json()
    return JSONResponse({"id": 2, **data}, status_code=201)

routes = [
    Route("/", homepage),
    Mount("/api", routes=[
        Route("/users", users, methods=["GET"]),
        Route("/users", create_user, methods=["POST"]),
    ]),
]

middleware = [
    Middleware(CORSMiddleware, allow_origins=["*"]),
]

app = Starlette(routes=routes, middleware=middleware)
```

## 后台任务

```python
from starlette.background import BackgroundTask

async def send_email(email: str):
    # 异步发送邮件
    pass

async def signup(request):
    data = await request.json()
    task = BackgroundTask(send_email, email=data['email'])
    return JSONResponse({"status": "ok"}, background=task)
```
