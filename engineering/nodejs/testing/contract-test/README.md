# Contract Testing

契约测试确保消费者（前端 / 其他服务）与提供者（API）之间的接口契约不被破坏。

## Pact 示例

### 消费者测试

```ts
// consumer-pact.test.ts
import { Pact } from '@pact-foundation/pact';
import { API } from './api-client';

const provider = new Pact({
  consumer: 'WebApp',
  provider: 'OrderAPI',
  port: 1234,
});

describe('Order API contract', () => {
  beforeAll(() => provider.setup());
  afterEach(() => provider.verify());
  afterAll(() => provider.finalize());

  it('should return order by id', async () => {
    await provider.addInteraction({
      state: 'order exists',
      uponReceiving: 'a request for order 1',
      withRequest: {
        method: 'GET',
        path: '/orders/1',
        headers: { Authorization: 'Bearer token' },
      },
      willRespondWith: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: '1',
          productId: 'p1',
          quantity: 2,
        },
      },
    });

    const api = new API(provider.mockService.baseUrl);
    const order = await api.getOrder('1');
    expect(order.id).toBe('1');
  });
});
```

### 提供者验证

```bash
npx pact-verifier \
  --provider-base-url http://localhost:3000 \
  --pact-broker-base-url https://pact-broker.example.com \
  --provider-app-version $(git rev-parse --short HEAD) \
  --publish-verification-results
```

## 何时使用

- 微服务间 API 契约频繁变更。
- 前端团队与后端团队独立迭代。
- 需要防止破坏性变更上线。

## 替代方案

- **OpenAPI + schemathesis**：基于 schema 自动生成测试。
- **tRPC**：类型即契约，天然消除契约测试需求。
