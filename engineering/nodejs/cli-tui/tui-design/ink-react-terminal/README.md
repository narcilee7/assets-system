# Ink: React for Terminal

Ink 让你用 React 组件模型构建终端用户界面（TUI），支持 hooks、状态管理、JSX。

## 核心优势

- 声明式 UI：用 JSX 描述终端界面
- React 生态：useState、useEffect、自定义 hooks
- 组件丰富：ink-spinner、ink-text-input、ink-select-input
- TypeScript 原生支持

## 基础 Hello World

```tsx
// app.tsx
import { render, Text } from 'ink';

function App() {
  return <Text color="green">Hello from Ink!</Text>;
}

render(<App />);
```

## 实时计数器

```tsx
// counter.tsx
import { useState, useEffect } from 'react';
import { render, Text, Box } from 'ink';

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((c) => c + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        Counter Demo
      </Text>
      <Text>
        Count: <Text color="green">{count}</Text>
      </Text>
    </Box>
  );
}

render(<Counter />);
```

## 交互式选择列表

```tsx
// select.tsx
import { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';

const options = ['Deploy', 'Rollback', 'Status', 'Logs', 'Exit'];

function SelectMenu() {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelected((s) => (s > 0 ? s - 1 : options.length - 1));
    }
    if (key.downArrow) {
      setSelected((s) => (s < options.length - 1 ? s + 1 : 0));
    }
    if (key.return) {
      console.log(`\nSelected: ${options[selected]}`);
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>What would you like to do?</Text>
      {options.map((opt, i) => (
        <Text key={opt} color={i === selected ? 'green' : undefined}>
          {i === selected ? '▸ ' : '  '}
          {opt}
        </Text>
      ))}
    </Box>
  );
}

render(<SelectMenu />);
```

## 实时日志面板

```tsx
// log-panel.tsx
import { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';

interface Log {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

function LogPanel() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const levels: Log['level'][] = ['info', 'warn', 'error'];
    const timer = setInterval(() => {
      const level = levels[Math.floor(Math.random() * levels.length)];
      setLogs((prev) => [
        ...prev.slice(-9),
        {
          level,
          message: `Processing task #${prev.length + 1}`,
          timestamp: new Date().toISOString().split('T')[1].slice(0, 8),
        },
      ]);
    }, 800);
    return () => clearInterval(timer);
  }, []);

  const colorMap = {
    info: 'blue',
    warn: 'yellow',
    error: 'red',
  };

  return (
    <Box flexDirection="column" borderStyle="single" padding={1}>
      <Text bold>Live Logs</Text>
      {logs.map((log, i) => (
        <Text key={i}>
          <Text dimColor>[{log.timestamp}]</Text>{' '}
          <Text color={colorMap[log.level]} bold>
            {log.level.toUpperCase().padEnd(5)}
          </Text>{' '}
          {log.message}
        </Text>
      ))}
    </Box>
  );
}

render(<LogPanel />);
```

## 常用 Ink 组件

| 组件 | 用途 |
| --- | --- |
| `ink-spinner` | 加载动画 |
| `ink-text-input` | 文本输入框 |
| `ink-select-input` | 选择列表 |
| `ink-progress-bar` | 进度条 |
| `ink-link` | 可点击链接 |
| `ink-big-text` | 艺术字 |

## 与 AI Agent CLI 结合

Ink 非常适合做 AI Agent 的 TUI：
- 左侧：对话历史面板
- 右侧：实时 thought / tool 执行面板
- 底部：输入框 + 状态栏
- 顶部：模型信息、token 消耗
