import { Controller, Post, Body, Param, Patch } from '@nestjs/common';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @Post()
  create(@Body() dto: { userId: string; productId: string; quantity: number }) {
    return this.service.placeOrder(dto.userId, dto);
  }

  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @Body() dto: { paymentId: string }) {
    return this.service.confirmPayment(id, dto.paymentId);
  }
}
