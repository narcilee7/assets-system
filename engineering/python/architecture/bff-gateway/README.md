# Python BFF Gateway

BFF（Backend for Frontend）模式为不同客户端（Web、Mobile、Admin）提供定制化 API。

## FastAPI BFF 实现

```python
# bff_gateway.py
from fastapi import FastAPI, HTTPException
import httpx

app = FastAPI()

USER_SERVICE = "http://user-service:8000"
ORDER_SERVICE = "http://order-service:8000"
INVENTORY_SERVICE = "http://inventory-service:8000"

@app.get("/api/mobile/dashboard")
async def mobile_dashboard(user_id: int):
    """移动端仪表盘：精简数据，优化加载"""
    async with httpx.AsyncClient() as client:
        user, orders = await asyncio.gather(
            client.get(f"{USER_SERVICE}/users/{user_id}"),
            client.get(f"{ORDER_SERVICE}/users/{user_id}/orders?limit=5"),
        )
    
    return {
        "user": user.json(),
        "recent_orders": orders.json(),
        # 移动端不需要完整商品信息
    }

@app.get("/api/admin/dashboard")
async def admin_dashboard():
    """管理后台：完整数据，支持筛选和分页"""
    async with httpx.AsyncClient() as client:
        users, orders, inventory = await asyncio.gather(
            client.get(f"{USER_SERVICE}/users?limit=100"),
            client.get(f"{ORDER_SERVICE}/orders?status=pending"),
            client.get(f"{INVENTORY_SERVICE}/low-stock"),
        )
    
    return {
        "users": users.json(),
        "pending_orders": orders.json(),
        "low_stock_items": inventory.json(),
    }

# 统一错误处理
@app.exception_handler(httpx.HTTPStatusError)
async def http_error_handler(request, exc):
    raise HTTPException(
        status_code=exc.response.status_code,
        detail="Service temporarily unavailable",
    )
```
