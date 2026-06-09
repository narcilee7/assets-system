# Next.js API Routes / Route Handlers

Next.js App Router 的 Route Handler 是现代全栈应用的核心，支持 Edge 和 Node.js Runtime。

## App Router Route Handler

```ts
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export const runtime = 'nodejs'; // 或 'edge'
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || '1');
  const users = await db.user.findMany({ skip: (page - 1) * 20, take: 20 });
  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', errors: parsed.error.issues }, { status: 400 });
  }
  const user = await db.user.create({ data: parsed.data });
  return NextResponse.json(user, { status: 201 });
}
```

## Streaming Response

```ts
// app/api/chat/route.ts
import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI();

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
```

## 边界与注意

- Route Handler 不是独立后端，与前端共享部署单元。
- `edge` runtime 无法使用原生 Node.js 模块（如 Prisma 需特殊配置）。
- 长时间运行任务应委托给 BullMQ / Inngest，避免 Vercel 函数超时（10s-300s）。
- 缓存使用 `export const revalidate = 60` 或 `cache: 'force-cache'`。
