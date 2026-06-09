import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';

@Injectable()
export class OrderRepository {
  private orders: Map<string, OrderResponseDto> = new Map();
  private id = 0;

  async create(dto: CreateOrderDto): Promise<OrderResponseDto> {
    const order = { id: String(++this.id), ...dto, createdAt: new Date() };
    this.orders.set(order.id, order);
    return order;
  }

  async findById(id: string): Promise<OrderResponseDto | undefined> {
    return this.orders.get(id);
  }
}
