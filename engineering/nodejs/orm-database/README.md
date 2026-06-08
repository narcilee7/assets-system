# Node.js ORM / Database

## 生态矩阵

| 工具 | 适合场景 | 关注点 |
| --- | --- | --- |
| Prisma | 类型安全、迁移、现代应用 | 复杂查询、连接管理 |
| TypeORM | OOP entity、装饰器生态 | 维护状态、复杂度 |
| Sequelize | 传统成熟 ORM | 类型体验 |
| Drizzle | SQL-like、类型安全、轻量 | 生态成熟度 |
| Mongoose | MongoDB ODM | schema、model、validation |
| Knex | query builder | 手写 SQL 控制力 |

## 必会主题

- 连接池。
- transaction。
- migration。
- N+1。
- pagination。
- soft delete。
- optimistic lock。
- read/write splitting。
- serverless connection issue。

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| Prisma schema and migration | `prisma-transaction/` | schema.prisma、迁移工作流 |
| Prisma transaction boundary | `prisma-transaction/src/` | 交互式事务、批量事务、隔离级别 |
| TypeORM repository pattern | `typeorm-example/` | Entity、DataSource、Repository、悲观锁事务 |
| Drizzle query builder | `drizzle-example/` | Schema、SQL-like 查询、事务、PGVector |
| Mongoose ODM pattern | `mongoose-example/` | Schema、Model、Populate、MongoDB 事务 |
| ORM selection matrix | *(见本 README 表格)* | 按场景选型参考 |
