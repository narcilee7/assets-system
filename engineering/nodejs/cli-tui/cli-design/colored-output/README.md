# Colored Output

颜色让 CLI 输出更易读，但需要兼顾可访问性（色盲用户）和 CI 环境（无 TTY 时禁用）。

## 选型矩阵

| 库 | 特点 |
| --- | --- |
| Chalk | 最流行、链式 API、支持嵌套 |
| Picocolors | 极小（~1KB）、无依赖 |
| ANSI Colors | 原生模板字符串 |
| Gradient String | 渐变文字效果 |

## Picocolors（推荐新项目）

```ts
// colored.ts
import pc from 'picocolors';

console.log(pc.green('✓ Success'));
console.log(pc.red('✗ Failed'));
console.log(pc.yellow('⚠ Warning'));
console.log(pc.blue('ℹ Info'));
console.log(pc.bold(pc.cyan('Heading')));

// 组合样式
const status = 'deployed';
console.log(`Status: ${pc.green(pc.bold(status))}`);
```

## Chalk 高级用法

```ts
// chalk-styles.ts
import chalk from 'chalk';

const error = chalk.bold.red;
const warning = chalk.hex('#FFA500');
const success = chalk.bold.green;
const info = chalk.blueBright;

console.log(error('Error: Connection refused'));
console.log(warning('Warning: High memory usage'));
console.log(success('Success: Deployment completed'));
console.log(info('Info: 3 tasks remaining'));

// 渐变
import gradient from 'gradient-string';
console.log(gradient('cyan', 'magenta')('AI Agent CLI'));
```

## 表格输出

```ts
// table.ts
import pc from 'picocolors';

interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

export function printTable<T>(columns: TableColumn[], rows: T[]) {
  // 表头
  const header = columns
    .map((col) => pc.bold(col.header).padEnd(col.width))
    .join(' | ');
  console.log(header);
  console.log('-'.repeat(header.length));

  // 数据行
  for (const row of rows) {
    const line = columns
      .map((col) => {
        const value = String((row as any)[col.header.toLowerCase()]);
        return col.align === 'right'
          ? value.padStart(col.width)
          : value.padEnd(col.width);
      })
      .join(' | ');
    console.log(line);
  }
}

// 使用
printTable(
  [
    { header: 'Service', width: 20 },
    { header: 'Status', width: 12 },
    { header: 'Replicas', width: 10, align: 'right' },
  ],
  [
    { service: 'api-gateway', status: pc.green('running'), replicas: '3/3' },
    { service: 'order-service', status: pc.yellow('degraded'), replicas: '2/3' },
    { service: 'payment-worker', status: pc.red('failed'), replicas: '0/2' },
  ]
);
```

## 自动检测 TTY

```ts
// tty-aware.ts
import pc from 'picocolors';

const isTTY = process.stdout.isTTY;
const isCI = process.env.CI === 'true';
const noColor = process.env.NO_COLOR || process.env.NODE_DISABLE_COLORS;

export const c = {
  green: (s: string) => (noColor || (!isTTY && !isCI) ? s : pc.green(s)),
  red: (s: string) => (noColor || (!isTTY && !isCI) ? s : pc.red(s)),
  yellow: (s: string) => (noColor || (!isTTY && !isCI) ? s : pc.yellow(s)),
  blue: (s: string) => (noColor || (!isTTY && !isCI) ? s : pc.blue(s)),
  bold: (s: string) => (noColor || (!isTTY && !isCI) ? s : pc.bold(s)),
};
```

## 可访问性

- 不要只用颜色传达状态，同时用 `✓`/`✗`/`⚠` 图标。
- 支持 `NO_COLOR` 环境变量（行业惯例）。
- 高对比度主题优先。
