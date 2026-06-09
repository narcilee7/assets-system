# Child Process Interaction

Node.js CLI 经常需要调用外部程序：git、docker、kubectl、npm 等。正确管理子进程是稳定 CLI 的关键。

## 选型矩阵

| API | 适合 | 注意 |
| --- | --- | --- |
| `exec` | 简单命令、小输出 | 缓冲区限制 1MB、shell 注入风险 |
| `execFile` | 直接执行文件、无 shell | 更安全、参数传递更明确 |
| `spawn` | 大输出、流式处理 | 返回 Stream、需要手动管理 |
| `fork` | 同 Node.js 脚本通信 | 建立 IPC 通道 |

## spawn 最佳实践

```ts
// spawn-runner.ts
import { spawn } from 'child_process';
import { Readable } from 'stream';

interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  stdin?: string | Buffer | Readable;
}

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runCommand(
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout;

    if (options.timeout) {
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);
    }

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    if (options.stdin) {
      if (typeof options.stdin === 'string' || Buffer.isBuffer(options.stdin)) {
        child.stdin?.write(options.stdin);
        child.stdin?.end();
      } else if (options.stdin instanceof Readable) {
        options.stdin.pipe(child.stdin!);
      }
    } else {
      child.stdin?.end();
    }

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
  });
}

// 使用
async function deployDocker(image: string) {
  const result = await runCommand('docker', ['build', '-t', image, '.'], {
    timeout: 120000,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Docker build failed: ${result.stderr}`);
  }

  return result.stdout;
}
```

## 实时流式输出

```ts
// streaming-spawn.ts
import { spawn } from 'child_process';
import pc from 'picocolors';

export async function runWithStreaming(
  command: string,
  args: string[],
  onOutput?: (line: string, isStderr: boolean) => void,
) {
  const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'] });

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line) onOutput?.(line, false);
    }
  });

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line) onOutput?.(line, true);
    }
  });

  return new Promise<number>((resolve) => {
    child.on('close', (code) => resolve(code || 0));
  });
}

// 使用
async function main() {
  const code = await runWithStreaming(
    'npm',
    ['run', 'build'],
    (line, isStderr) => {
      console.log(isStderr ? pc.red(line) : line);
    }
  );
  process.exit(code);
}
```

## IPC 通信

```ts
// ipc-parent.ts
import { fork } from 'child_process';
import { join } from 'path';

const worker = fork(join(__dirname, 'worker.js'));

worker.send({ type: 'START', payload: { taskId: '123' } });

worker.on('message', (msg) => {
  console.log('From worker:', msg);
});

worker.on('exit', (code) => {
  console.log('Worker exited with code', code);
});

// worker.ts
process.on('message', (msg: any) => {
  if (msg.type === 'START') {
    // 执行耗时任务
    process.send?.({ type: 'PROGRESS', payload: 50 });
    // ...
    process.send?.({ type: 'DONE', payload: { result: 'ok' } });
  }
});
```

## 安全防范

```ts
// safe-exec.ts
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function safeExec(command: string, args: string[]) {
  // 1. 验证命令白名单
  const allowedCommands = ['git', 'docker', 'npm', 'node'];
  if (!allowedCommands.includes(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }

  // 2. 使用 execFile 避免 shell 注入
  const { stdout, stderr } = await execFileAsync(command, args, { timeout: 30000 });

  return { stdout, stderr };
}
```
