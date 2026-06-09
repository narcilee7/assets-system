# 手写 SSE 流式聊天组件

## 目标

实现一个完整的 React 流式聊天组件，支持：
1. SSE 流式接收
2. 打字机效果
3. Markdown 渲染
4. 代码高亮
5. 复制功能

## 实现

```tsx
// StreamingChat.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp: number;
}

interface StreamingChatProps {
  apiUrl: string;
  apiKey: string;
  model?: string;
  systemPrompt?: string;
}

export function StreamingChat({
  apiUrl,
  apiKey,
  model = 'gpt-4o-mini',
  systemPrompt = 'You are a helpful assistant.',
}: StreamingChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage.content },
    ];

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: allMessages,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === 'assistant') {
                    lastMsg.content = fullContent;
                  }
                  return updated;
                });
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 用户取消
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setIsLoading(false);
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg.role === 'assistant') {
          lastMsg.isStreaming = false;
        }
        return updated;
      });
    }
  }, [input, isLoading, messages, apiUrl, apiKey, model, systemPrompt]);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return (
    <div className="streaming-chat">
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-header">
              {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className="message-content">
              <MarkdownRenderer content={msg.content} />
              {msg.isStreaming && <span className="cursor">▊</span>}
            </div>
          </div>
        ))}
        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message..."
          disabled={isLoading}
          rows={3}
        />
        <div className="button-group">
          {isLoading ? (
            <button onClick={stopGeneration} className="stop-btn">
              Stop
            </button>
          ) : (
            <button onClick={sendMessage} disabled={!input.trim()}>
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Markdown 渲染组件
function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  // 简化版 Markdown 渲染（实际项目用 react-markdown）
  const segments = parseMarkdown(content);

  return (
    <div className="markdown-body">
      {segments.map((segment, i) => {
        if (segment.type === 'code') {
          return (
            <CodeBlock key={i} language={segment.language} code={segment.content} />
          );
        }
        return <p key={i}>{segment.content}</p>;
      })}
    </div>
  );
}

// 简化 Markdown 解析
function parseMarkdown(text: string) {
  const segments = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }
    segments.push({
      type: 'code',
      language: match[1] || 'text',
      content: match[2].trim(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

// 代码块组件
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <div className="code-header">
        <span>{language}</span>
        <button onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
```
