# CLI Argument Parser

现代 Node.js CLI 需要从简单的命令行参数解析到复杂的子命令系统。

## 选型矩阵

| 库 | 特点 | 适合 |
| --- | --- | --- |
| Commander | 生态最成熟、文档好 | 中等复杂度 CLI |
| Yargs | 强大的中间件、类型推导 | 复杂多命令 CLI |
| Oclif | Heroku/Stripe 风格、插件化 | 企业级 CLI 框架 |
| CAC | 轻量、现代、TypeScript 友好 | 快速原型 |
| Zod + 手动解析 | 极致类型安全 | 简单工具 |

## Commander 示例

```ts
// cli.ts
import { Command } from 'commander';
import { z } from 'zod';

const program = new Command();

program
  .name('deploy-cli')
  .description('Deployment automation CLI')
  .version('1.0.0');

program
  .command('deploy')
  .description('Deploy application')
  .argument('<environment>', 'target environment')
  .option('-t, --tag <tag>', 'docker image tag', 'latest')
  .option('--dry-run', 'simulate without actual deployment', false)
  .option('-r, --regions <regions...>', 'target regions', ['us-east-1'])
  .action(async (environment, options) => {
    const schema = z.object({
      tag: z.string(),
      dryRun: z.boolean(),
      regions: z.array(z.string()),
    });

    const parsed = schema.parse(options);
    console.log(`Deploying to ${environment} with tag ${parsed.tag}`);
    console.log(`Regions: ${parsed.regions.join(', ')}`);
    if (parsed.dryRun) console.log('(dry run)');
  });

program
  .command('rollback')
  .description('Rollback deployment')
  .argument('<environment>', 'target environment')
  .option('--to <version>', 'rollback target version')
  .action(async (environment, options) => {
    console.log(`Rolling back ${environment} to ${options.to || 'previous'}`);
  });

program.parse();
```

## Zod + 手动解析（轻量）

```ts
// lightweight-parser.ts
import { z } from 'zod';

const ArgsSchema = z.object({
  _: z.array(z.string()).default([]),
  '--help': z.boolean().default(false),
  '--version': z.boolean().default(false),
  '--verbose': z.boolean().default(false),
  '--config': z.string().optional(),
});

export function parseArgs(argv: string[] = process.argv.slice(2)) {
  const result: Record<string, any> = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        result[arg] = next;
        i++;
      } else {
        result[arg] = true;
      }
    } else {
      result._.push(arg);
    }
  }

  return ArgsSchema.parse(result);
}
```

## CLI UX 最佳实践

- **长选项用 `--`**：`--dry-run` 比 `-d` 更易读
- **默认值明确标注**：在 help 中显示默认值
- **错误信息友好**：参数缺失时给出具体建议
- **支持 `--help` 和 `--version`**：用户期望的惯例
- **环境变量优先**：`DEPLOY_REGION` > `--region` > 默认值
- **配置文件支持**：`.deployclirc` 或 `deploy.config.js`
