import { db } from './db';

export async function getUserById(id: string) {
  return db('users').where({ id }).first();
}

export async function createUser(data: { email: string; name: string }) {
  const [user] = await db('users').insert(data).returning('*');
  return user;
}

export async function getUserWithOrders(userId: string) {
  const user = await db('users').where({ id: userId }).first();
  const orders = await db('orders').where({ userId });
  return { ...user, orders };
}

export async function getUserTotalSpent(userId: string) {
  const result = await db('orders')
    .where({ userId, status: 'PAID' })
    .sum('amount as total')
    .first();
  return result?.total || 0;
}
