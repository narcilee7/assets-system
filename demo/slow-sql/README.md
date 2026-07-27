# B 端客户列表接口优化 Demo

> 用 Prisma + Express + MySQL 8 + Redis 7 复现“全量联表查询”灾难，并分阶段优化到 P99 < 50ms。

---

## 技术栈

- Node.js 20 + Express
- Prisma ORM（Schema / Client / 原生 Raw）
- MySQL 8.0（Docker）
- Redis 7（Docker）
- 压测：autocannon

---

## 快速开始

### 1. 启动依赖

```bash
npm run docker:up
```

这会启动 `slowsql-mysql` 和 `slowsql-redis`。

### 2. 安装依赖并初始化数据库

```bash
npm install
npm run db:generate
npm run db:push
```

### 3. 造数据

默认生成**生产级数据量**（customers 8000 / users ~12 万 / contents ~50 万）：

```bash
npm run db:seed
```

如果想快速验证，可使用小数据集：

```bash
npm run db:seed:small     # 200 customers / ~1500 users / ~3000 contents
npm run db:seed:medium    # 1000 customers / ~11500 users / ~40000 contents
```

### 4. 启动服务

```bash
npm start
# 或开发模式
npm run dev
```

服务默认监听 `http://127.0.0.1:3000`。

---

## 环境变量

复制 `.env.example` 为 `.env`（已默认提供）：

```env
PORT=3000
DATABASE_URL="mysql://root:password@127.0.0.1:3306/slowsql"
REDIS_URL="redis://127.0.0.1:6379"
```

---

## 接口列表

### Phase 接口（客户列表）

| Phase | 接口 | 说明 |
|-------|------|------|
| Phase 1 | `GET /api/customers/list/phase1?status=active` | 无索引、无 LIMIT、全量 LEFT JOIN |
| Phase 2 | `GET /api/customers/list/phase2?status=active&page=1&pageSize=20` | 加索引 + 字段裁剪 + LIMIT |
| Phase 3 | `GET /api/customers/list/phase3?status=active&page=1&pageSize=20` | 先分页主表，再批量 IN 查统计 |
| Phase 4 | `GET /api/customers/list/phase4?status=active&page=1&pageSize=20` | 冗余计数字段，单表查询 |
| Phase 5 | `GET /api/customers/list/phase5?status=active&page=1&pageSize=20` | Redis 列表缓存 + 统计缓存 |

通用查询参数：

- `status`: `active`（默认）/ `inactive` / `pending`
- `plan_type`: `free` / `pro` / `enterprise`（Phase 4/5 支持）
- `page`: 页码，默认 1
- `pageSize`: 每页条数，默认 20，最大 100（被强制分页中间件限制）
- `sort_by`: `created_at`（默认）/ `content_count`（Phase 4/5）
- `order`: `desc`（默认）/ `asc`

### 写接口（双写演示）

- `POST /api/customers/:id/users` — 创建用户并 +1 `user_count`
- `DELETE /api/customers/:id/users/:userId` — 删除用户并 -1 `user_count`
- `POST /api/customers/:id/contents` — 创建内容并 +1 `content_count`
- `DELETE /api/customers/:id/contents/:contentId` — 删除内容并 -1 `content_count`
- `GET /api/customers/:id/stats` — 单个客户统计（带 Redis 统计缓存）

### 管理接口

- `POST /api/admin/indexes/add` — 添加 users/contents 的 `customer_id` 索引
- `POST /api/admin/indexes/drop` — 删除 users/contents 的 `customer_id` 索引
- `POST /api/admin/counters/init` — 全量重新计算 `customers.user_count` / `content_count`

### 其他

- `GET /api/health` — 健康检查

---

## 压测

### 使用项目内置脚本

```bash
npm run benchmark
```

### 使用 autocannon 命令行

```bash
# Phase 1：灾难复现（连接数少一点，避免机器扛不住）
autocannon -c 5 -d 5 http://127.0.0.1:3000/api/customers/list/phase1?status=active

# Phase 2：索引 + LIMIT
autocannon -c 10 -d 10 "http://127.0.0.1:3000/api/customers/list/phase2?status=active&page=1&pageSize=20"

# Phase 3：批量 IN
autocannon -c 10 -d 10 "http://127.0.0.1:3000/api/customers/list/phase3?status=active&page=1&pageSize=20"

# Phase 4：冗余字段
autocannon -c 10 -d 10 "http://127.0.0.1:3000/api/customers/list/phase4?status=active&page=1&pageSize=20"

# Phase 5：缓存
autocannon -c 50 -d 10 "http://127.0.0.1:3000/api/customers/list/phase5?status=active&page=1&pageSize=20"
```

---

## 预期效果（参考值，以生产数据集为准）

| Phase | P50 | P99 | 单次请求 SQL 数 | 返回体大小 | 核心优化点 |
|-------|-----|-----|----------------|------------|-----------|
| Phase 1 | >3000ms | >5000ms | 1 | >10MB | 无 |
| Phase 2 | ~200ms | ~800ms | 1 | ~20KB | 索引 + LIMIT |
| Phase 3 | ~30ms | ~80ms | 3 | ~20KB | 主表分页 + 批量 IN |
| Phase 4 | ~10ms | ~30ms | 1 | ~20KB | 冗余计数字段 |
| Phase 5 | ~3ms | ~10ms | 0（命中缓存） | ~20KB | Redis 缓存 |

> 注：Phase 1 为了避免 Node 内存爆炸，使用了 **MySQL 流式读取**，但返回体仍然是超大 JSON；`EXPLAIN` 仍能看到 `type: ALL` + `Using temporary; Using filesort`。

---

## 项目结构

```
.
├── docker-compose.yml      # MySQL + Redis
├── package.json
├── .env / .env.example
├── prisma/
│   ├── schema.prisma       # 数据模型
│   └── seed.js             # 造数据脚本（支持 small / medium / prod）
├── src/
│   └── app.js              # Express 服务 + 所有 Phase 接口
├── scripts/
│   └── benchmark.js        # autocannon 压测脚本
└── README.md
```

---

## 关键实现说明

1. **Phase 1 全量 JOIN**：先 `DROP` 掉 `users.customer_id` 和 `contents.customer_id` 索引，再用 `LEFT JOIN` 拉取所有关联行；通过 `mysql2` 流式结果集写到响应，避免把几百万行全加载到内存。
2. **Phase 2 止血**：`CREATE` 索引后，用 `COUNT(DISTINCT ...)` + `GROUP BY` + `LIMIT` 返回一页。
3. **Phase 3 根治**：先 `LIMIT` 分页主表，再用 `IN (...)` 聚合统计，`Promise.all` 并行。
4. **Phase 4 冗余**：`customers` 表直接保存 `user_count` / `content_count`，列表变成单表查询；写接口用事务双写。
5. **Phase 5 缓存**：列表结果缓存 60s，单客户统计缓存 300s；写操作后 `DEL` 对应缓存并清掉列表缓存；后台每 5 分钟全量刷新计数兜底。
6. **工程化中间件**：`/api/customers/list` 强制限制 `pageSize ≤ 100`；全局请求耗时监控，超过 500ms 打印 `SLOW QUERY DETECTED`；Prisma 中间件统计每次请求 SQL 数。

---

## 清理环境

```bash
npm run docker:down
```
