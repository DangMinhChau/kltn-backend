import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { PaymentMethod } from 'src/common/constants/payment-method.enum';
import { OrderStatus } from 'src/common/constants/order-status.enum';
import { PaymentStatus } from 'src/common/constants/payment-status.enum';

export interface CreateOrderWithPaymentDto extends CreateOrderDto {
  paymentMethod: PaymentMethod;
  paymentReturnUrl?: string;
}

export interface OrderPaymentResult {
  order: Order;
  paymentUrl?: string;
  qrCode?: string;
  paymentId?: string;
  message: string;
}

@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Tạo đơn hàng kết hợp với thanh toán
   * @param createOrderWithPaymentDto Thông tin đơn hàng và thanh toán
   * @returns Kết quả tạo đơn hàng và thanh toán
   */
  async createOrderWithPayment(
    createOrderWithPaymentDto: CreateOrderWithPaymentDto,
  ): Promise<OrderPaymentResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(
        `Creating order with payment method: ${createOrderWithPaymentDto.paymentMethod}`,
      ); // 1. Tạo đơn hàng
      const { paymentMethod, paymentReturnUrl, ...orderData } =
        createOrderWithPaymentDto;

      const orderResult = await this.ordersService.create(orderData);
      const order = orderResult.order;

      // 2. Tạo thanh toán tương ứng
      const createPaymentDto: CreatePaymentDto = {
        orderId: order.id,
        method: paymentMethod,
        amount: order.totalPrice,
        returnUrl: paymentReturnUrl,
        note: `Payment for order ${order.orderNumber}`,
      };

      const paymentResult = await this.paymentsService.create(createPaymentDto);

      await queryRunner.commitTransaction();

      // 3. Xử lý kết quả dựa trên phương thức thanh toán
      if (paymentMethod === PaymentMethod.COD) {
        return {
          order,
          message:
            'Order created successfully. Payment will be collected on delivery.',
          paymentId: undefined,
        };
      } else if ('paymentUrl' in paymentResult) {
        // VNPay
        return {
          order,
          paymentUrl: paymentResult.paymentUrl,
          paymentId: paymentResult.transactionId,
          message:
            'Order created successfully. Please complete payment via VNPay.',
        };
      } else {
        // Fallback
        return {
          order,
          message: 'Order and payment created successfully.',
          paymentId: undefined,
        };
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create order with payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  /**
   * Kiểm tra trạng thái thanh toán và cập nhật đơn hàng
   * @param orderId ID đơn hàng
   * @returns Trạng thái hiện tại của đơn hàng và thanh toán
   */
  async checkOrderPaymentStatus(orderId: string): Promise<{
    order: Order;
    paymentStatus: PaymentStatus;
    message: string;
    canRetryPayment: boolean;
  }> {
    try {
      const order = await this.ordersService.findOne(orderId);

      const paymentHistory =
        await this.paymentsService.getPaymentHistory(orderId);
      const latestPayment = paymentHistory.latest;

      if (!latestPayment) {
        return {
          order,
          paymentStatus: PaymentStatus.UNPAID,
          message: 'No payment found for this order',
          canRetryPayment: true,
        };
      }

      const canRetryPayment =
        latestPayment.status === PaymentStatus.FAILED ||
        latestPayment.status === PaymentStatus.CANCELLED ||
        (latestPayment.status === PaymentStatus.PENDING &&
          new Date().getTime() - new Date(latestPayment.createdAt).getTime() >
            30 * 60 * 1000); // 30 minutes

      let message = '';
      switch (latestPayment.status) {
        case PaymentStatus.PAID:
          message = 'Payment completed successfully';
          break;
        case PaymentStatus.PENDING:
          message = 'Payment is being processed';
          break;
        case PaymentStatus.FAILED:
          message = 'Payment failed. You can retry payment.';
          break;
        case PaymentStatus.CANCELLED:
          message = 'Payment was cancelled. You can retry payment.';
          break;
        default:
          message = 'Payment status unknown';
      }

      return {
        order,
        paymentStatus: latestPayment.status,
        message,
        canRetryPayment,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check payment status for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }
  /**
   * Thử lại thanh toán cho đơn hàng
   * @param orderId ID đơn hàng
   * @param paymentMethod Phương thức thanh toán mới
   * @param returnUrl URL trả về sau thanh toán
   * @returns Kết quả thử lại thanh toán
   */
  async retryOrderPayment(
    orderId: string,
    paymentMethod: PaymentMethod,
    returnUrl?: string,
  ): Promise<{
    success: boolean;
    paymentUrl?: string;
    paymentId?: string;
    message: string;
  }> {
    try {
      const order = await this.ordersService.findOne(orderId);

      if (order.isPaid) {
        throw new BadRequestException('Order has already been paid');
      }

      const createPaymentDto: CreatePaymentDto = {
        orderId,
        method: paymentMethod,
        amount: order.totalPrice,
        returnUrl,
        note: `Retry payment for order ${order.orderNumber}`,
      };

      const paymentResult = await this.paymentsService.retryPayment(
        orderId,
        createPaymentDto,
      );

      if ('paymentUrl' in paymentResult) {
        // VNPay
        return {
          success: true,
          paymentUrl: paymentResult.paymentUrl,
          paymentId: paymentResult.transactionId,
          message:
            'Payment retry initiated. Please complete payment via VNPay.',
        };
      } else {
        // COD or other
        return {
          success: true,
          paymentId: undefined,
          message: 'Payment method updated successfully.',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to retry payment for order ${orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
  /**
   * Hủy đơn hàng và thanh toán
   * @param orderId ID đơn hàng
   * @param reason Lý do hủy
   * @returns Kết quả hủy đơn hàng
   */
  async cancelOrder(
    orderId: string,
    reason?: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.ordersService.findOne(orderId);

      if (order.status === OrderStatus.COMPLETED) {
        throw new BadRequestException('Cannot cancel completed order');
      }

      if (order.isPaid) {
        throw new BadRequestException(
          'Cannot cancel paid order. Please contact support for refund.',
        );
      }

      // Hủy đơn hàng
      await this.ordersService.cancelOrder(orderId, reason);

      // Hủy thanh toán nếu có
      try {
        const paymentHistory =
          await this.paymentsService.getPaymentHistory(orderId);
        if (
          paymentHistory.latest &&
          (paymentHistory.latest.status === PaymentStatus.PENDING ||
            paymentHistory.latest.status === PaymentStatus.UNPAID)
        ) {
          await this.paymentsService.cancelPayment(
            paymentHistory.latest.id,
            `Order cancelled: ${reason || 'No reason provided'}`,
          );
        }
      } catch (paymentError) {
        this.logger.warn(
          `Failed to cancel payment for order ${orderId}: ${paymentError instanceof Error ? paymentError.message : 'Unknown error'}`,
        );
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Order cancelled successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to cancel order ${orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  } /**
   * Lấy thống kê thanh toán
   * @param startDate Ngày bắt đầu
   * @param endDate Ngày kết thúc
   * @returns Thống kê thanh toán
   */
  async getPaymentStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    failedOrders: number;
    totalRevenue: number;
    paymentMethodStats: Record<PaymentMethod, number>;
  }> {
    try {
      this.logger.log(
        `Getting payment statistics for period: ${startDate?.toISOString() || 'all'} - ${endDate?.toISOString() || 'all'}`,
      );

      // Build base query for orders with their payments
      let orderQuery = this.dataSource
        .getRepository(Order)
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.payment', 'payment');

      // Apply date filters if provided
      if (startDate) {
        orderQuery = orderQuery.andWhere('order.orderedAt >= :startDate', {
          startDate,
        });
      }
      if (endDate) {
        orderQuery = orderQuery.andWhere('order.orderedAt <= :endDate', {
          endDate,
        });
      }

      const orders = await orderQuery.getMany();

      // Calculate statistics
      const totalOrders = orders.length;
      const paidOrders = orders.filter((order) => order.isPaid).length;
      const pendingOrders = orders.filter(
        (order) =>
          order.payment &&
          [PaymentStatus.PENDING, PaymentStatus.UNPAID].includes(
            order.payment.status,
          ),
      ).length;
      const failedOrders = orders.filter(
        (order) =>
          order.payment &&
          [PaymentStatus.FAILED, PaymentStatus.CANCELLED].includes(
            order.payment.status,
          ),
      ).length;

      // Calculate total revenue from paid orders
      const totalRevenue = orders
        .filter((order) => order.isPaid)
        .reduce((sum, order) => sum + Number(order.totalPrice), 0);

      // Calculate payment method statistics
      const paymentMethodStats: Record<PaymentMethod, number> = {
        [PaymentMethod.COD]: 0,
        [PaymentMethod.VNPAY]: 0,
        [PaymentMethod.CREDIT_CARD]: 0,
      };
      orders.forEach((order) => {
        if (order.payment && order.payment.method) {
          paymentMethodStats[order.payment.method] =
            (paymentMethodStats[order.payment.method] || 0) + 1;
        }
      });

      const result = {
        totalOrders,
        paidOrders,
        pendingOrders,
        failedOrders,
        totalRevenue,
        paymentMethodStats,
      };

      this.logger.log('Payment statistics calculated successfully', result);
      return result;
    } catch (error) {
      this.logger.error('Failed to get payment statistics:', error);
      throw error;
    }
  }
}
