import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderService {
  async placeOrder(userId: string, dto: { productId: string; quantity: number }) {
    // Simplified for case study; full version uses Prisma transaction
    return {
      id: 'order-1',
      userId,
      productId: dto.productId,
      quantity: dto.quantity,
      status: 'PENDING',
      createdAt: new Date(),
    };
  }

  async confirmPayment(orderId: string, paymentId: string) {
    return {
      id: orderId,
      status: 'PAID',
      paymentId,
      updatedAt: new Date(),
    };
  }
}
