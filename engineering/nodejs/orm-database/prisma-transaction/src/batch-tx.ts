import { prisma } from './prisma';

export async function batchUpdateStatuses(orderIds: string[]) {
  const updates = orderIds.map((id) =>
    prisma.order.update({ where: { id }, data: { status: 'PAID' } })
  );
  return prisma.$transaction(updates);
}
