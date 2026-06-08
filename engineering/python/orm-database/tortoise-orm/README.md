# Tortoise ORM

Tortoise ORM 是专为 asyncio 设计的 Python ORM，类似 Django ORM 的 API。

## 核心实现

```python
# models.py
from tortoise import Model, fields

class User(Model):
    id = fields.IntField(pk=True)
    email = fields.CharField(max_length=255, unique=True)
    name = fields.CharField(max_length=100)
    created_at = fields.DatetimeField(auto_now_add=True)
    
    orders: fields.ReverseRelation["Order"]
    
    class Meta:
        table = "users"

class Order(Model):
    id = fields.IntField(pk=True)
    amount = fields.FloatField()
    status = fields.CharField(max_length=20, default="pending")
    user = fields.ForeignKeyField("models.User", related_name="orders")

# 初始化
db_url = "postgres://user:pass@localhost:5432/mydb"

async def init():
    await Tortoise.init(
        db_url=db_url,
        modules={"models": ["models"]}
    )
    await Tortoise.generate_schemas()

# 使用
async def create_user():
    user = await User.create(email="alice@example.com", name="Alice")
    
    # 查询
    users = await User.filter(age__gte=18).order_by("-created_at")
    
    # 关联
    orders = await user.orders.all()
    
    # 预加载
    users_with_orders = await User.all().prefetch_related("orders")
    
    # 聚合
    from tortoise.functions import Count, Sum
    result = await Order.annotate(total=Sum("amount")).values("total")
```

## 与 FastAPI 集成

```python
from fastapi import FastAPI
from tortoise.contrib.fastapi import register_tortoise

app = FastAPI()

register_tortoise(
    app,
    db_url=db_url,
    modules={"models": ["models"]},
    generate_schemas=True,
    add_exception_handlers=True,
)
```
