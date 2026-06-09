# Python pytest + Async Testing

pytest 是 Python 最强大的测试框架，async 测试需要 pytest-asyncio。

## 核心实现

```python
# test_api.py
import pytest
from httpx import AsyncClient
from myapp.main import app

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_create_user(client):
    response = await client.post("/users", json={
        "name": "Alice",
        "email": "alice@example.com",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alice"
    assert "id" in data

@pytest.mark.asyncio
async def test_get_user_not_found(client):
    response = await client.get("/users/99999")
    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"

# Mock 依赖
@pytest.fixture
async def mock_db(monkeypatch):
    class MockDB:
        async def get_user(self, id):
            return {"id": id, "name": "Mock User"}
    
    monkeypatch.setattr("myapp.service.UserRepository", MockDB)

@pytest.mark.asyncio
async def test_with_mock(client, mock_db):
    response = await client.get("/users/1")
    assert response.json()["name"] == "Mock User"
```

## Factory Boy

```python
# factories.py
import factory
from myapp.models import User

class UserFactory(factory.Factory):
    class Meta:
        model = User

    name = factory.Faker("name")
    email = factory.Faker("email")
    age = factory.Faker("random_int", min=18, max=80)

# 使用
user = UserFactory()
users = UserFactory.create_batch(10)
```
