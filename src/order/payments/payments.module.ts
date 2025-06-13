import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { VNPayWebhookController } from './controllers/vnpay-webhook.controller';
import { WebhookMonitoringService } from './services/webhook-monitoring.service';
import { WebhookAlertService } from './services/webhook-alert.service';
import { WebhookDashboardController } from '../controllers/webhook-dashboard.controller';
import { WebhookCleanupService } from '../../common/services/webhook-cleanup.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../../notification/notifications/notifications.module';
import { MailModule } from '../../common/services/mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, WebhookEvent, Order]),
    forwardRef(() => OrdersModule),
    NotificationsModule,
    MailModule,
  ],
  controllers: [
    PaymentsController,
    VNPayWebhookController,
    WebhookDashboardController,
  ],
  providers: [
    PaymentsService,
    WebhookMonitoringService,
    WebhookAlertService,
    WebhookCleanupService,
  ],
  exports: [
    PaymentsService,
    WebhookMonitoringService,
    WebhookAlertService,
    WebhookCleanupService,
  ],
})
export class PaymentsModule {}
