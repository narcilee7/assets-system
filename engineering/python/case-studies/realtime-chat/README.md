# Python Realtime Chat Case Study

基于 FastAPI + WebSocket + Redis 的水平扩展实时聊天系统。

## 架构

```
Client → Nginx → FastAPI Server 1 (WebSocket)
                     ↕
                  Redis Pub/Sub
                     ↕
              FastAPI Server 2 (WebSocket)
```

## 核心实现

```python
# chat_server.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import aioredis
import json

app = FastAPI()
redis = aioredis.from_url("redis://localhost")

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = []
        self.active_connections[room].append(websocket)
    
    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.active_connections:
            self.active_connections[room].remove(websocket)
    
    async def broadcast(self, room: str, message: dict):
        if room in self.active_connections:
            for connection in self.active_connections[room]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

# Redis 订阅（跨实例通信）
async def redis_listener():
    pubsub = redis.pubsub()
    await pubsub.subscribe("chat:general")
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            await manager.broadcast(data["room"], data)

@app.on_event("startup")
async def startup():
    asyncio.create_task(redis_listener())

@app.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str):
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_text()
            message = {
                "room": room,
                "user": "anonymous",
                "content": data,
                "timestamp": datetime.utcnow().isoformat(),
            }
            # 本地广播 + Redis 发布
            await manager.broadcast(room, message)
            await redis.publish("chat:general", json.dumps(message))
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
```
