# Serverless Deployment

Node.js 是 Serverless（AWS Lambda、Vercel、Cloudflare Workers）的首选运行时。

## AWS Lambda + Node.js

```ts
// handler.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello from Lambda', path: event.path }),
  };
};
```

```yaml
# serverless.yml
service: my-api
provider:
  name: aws
  runtime: nodejs20.x
  environment:
    NODE_ENV: production
functions:
  api:
    handler: dist/handler.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
```

## 冷启动优化

| 策略 | 效果 |
| --- | --- |
| 精简依赖 | 减少 bundle 体积 |
| 使用 ES Modules | 比 CJS 启动快 10-20% |
| 延迟初始化 | 非关键连接在首次请求时建立 |
| Provisioned Concurrency | 保持预热实例（AWS） |

## 数据库连接池

Serverless 的致命问题：每个实例一个连接池，容易耗尽数据库连接。

- 使用 RDS Proxy（AWS）或 PlanetScale（无连接池）。
- 或者改用 DynamoDB / MongoDB Atlas Serverless。

## Edge Runtime

```ts
// edge-function.ts
export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || 'World';
  return new Response(JSON.stringify({ message: `Hello ${name}` }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

> Edge Runtime 基于 V8 isolates，启动极快，但限制也更多（无 Node.js API）。
