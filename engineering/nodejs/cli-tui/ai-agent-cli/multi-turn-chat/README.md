# AI Agent CLI: Multi-Turn Chat

多轮对话是 AI Agent CLI 的核心模式，需要管理对话历史、上下文窗口、会话持久化。

## 核心概念

| 概念 | 说明 |
| --- | --- |
| Message | `{ role, content, timestamp?, metadata? }` |
| Thread | 一组有序的 Message |
| Context Window | LLM 能处理的最大 token 数 |
| Summarization | 上下文过长时压缩历史 |
| Branching | 支持从某条消息分叉新对话 |

## 消息模型

```ts
// chat.types.ts
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    latencyMs?: number;
  };
}

export interface Thread {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}
```

## 会话管理

```ts
// thread-manager.ts
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';

const CHAT_DIR = join(homedir(), '.ai-agent-cli', 'threads');

export class ThreadManager {
  constructor(private storageDir: string = CHAT_DIR) {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  create(title: string): Thread {
    const thread: Thread = {
      id: crypto.randomUUID(),
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.save(thread);
    return thread;
  }

  load(threadId: string): Thread | null {
    const path = join(this.storageDir, `${threadId}.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  save(thread: Thread): void {
    thread.updatedAt = new Date();
    const path = join(this.storageDir, `${thread.id}.json`);
    writeFileSync(path, JSON.stringify(thread, null, 2));
  }

  list(): Thread[] {
    // 简化实现
    return [];
  }

  addMessage(threadId: string, message: Message): Thread {
    const thread = this.load(threadId);
    if (!thread) throw new Error(`Thread ${threadId} not found`);
    thread.messages.push(message);
    this.save(thread);
    return thread;
  }
}
```

## 上下文窗口管理

```ts
// context-window.ts
export class ContextWindowManager {
  constructor(private maxTokens: number = 8000) {}

  buildMessages(systemPrompt: string, history: Message[]): Message[] {
    const system: Message = {
      id: 'system',
      role: 'system',
      content: systemPrompt,
      timestamp: new Date(),
    };

    // 简单策略：保留最近 N 条
    // 生产环境应使用 tokenizer（如 tiktoken）精确计算
    const estimatedTokens = history.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);

    if (estimatedTokens <= this.maxTokens * 0.8) {
      return [system, ...history];
    }

    // 需要截断：保留系统消息、第一条用户消息、最近的消息
    const truncated = this.truncate(history);
    return [system, ...truncated];
  }

  private estimateTokens(text: string): number {
    // 粗略估计：英文 ~4 chars/token，中文 ~1 char/token
    return Math.ceil(text.length / 4);
  }

  private truncate(history: Message[]): Message[] {
    const firstUserIndex = history.findIndex((m) => m.role === 'user');
    const firstUser = firstUserIndex >= 0 ? [history[firstUserIndex]] : [];

    // 保留最近 10 条
    const recent = history.slice(-10);
    return [...firstUser, ...recent];
  }

  summarize(oldMessages: Message[]): string {
    // 实际应调用 LLM 生成摘要
    return `[Summary of ${oldMessages.length} earlier messages]`;
  }
}
```

## CLI 交互循环

```ts
// chat-loop.ts
import * as p from '@clack/prompts';

export async function startChatLoop(threadManager: ThreadManager, threadId: string) {
  const contextManager = new ContextWindowManager();

  while (true) {
    const input = await p.text({ message: 'You:' });
    if (p.isCancel(input) || input === '/exit') break;

    if (input === '/clear') {
      const thread = threadManager.load(threadId);
      if (thread) {
        thread.messages = [];
        threadManager.save(thread);
        console.log('Context cleared.');
      }
      continue;
    }

    if (input === '/history') {
      const thread = threadManager.load(threadId);
      thread?.messages.forEach((m) => console.log(`${m.role}: ${m.content.slice(0, 100)}...`));
      continue;
    }

    // 添加用户消息
    threadManager.addMessage(threadId, {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    });

    // 调用 LLM 并流式输出
    const thread = threadManager.load(threadId)!;
    const messages = contextManager.buildMessages('You are a helpful assistant.', thread.messages);

    const response = await streamChatCompletion(messages);

    // 添加助手消息
    threadManager.addMessage(threadId, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    });
  }
}

async function streamChatCompletion(messages: Message[]): Promise<string> {
  // 模拟流式响应
  const response = 'This is a simulated response.';
  process.stdout.write('AI: ');
  for (const char of response) {
    process.stdout.write(char);
    await new Promise((r) => setTimeout(r, 20));
  }
  process.stdout.write('\n');
  return response;
}
```

## 分支对话

```ts
// branching.ts
export function branchThread(thread: Thread, messageId: string): Thread {
  const index = thread.messages.findIndex((m) => m.id === messageId);
  if (index === -1) throw new Error('Message not found');

  return {
    id: crypto.randomUUID(),
    title: `${thread.title} (branch)`,
    messages: thread.messages.slice(0, index + 1),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
```
