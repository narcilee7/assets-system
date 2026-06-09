# Python Socket.IO

Socket.IO 是比原生 WebSocket 更高级的实时通信方案，支持自动重连、房间、命名空间。

## 核心实现

```python
# socketio_server.py
import socketio
from fastapi import FastAPI

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
)
app = FastAPI()
asgi_app = socketio.ASGIApp(sio, app)

# 事件处理
@sio.event
async def connect(sid, environ):
    print(f"Client {sid} connected")

@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")

@sio.event
async def chat_message(sid, data):
    print(f"Message from {sid}: {data}")
    await sio.emit('chat_response', {'msg': data}, room=sid)

# 房间管理
@sio.event
async def join_room(sid, room):
    sio.enter_room(sid, room)
    await sio.emit('user_joined', {'room': room}, room=room)

@sio.event
async def leave_room(sid, room):
    sio.leave_room(sid, room)

# 广播到房间
async def broadcast_to_room(room, message):
    await sio.emit('message', message, room=room)

# 命名空间
@sio.on('admin_command', namespace='/admin')
async def admin_command(sid, data):
    # 仅管理员可用
    pass
```

## 与 Redis 适配器（多实例）

```python
mgr = socketio.AsyncRedisManager('redis://localhost:6379/0')
sio = socketio.AsyncServer(client_manager=mgr, async_mode='asgi')
```
