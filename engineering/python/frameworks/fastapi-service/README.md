# FastAPI Service

FastAPI 是现代 Python Web 框架的标杆：基于 Starlette（ASGI）、原生 async、自动生成 OpenAPI、Pydantic 类型校验。

## 核心实现

```python
# main.py
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
import uuid

app = FastAPI(
    title="Order API",
    version="1.0.0",
    docs_url="/docs",
)

# 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 请求模型
class CreateOrderRequest(BaseModel):
    product_id: str = Field(..., min_length=1)
    quantity: int = Field(..., ge=1)
    note: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    product_id: str
    quantity: int
    status: str

# 内存存储（实际项目用数据库）
orders_db = {}

# 依赖注入
async def get_current_user(token: str = Depends(lambda: "user-123")):
    return {"id": token, "name": "Alice"}

# 路由
@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    req: CreateOrderRequest,
    user: dict = Depends(get_current_user),
):
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "product_id": req.product_id,
        "quantity": req.quantity,
        "status": "pending",
        "user_id": user["id"],
    }
    orders_db[order_id] = order
    return order

@app.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str):
    order = orders_db.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"code": "INTERNAL_ERROR", "message": str(exc)},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## 异步数据库

```python
# database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "postgresql+asyncpg://user:pass@localhost/db"

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# 在路由中使用
@app.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()
```

## FastAPI vs Django vs Flask

| 维度 | FastAPI | Django | Flask |
| --- | --- | --- | --- |
| 异步支持 | 原生 | Django 4.2+ | 需扩展 |
| 类型校验 | Pydantic（自动） | 手动/DRF | 手动 |
| 自动生成文档 | ✅ OpenAPI | 需 DRF | 需扩展 |
| 生态 | 增长最快 | 最丰富 | 成熟 |
| ORM | SQLAlchemy/任意 | Django ORM | SQLAlchemy |
| 适用 | API 服务、微服务 | 全栈、CMS | 轻量服务 |
| 学习曲线 | 低 | 高 | 低 |

> API 服务首选 FastAPI；全栈/后台管理选 Django；原型/简单服务选 Flask。
