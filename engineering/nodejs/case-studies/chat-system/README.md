# Real-time Chat System Case Study

一个完整的实时聊天系统后端，演示 WebSocket 房间、消息持久化、未读计数和消息撤回。

## 技术栈

- **Framework**: NestJS + @nestjs/websockets
- **Transport**: Socket.IO + Redis Adapter
- **Database**: PostgreSQL (messages) + Redis (online status)
- **Auth**: JWT

## 核心架构

```
[Client A] <--Socket.IO--> [API Server 1] <--Redis PubSub--> [API Server 2] --> [Client B]
                                    |
                                    v
                              [PostgreSQL]
```

## 核心代码

### 1. Gateway

```ts
// chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  async handleConnection(client: Socket) {
    const user = await this.authService.verifyToken(client.handshake.auth.token);
    client.data.userId = user.id;
    await redis.hset('online', user.id, Date.now());
    this.server.emit('user:online', { userId: user.id });
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    await redis.hdel('online', userId);
    this.server.emit('user:offline', { userId });
  }

  @SubscribeMessage('join:room')
  async joinRoom(client: Socket, roomId: string) {
    client.join(roomId);
    const history = await this.messageService.getRecent(roomId, 50);
    client.emit('room:history', history);
  }

  @SubscribeMessage('message:send')
  async handleMessage(client: Socket, payload: { roomId: string; content: string }) {
    const message = await this.messageService.create({
      roomId: payload.roomId,
      senderId: client.data.userId,
      content: payload.content,
    });

    this.server.to(payload.roomId).emit('message:new', message);

    // 更新未读计数
    const members = await this.roomService.getMembers(payload.roomId);
    for (const member of members) {
      if (member !== client.data.userId) {
        await redis.hincrby(`unread:${member}`, payload.roomId, 1);
      }
    }
  }

  @SubscribeMessage('message:recall')
  async recallMessage(client: Socket, messageId: string) {
    const message = await this.messageService.findById(messageId);
    if (message.senderId !== client.data.userId) return;
    if (Date.now() - message.createdAt.getTime() > 2 * 60 * 1000) return; // 2min 限制

    await this.messageService.update(messageId, { recalled: true });
    this.server.to(message.roomId).emit('message:recalled', { messageId });
  }
}
```

### 2. Message Service

```ts
// message.service.ts
@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  async create(data: { roomId: string; senderId: string; content: string }) {
    return this.prisma.message.create({
      data: { ...data, createdAt: new Date() },
    });
  }

  async getRecent(roomId: string, limit: number) {
    return this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
```

## 功能清单

- [x] 多房间支持
- [x] 历史消息分页
- [x] 未读消息计数
- [x] 消息撤回（2分钟限制）
- [x] 在线状态广播
- [x] 多实例 Redis Adapter 扩展
- [ ] 消息已读回执
- [ ] 文件上传（图片/语音）
- [ ] @提及和推送通知
