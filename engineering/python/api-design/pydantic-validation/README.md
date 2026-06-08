# Pydantic Validation

Pydantic 是 Python 生态的类型验证之王，FastAPI 的核心依赖。

## 核心特性

```python
# pydantic_features.py
from pydantic import BaseModel, Field, validator, root_validator, EmailStr, HttpUrl
from typing import Optional, List
from datetime import datetime

class Address(BaseModel):
    street: str
    city: str
    zip: str = Field(..., regex=r"^\d{5}$")

class User(BaseModel):
    id: int
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    age: Optional[int] = Field(None, ge=0, le=150)
    website: Optional[HttpUrl] = None
    address: Optional[Address] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        orm_mode = True  # 支持从 ORM 对象转换
        validate_assignment = True  # 赋值时验证

    @validator('name')
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()

    @root_validator
    def check_age_for_adult_content(cls, values):
        age = values.get('age')
        tags = values.get('tags', [])
        if age and age < 18 and 'adult' in tags:
            raise ValueError('Minors cannot have adult content')
        return values

# 使用
user = User(id=1, name="Alice", email="alice@example.com", age=25)
print(user.json())  # JSON 序列化
print(user.dict())  # Dict 转换

# 从 dict 解析
data = {"id": 2, "name": "Bob", "email": "bob@example.com", "age": "30"}
user2 = User(**data)  # age 自动从 str 转 int
```

## Pydantic v2 升级

```python
# pydantic_v2.py
from pydantic import BaseModel, field_validator, model_validator

class Order(BaseModel):
    product_id: str
    quantity: int

    @field_validator('quantity')
    @classmethod
    def quantity_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('Quantity must be positive')
        return v

    @model_validator(mode='after')
    def check_total(self):
        if self.quantity > 100:
            raise ValueError('Quantity cannot exceed 100')
        return self
```

## 与 FastAPI 集成

```python
# fastapi_integration.py
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float

@app.post("/items")
async def create_item(item: Item):
    # FastAPI 自动：解析 JSON → 验证 → 转换为 Item 对象
    return {"item": item, "total": item.price * 1.08}
```
