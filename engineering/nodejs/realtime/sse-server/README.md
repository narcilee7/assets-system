# SSE Server with Resume

Server-Sent Events (SSE) 是单向服务器推送的标准方案，适合 AI streaming、通知、实时数据等场景。

## 优势

- 基于 HTTP，穿透防火墙和代理更容易。
- 自动重连（浏览器原生 `EventSource`）。
- 支持 `Last-Event-ID` 断点续传。

## 核心实现

### 1. SSE 服务端

```ts
// sse-server.ts
import { Request, Response } from 'express';

interface Client {
  id: string;
  res: Response;
  lastEventId: number;
}

class SSEService {
  private clients = new Map<string, Client>();
  private messageHistory: { id: number; event?: string; data: string }[] = [];
  private historyLimit = 100;
  private nextId = 1;

  subscribe(req: Request, res: Response) {
    const clientId = crypto.randomUUID();
    const lastId = Number(req.headers['last-event-id'] || 0);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 发送历史消息（断点续传）
    const missed = this.messageHistory.filter((m) => m.id > lastId);
    for (const msg of missed) {
      this.writeMessage(res, msg);
    }

    const client: Client = { id: clientId, res, lastEventId: lastId };
    this.clients.set(clientId, client);

    req.on('close', () => {
      this.clients.delete(clientId);
    });

    // 心跳保活
    const heartbeat = setInterval(() => {
      if (!this.clients.has(clientId)) {
        clearInterval(heartbeat);
        return;
      }
      res.write(':heartbeat\n\n');
    }, 30000);
  }

  broadcast(event: string, data: any) {
    const message = { id: this.nextId++, event, data: JSON.stringify(data) };
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.historyLimit) {
      this.messageHistory.shift();
    }

    for (const client of this.clients.values()) {
      this.writeMessage(client.res, message);
    }
  }

  private writeMessage(res: Response, msg: { id: number; event?: string; data: string }) {
    res.write(`id: ${msg.id}\n`);
    if (msg.event) res.write(`event: ${msg.event}\n`);
    res.write(`data: ${msg.data}\n\n`);
  }
}

export const sseService = new SSEService();
```

### 2. Express 路由集成

```ts
// routes.ts
import { Router } from 'express';
import { sseService } from './sse-server';

const router = Router();

router.get('/events', (req, res) => sseService.subscribe(req, res));

router.post('/notify', (req, res) => {
  sseService.broadcast('notification', req.body);
  res.json({ ok: true });
});

export default router;
```

### 3. 客户端使用

```js
// client.js
const es = new EventSource('/events');

es.addEventListener('notification', (e) => {
  console.log('Got notification:', JSON.parse(e.data));
});

es.onerror = (err) => {
  console.error('SSE error', err);
};
```

## 对比 WebSocket

| 维度 | SSE | WebSocket |
| --- | --- | --- |
| 方向 | 服务器 -> 客户端 | 双向 |
| 协议 | HTTP | WS/WSS |
| 自动重连 | ✅ 原生 | ❌ 需手动实现 |
| 二进制 | ❌ 文本 only | ✅ |
| 多实例广播 | 需 Redis PubSub | 需 Redis Adapter |
| 适用 | AI streaming、通知 | 聊天、游戏、协作 |
