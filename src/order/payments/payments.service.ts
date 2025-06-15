import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../../notification/notifications/notifications.service';
import { MailService } from '../../common/services/mail/mail.service';
import { PaymentMethod } from 'src/common/constants/payment-method.enum';
import { PaymentStatus } from 'src/common/constants/payment-status.enum';
import {
  VNPayCreatePaymentResponse,
  VNPayCallbackDto,
} from './dto/payment-gateway.dto';
import { Order } from '../orders/entities/order.entity';
import * as crypto from 'crypto';

// Define querystring replacement with properly typed functions
const qs = {
  stringify: (
    obj: Record<string, string | number>,
    options?: { encode: boolean },
  ): string => {
    const encode = options?.encode !== false;
    return Object.keys(obj)
      .map((key) => {
        const value = obj[key];
        return `${key}=${encode ? encodeURIComponent(String(value)) : String(value)}`;
      })
      .join('&');
  },
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}
  async create(
    createPaymentDto: CreatePaymentDto,
  ): Promise<Payment | VNPayCreatePaymentResponse> {
    try {
      const order = await this.ordersService.findOne(createPaymentDto.orderId);

      // Check if order is already paid
      if (order.isPaid) {
        throw new ConflictException('Order has already been paid');
      }

      // Check if active payment already exists for this order
      const existingPayment = await this.paymentRepository.findOne({
        where: {
          order: { id: order.id },
          status: PaymentStatus.PENDING,
        },
      });

      if (existingPayment) {
        // Cancel existing pending payment before creating new one
        existingPayment.status = PaymentStatus.CANCELLED;
        existingPayment.note = 'Cancelled due to new payment creation';
        await this.paymentRepository.save(existingPayment);
      }

      const payment = this.paymentRepository.create({
        order,
        method: createPaymentDto.method,
        amount: createPaymentDto.amount,
        note: createPaymentDto.note,
        status: PaymentStatus.PENDING,
      });

      const savedPayment = await this.paymentRepository.save(payment);

      // Handle different payment methods
      switch (createPaymentDto.method) {
        case PaymentMethod.VNPAY:
          return await this.createVNPayPayment(savedPayment, createPaymentDto);
        case PaymentMethod.COD:
        case PaymentMethod.CREDIT_CARD:
          // For COD and CREDIT_CARD, set status to unpaid and return payment
          savedPayment.status = PaymentStatus.UNPAID;
          await this.paymentRepository.save(savedPayment);
          return savedPayment;
        default:
          throw new BadRequestException('Unsupported payment method');
      }
    } catch (error) {
      this.logger.error('Failed to create payment:', error);
      throw error;
    }
  }
  async createVNPayPayment(
    payment: Payment,
    createPaymentDto: CreatePaymentDto,
  ): Promise<VNPayCreatePaymentResponse> {
    const vnpUrl = this.configService.get<string>('VNPAY_URL');
    const vnpTmnCode = this.configService.get<string>('VNPAY_TMN_CODE');
    const vnpHashSecret = this.configService.get<string>('VNPAY_HASH_SECRET');
    const vnpReturnUrl =
      createPaymentDto.returnUrl ||
      this.configService.get<string>('VNPAY_RETURN_URL');

    if (!vnpUrl || !vnpTmnCode || !vnpHashSecret || !vnpReturnUrl) {
      throw new BadRequestException('VNPAY configuration is incomplete');
    }

    const createDate = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z/, '');
    const orderId = payment.order.id;
    const amount = Math.round(payment.amount * 100); // VNPay requires amount in cents

    const vnpParams: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: vnpTmnCode,
      vnp_Amount: amount,
      vnp_CreateDate: createDate,
      vnp_CurrCode: 'VND',
      vnp_IpAddr: '127.0.0.1',
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Payment for order ${orderId}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: vnpReturnUrl,
      vnp_TxnRef: orderId,
    };

    // Sort params and create query string
    const sortedParams: Record<string, string | number> = {};
    Object.keys(vnpParams)
      .sort()
      .forEach((key) => {
        sortedParams[key] = vnpParams[key];
      });

    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', vnpHashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    vnpParams.vnp_SecureHash = signed;
    const paymentUrl =
      vnpUrl + '?' + qs.stringify(vnpParams, { encode: false });

    // Update payment with transaction reference
    await this.paymentRepository.update(payment.id, {
      transactionId: orderId,
    });

    return {
      paymentUrl,
      orderId,
      transactionId: orderId,
    };
  }
  async handleVNPayCallback(callbackData: VNPayCallbackDto): Promise<Payment> {
    this.logger.log('Processing VNPay callback');
    this.logger.debug(JSON.stringify(callbackData));

    const vnpHashSecret = this.configService.get<string>('VNPAY_HASH_SECRET');

    if (!vnpHashSecret) {
      this.logger.error('VNPAY_HASH_SECRET is not configured');
      throw new BadRequestException('Payment configuration error');
    }

    const secureHash = callbackData.vnp_SecureHash;

    // Remove hash from params for verification
    const paramsWithoutHash: Record<string, string> = {};
    Object.keys(callbackData).forEach((key) => {
      if (key !== 'vnp_SecureHash') {
        paramsWithoutHash[key] = callbackData[
          key as keyof VNPayCallbackDto
        ] as string;
      }
    });

    // Sort params and create signature
    const sortedParams: Record<string, string> = {};
    Object.keys(paramsWithoutHash)
      .sort()
      .forEach((key) => {
        sortedParams[key] = paramsWithoutHash[key];
      });

    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', vnpHashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (signed !== secureHash) {
      this.logger.error('Invalid VNPay signature');
      throw new BadRequestException('Invalid signature');
    }

    const orderId = callbackData.vnp_TxnRef;
    const payment = await this.paymentRepository.findOne({
      where: { order: { id: orderId } },
      relations: ['order'],
    });

    if (!payment) {
      this.logger.error(`Payment not found for order ID: ${orderId}`);
      throw new NotFoundException('Payment not found');
    }

    const isPaid = callbackData.vnp_ResponseCode === '00';
    const status = isPaid ? PaymentStatus.PAID : PaymentStatus.FAILED;

    this.logger.log(
      `Updating payment ${payment.id} for order ${orderId} to status: ${status}`,
    );

    await this.paymentRepository.update(payment.id, {
      status,
      transactionId: callbackData.vnp_TransactionNo,
      paidAt: isPaid ? new Date() : undefined,
    }); // Update the order's payment status
    if (isPaid) {
      this.logger.log(`Marking order ${orderId} as paid`);
      await this.ordersService.updatePaymentStatus(
        payment.order.id,
        true,
        new Date(),
      );
    }

    const updatedPayment = await this.paymentRepository.findOne({
      where: { id: payment.id },
      relations: ['order'],
    });

    if (!updatedPayment) {
      throw new NotFoundException('Updated payment not found');
    }
    return updatedPayment;
  }
  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Payment[];
    meta: { total: number; page: number; limit: number };
  }> {
    const [payments, total] = await this.paymentRepository.findAndCount({
      relations: ['order', 'order.user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: payments,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['order', 'order.user'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async findByOrderId(orderId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { order: { id: orderId } },
      relations: ['order', 'order.user'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async update(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<Payment> {
    const payment = await this.findOne(id);

    Object.assign(payment, updatePaymentDto);

    if (updatePaymentDto.status === PaymentStatus.PAID && !payment.paidAt) {
      payment.paidAt = new Date();
    }

    return await this.paymentRepository.save(payment);
  }

  async remove(id: string): Promise<void> {
    const payment = await this.findOne(id);
    await this.paymentRepository.remove(payment);
  }

  async refund(id: string, reason?: string): Promise<Payment> {
    const payment = await this.findOne(id);

    if (!payment.canBeRefunded()) {
      throw new BadRequestException('Payment cannot be refunded');
    }

    payment.status = PaymentStatus.REFUNDED;
    payment.note = reason ? `Refunded: ${reason}` : 'Refunded';

    return await this.paymentRepository.save(payment);
  }

  /**
   * Get payment history for an order
   * @param orderId Order ID to get payment history for
   * @returns Array of payment attempts and their statuses
   */
  async getPaymentHistory(orderId: string): Promise<{
    latest: Payment | null;
    history: Payment[];
  }> {
    // Ensure the order exists using OrdersService
    await this.ordersService.findOne(orderId);

    // Get all payments for this order (even soft-deleted ones)
    const payments = await this.paymentRepository.find({
      where: { order: { id: orderId } },
      withDeleted: true,
      order: { createdAt: 'DESC' },
      relations: ['order'],
    });

    const latest = payments.length > 0 ? payments[0] : null;

    return {
      latest,
      history: payments,
    };
  }

  /**
   * Cancel a pending payment
   * @param id Payment ID to cancel
   * @param reason Reason for cancellation
   * @returns Updated payment entity
   */
  async cancelPayment(id: string, reason?: string): Promise<Payment> {
    const payment = await this.findOne(id);

    // Only pending or unpaid payments can be cancelled
    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.UNPAID
    ) {
      throw new BadRequestException(
        `Payment with status ${payment.status} cannot be cancelled`,
      );
    }

    payment.status = PaymentStatus.CANCELLED;
    payment.note = reason ? `Cancelled: ${reason}` : 'Cancelled by user';

    return await this.paymentRepository.save(payment);
  }

  /**
   * Retry payment for an order (create a new payment for the same order)
   * @param orderId Order ID to retry payment for
   * @param createPaymentDto Payment details
   * @returns New payment entity or payment gateway response
   */ async retryPayment(
    orderId: string,
    createPaymentDto: CreatePaymentDto,
  ): Promise<Payment | VNPayCreatePaymentResponse> {
    try {
      // Validate order exists using OrdersService
      const order = await this.ordersService.findOne(orderId);

      // Find existing payments for this order
      const existingPayments = await this.paymentRepository.find({
        where: { order: { id: orderId } },
      });

      // Cancel any existing pending payments
      for (const payment of existingPayments) {
        if (
          payment.status === PaymentStatus.PENDING ||
          payment.status === PaymentStatus.UNPAID
        ) {
          payment.status = PaymentStatus.CANCELLED;
          payment.note = 'Cancelled due to payment retry';
          await this.paymentRepository.save(payment);
        }
      }

      // Create a new payment
      const payment = this.paymentRepository.create({
        order,
        method: createPaymentDto.method,
        amount: createPaymentDto.amount,
        note: `Retry payment. ${createPaymentDto.note || ''}`,
        status: PaymentStatus.PENDING,
      });

      const savedPayment = await this.paymentRepository.save(payment);

      // Process payment based on method
      switch (createPaymentDto.method) {
        case PaymentMethod.VNPAY:
          return await this.createVNPayPayment(savedPayment, createPaymentDto);
        case PaymentMethod.COD:
          return savedPayment;
        default:
          throw new BadRequestException('Unsupported payment method');
      }
    } catch (error) {
      this.logger.error(`Failed to retry payment for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Check and handle abandoned payments (payments that were initiated but never completed)
   * @param timeThresholdMinutes Minutes after which a payment is considered abandoned
   * @returns Number of abandoned payments handled
   */
  async handleAbandonedPayments(
    timeThresholdMinutes: number = 30,
  ): Promise<number> {
    this.logger.log(
      `Checking for abandoned payments older than ${timeThresholdMinutes} minutes`,
    );

    // Calculate the threshold date
    const thresholdDate = new Date();
    thresholdDate.setMinutes(thresholdDate.getMinutes() - timeThresholdMinutes);

    // Find pending or unpaid payments older than the threshold
    const abandonedPayments = await this.paymentRepository.find({
      where: [
        { status: PaymentStatus.PENDING, createdAt: LessThan(thresholdDate) },
        { status: PaymentStatus.UNPAID, createdAt: LessThan(thresholdDate) },
      ],
      relations: ['order'],
    });

    this.logger.log(`Found ${abandonedPayments.length} abandoned payments`);

    // Mark each payment as cancelled
    let handled = 0;
    for (const payment of abandonedPayments) {
      try {
        payment.status = PaymentStatus.CANCELLED;
        payment.note = `Cancelled automatically: Payment abandoned for more than ${timeThresholdMinutes} minutes`;
        await this.paymentRepository.save(payment);
        handled++;
      } catch (error) {
        this.logger.error(
          `Failed to cancel abandoned payment ${payment.id}:`,
          error,
        );
      }
    }

    this.logger.log(`Successfully handled ${handled} abandoned payments`);
    return handled;
  }

  /**
   * Process payment callbacks from various payment gateways
   * @param gateway The payment gateway (vnpay, momo)
   * @param callbackData Data received from the payment gateway
   * @returns Object with success status, message, and payment details
   */
  async processPaymentCallback(
    gateway: string,
    callbackData: any,
  ): Promise<{ success: boolean; message: string; payment?: Payment }> {
    this.logger.log(`Processing ${gateway} callback`);
    this.logger.debug(JSON.stringify(callbackData));

    try {
      let payment: Payment; // Handle different payment gateways
      switch (gateway.toLowerCase()) {
        case 'vnpay':
          payment = await this.handleVNPayCallback(
            callbackData as VNPayCallbackDto,
          );
          break;
        default:
          throw new BadRequestException(
            `Unsupported payment gateway: ${gateway}`,
          );
      } // Update order status if payment was successful
      if (payment.status === PaymentStatus.PAID) {
        await this.ordersService.updatePaymentStatus(
          payment.order.id,
          true,
          payment.paidAt,
        );

        return {
          success: true,
          message: 'Payment processed successfully',
          payment,
        };
      } else {
        return {
          success: false,
          message: 'Payment failed or was declined',
          payment,
        };
      }
    } catch (error: unknown) {
      this.logger.error(`Error processing ${gateway} callback:`, error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An error occurred while processing the payment';

      return {
        success: false,
        message: errorMessage,
      };
    }
  } /**
   * Send payment success notifications (both email and in-app)
   * @param order Order that was paid
   */
  private async sendPaymentSuccessNotifications(order: Order): Promise<void> {
    try {
      // Send in-app notification
      await this.notificationsService.notifyPaymentStatusChange(
        order.user.id,
        order.id,
        order.orderNumber,
        PaymentStatus.PAID,
      );

      // Send email notification
      await this.mailService.sendOrderStatusUpdateEmail(order.user.email, {
        orderNumber: order.orderNumber,
        customerName: order.user.fullName,
        status: 'paid',
        trackingNumber: order.shipping?.trackingNumber,
      });

      this.logger.log(
        `Payment success notifications sent for order ${order.id}`,
      );
    } catch (error) {
      this.logger.error('Failed to send payment notifications:', error);
      // Don't throw error to prevent notification failure from affecting payment flow
    }
  }
}
