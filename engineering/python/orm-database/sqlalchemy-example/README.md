# SQLAlchemy

SQLAlchemy 是 Python 生态最强大的数据库工具集，分为 ORM 层和 Core 层。

## 核心实现

```python
# models.py
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, Session
from datetime import datetime
import enum

Base = declarative_base()

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    balance = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    orders = relationship("Order", back_populates="user")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="orders")
```

## 同步版本

```python
# sync_db.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine("postgresql://user:pass@localhost/db")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 依赖注入（FastAPI 风格）
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# CRUD
class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    # 事务
    def transfer(self, user_id: int, amount: float) -> Order:
        user = self.db.query(User).filter(User.id == user_id).with_for_update().first()
        if not user or user.balance < amount:
            raise ValueError("Insufficient balance")

        user.balance -= amount
        order = Order(user_id=user_id, amount=amount, status=OrderStatus.PAID)
        self.db.add(order)
        self.db.commit()
        self.db.refresh(order)
        return order
```

## 异步版本（SQLAlchemy 2.0+）

```python
# async_db.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

async_engine = create_async_engine("postgresql+asyncpg://user:pass@localhost/db")
AsyncSessionLocal = async_sessionmaker(async_engine, class_=AsyncSession)

async def get_async_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

class AsyncUserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user: User) -> User:
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
```

## SQLAlchemy vs Django ORM vs Prisma

| 维度 | SQLAlchemy | Django ORM | Prisma Python |
| --- | --- | --- | --- |
| 灵活性 | 极高 | 中 | 中 |
| 框架绑定 | 无 | Django 专属 | 无 |
| 异步 | 2.0+ 原生 | 4.2+ | 原生 |
| 类型安全 | 一般 | 一般 | 强（生成） |
| 适用 | 通用 | Django 项目 | 新项目 |
