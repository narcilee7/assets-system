# Prisma Client Python

Prisma 是新一代类型安全 ORM，Python 客户端基于 Rust 引擎。

## 使用方式

```bash
# 安装
pip install prisma

# 初始化
prisma init

# 生成客户端
prisma generate
```

## Schema 定义

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-py"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  orders    Order[]
}

model Order {
  id     Int    @id @default(autoincrement())
  userId Int
  amount Float
  user   User   @relation(fields: [userId], references: [id])
}
```

## Python 使用

```python
from prisma import Prisma

prisma = Prisma()

async def main():
    await prisma.connect()
    
    # 创建
    user = await prisma.user.create({
        'data': {'email': 'alice@example.com', 'name': 'Alice'}
    })
    
    # 查询
    users = await prisma.user.find_many(where={'age': {'gte': 18}})
    
    # 关联查询
    user_with_orders = await prisma.user.find_unique(
        where={'id': 1},
        include={'orders': True}
    )
    
    await prisma.disconnect()

import asyncio
asyncio.run(main())
```

## 优势

- 类型安全：生成的代码带完整类型注解
- 自动迁移：`prisma migrate dev`
- 跨语言：Schema 可在 Node.js/Python/Go 间共享
