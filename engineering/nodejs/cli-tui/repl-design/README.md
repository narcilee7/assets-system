# REPL Design

REPL（Read-Eval-Print Loop）是交互式解释器的经典模式，也是 AI Agent CLI 的重要入口。

## Node.js 原生 REPL

```ts
// repl-server.ts
import repl from 'repl';
import vm from 'vm';

const server = repl.start({
  prompt: 'ai> ',
  useColors: true,
  useGlobal: false,
  writer: (output: any) => {
    if (typeof output === 'object') {
      return JSON.stringify(output, null, 2);
    }
    return String(output);
  },
});

// 注入自定义变量
server.context.agent = {
  async chat(message: string) {
    return `Response to: ${message}`;
  },
  tools: ['search', 'calculate', 'deploy'],
};

server.context.utils = {
  formatDate: (d: Date) => d.toISOString(),
};

// 自定义命令
server.defineCommand('tools', {
  help: 'List available tools',
  action() {
    this.clearBufferedCommand();
    console.log('Available tools:', server.context.agent.tools.join(', '));
    this.displayPrompt();
  },
});

server.defineCommand('reset', {
  help: 'Reset conversation context',
  action() {
    this.clearBufferedCommand();
    console.log('Context reset.');
    this.displayPrompt();
  },
});

server.on('exit', () => {
  console.log('Goodbye!');
  process.exit(0);
});
```

## 自定义 REPL（基于 readline）

```ts
// custom-repl.ts
import readline from 'readline';
import chalk from 'chalk';

interface ReplOptions {
  prompt: string;
  evaluator: (input: string, context: any) => Promise<any>;
  completer?: (line: string) => [string[], string];
  onExit?: () => void;
}

export function createREPL(options: ReplOptions) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan(options.prompt),
    completer: options.completer,
  });

  const context: any = {};

  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();

    if (trimmed === '.exit' || trimmed === 'exit') {
      rl.close();
      return;
    }

    if (trimmed === '.help') {
      console.log(chalk.yellow('Commands:'));
      console.log('  .exit  - Exit REPL');
      console.log('  .help  - Show help');
      console.log('  .clear - Clear context');
      rl.prompt();
      return;
    }

    if (trimmed === '.clear') {
      Object.keys(context).forEach((k) => delete context[k]);
      console.log(chalk.green('Context cleared.'));
      rl.prompt();
      return;
    }

    try {
      const result = await options.evaluator(trimmed, context);
      if (result !== undefined) {
        console.log(chalk.green('→ '), result);
      }
    } catch (err: any) {
      console.error(chalk.red('Error:'), err.message);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.yellow('\nGoodbye!'));
    options.onExit?.();
  });

  return rl;
}

// AI Agent REPL 使用
const aiRepl = createREPL({
  prompt: 'agent> ',
  async evaluator(input, context) {
    // 调用 LLM
    context.lastInput = input;
    return `AI says: You asked about "${input}"`;
  },
  completer(line) {
    const commands = ['help', 'exit', 'clear', 'tools', 'history'];
    const hits = commands.filter((c) => c.startsWith(line));
    return [hits.length ? hits : commands, line];
  },
});
```

## 多行输入支持

```ts
// multiline-repl.ts
import readline from 'readline';

export function createMultilineREPL(options: { prompt: string; evaluator: (code: string) => Promise<any> }) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: options.prompt,
  });

  let buffer = '';
  let braceCount = 0;

  rl.on('line', async (line) => {
    buffer += line + '\n';

    // 简单的括号匹配
    for (const char of line) {
      if (char === '{' || char === '(' || char === '[') braceCount++;
      if (char === '}' || char === ')' || char === ']') braceCount--;
    }

    if (braceCount === 0) {
      try {
        const result = await options.evaluator(buffer.trim());
        if (result !== undefined) console.log(result);
      } catch (err: any) {
        console.error('Error:', err.message);
      }
      buffer = '';
      rl.setPrompt(options.prompt);
    } else {
      rl.setPrompt('... ');
    }

    rl.prompt();
  });
}
```

## 历史记录与持久化

```ts
// repl-history.ts
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { createInterface } from 'readline';
import { homedir } from 'os';
import { join } from 'path';

const HISTORY_FILE = join(homedir(), '.ai-agent-cli', 'repl-history');
const MAX_HISTORY = 1000;

export async function loadHistory(): Promise<string[]> {
  if (!existsSync(HISTORY_FILE)) return [];
  const lines: string[] = [];
  const rl = createInterface({ input: createReadStream(HISTORY_FILE) });
  for await (const line of rl) lines.push(line);
  return lines.slice(-MAX_HISTORY);
}

export function saveHistory(history: string[]) {
  const stream = createWriteStream(HISTORY_FILE);
  for (const line of history.slice(-MAX_HISTORY)) {
    stream.write(line + '\n');
  }
  stream.end();
}
```

## REPL 安全

- 使用 `vm.runInNewContext` 隔离用户代码
- 限制执行时间
- 禁用危险 API（`require('child_process')`）
- 审计输入日志
