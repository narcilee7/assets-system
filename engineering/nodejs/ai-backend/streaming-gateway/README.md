# Node.js Agent Streaming Gateway

Node.js 是 AI 应用 Streaming Gateway 的理想选择：HTTP/SSE 生态成熟、非阻塞 I/O 适合高并发长连接。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| SSE Streaming | 将 LLM 的 stream 通过 SSE 推送到前端 |
| Tool Runtime | 接收 LLM 的 tool_call，执行后返回结果 |
| Heartbeat | 维持长连接，检测僵尸客户端 |
| Resume | 支持 `Last-Event-ID` 断点续传 |

## 核心实现

### 1. AI Streaming SSE Gateway

```ts
// ai-streaming-gateway.ts
import { Request, Response } from 'express';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function chatStream(req: Request, res: Response) {
  const { messages, tools } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    tools,
    stream: true,
  });

  let eventId = 1;
  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 30000);

  try {
    for await (const chunk of stream) {
      const data = JSON.stringify(chunk);
      res.write(`id: ${eventId++}\nevent: message\ndata: ${data}\n\n`);

      // Tool call detection
      const toolCalls = chunk.choices?.[0]?.delta?.tool_calls;
      if (toolCalls?.length) {
        for (const tc of toolCalls) {
          if (tc.function?.name && tc.id) {
            res.write(`id: ${eventId++}\nevent: tool_call\ndata: ${JSON.stringify(tc)}\n\n`);
          }
        }
      }
    }
    res.write(`id: ${eventId++}\nevent: done\ndata: [DONE]\n\n`);
  } catch (err: any) {
    res.write(`id: ${eventId++}\nevent: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}
```

### 2. 客户端 EventSource 示例

```js
// client-example.js
const es = new EventSource('/api/chat?session=abc');

es.addEventListener('message', (e) => {
  const chunk = JSON.parse(e.data);
  appendToUI(chunk.choices?.[0]?.delta?.content);
});

es.addEventListener('tool_call', (e) => {
  const tc = JSON.parse(e.data);
  console.log('Tool called:', tc.function.name);
});

es.addEventListener('done', () => es.close());
```

### 3. 心跳与超时管理

```ts
// heartbeat-manager.ts
export function withHeartbeat(res: Response, intervalMs = 30000) {
  const interval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(interval);
      return;
    }
    res.write(':heartbeat\n\n');
  }, intervalMs);

  res.on('close', () => clearInterval(interval));
  return interval;
}
```

## 生产要点

- 设置请求级超时（OpenAI 默认 10min，但网关应设更短）。
- Tool 执行失败时，向 LLM 返回 `error` 类型 message，让其决定下一步。
- 高并发场景使用连接池，避免每个请求新建 TCP 连接。
- 记录每个 chunk 的延迟，作为 LLM 供应商 SLA 监控数据。
