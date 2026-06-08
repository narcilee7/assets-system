import { db } from './db';

export async function placeOrder(userId: string, amount: number) {
  return db.transaction(async (trx) => {
    const user = await trx('users').where({ id: userId }).forUpdate().first();
    if (!user) throw new Error('User not found');

    const newBalance = Number(user.balance) - amount;
    if (newBalance < 0) throw new Error('Insufficient balance');

    await trx('users').where({ id: userId }).update({ balance: newBalance });
    const [order] = await trx('orders')
      .insert({ userId, amount, status: 'PAID' })
      .returning('*');

    return order;
  });
}
