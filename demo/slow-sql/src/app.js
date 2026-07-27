require('dotenv').config();

const express = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');
const Redis = require('ioredis');
const mysql = require('mysql2');
const { URL } = require('url');
const { AsyncLocalStorage } = require('async_hooks');

const app = express();
app.use(express.json());

// 把 BigInt 序列化成 Number（本 Demo 的 id 不会超过 2^53）
BigInt.prototype.toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};

const prisma = new PrismaClient({
  log: process.env.DEBUG_SQL === 'true' ? ['query'] : [],
});
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const requestStore = new AsyncLocalStorage();

// Prisma 中间件：统计单次请求触发的 SQL 数
prisma.$use(async (params, next) => {
  const store = requestStore.getStore();
  if (store) store.queryCount += 1;
  return next(params);
});

// ============================================================
// 通用中间件
// ============================================================

// 1. 接口性能监控中间件
app.use((req, res, next) => {
  requestStore.run({ start: Date.now(), queryCount: 0 }, () => {
    const store = requestStore.getStore();
    res.on('finish', () => {
      const duration = Date.now() - store.start;
      console.log(`${req.method} ${req.path} - ${duration}ms - queries:${store.queryCount}`);
      if (duration > 500) console.warn('SLOW QUERY DETECTED');
    });
    next();
  });
});

