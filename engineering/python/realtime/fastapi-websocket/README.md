# FastAPI WebSocket

FastAPI 原生支持 WebSocket，适合实时双向通信。

## 基础示例

```python
# websocket_basic.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        print("Client disconnected")
```

## 带认证的 WebSocket

```python
from fastapi import Depends, Query
from fastapi.security import HTTPBearer

async def get_user(token: str = Query(...)):
    # 验证 token
    return verify_jwt(token)

@app.websocket("/ws/auth")
async def authenticated_ws(websocket: WebSocket, user=Depends(get_user)):
    await websocket.accept()
    await websocket.send_json({"message": f"Welcome {user.name}"})
    # ...
```

## 二进制消息

```python
@app.websocket("/ws/binary")
async def binary_ws(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_bytes()
        # 处理二进制数据
        await websocket.send_bytes(b"Received: " + data)
```
