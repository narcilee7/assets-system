# Python httpx Testing

httpx 是 Python 的现代异步 HTTP 客户端，也是 FastAPI 测试的首选。

## 异步测试

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
```

## Mock 外部 HTTP 调用

```python
# test_external.py
import respx
from httpx import Response

@respx.mock
def test_call_external_api():
    # Mock API 响应
    route = respx.get("https://api.example.com/users/1").mock(
        return_value=Response(200, json={"id": 1, "name": "Alice"})
    )
    
    result = my_service.fetch_user(1)
    
    assert result["name"] == "Alice"
    assert route.called

# Mock 失败场景
@respx.mock
def test_api_failure():
    respx.get("https://api.example.com/users/1").mock(
        return_value=Response(500)
    )
    
    with pytest.raises(ExternalAPIError):
        my_service.fetch_user(1)
```

## pytest-asyncio 配置

```python
# conftest.py
import pytest

@pytest.fixture(scope="session")
def event_loop():
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
```