// 2. 强制分页中间件（只对 /api/customers/list 生效）
app.use('/api/customers/list', (req, res, next) => {
  let pageSize = parseInt(req.query.pageSize, 10);
  let page = parseInt(req.query.page, 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 20;
  if (pageSize > 100) pageSize = 100;
  if (!Number.isFinite(page) || page < 1) page = 1;
  req.query.pageSize = pageSize;
  req.query.page = page;
  next();
});

// ============================================================
// 工具函数
// ============================================================

function getStatus(req) {
  const s = req.query.status;
  return ['active', 'inactive', 'pending'].includes(s) ? s : 'active';
}

function getPlanType(req) {
  const p = req.query.plan_type;
  return ['free', 'pro', 'enterprise'].includes(p) ? p : null;
}

function getOffset(req) {
  return (req.query.page - 1) * req.query.pageSize;
}

function redisListKey(status, planType, page, pageSize) {
  return `customer_list:${status}:${planType || 'all'}:${page}:${pageSize}`;
}

function redisStatsKey(id) {
  return `customer_stats:${id}`;
}

async function invalidateListCache() {
  const keys = await redis.keys('customer_list:*');
  if (keys.length) await redis.del(...keys);
}

async function indexExists(tableName, indexName) {
  const dbUrl = new URL(process.env.DATABASE_URL);
  const dbName = dbUrl.pathname.slice(1);
  const rows = await prisma.$queryRaw`
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = ${dbName}
      AND table_name = ${tableName}
      AND index_name = ${indexName}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function dropIndexes() {
  if (await indexExists('users', 'idx_users_customer_id')) {
    await prisma.$executeRawUnsafe('DROP INDEX idx_users_customer_id ON users');
  }
  if (await indexExists('contents', 'idx_contents_customer_id')) {
    await prisma.$executeRawUnsafe('DROP INDEX idx_contents_customer_id ON contents');
  }
}

async function addIndexes() {
  if (!(await indexExists('users', 'idx_users_customer_id'))) {
    await prisma.$executeRawUnsafe('CREATE INDEX idx_users_customer_id ON users(customer_id)');
  }
  if (!(await indexExists('contents', 'idx_contents_customer_id'))) {
    await prisma.$executeRawUnsafe('CREATE INDEX idx_contents_customer_id ON contents(customer_id)');
  }
}

async function initCounters() {
  await prisma.$executeRawUnsafe(`
    UPDATE customers c
    SET user_count = (SELECT COUNT(*) FROM users u WHERE u.customer_id = c.id),
        content_count = (SELECT COUNT(*) FROM contents ct WHERE ct.customer_id = c.id)
  `);
}

// ============================================================
// Phase 1：灾难复现（无索引、无分页、全量 JOIN）
// ============================================================

app.get('/api/customers/list/phase1', async (req, res, next) => {
  try {
    await dropIndexes();
    const status = getStatus(req);
    const dbUrl = new URL(process.env.DATABASE_URL);

    const conn = mysql.createConnection({
      host: dbUrl.hostname,
      port: dbUrl.port || 3306,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.slice(1),
      supportBigNumbers: true,
      bigNumberStrings: false,
    });

    const store = requestStore.getStore();
    if (store) store.queryCount += 1;

    const query = conn.query(
      `SELECT c.id, c.name, c.status, c.plan_type, c.created_at,
              u.id AS user_id, u.name AS user_name, u.email AS user_email,
              ct.id AS content_id, ct.title AS content_title
       FROM customers c
       LEFT JOIN users u ON c.id = u.customer_id
       LEFT JOIN contents ct ON c.id = ct.customer_id
       WHERE c.status = ?`,
      [status]
    );

    res.setHeader('Content-Type', 'application/json');
    res.write('[');
    let first = true;

    query
      .stream()
      .on('data', (row) => {
        if (!first) res.write(',');
        first = false;
        res.write(JSON.stringify(row));
      })
      .on('end', () => {
        res.end(']');
        conn.end();
      })
      .on('error', (err) => {
        conn.end();
        next(err);
      });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Phase 2：止血（索引 + 字段裁剪 + LIMIT）
// ============================================================

app.get('/api/customers/list/phase2', async (req, res, next) => {
  try {
    await addIndexes();
    const status = getStatus(req);
    const limit = req.query.pageSize;
    const offset = getOffset(req);

    const rows = await prisma.$queryRaw`
      SELECT c.id, c.name, c.status, c.plan_type, c.created_at,
        COUNT(DISTINCT u.id) AS user_count,
        COUNT(DISTINCT ct.id) AS content_count
      FROM customers c
      LEFT JOIN users u ON c.id = u.customer_id
      LEFT JOIN contents ct ON c.id = ct.customer_id
      WHERE c.status = ${status}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const data = rows.map((r) => ({
      ...r,
      user_count: Number(r.user_count),
      content_count: Number(r.content_count),
    }));

    res.json({
      data,
      pagination: { page: req.query.page, pageSize: limit },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Phase 3：根治（先分页主表，再批量 IN 查统计）
// ============================================================

app.get('/api/customers/list/phase3', async (req, res, next) => {
  try {
    await addIndexes();
    const status = getStatus(req);
    const limit = req.query.pageSize;
    const offset = getOffset(req);

    const customers = await prisma.customers.findMany({
      where: { status },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        status: true,
        plan_type: true,
        created_at: true,
      },
    });

    const ids = customers.map((c) => c.id);
    let userCounts = [];
    let contentCounts = [];

    if (ids.length) {
      [userCounts, contentCounts] = await Promise.all([
        prisma.$queryRaw`
          SELECT customer_id, COUNT(*) AS count
          FROM users
          WHERE customer_id IN (${Prisma.join(ids)})
          GROUP BY customer_id
        `,
        prisma.$queryRaw`
          SELECT customer_id, COUNT(*) AS count
          FROM contents
          WHERE customer_id IN (${Prisma.join(ids)})
          GROUP BY customer_id
        `,
      ]);
    }

    const userMap = new Map(userCounts.map((x) => [x.customer_id, Number(x.count)]));
    const contentMap = new Map(contentCounts.map((x) => [x.customer_id, Number(x.count)]));

    const data = customers.map((c) => ({
      ...c,
      user_count: userMap.get(c.id) || 0,
      content_count: contentMap.get(c.id) || 0,
    }));

    res.json({
      data,
      pagination: { page: req.query.page, pageSize: limit },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Phase 4：冗余字段（单表查询）
// ============================================================

app.get('/api/customers/list/phase4', async (req, res, next) => {
  try {
    await addIndexes();
    const status = getStatus(req);
    const planType = getPlanType(req);
    const sortBy = req.query.sort_by === 'content_count' ? 'content_count' : 'created_at';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';
    const limit = req.query.pageSize;
    const offset = getOffset(req);

    const where = { status };
    if (planType) where.plan_type = planType;

    const customers = await prisma.customers.findMany({
      where,
      orderBy: { [sortBy]: order },
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        status: true,
        plan_type: true,
        user_count: true,
        content_count: true,
        created_at: true,
      },
    });

    res.json({
      data: customers,
      pagination: { page: req.query.page, pageSize: limit },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Phase 5：缓存层（Redis 统计缓存 + 列表缓存）
// ============================================================

app.get('/api/customers/list/phase5', async (req, res, next) => {
  try {
    await addIndexes();
    const status = getStatus(req);
    const planType = getPlanType(req);
    const page = req.query.page;
    const pageSize = req.query.pageSize;
    const cacheKey = redisListKey(status, planType, page, pageSize);

    const cached = await redis.get(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(JSON.parse(cached));
    }

    const sortBy = req.query.sort_by === 'content_count' ? 'content_count' : 'created_at';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';
    const limit = pageSize;
    const offset = getOffset(req);

    const where = { status };
    if (planType) where.plan_type = planType;

    const customers = await prisma.customers.findMany({
      where,
      orderBy: { [sortBy]: order },
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        status: true,
        plan_type: true,
        user_count: true,
        content_count: true,
        created_at: true,
      },
    });

    const result = {
      data: customers,
      pagination: { page, pageSize },
      cached: false,
    };

    await redis.setex(cacheKey, 60, JSON.stringify(result));
    res.set('X-Cache', 'MISS');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 单个客户统计（带 Redis 统计缓存）
app.get('/api/customers/:id/stats', async (req, res, next) => {
  try {
    const id = BigInt(req.params.id);
    const key = redisStatsKey(id);
    const cached = await redis.hgetall(key);

    if (Object.keys(cached).length) {
      res.set('X-Cache', 'HIT');
      return res.json({
        customer_id: id,
        user_count: Number(cached.user_count),
        content_count: Number(cached.content_count),
        updated_at: cached.updated_at,
      });
    }

    const rows = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*) FROM users WHERE customer_id = ${id}) AS user_count,
        (SELECT COUNT(*) FROM contents WHERE customer_id = ${id}) AS content_count
    `;
    const row = rows[0];
    const now = new Date().toISOString();

    await redis.hmset(key, {
      user_count: String(row.user_count),
      content_count: String(row.content_count),
      updated_at: now,
    });
    await redis.expire(key, 300);

    res.set('X-Cache', 'MISS');
    res.json({
      customer_id: id,
      user_count: Number(row.user_count),
      content_count: Number(row.content_count),
      updated_at: now,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// 写接口：应用层双写 + 缓存失效
// ============================================================

app.post('/api/customers/:id/users', async (req, res, next) => {
  try {
    const customerId = BigInt(req.params.id);
    const { name, email, role } = req.body || {};

    const [user] = await prisma.$transaction([
      prisma.users.create({
        data: {
          customer_id: customerId,
          name,
          email,
          role: role || 'user',
          created_at: new Date(),
        },
      }),
      prisma.customers.update({
        where: { id: customerId },
        data: { user_count: { increment: 1 } },
      }),
    ]);

    await redis.del(redisStatsKey(customerId));
    await invalidateListCache();

    res.json({
      id: user.id,
      customer_id: customerId,
      name,
      email,
      role: role || 'user',
    });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/customers/:id/users/:userId', async (req, res, next) => {
  try {
    const customerId = BigInt(req.params.id);
    const userId = BigInt(req.params.userId);

    const existing = await prisma.users.findUnique({ where: { id: userId } });
    if (!existing || existing.customer_id.toString() !== customerId.toString()) {
      return res.status(404).json({ error: 'user not found' });
    }

    await prisma.$transaction([
      prisma.users.delete({ where: { id: userId } }),
      prisma.customers.update({
        where: { id: customerId },
        data: { user_count: { decrement: 1 } },
      }),
    ]);

    await redis.del(redisStatsKey(customerId));
    await invalidateListCache();

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/customers/:id/contents', async (req, res, next) => {
  try {
    const customerId = BigInt(req.params.id);
    const { title, body, status: contentStatus } = req.body || {};

    const [content] = await prisma.$transaction([
      prisma.contents.create({
        data: {
          customer_id: customerId,
          title,
          body,
          status: contentStatus || 'draft',
          created_at: new Date(),
        },
      }),
      prisma.customers.update({
        where: { id: customerId },
        data: { content_count: { increment: 1 } },
      }),
    ]);

    await redis.del(redisStatsKey(customerId));
    await invalidateListCache();

    res.json({
      id: content.id,
      customer_id: customerId,
      title,
      status: contentStatus || 'draft',
    });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/customers/:id/contents/:contentId', async (req, res, next) => {
  try {
    const customerId = BigInt(req.params.id);
    const contentId = BigInt(req.params.contentId);

    const existing = await prisma.contents.findUnique({ where: { id: contentId } });
    if (!existing || existing.customer_id.toString() !== customerId.toString()) {
      return res.status(404).json({ error: 'content not found' });
    }

    await prisma.$transaction([
      prisma.contents.delete({ where: { id: contentId } }),
      prisma.customers.update({
        where: { id: customerId },
        data: { content_count: { decrement: 1 } },
      }),
    ]);

    await redis.del(redisStatsKey(customerId));
    await invalidateListCache();

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// 管理接口
// ============================================================

app.post('/api/admin/indexes/add', async (req, res, next) => {
  try {
    await addIndexes();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/indexes/drop', async (req, res, next) => {
  try {
    await dropIndexes();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/counters/init', async (req, res, next) => {
  try {
    await initCounters();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// 健康检查
// ============================================================

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    mysql: 'connected',
    redis: redis.status,
  });
});

// ============================================================
// 错误处理
// ============================================================

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// ============================================================
// 启动服务
// ============================================================

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});

// 兜底定时任务：每 5 分钟刷新一次计数器
if (process.env.ENABLE_COUNTER_REFRESH !== 'false') {
  setInterval(async () => {
    try {
      await initCounters();
      console.log('[cron] counters refreshed');
    } catch (e) {
      console.error('[cron] counters refresh failed', e);
    }
  }, 5 * 60 * 1000);
}

process.on('SIGTERM', async () => {
  server.close(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });
});
