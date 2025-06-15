import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../../notification/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order]),
    forwardRef(() => OrdersModule),
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
