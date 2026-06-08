# Blessed Terminal UI

Blessed 是传统但功能强大的终端 UI 库，提供窗口、面板、列表、表单等高级控件，不依赖 React。

## 适用场景

- 不需要 React 运行时（二进制包体积敏感）
- 需要复杂布局（dashboard、分屏、日志监控）
- 需要鼠标支持
- 老项目维护

## 核心实现

```ts
// dashboard.ts
import blessed from 'blessed';

const screen = blessed.screen({
  smartCSR: true,
  title: 'System Dashboard',
});

// 日志面板
const logBox = blessed.log({
  top: 0,
  left: 0,
  width: '70%',
  height: '70%',
  label: ' Logs ',
  border: { type: 'line' },
  style: {
    border: { fg: 'cyan' },
  },
  scrollable: true,
  alwaysScroll: true,
});

// 状态面板
const statusBox = blessed.box({
  top: 0,
  right: 0,
  width: '30%',
  height: '70%',
  label: ' Status ',
  border: { type: 'line' },
  content: 'CPU: 23%\nMemory: 1.2GB\nRequests: 1,234/s',
  style: {
    border: { fg: 'green' },
  },
});

// 命令输入框
const inputBox = blessed.textbox({
  bottom: 0,
  left: 0,
  width: '100%',
  height: '30%',
  label: ' Command ',
  border: { type: 'line' },
  inputOnFocus: true,
});

screen.append(logBox);
screen.append(statusBox);
screen.append(inputBox);

// 模拟日志
let requestCount = 1234;
setInterval(() => {
  requestCount += Math.floor(Math.random() * 10);
  const level = Math.random() > 0.8 ? 'ERROR' : 'INFO';
  const color = level === 'ERROR' ? '{red-fg}' : '{blue-fg}';
  logBox.log(`${color}[${level}]{/} Request #${requestCount} processed in ${(Math.random() * 100).toFixed(1)}ms`);
  statusBox.setContent(`CPU: ${(Math.random() * 50).toFixed(0)}%\nMemory: ${(1 + Math.random()).toFixed(1)}GB\nRequests: ${requestCount}/s`);
  screen.render();
}, 500);

// 输入处理
inputBox.on('submit', (text: string) => {
  logBox.log(`> ${text}`);
  if (text === 'quit') {
    process.exit(0);
  }
  inputBox.clearValue();
  screen.render();
  inputBox.focus();
});

// 键盘事件
screen.key(['escape', 'q', 'C-c'], () => {
  process.exit(0);
});

inputBox.focus();
screen.render();
```

## 表格控件

```ts
// table.ts
import blessed from 'blessed';
import contrib from 'blessed-contrib';

const screen = blessed.screen();
const grid = new contrib.grid({ rows: 12, cols: 12, screen });

const table = grid.set(0, 0, 6, 12, contrib.table, {
  keys: true,
  fg: 'green',
  selectedFg: 'white',
  selectedBg: 'blue',
  interactive: true,
  label: 'Services',
  width: '100%',
  height: '50%',
  border: { type: 'line', fg: 'cyan' },
  columnSpacing: 10,
  columnWidth: [20, 12, 10, 20],
});

table.setData({
  headers: ['Service', 'Status', 'Replicas', 'Uptime'],
  data: [
    ['api-gateway', 'running', '3/3', '12d 4h'],
    ['order-service', 'running', '5/5', '8d 2h'],
    ['payment-worker', 'degraded', '2/3', '3d 12h'],
    ['notification', 'failed', '0/2', '1h 23m'],
  ],
});

screen.key(['escape', 'q'], () => process.exit(0));
screen.render();
```

## Ink vs Blessed

| 维度 | Ink | Blessed |
| --- | --- | --- |
| 编程模型 | React 组件 | 命令式 API |
| 学习曲线 | React 开发者友好 | 需学习 blessed API |
| 包体积 | 较大（含 React） | 较大 |
| 组件生态 | React 生态 + ink 专属 | blessed-contrib |
| 鼠标支持 | 有限 | 完善 |
| 推荐 | 新 TUI 项目 | 复杂 dashboard、日志系统 |
