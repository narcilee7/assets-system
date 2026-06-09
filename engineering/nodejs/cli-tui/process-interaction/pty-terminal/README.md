# PTY Terminal

PTY（Pseudo Terminal）让 Node.js CLI 可以运行需要全终端交互的程序（vim、htop、ssh、交互式 shell），保留颜色、光标控制、窗口尺寸等。

## 使用场景

- AI Agent 执行命令并实时观察输出
- 远程 SSH 会话封装
- 在 CLI 中嵌入完整终端
- 录制和回放终端会话

## node-pty 基础用法

```ts
// pty-shell.ts
import * as pty from 'node-pty';
import os from 'os';

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env as { [key: string]: string },
});

// 将 PTY 输出转发到 stdout
ptyProcess.onData((data) => {
  process.stdout.write(data);
});

// 将 stdin 转发到 PTY
process.stdin.on('data', (data) => {
  ptyProcess.write(data.toString());
});

ptyProcess.onExit(({ exitCode, signal }) => {
  console.log(`\nPTY exited with code ${exitCode}, signal ${signal}`);
  process.exit(exitCode);
});
```

## AI Agent 执行命令并观察

```ts
// ai-pty-executor.ts
import * as pty from 'node-pty';
import stripAnsi from 'strip-ansi';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export function executeInPTY(
  command: string,
  options: { timeout?: number; cwd?: string } = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    const ptyProcess = pty.spawn(shell, ['-c', command], {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd: options.cwd || process.cwd(),
      env: process.env as { [key: string]: string },
    });

    let rawOutput = '';
    let timeoutId: NodeJS.Timeout;

    if (options.timeout) {
      timeoutId = setTimeout(() => {
        ptyProcess.kill();
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);
    }

    ptyProcess.onData((data) => {
      rawOutput += data;
    });

    ptyProcess.onExit(({ exitCode }) => {
      clearTimeout(timeoutId);
      const cleanOutput = stripAnsi(rawOutput);

      // 简单拆分 stdout/stderr（PTY 不区分，如果需要可用其他方式）
      resolve({
        stdout: cleanOutput,
        stderr: '',
        exitCode: exitCode,
        durationMs: Date.now() - startTime,
      });
    });
  });
}
```

## 尺寸自适应

```ts
// pty-resize.ts
import * as pty from 'node-pty';

const ptyProcess = pty.spawn('bash', [], {
  name: 'xterm-color',
  cols: process.stdout.columns || 80,
  rows: process.stdout.rows || 24,
  cwd: process.cwd(),
  env: process.env as { [key: string]: string },
});

process.stdout.on('resize', () => {
  ptyProcess.resize(process.stdout.columns || 80, process.stdout.rows || 24);
});
```

## PTY + WebSocket（远程终端）

```ts
// pty-ws-server.ts
import { WebSocketServer } from 'ws';
import * as pty from 'node-pty';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env as { [key: string]: string },
  });

  ptyProcess.onData((data) => ws.send(data));

  ws.on('message', (data) => {
    if (typeof data === 'string' && data.startsWith('resize:')) {
      const [cols, rows] = data.slice(7).split(',').map(Number);
      ptyProcess.resize(cols, rows);
    } else {
      ptyProcess.write(data.toString());
    }
  });

  ws.on('close', () => ptyProcess.kill());
});
```

## 安全注意

- PTY 执行命令风险极高，必须严格白名单。
- 记录所有 PTY 会话日志用于审计。
- 设置命令超时，防止长时间挂起。
- 在沙箱环境中运行不受信任的命令。
