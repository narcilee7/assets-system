import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Order } from './entities/order.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Order],
  migrations: ['dist/migrations/*.js'],
});
