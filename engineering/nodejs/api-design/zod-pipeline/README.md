# Zod Validation Pipeline

运行时类型安全是 Node.js API 的第一道防线。Zod 提供了声明式、可组合、类型推导的校验方案。

## 核心设计

- **单一来源**：Zod schema 即类型定义，避免 TypeScript interface 和校验逻辑分离。
- **提前失败**：在 middleware 层完成校验，Controller 直接拿到类型安全的数据。
- **错误友好**：将 Zod 错误扁平化为客户端可读的字段级提示。

## 实现

### 1. 通用校验中间件

```ts
// validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { Errors } from '../error-model/app-error';

export function validate<T>(schema: ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = flattenZodError(result.error);
      next(Errors.validation(details));
      return;
    }
    // 将校验后的干净数据挂载到 req 上
    req[source] = result.data as any;
    next();
  };
}

function flattenZodError(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    details[path] = details[path] || [];
    details[path].push(issue.message);
  }
  return details;
}
```

### 2. 业务 Schema 定义

```ts
// schemas.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150).optional(),
  role: z.enum(['user', 'admin']).default('user'),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const PaginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;
```

### 3. 路由中使用

```ts
// user-routes.ts
import { Router } from 'express';
import { validate } from './validate';
import { CreateUserSchema, PaginationSchema } from './schemas';

const router = Router();

router.post('/users',
  validate(CreateUserSchema, 'body'),
  (req, res) => {
    // req.body 类型为 CreateUserInput
    const data = req.body;
    res.json({ created: true, email: data.email });
  }
);

router.get('/users',
  validate(PaginationSchema, 'query'),
  (req, res) => {
    const { page, limit } = req.query as unknown as PaginationInput;
    res.json({ page, limit });
  }
);
```

## 对比

| 特性 | Zod | Joi | class-validator |
| --- | --- | --- | --- |
| TypeScript 推导 | ✅ | 需额外定义 | 装饰器 |
| 树摇 | ✅ 好 | 差 | 一般 |
| 运行时大小 | 小 | 大 | 中 |
| 组合能力 | 强 | 强 | 中 |
| 生态（tRPC 等） | 原生支持 | 无 | 无 |

> 新项目优先选 Zod；已有大量 Joi schema 的项目迁移成本需评估。
