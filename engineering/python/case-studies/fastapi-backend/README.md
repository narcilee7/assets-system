# Python FastAPI Backend Case Study

一个完整的 FastAPI 后端案例，演示异步架构、SQLAlchemy 2.0、Celery、测试和部署。

## 技术栈

| 层 | 技术 |
| --- | --- |
| API | FastAPI + Pydantic v2 |
| ORM | SQLAlchemy 2.0 (async) |
| Cache | Redis |
| Queue | Celery |
| Auth | JWT + OAuth2 |
| Test | pytest + httpx + factory_boy |
| Deploy | Docker + Uvicorn |

## 项目结构

```
app/
  __init__.py
  main.py           # FastAPI 入口
  config.py         # 配置
  models.py         # SQLAlchemy 模型
  schemas.py        # Pydantic 模型
  crud.py           # 数据库操作
  api/
    deps.py         # 依赖注入
    v1/
      users.py      # 用户路由
      orders.py     # 订单路由
  core/
    security.py     # JWT
    exceptions.py   # 自定义异常
tests/
  conftest.py       # pytest fixtures
  test_users.py
  test_orders.py
celery_app.py       # Celery 配置
```

## 核心代码

```python
# app/main.py
from fastapi import FastAPI
from app.api.v1 import users, orders

app = FastAPI(title="E-commerce API", version="1.0.0")

app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["orders"])

@app.get("/health")
async def health():
    return {"status": "ok"}
```

```python
# app/models.py
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Float, ForeignKey, DateTime
from datetime import datetime
from typing import List

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    orders: Mapped[List["Order"]] = relationship(back_populates="user")

class Order(Base):
    __tablename__ = "orders"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[float]
    status: Mapped[str] = mapped_column(default="pending")
    
    user: Mapped["User"] = relationship(back_populates="orders")
```

```python
# app/api/v1/orders.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app import crud, schemas
from app.api.deps import get_db, get_current_user

router = APIRouter()

@router.post("/", response_model=schemas.Order)
async def create_order(
    order_in: schemas.OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await crud.order.create(db, obj_in=order_in, user_id=current_user.id)

@router.get("/{order_id}", response_model=schemas.Order)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
):
    order = await crud.order.get(db, id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
```
