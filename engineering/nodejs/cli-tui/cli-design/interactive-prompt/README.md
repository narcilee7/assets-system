# Interactive Prompts

交互式 Prompt 让 CLI 更友好，减少用户记忆负担，支持向导式操作。

## 选型矩阵

| 库 | 特点 | 适合 |
| --- | --- | --- |
| @clack/prompts | 现代、美观、TypeScript 原生 | 新项目的首选 |
| Inquirer | 老牌、功能全、插件多 | 复杂表单 |
| Enquirer | 轻量、可扩展 | 轻量 CLI |
| Prompts | 极简 | 简单场景 |

## @clack/prompts 示例

```ts
// wizard.ts
import * as p from '@clack/prompts';
import { z } from 'zod';

async function main() {
  p.intro('🚀 Deployment Wizard');

  const project = await p.text({
    message: 'Project name?',
    placeholder: 'my-awesome-app',
    validate: (value) => {
      if (value.length < 2) return 'Project name must be at least 2 characters';
    },
  });

  if (p.isCancel(project)) {
    p.cancel('Cancelled');
    process.exit(0);
  }

  const environment = await p.select({
    message: 'Select environment',
    options: [
      { value: 'dev', label: 'Development' },
      { value: 'staging', label: 'Staging' },
      { value: 'prod', label: 'Production', hint: 'Careful!' },
    ],
  });

  if (p.isCancel(environment)) {
    p.cancel('Cancelled');
    process.exit(0);
  }

  const features = await p.multiselect({
    message: 'Select features to enable',
    options: [
      { value: 'caching', label: 'Redis Caching' },
      { value: 'queue', label: 'Background Jobs' },
      { value: 'metrics', label: 'Observability' },
    ],
    required: false,
  });

  const confirm = await p.confirm({
    message: `Deploy ${project} to ${environment} with ${features?.length || 0} features?`,
    initialValue: false,
  });

  if (!confirm) {
    p.cancel('Deployment cancelled');
    return;
  }

  const s = p.spinner();
  s.start('Deploying...');

  try {
    await new Promise((r) => setTimeout(r, 2000));
    s.stop('Deployed successfully!');
    p.outro(`✅ ${project} is live on ${environment}`);
  } catch (err: any) {
    s.stop(`Deployment failed: ${err.message}`);
    process.exit(1);
  }
}

main();
```

## 自定义验证

```ts
// validation.ts
import { z } from 'zod';

const schema = z.object({
  project: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  environment: z.enum(['dev', 'staging', 'prod']),
  features: z.array(z.string()).optional(),
});

export function validateAnswers(answers: any) {
  const result = schema.safeParse(answers);
  if (!result.success) {
    return result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  }
  return null;
}
```

## UX 原则

- **可取消**：每一步都支持 `Ctrl+C`，优雅退出不残留状态。
- **默认值**：常用选择提供默认值，减少输入。
- **验证即时**：输入后立即验证，不要等到最后才报错。
- **进度可见**：长操作显示 spinner 或 progress bar。
- **结果总结**：操作完成后展示关键结果。
