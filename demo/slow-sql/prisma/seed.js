const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('crypto');

const prisma = new PrismaClient();

const DATASETS = {
  small: {
    customers: 200,
    usersMin: 5,
    usersMax: 10,
    contentsMin: 10,
    contentsMax: 20,
  },
  medium: {
    customers: 1000,
    usersMin: 8,
    usersMax: 15,
    contentsMin: 30,
    contentsMax: 50,
  },
  prod: {
    customers: 8000,
    usersMin: 10,
    usersMax: 20,
    contentsMin: 40,
    contentsMax: 80,
  },
};

const datasetName = process.env.DATASET || 'prod';
const profile = DATASETS[datasetName] || DATASETS.prod;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(items) {
  let r = Math.random();
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomPastDate() {
  return new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000));
}

function generateBody() {
  return randomBytes(512).toString('hex');
}

async function batchCreateMany(model, rows, batchSize = 2000) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await prisma[model].createMany({ data: chunk, skipDuplicates: true });
  }
}

async function main() {
  console.log(`Using dataset: ${datasetName}`, profile);

  // 清空旧数据（按外键依赖顺序）
  await prisma.contents.deleteMany({});
  await prisma.users.deleteMany({});
  await prisma.customers.deleteMany({});
  console.log('Old data cleaned.');

  // 1. 生成 customers
  const customerRows = [];
  for (let i = 1; i <= profile.customers; i++) {
    customerRows.push({
      name: `Customer-${String(i).padStart(5, '0')}`,
      status: pickWeighted([
        { value: 'active', weight: 0.7 },
        { value: 'inactive', weight: 0.2 },
        { value: 'pending', weight: 0.1 },
      ]),
      plan_type: pick(['free', 'pro', 'enterprise']),
      created_at: randomPastDate(),
    });
  }
  await batchCreateMany('customers', customerRows, 1000);
  console.log(`Inserted ${customerRows.length} customers.`);

  // 2. 读取所有 customer id
  const customers = await prisma.$queryRaw`
    SELECT id FROM customers ORDER BY id
  `;
  console.log(`Loaded ${customers.length} customer ids.`);

  // 3. 生成 users 和 contents
  const userBatch = [];
  const contentBatch = [];
  let userIdx = 0;
  let contentIdx = 0;

  for (const c of customers) {
    const userCount = randomInt(profile.usersMin, profile.usersMax);
    for (let j = 0; j < userCount; j++) {
      userIdx++;
      userBatch.push({
        customer_id: c.id,
        name: `User-${userIdx}`,
        email: `user-${userIdx}@example.com`,
        role: pickWeighted([
          { value: 'user', weight: 0.7 },
          { value: 'admin', weight: 0.2 },
          { value: 'manager', weight: 0.1 },
        ]),
        created_at: randomPastDate(),
      });
      if (userBatch.length >= 2000) {
        await batchCreateMany('users', userBatch, 2000);
        userBatch.length = 0;
      }
    }

    const contentCount = randomInt(profile.contentsMin, profile.contentsMax);
    for (let j = 0; j < contentCount; j++) {
      contentIdx++;
      contentBatch.push({
        customer_id: c.id,
        title: `Content-${contentIdx}`,
        body: generateBody(),
        status: pickWeighted([
          { value: 'published', weight: 0.5 },
          { value: 'draft', weight: 0.3 },
          { value: 'archived', weight: 0.2 },
        ]),
        created_at: randomPastDate(),
      });
      if (contentBatch.length >= 2000) {
        await batchCreateMany('contents', contentBatch, 2000);
        contentBatch.length = 0;
      }
    }
  }

  if (userBatch.length) await batchCreateMany('users', userBatch);
  if (contentBatch.length) await batchCreateMany('contents', contentBatch);
  console.log(`Inserted ${userIdx} users and ${contentIdx} contents.`);

  // 4. 初始化冗余计数器
  console.log('Initializing counters...');
  await prisma.$executeRawUnsafe(`
    UPDATE customers c
    SET user_count = (SELECT COUNT(*) FROM users u WHERE u.customer_id = c.id),
        content_count = (SELECT COUNT(*) FROM contents ct WHERE ct.customer_id = c.id)
  `);
  console.log('Counters initialized.');

  // 5. 汇总输出
  const stats = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*) FROM customers) AS customer_count,
      (SELECT COUNT(*) FROM users) AS user_count,
      (SELECT COUNT(*) FROM contents) AS content_count
  `;
  console.log('Final stats:', stats[0]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
