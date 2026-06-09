import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderRepository } from './order.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';

@Injectable()
export class OrderService {
  constructor(private readonly repo: OrderRepository) {}

  async create(dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.repo.create(dto);
  }

  async findOne(id: string): Promise<OrderResponseDto> {
    const order = await this.repo.findById(id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }
}
