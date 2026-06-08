# AI SDK 集成

## 1. Vercel AI SDK

```typescript
// 核心抽象：Unified API 对接多个提供商

// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    maxTokens: 1000,
    temperature: 0.7,
    // 工具定义
    tools: {
      getWeather: {
        description: '获取指定城市的天气',
        parameters: z.object({
          city: z.string().describe('城市名称'),
          unit: z.enum(['celsius', 'fahrenheit']).optional(),
        }),
        execute: async ({ city, unit = 'celsius' }) => {
          // 调用天气 API
          return { temperature: 25, condition: 'sunny', unit };
        },
      },
    },
  });

  return result.toDataStreamResponse();
}
```

```tsx
// components/chat.tsx
'use client';

import { useChat } from 'ai/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    onError: (error) => console.error(error),
    onFinish: (message) => {
      // 消息完成后的处理
      console.log('Message finished:', message);
    },
  });

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="avatar">
              {message.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="content">
              {message.parts?.map((part, i) => {
                if (part.type === 'text') {
                  return <p key={i}>{part.text}</p>;
                }
                if (part.type === 'tool-invocation') {
                  return <ToolCall key={i} tool={part.toolInvocation} />;
                }
                return null;
              }) || <p>{message.content}</p>}
            </div>
          </div>
        ))}
        {isLoading && <LoadingIndicator />}
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="输入消息..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          发送
        </button>
      </form>
    </div>
  );
}
```

### 多提供商切换

```typescript
// lib/ai/providers.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAzure } from '@ai-sdk/azure';

const providers = {
  openai: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  anthropic: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  google: createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY }),
  azure: createAzure({ resourceName: 'my-resource', apiKey: process.env.AZURE_API_KEY }),
};

export function getModel(provider: string, model: string) {
  const p = providers[provider as keyof typeof providers];
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  return p(model);
}

// 使用
import { generateText } from 'ai';

const result = await generateText({
  model: getModel('openai', 'gpt-4o'),
  prompt: 'Hello world',
});
```

### Object Generation（结构化输出）

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const schema = z.object({
  recipe: z.object({
    name: z.string(),
    ingredients: z.array(z.object({
      name: z.string(),
      amount: z.string(),
    })),
    steps: z.array(z.string()),
    prepTime: z.number(),
    cookTime: z.number(),
  }),
});

const { object } = await generateObject({
  model: openai('gpt-4o'),
  schema,
  prompt: '生成一个宫保鸡丁的食谱',
});

// object.recipe 类型安全
console.log(object.recipe.name);  // "宫保鸡丁"
```

## 2. 原生 SDK 集成

```typescript
// 直接使用 OpenAI SDK（需要服务端代理）
// app/api/chat/openai/route.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    stream: true,
    response_format: { type: 'json_object' },  // 强制 JSON 输出
  });

  // 转换为 SSE
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
          );
        }
        controller.close();
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    }
  );
}
```

```typescript
// 直接使用 Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const stream = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text);
  }
}
```

## 3. 前端直接调用（Edge / Serverless）

```typescript
// 服务端聚合层（统一 API）
// app/api/ai/route.ts
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { provider, model, messages, tools, stream = true } = body;

  // 根据 provider 路由到不同实现
  const handler = getProviderHandler(provider);

  if (stream) {
    return handler.stream(model, messages, tools);
  }
  return handler.complete(model, messages, tools);
}

// 前端统一调用
async function callAI(options: AIOptions) {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) throw new Error('AI request failed');

  if (options.stream) {
    return response.body;  // ReadableStream
  }
  return response.json();
}
```

## 4. API 设计模式

```typescript
// 模式 1：简单对话
interface ChatRequest {
  message: string;
  conversationId?: string;
}

interface ChatResponse {
  message: string;
  conversationId: string;
}

// 模式 2：流式对话
interface StreamChatRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
}

// 返回 SSE
// data: {"id":"msg_1","content":"Hello","done":false}
// data: {"id":"msg_1","content":"","done":true}

// 模式 3：结构化生成
interface GenerateRequest<T> {
  prompt: string;
  schema: JSONSchema;
  examples?: Example[];
}

interface GenerateResponse<T> {
  data: T;
  usage: TokenUsage;
}

// 模式 4：Agent 执行
interface AgentRequest {
  task: string;
  context?: Record<string, unknown>;
  tools?: string[];  // 可用工具列表
  maxSteps?: number;
}

interface AgentResponse {
  result: unknown;
  steps: AgentStep[];
  toolCalls: ToolCall[];
}
```
