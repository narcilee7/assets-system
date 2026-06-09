# GraphQL BFF

GraphQL 作为 BFF 层，让前端自主决定数据形状，后端专注数据聚合。

## 核心实现

### 1. Schema 定义

```ts
// schema.ts
import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String!
    orders: [Order!]!
    loyalty: Loyalty
  }

  type Order {
    id: ID!
    status: String!
    amount: Float!
    createdAt: String!
  }

  type Loyalty {
    points: Int!
    tier: String!
  }

  type Query {
    me: User
    user(id: ID!): User
  }

  type Mutation {
    updateProfile(name: String!): User
  }
`;
```

### 2. Resolver + DataLoader（N+1 解决）

```ts
// resolvers.ts
import DataLoader from 'dataloader';

const orderLoader = new DataLoader(async (userIds: readonly string[]) => {
  const orders = await orderService.getOrdersByUserIds(userIds as string[]);
  const map = new Map<string, any[]>();
  for (const o of orders) {
    const list = map.get(o.userId) || [];
    list.push(o);
    map.set(o.userId, list);
  }
  return userIds.map((id) => map.get(id) || []);
});

const loyaltyLoader = new DataLoader(async (userIds: readonly string[]) => {
  const loyalties = await loyaltyService.getByUserIds(userIds as string[]);
  const map = new Map(loyalties.map((l) => [l.userId, l]));
  return userIds.map((id) => map.get(id) || { points: 0, tier: 'bronze' });
});

export const resolvers = {
  Query: {
    me: (_: any, __: any, { userId }: Context) => userService.getById(userId),
    user: (_: any, { id }: { id: string }) => userService.getById(id),
  },
  User: {
    orders: (parent: any) => orderLoader.load(parent.id),
    loyalty: (parent: any) => loyaltyLoader.load(parent.id),
  },
};
```

### 3. Apollo Server 集成

```ts
// server.ts
import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';

const app = express();

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const token = req.headers.authorization || '';
    const userId = verifyToken(token);
    return { userId };
  },
});

await server.start();
server.applyMiddleware({ app });

app.listen(4000);
```

## GraphQL BFF 反模式

- 直接暴露数据库模型 → 应定义独立的 GraphQL Schema。
- Resolver 里做 HTTP 调用 → 使用 DataLoader 批量化和缓存。
- 不限制查询深度 → 使用 `graphql-depth-limit`。
- 不做复杂度分析 → 使用 `graphql-query-complexity` 防止恶意查询。

## tRPC 替代方案

如果团队全栈 TypeScript，tRPC 可以消除 GraphQL 的类型生成开销，直接用 TypeScript 类型作为 API 契约。
