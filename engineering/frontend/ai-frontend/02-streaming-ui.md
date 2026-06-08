# 流式响应 UI

## 1. SSE（Server-Sent Events）

```typescript
// 服务端：Node.js SSE 实现
// server.ts
import http from 'http';

const server = http.createServer((req, res) => {
  if (req.url === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 模拟流式输出
    const words = ['Hello', ' ', 'world', '!', ' ', 'How', ' ', 'are', ' ', 'you', '?'];
    let i = 0;

    const interval = setInterval(() => {
      if (i >= words.length) {
        send({ done: true });
        clearInterval(interval);
        res.end();
        return;
      }
      send({ content: words[i], index: i });
      i++;
    }, 100);

    req.on('close', () => clearInterval(interval));
  }
});
```

```typescript
// 前端：EventSource 消费
class SSEClient {
  private eventSource: EventSource | null = null;
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  connect(url: string) {
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('message', data);
      } catch {
        this.emit('message', event.data);
      }
    };

    this.eventSource.onerror = (error) => {
      this.emit('error', error);
    };

    this.eventSource.onopen = () => {
      this.emit('open', null);
    };
  }

  on(event: string, handler: (data: unknown) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach((handler) => handler(data));
  }

  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

// 使用
const client = new SSEClient();
client.connect('/api/stream');

const unsubscribe = client.on('message', (data) => {
  if (data.done) {
    console.log('Stream complete');
    client.disconnect();
  } else {
    process.stdout.write(data.content);
  }
});
```

## 2. Fetch + ReadableStream

```typescript
// 更灵活的流式消费（支持 POST 和自定义 Header）
class StreamingClient {
  private abortController: AbortController | null = null;

  async stream(
    url: string,
    options: RequestInit & {
      onChunk: (chunk: string) => void;
      onDone?: () => void;
      onError?: (error: Error) => void;
    }
  ) {
    const { onChunk, onDone, onError, ...fetchOptions } = options;
    this.abortController = new AbortController();

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: this.abortController.signal,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 处理 SSE 格式：data: {...}\n\n
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (match) {
            try {
              const data = JSON.parse(match[1]);
              onChunk(data.content || match[1]);
            } catch {
              onChunk(match[1]);
            }
          }
        }
      }

      onDone?.();
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        onError?.(error);
      }
    }
  }

  abort() {
    this.abortController?.abort();
  }
}

// React Hook
function useStreamingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const clientRef = useRef(new StreamingClient());

  const sendMessage = useCallback(async (content: string) => {
    setIsStreaming(true);

    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);

    let assistantContent = '';

    await clientRef.current.stream('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content }),
      onChunk: (chunk) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent }];
          }
          return [...prev, { role: 'assistant', content: assistantContent }];
        });
      },
      onDone: () => setIsStreaming(false),
      onError: (error) => {
        console.error('Stream error:', error);
        setIsStreaming(false);
      },
    });
  }, []);

  const stop = useCallback(() => {
    clientRef.current.abort();
    setIsStreaming(false);
  }, []);

  return { messages, sendMessage, stop, isStreaming };
}
```

## 3. 打字机效果

```tsx
// Typewriter 组件
function TypewriterText({ content, speed = 30 }: { content: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    if (!content) return;

    indexRef.current = 0;
    setDisplayed('');

    const interval = setInterval(() => {
      if (indexRef.current >= content.length) {
        clearInterval(interval);
        return;
      }

      // 按词组而非字符渲染，更自然
      const nextIndex = findNextChunkEnd(content, indexRef.current);
      setDisplayed(content.slice(0, nextIndex));
      indexRef.current = nextIndex;
    }, speed);

    return () => clearInterval(interval);
  }, [content, speed]);

  // 内容变化时直接更新（流式场景）
  useEffect(() => {
    if (displayed.length < content.length) {
      setDisplayed(content);
    }
  }, [content]);

  return <span>{displayed}</span>;
}

// 找到下一个断点（标点、空格、代码块）
function findNextChunkEnd(text: string, start: number): number {
  if (start >= text.length) return text.length;

  // 代码块整体输出
  if (text[start] === '`') {
    const end = text.indexOf('```', start + 3);
    return end === -1 ? Math.min(start + 10, text.length) : end + 3;
  }

  // 查找下一个自然断点
  const breakpoints = [' ', '\n', '.', '，', '。', '!', '?', '！', '？'];
  let min = start + 1;

  for (const bp of breakpoints) {
    const idx = text.indexOf(bp, start);
    if (idx !== -1 && idx < min + 5) {
      min = Math.min(min, idx + 1);
    }
  }

  return Math.min(min, text.length);
}
```

## 4. Markdown 流式渲染

```tsx
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useMemo } from 'react';

function StreamingMarkdown({ content }: { content: string }) {
  // 处理不完整的 Markdown（流式中可能截断）
  const safeContent = useMemo(() => {
    // 如果内容以代码块开始但未结束，添加临时闭合
    const openCodeBlocks = (content.match(/```/g) || []).length;
    let fixed = content;
    if (openCodeBlocks % 2 === 1) {
      fixed += '\n```';
    }
    // 未闭合的行内代码
    const openBackticks = (fixed.match(/`/g) || []).length;
    if (openBackticks % 2 === 1) {
      fixed += '`';
    }
    return fixed;
  }, [content]);

  const html = useMemo(() => {
    const raw = marked.parse(safeContent, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [safeContent]);

  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

// 优化：只重新渲染变化的部分
function useIncrementalMarkdown() {
  const [chunks, setChunks] = useState<Array<{ type: string; content: string }>>([]);
  const bufferRef = useRef('');

  const append = useCallback((text: string) => {
    bufferRef.current += text;

    // 尝试解析完整的 Markdown 块
    const parsed = parsePartialMarkdown(bufferRef.current);
    setChunks(parsed.chunks);
    bufferRef.current = parsed.remainder;
  }, []);

  return { chunks, append };
}
```
