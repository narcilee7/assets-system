import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

export async function placeOrder(userId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const newBalance = user.balance.toNumber() - amount;
    if (newBalance < 0) throw new Error('Insufficient balance');

    const [updatedUser, order] = await Promise.all([
      tx.user.update({
        where: { id: userId },
        data: { balance: newBalance },
      }),
      tx.order.create({
        data: { userId, amount, status: 'PAID' },
      }),
    ]);

    return { user: updatedUser, order };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5000,
    timeout: 10000,
  });
}
