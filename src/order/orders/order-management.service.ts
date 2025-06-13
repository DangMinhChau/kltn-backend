import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrdersService } from './orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ShippingService } from '../shippings/shipping.service';
import { OrderPaymentService } from './order-payment.service';
import { NotificationsService } from '../../notification/notifications/notifications.service';
import { CreateShippingDto } from '../shippings/dto/create-shipping.dto';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { OrderStatus } from 'src/common/constants/order-status.enum';
import { PaymentStatus } from 'src/common/constants/payment-status.enum';
import { ShippingStatus } from 'src/common/constants/shipping-status.enum';
import { PaymentMethod } from 'src/common/constants/payment-method.enum';
import { Order } from './entities/order.entity';

@Injectable()
export class OrderManagementService {
  private readonly logger = new Logger(OrderManagementService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly shippingService: ShippingService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Tạo đơn hàng hoàn chỉnh với payment và shipping
   */
  async createCompleteOrder(completeOrderDto: CompleteOrderDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Tạo order với payment
      const { shippingInfo, paymentMethod, paymentReturnUrl, ...orderData } =
        completeOrderDto;

      const orderPaymentResult =
        await this.orderPaymentService.createOrderWithPayment({
          ...orderData,
          paymentMethod,
          paymentReturnUrl,
        }); // 2. Tạo shipping information với GHN integration
      const createShippingDto: CreateShippingDto = {
        orderId: orderPaymentResult.order.id,
        recipientName: shippingInfo.recipientName,
        recipientPhone: shippingInfo.phoneNumber,
        address: shippingInfo.streetAddress,
        ward: shippingInfo.ward,
        district: shippingInfo.district,
        province: shippingInfo.province,
        wardCode: shippingInfo.wardCode,
        districtId: shippingInfo.districtId,
        provinceId: shippingInfo.provinceId,
        shippingMethod: shippingInfo.shippingMethod,
        shippingFee: shippingInfo.shippingFee,
        note: shippingInfo.note,
      };

      // Use GHN integration for shipping creation
      const shipping = await this.shippingService.createWithGHN(
        createShippingDto,
        orderPaymentResult.order,
      );

      await queryRunner.commitTransaction();

      return {
        order: orderPaymentResult.order,
        shipping,
        paymentUrl: orderPaymentResult.paymentUrl,
        paymentId: orderPaymentResult.paymentId,
        message: orderPaymentResult.message,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to create complete order:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  /**
   * Lấy thông tin đơn hàng đầy đủ
   */
  async getOrderDetails(orderId: string) {
    try {
      const order = await this.ordersService.findOne(orderId);

      // Get related data in parallel for better performance
      const [shipping, payments] = await Promise.allSettled([
        this.shippingService.findByOrderId(orderId).catch(() => null),
        this.paymentsService.findByOrderId(orderId).catch(() => null),
      ]);

      return {
        ...order,
        shipping: shipping.status === 'fulfilled' ? shipping.value : null,
        payment: payments.status === 'fulfilled' ? payments.value : null,
      };
    } catch (error) {
      this.logger.error(`Failed to get order details for ${orderId}:`, error);
      throw error;
    }
  }
  /**
   * Cập nhật trạng thái đơn hàng với business logic và notifications
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    notes?: string,
  ) {
    try {
      // Get current order first
      const order = await this.ordersService.findOne(orderId);

      // Validate status transition
      if (!this.canTransitionToStatus(order.status, status)) {
        throw new BadRequestException(
          `Cannot transition from ${order.status} to ${status}`,
        );
      }

      // Delegate core update to OrdersService
      const updatedOrder = await this.ordersService.updateStatus(
        orderId,
        status,
        notes,
      );

      // Handle business logic based on status
      await this.handleStatusChange(updatedOrder, status); // Send notifications
      try {
        await this.notificationsService.notifyOrderStatusChange(
          updatedOrder.user.id,
          updatedOrder,
        );
      } catch (notificationError) {
        this.logger.error(
          'Failed to send order status notification:',
          notificationError,
        );
        // Don't fail the entire operation for notification errors
      }

      return updatedOrder;
    } catch (error) {
      this.logger.error(`Failed to update order status for ${orderId}:`, error);
      throw error;
    }
  } /**
   * Handle business logic when order status changes
   */
  private async handleStatusChange(order: Order, newStatus: OrderStatus) {
    switch (newStatus) {
      case OrderStatus.PROCESSING:
        await this.handleProcessingStatus(order);
        break;
      case OrderStatus.COMPLETED:
        await this.handleCompletedStatus(order);
        break;
      case OrderStatus.CANCELLED:
        await this.handleCancelledStatus(order);
        break;
      default:
        // No special handling needed for other statuses
        break;
    }
  }

  /**
   * Kiểm tra có thể chuyển trạng thái không
   */
  private canTransitionToStatus(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): boolean {
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [], // Không thể chuyển từ completed
      [OrderStatus.CANCELLED]: [], // Không thể chuyển từ cancelled
    };

    return allowedTransitions[currentStatus]?.includes(newStatus) || false;
  }
  /**
   * Xử lý khi đơn hàng chuyển sang processing
   */
  private async handleProcessingStatus(order: Order) {
    try {
      // Get payment info
      const payment = await this.paymentsService
        .findByOrderId(order.id)
        .catch(() => null);

      // Kiểm tra thanh toán nếu không phải COD
      if (
        payment?.method !== PaymentMethod.COD &&
        payment?.status !== PaymentStatus.PAID
      ) {
        throw new ConflictException('Order must be paid before processing');
      }

      // Cập nhật shipping status if exists
      const shipping = await this.shippingService
        .findByOrderId(order.id)
        .catch(() => null);
      if (shipping) {
        await this.shippingService.updateStatus(
          shipping.id,
          ShippingStatus.PENDING,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling processing status for order ${order.id}:`,
        error,
      );
      throw error;
    }
  }
  /**
   * Xử lý khi đơn hàng hoàn thành
   */
  private async handleCompletedStatus(order: Order) {
    try {
      // Update completion timestamp through OrdersService
      await this.ordersService.updateCompletionTimestamp(order.id);

      // Cập nhật shipping status
      const shipping = await this.shippingService
        .findByOrderId(order.id)
        .catch(() => null);
      if (shipping) {
        await this.shippingService.updateStatus(
          shipping.id,
          ShippingStatus.DELIVERED,
        );
      }

      // Xử lý thanh toán COD
      const payment = await this.paymentsService
        .findByOrderId(order.id)
        .catch(() => null);
      if (
        payment?.method === PaymentMethod.COD &&
        payment?.status === PaymentStatus.UNPAID
      ) {
        await this.paymentsService.update(payment.id, {
          status: PaymentStatus.PAID,
          transactionId: `COD-${order.orderNumber}`,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error handling completed status for order ${order.id}:`,
        error,
      );
      throw error;
    }
  }
  /**
   * Xử lý khi đơn hàng bị hủy
   */
  private async handleCancelledStatus(order: Order) {
    try {
      // Update cancellation timestamp
      await this.ordersService.updateCancellationTimestamp(order.id);

      // Hủy shipping
      const shipping = await this.shippingService
        .findByOrderId(order.id)
        .catch(() => null);
      if (shipping) {
        await this.shippingService.updateStatus(
          shipping.id,
          ShippingStatus.CANCELLED,
        );
      }

      // Xử lý refund nếu đã thanh toán
      const payment = await this.paymentsService
        .findByOrderId(order.id)
        .catch(() => null);
      if (payment?.status === PaymentStatus.PAID) {
        // Logic refund sẽ được implement riêng
        this.logger.log(`Refund needed for order ${order.orderNumber}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling cancelled status for order ${order.id}:`,
        error,
      );
      throw error;
    }
  }
  /**
   * Lấy summary thống kê orders - delegated to OrdersService
   */
  async getOrdersSummary() {
    try {
      // Use OrdersService for data access instead of direct repository
      // Call without pagination params to get Order[] directly
      const [
        allOrders,
        pendingOrders,
        processingOrders,
        completedOrders,
        cancelledOrders,
      ] = await Promise.all([
        this.ordersService.findAll(),
        this.ordersService.findAll(undefined, OrderStatus.PENDING),
        this.ordersService.findAll(undefined, OrderStatus.PROCESSING),
        this.ordersService.findAll(undefined, OrderStatus.COMPLETED),
        this.ordersService.findAll(undefined, OrderStatus.CANCELLED),
      ]);

      // Type assertion since we know findAll without pagination returns Order[]
      const allOrdersArray = allOrders as Order[];
      const pendingOrdersArray = pendingOrders as Order[];
      const processingOrdersArray = processingOrders as Order[];
      const completedOrdersArray = completedOrders as Order[];
      const cancelledOrdersArray = cancelledOrders as Order[];

      return {
        totalOrders: allOrdersArray.length,
        pendingOrders: pendingOrdersArray.length,
        processingOrders: processingOrdersArray.length,
        completedOrders: completedOrdersArray.length,
        cancelledOrders: cancelledOrdersArray.length,
      };
    } catch (error) {
      this.logger.error('Failed to get orders summary:', error);
      throw error;
    }
  }
  /**
   * Lấy đơn hàng của user với phân trang và filter - delegated to OrdersService
   */
  async getUserOrders(
    userId: string,
    options: {
      status?: OrderStatus;
      page?: number;
      limit?: number;
    } = {},
  ) {
    try {
      const { status, page = 1, limit = 10 } = options;

      // Delegate to OrdersService with pagination
      const result = await this.ordersService.findAll(
        userId,
        status,
        page,
        limit,
      );

      // When pagination params are provided, result will be the paginated format
      return result;
    } catch (error) {
      this.logger.error(`Failed to get user orders for ${userId}:`, error);
      throw error;
    }
  }
}
