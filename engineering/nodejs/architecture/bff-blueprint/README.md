# Node.js BFF Blueprint

Backend-for-Frontend（BFF）是 Node.js 最经典的架构角色：聚合多个下游服务，为特定前端提供定制化 API。

## 职责边界

| BFF 职责 | 不属于 BFF |
| --- | --- |
| 聚合下游 API | 复杂业务逻辑（属于 Domain Service） |
| 数据裁剪与格式化 | 数据库直接访问（属于 Data Service） |
| 鉴权与权限校验 | 核心交易逻辑（属于 Core Service） |
| 缓存与降级 | 长时间计算（属于 Worker / Batch） |
| 协议转换（REST <> GraphQL <> gRPC） | 状态管理（属于前端） |

## 核心实现

### 1. 服务聚合器

```ts
// user-bff.service.ts
import { AppError, Errors } from '../../api-design/error-model/app-error';

interface UserProfile {
  id: string;
  name: string;
  orders: OrderSummary[];
  loyalty: LoyaltyInfo;
}

export class UserBffService {
  constructor(
    private userClient: UserServiceClient,
    private orderClient: OrderServiceClient,
    private loyaltyClient: LoyaltyServiceClient,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const [user, orders, loyalty] = await Promise.allSettled([
      this.userClient.getUser(userId),
      this.orderClient.getRecentOrders(userId),
      this.loyaltyClient.getPoints(userId).catch(() => null), // 降级
    ]);

    if (user.status === 'rejected') throw Errors.notFound('User');

    return {
      id: user.value.id,
      name: user.value.name,
      orders: orders.status === 'fulfilled' ? orders.value : [],
      loyalty: loyalty.status === 'fulfilled' ? loyalty.value : { points: 0 },
    };
  }
}
```

### 2. 降级中间件

```ts
// fallback.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  timeoutMs: number = 2000,
) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = await Promise.race([
        primary(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Primary timeout')), timeoutMs)
        ),
      ]);
      (res as any).locals.data = result;
      next();
    } catch {
      const result = await fallback();
      (res as any).locals.data = result;
      next();
    }
  };
}
```

### 3. 缓存层

```ts
// cache-layer.ts
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

export async function cached<T>(key: string, factory: () => Promise<T>, ttl = 60): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;
  const value = await factory();
  cache.set(key, value, ttl);
  return value;
}
```

## 反模式

- BFF 里写复杂事务逻辑 → 应下沉到 Domain Service。
- BFF 直接连数据库 → 应通过 Service Client 访问。
- 一个 BFF 服务所有前端 → 应按前端维度拆分（Web BFF / App BFF / Admin BFF）。
