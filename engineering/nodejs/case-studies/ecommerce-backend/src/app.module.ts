import { Module } from '@nestjs/common';
import { OrderModule } from './modules/order/order.module';
import { ProductModule } from './modules/product/product.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [UserModule, ProductModule, OrderModule],
})
export class AppModule {}
