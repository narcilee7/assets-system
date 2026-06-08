import { Module } from '@nestjs/common';
import { OrderModule } from './modules/order/order.module';

@Module({
  imports: [OrderModule],
})
export class AppModule {}
