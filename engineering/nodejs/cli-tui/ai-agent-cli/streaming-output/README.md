# AI Agent CLI: Streaming Output

AI Agent CLI 的核心体验是**流式输出**——用户需要实时看到模型生成的内容，而不是等待完整响应。

## 核心挑战

| 挑战 | 解决 |
| --- | --- |
| 逐字输出闪烁 | 使用原地刷新（stdout.write + \r）或 TUI 框架 |
| Token 与汉字混排 | 按字符边界处理，避免截断 Unicode |
| 代码块渲染 | 检测到 ``` 开始代码块，应用语法高亮 |
| Markdown 解析 | 实时解析标题、列表、粗体 |
| 多模态（图片） | 渲染 ASCII art 或提供打开链接 |

## 基础流式输出

```ts
// stream-text.ts
import { stdout } from 'process';

export class StreamRenderer {
  private buffer = '';

  write(chunk: string) {
    this.buffer += chunk;
    // 清到行尾，避免残留字符
    stdout.write(chunk + '\x1b[K');
  }

  writeln(line: string) {
    stdout.write(line + '\n');
  }

  newLine() {
    stdout.write('\n');
  }
}

// 使用
const renderer = new StreamRenderer();
const chunks = ['Hello', ', ', 'world', '!', '\n\n', 'This ', 'is ', 'streaming.', '\n'];

for (const chunk of chunks) {
  renderer.write(chunk);
  await new Promise((r) => setTimeout(r, 100));
}
```

## Markdown 实时高亮

```ts
// markdown-stream.ts
import pc from 'picocolors';

export class MarkdownStreamRenderer {
  private buffer = '';
  private inCodeBlock = false;
  private codeLanguage = '';

  onChunk(chunk: string) {
    this.buffer += chunk;

    // 简单状态机检测代码块
    const codeBlockStart = this.buffer.indexOf('```');
    if (codeBlockStart !== -1 && !this.inCodeBlock) {
      this.inCodeBlock = true;
      const langEnd = this.buffer.indexOf('\n', codeBlockStart);
      this.codeLanguage = this.buffer.slice(codeBlockStart + 3, langEnd).trim();
    }

    const codeBlockEnd = this.buffer.indexOf('```', codeBlockStart + 3);
    if (codeBlockEnd !== -1 && this.inCodeBlock) {
      this.inCodeBlock = false;
      // 渲染完整代码块
      const code = this.buffer.slice(codeBlockStart, codeBlockEnd + 3);
      this.renderCodeBlock(code, this.codeLanguage);
      this.buffer = this.buffer.slice(codeBlockEnd + 3);
      return;
    }

    if (!this.inCodeBlock) {
      this.renderInlineMarkdown(chunk);
    }
  }

  private renderInlineMarkdown(text: string) {
    const formatted = text
      .replace(/\*\*(.+?)\*\*/g, (_, content) => pc.bold(content))
      .replace(/`(.+?)`/g, (_, code) => pc.gray(code));
    process.stdout.write(formatted);
  }

  private renderCodeBlock(code: string, language: string) {
    console.log(pc.cyan(`\n━━━ ${language || 'code'} ━━━`));
    console.log(pc.gray(code.replace(/```\w*\n?/g, '')));
    console.log(pc.cyan('━━━━━━━━━━━━━━━━━━━\n'));
  }
}
```

## Ink 集成（TUI 流式输出）

```tsx
// ink-stream.tsx
import { useState, useEffect } from 'react';
import { render, Text, Box } from 'ink';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'user', content: 'Explain event loop' },
  ]);
  const [streamingContent, setStreamingContent] = useState('');

  useEffect(() => {
    // 模拟 SSE 流
    const chunks = [
      'The ', 'event ', 'loop ', 'is ', 'a ',
      'programming ', 'construct ', 'that ',
      'waits ', 'for ', 'and ', 'dispatches ',
      'events ', 'in ', 'a ', 'program.',
    ];

    let i = 0;
    const timer = setInterval(() => {
      if (i >= chunks.length) {
        clearInterval(timer);
        setMessages((prev) => [...prev, { role: 'assistant', content: streamingContent + chunks.slice(i).join('') }]);
        setStreamingContent('');
        return;
      }
      setStreamingContent((prev) => prev + chunks[i]);
      i++;
    }, 80);

    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      {messages.map((msg, idx) => (
        <Box key={idx} flexDirection="column" marginBottom={1}>
          <Text bold color={msg.role === 'user' ? 'blue' : 'green'}>
            {msg.role === 'user' ? 'You' : 'AI'}
          </Text>
          <Text>{msg.content}</Text>
        </Box>
      ))}
      {streamingContent && (
        <Box flexDirection="column">
          <Text bold color="green">AI</Text>
          <Text>{streamingContent}▌</Text>
        </Box>
      )}
    </Box>
  );
}

render(<ChatUI />);
```

## 心跳与断开恢复

```ts
// resilient-stream.ts
export async function* streamWithResume(url: string, lastEventId?: string) {
  while (true) {
    try {
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      if (lastEventId) headers['Last-Event-ID'] = lastEventId;

      const response = await fetch(url, { headers });
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // 解析 SSE 格式
        for (const line of chunk.split('\n')) {
          if (line.startsWith('id: ')) {
            lastEventId = line.slice(4);
          }
          if (line.startsWith('data: ')) {
            yield line.slice(6);
          }
        }
      }
      break; // 正常结束
    } catch (err) {
      console.error('Stream error, reconnecting...', err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
```
