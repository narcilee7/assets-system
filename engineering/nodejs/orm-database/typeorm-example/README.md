# TypeORM Repository Pattern

TypeORM 是 OOP 导向的 ORM，适合喜欢装饰器和 Active Record / Data Mapper 模式的团队。

## 核心实现

### 1. Entity 定义

```ts
// entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 19, scale: 4, default: 0 })
  balance: number;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

```ts
// entities/order.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['PENDING', 'PAID', 'CANCELLED'], default: 'PENDING' })
  status: string;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  amount: number;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;
}
```

### 2. DataSource 配置

```ts
// data-source.ts
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Order } from './entities/order.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false, // 生产环境关闭
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Order],
  migrations: ['dist/migrations/*.js'],
});
```

### 3. Repository 模式

```ts
// repositories/order.repository.ts
import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Order } from '../entities/order.entity';

export class OrderRepository {
  private repo: Repository<Order> = AppDataSource.getRepository(Order);

  async create(data: Partial<Order>): Promise<Order> {
    const order = this.repo.create(data);
    return this.repo.save(order);
  }

  async findByUser(userId: string): Promise<Order[]> {
    return this.repo.find({ where: { userId }, relations: ['user'] });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.repo.update(id, { status });
  }
}
```

### 4. 事务管理

```ts
// services/payment.service.ts
import { AppDataSource } from '../data-source';

export async function processPayment(userId: string, orderId: string) {
  return AppDataSource.transaction(async (manager) => {
    const userRepo = manager.getRepository(User);
    const orderRepo = manager.getRepository(Order);

    const order = await orderRepo.findOne({ where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
    if (!order || order.status !== 'PENDING') throw new Error('Invalid order');

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user || user.balance < order.amount) throw new Error('Insufficient balance');

    user.balance -= order.amount;
    order.status = 'PAID';

    await manager.save([user, order]);
    return order;
  });
}
```

## Prisma vs TypeORM

| 维度 | Prisma | TypeORM |
| --- | --- | --- |
| 类型推导 | 自动生成、极致 | 装饰器推断、一般 |
| 迁移 | 原生支持、体验好 | 需 typeorm-cli |
| 查询 API | 声明式 | QueryBuilder + Repository |
| 生态活跃度 | 高 | 维护减缓 |
| 学习成本 | 中 | 高（装饰器、DataSource） |

> 新项目优先 Prisma；已有大量 TypeORM 实体和复杂 QueryBuilder 的项目迁移成本较高。
