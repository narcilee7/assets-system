# 集成测试

## 1. 数据库集成测试

```
数据库测试策略

策略 1：内存数据库（推荐用于单元+轻量集成）
├── SQLite :memory:（SQL 兼容时）
├── H2（Java）
├── 优点：快、隔离、无外部依赖
└── 缺点：可能与生产数据库行为不同

策略 2：Testcontainers（推荐用于真实集成）
├── Docker 容器运行真实数据库
├── 每个测试独立容器
├── 支持：Postgres、MySQL、MongoDB、Redis、Kafka...
└── 缺点：慢（秒级启动）、需要 Docker

策略 3：共享测试数据库
├── 团队共享一个测试数据库实例
├── 每个测试使用独立 schema/数据库
└── 缺点：环境维护、并发冲突风险

数据库测试原则
├── 每个测试独立：测试前清理、测试后清理
├── 使用事务回滚：测试后回滚，不污染数据
├── 避免测试顺序依赖
└── 数据准备用 Factory，不用 fixture 文件
```

```python
# pytest + Testcontainers
import pytest
from testcontainers.postgres import PostgresContainer
import psycopg2

@pytest.fixture(scope="module")
def postgres():
    with PostgresContainer("postgres:15") as postgres:
        yield postgres

@pytest.fixture
def db_conn(postgres):
    conn = psycopg2.connect(postgres.get_connection_url())
    yield conn
    conn.rollback()  # 回滚所有更改
    conn.close()

def test_create_user(db_conn):
    with db_conn.cursor() as cur:
        cur.execute("INSERT INTO users (name) VALUES ('Alice') RETURNING id")
        user_id = cur.fetchone()[0]

        cur.execute("SELECT name FROM users WHERE id = %s", (user_id,))
        result = cur.fetchone()

        assert result[0] == "Alice"
    # 事务回滚，数据库保持干净
```

```typescript
// Node.js + testcontainers
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

let container: PostgreSqlContainer;
let client: Client;

beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  client = new Client({ connectionString: container.getConnectionUri() });
  await client.connect();
});

afterAll(async () => {
  await client.end();
  await container.stop();
});

beforeEach(async () => {
  await client.query('BEGIN');
});

afterEach(async () => {
  await client.query('ROLLBACK');
});

test('creates user', async () => {
  const result = await client.query(
    'INSERT INTO users (name) VALUES ($1) RETURNING *',
    ['Alice']
  );
  expect(result.rows[0].name).toBe('Alice');
});
```

## 2. API 集成测试

```python
# Python Flask/FastAPI 集成测试
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_create_user():
    response = client.post("/users", json={"name": "Alice", "email": "alice@example.com"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alice"
    assert "id" in data

def test_get_user():
    # 先创建
    create_res = client.post("/users", json={"name": "Bob", "email": "bob@example.com"})
    user_id = create_res.json()["id"]

    # 再获取
    get_res = client.get(f"/users/{user_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Bob"
```

```typescript
// Node.js Supertest
import request from 'supertest';
import { app } from '../src/app';

describe('POST /users', () => {
  test('creates a user', async () => {
    const response = await request(app)
      .post('/users')
      .send({ name: 'Alice', email: 'alice@example.com' })
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(response.body.id).toBeDefined();
  });

  test('validates email', async () => {
    await request(app)
      .post('/users')
      .send({ name: 'Alice', email: 'invalid' })
      .expect(400);
  });
});
```

## 3. 契约测试（Contract Testing）

```
契约测试

问题：服务 A 调用服务 B，B 的 API 变更导致 A 故障

解决方案：
  消费者（Consumer）A 定义期望的契约
  提供者（Provider）B 验证满足契约

Pact 工作流程：
1. 消费者测试：Mock 提供者，定义交互契约
2. 生成契约文件（JSON）
3. 契约上传到 Pact Broker
4. 提供者测试： replay 契约验证
5. CI 中验证兼容性

        Consumer Test          Pact Broker         Provider Test
  A ─────▶ Mock Provider ──▶ 契约存储 ──────▶ 验证实际 API
           (生成 pact.json)   (版本管理)        (对比契约)
```

```typescript
// Pact Consumer Test（Jest）
import { Pact } from '@pact-foundation/pact';
import { UserAPI } from './user-api';

const provider = new Pact({
  consumer: 'FrontendApp',
  provider: 'UserService',
  port: 1234,
});

describe('UserService Contract', () => {
  beforeAll(() => provider.setup());
  afterEach(() => provider.verify());
  afterAll(() => provider.finalize());

  test('get user by id', async () => {
    await provider.addInteraction({
      state: 'user with id 1 exists',
      uponReceiving: 'a request for user 1',
      withRequest: {
        method: 'GET',
        path: '/users/1',
      },
      willRespondWith: {
        status: 200,
        body: {
          id: 1,
          name: 'Alice',
          email: 'alice@example.com',
        },
      },
    });

    const userApi = new UserAPI(provider.mockService.baseUrl);
    const user = await userApi.getUser(1);
    expect(user.name).toBe('Alice');
  });
});
```
